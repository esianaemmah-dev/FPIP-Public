"""Azure Function that receives Marketplace Metering Service usage events.

The Marketplace Metering Service calls this HTTPS endpoint with a JWT bearer
signed by Microsoft. We verify the signature against the well-known Microsoft
public key, accept the usage event, and emit the same event to the Azure
Marketplace Metering API on behalf of the managed app.

This function is only required if FPIP is sold with usage-based Marketplace
metering. For flat/BYOL pricing it can be removed.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any

import azure.functions as func
import jwt
import requests
from jwt import PyJWKClient

logger = logging.getLogger(__name__)

# Marketplace Metering Service well-known config.
MARKETPLACE_AUDIENCE = "20e940b3-4c77-4b0b-9a53-9e0a42678bdd"
MARKETPLACE_WELL_KNOWN = "https://login.microsoftonline.com/common/discovery/keys"
METERING_API = "https://marketplaceapi.microsoft.com/api/usageEvent"


def _get_token() -> str:
    """Get an Entra ID token for the Marketplace Metering API.

    Uses Managed Identity in production; falls back to environment variables for
    local testing only.
    """
    try:
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = credential.get_token("20e940b3-4c77-4b0b-9a53-9e0a42678bdd/.default")
        return token.token
    except Exception as exc:
        logger.warning("Managed Identity token acquisition failed: %s", exc)
        token = os.getenv("METERING_API_TOKEN")
        if not token:
            raise RuntimeError("No Managed Identity and no METERING_API_TOKEN env var") from exc
        return token


def _verify_jwt(token: str) -> dict[str, Any]:
    """Verify the incoming Marketplace JWT and return its payload."""
    jwks_client = PyJWKClient(MARKETPLACE_WELL_KNOWN)
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=MARKETPLACE_AUDIENCE,
        issuer="https://sts.windows.net/common/",
    )


def _emit_to_marketplace(event: dict[str, Any]) -> dict[str, Any]:
    """Forward the usage event to the Marketplace Metering API."""
    token = _get_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    resp = requests.post(METERING_API, headers=headers, json=event, timeout=30)
    resp.raise_for_status()
    return resp.json()


def main(req: func.HttpRequest) -> func.HttpResponse:
    logger.info("Received metering webhook request")

    auth_header = req.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return func.HttpResponse("Missing or invalid Authorization header", status_code=401)

    incoming_token = auth_header.split(" ", 1)[1]
    try:
        _verify_jwt(incoming_token)
    except Exception as exc:
        logger.warning("JWT verification failed: %s", exc)
        return func.HttpResponse("Unauthorized", status_code=401)

    try:
        body = req.get_json()
    except ValueError:
        return func.HttpResponse("Invalid JSON body", status_code=400)

    if not isinstance(body, dict):
        return func.HttpResponse("Expected a JSON object", status_code=400)

    required = {"resourceId", "quantity", "dimension", "effectiveStartTime", "planId"}
    missing = required - set(body.keys())
    if missing:
        return func.HttpResponse(f"Missing fields: {missing}", status_code=400)

    # Normalize effectiveStartTime to ISO 8601 with Z suffix.
    try:
        ts = datetime.fromisoformat(body["effectiveStartTime"].replace("Z", "+00:00"))
        body["effectiveStartTime"] = ts.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception as exc:
        logger.warning("Could not parse effectiveStartTime: %s", exc)
        return func.HttpResponse("Invalid effectiveStartTime", status_code=400)

    try:
        result = _emit_to_marketplace(body)
    except requests.exceptions.RequestException as exc:
        logger.error("Marketplace metering API call failed: %s", exc)
        return func.HttpResponse("Failed to emit usage event", status_code=502)
    except Exception as exc:
        logger.error("Unexpected error emitting usage event: %s", exc)
        return func.HttpResponse("Internal error", status_code=500)

    return func.HttpResponse(
        json.dumps(result),
        status_code=200,
        mimetype="application/json",
    )

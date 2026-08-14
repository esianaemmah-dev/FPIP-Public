"""Entra authentication and server-side authorization for the agent API."""
from __future__ import annotations

import hashlib
import os
import re
from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import HTTPException, Security, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.config import Config

_bearer = HTTPBearer(auto_error=False)
_ROLE_NAMES = {
    "admin",
    "executive",
    "procurement",
    "finance",
    "auditor",
    "supplier",
    "hod",
    "budget_owner",
    "contract_manager",
}
_AGENT_ROLES: dict[str, set[str]] = {
    "executive": {"admin", "executive", "auditor"},
    "procurement": {"admin", "executive", "procurement", "auditor"},
    "finance": {"admin", "executive", "finance", "auditor", "budget_owner"},
    "spend": {"admin", "executive", "finance", "auditor", "budget_owner"},
    "contract": {"admin", "executive", "procurement", "auditor", "contract_manager"},
    "compliance": {"admin", "procurement", "auditor"},
    "risk": {"admin", "executive", "procurement", "auditor"},
    "knowledge": _ROLE_NAMES - {"supplier"},
    "supplier": {"admin", "supplier"},
}
_SAFE_ID = re.compile(r"^[A-Za-z0-9._:-]{1,160}$")


@dataclass(frozen=True)
class Principal:
    subject: str
    username: str
    role: str
    supplier_id: str | None
    claims: dict[str, Any]

    def tool_context(self) -> dict[str, Any]:
        return {
            "subject": self.subject,
            "username": self.username,
            "role": self.role,
            "supplier_id": self.supplier_id,
        }


def _auth_disabled() -> bool:
    disabled = os.getenv("AUTH_DISABLED", "false").lower() == "true"
    if disabled and Config.APP_ENV == "production":
        raise RuntimeError("AUTH_DISABLED cannot be enabled in production")
    return disabled


def _role_from_claims(claims: dict[str, Any]) -> str | None:
    roles = claims.get("roles") or []
    if isinstance(roles, str):
        roles = [roles]
    for raw in roles:
        normalized = str(raw).lower().replace("fpip-", "").replace("fpip_", "")
        if normalized in _ROLE_NAMES:
            return normalized
    groups = claims.get("groups") or []
    if isinstance(groups, str):
        groups = [groups]
    for group_id in groups:
        mapped = Config.ENTRA_GROUP_ROLE_MAP.get(str(group_id))
        if mapped in _ROLE_NAMES:
            return mapped
    return None


def _principal_from_claims(claims: dict[str, Any]) -> Principal:
    subject = str(claims.get("oid") or claims.get("sub") or "")
    role = _role_from_claims(claims)
    if not subject or not role:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="FPIP role assignment required")
    supplier_id = claims.get(Config.SUPPLIER_ID_CLAIM)
    supplier_id = str(supplier_id) if supplier_id else None
    if role == "supplier" and not supplier_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supplier identity claim required")
    return Principal(
        subject=subject,
        username=str(claims.get("preferred_username") or claims.get("name") or subject),
        role=role,
        supplier_id=supplier_id,
        claims=claims,
    )


def _decode_token(token: str) -> dict[str, Any]:
    if not Config.AGENT_API_AUDIENCE or not Config.AGENT_API_TENANT_ID:
        raise RuntimeError("Agent API Entra audience and tenant ID must be configured")
    jwks = PyJWKClient(
        f"https://login.microsoftonline.com/{Config.AGENT_API_TENANT_ID}/discovery/v2.0/keys",
        cache_jwk_set=True,
        lifespan=3600,
    )
    key = jwks.get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        key.key,
        algorithms=["RS256"],
        audience=Config.AGENT_API_AUDIENCE,
        issuer=f"https://login.microsoftonline.com/{Config.AGENT_API_TENANT_ID}/v2.0",
        options={"require": ["exp", "iat", "sub"]},
    )


async def require_principal(
    credentials: HTTPAuthorizationCredentials | None = Security(_bearer),
) -> Principal:
    if _auth_disabled():
        return Principal(
            subject="local-developer",
            username="local-developer",
            role="admin",
            supplier_id=None,
            claims={},
        )
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bearer token required")
    try:
        return _principal_from_claims(_decode_token(credentials.credentials))
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc


def authorize_agent(principal: Principal, agent_id: str) -> None:
    if principal.role not in _AGENT_ROLES.get(agent_id, set()):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Agent access denied for this role")


def internal_thread_id(principal: Principal, external_thread_id: str) -> str:
    if not _SAFE_ID.fullmatch(external_thread_id):
        raise HTTPException(status_code=422, detail="Invalid thread ID")
    digest = hashlib.sha256(f"{principal.subject}:{external_thread_id}".encode()).hexdigest()
    return f"fpip-{digest}"

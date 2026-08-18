"""Configuration for the FPIP agent service.

Secrets are loaded from Azure Key Vault via Managed Identity in production.
For local development, set the same values as environment variables in
agent-service/.env (never commit .env).
"""
from __future__ import annotations

import os
import json
from typing import Any

from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
from dotenv import load_dotenv

load_dotenv()


def _secret_client() -> SecretClient | None:
    vault_url = os.getenv("AZURE_KEY_VAULT_URL")
    if not vault_url:
        return None
    credential = DefaultAzureCredential()
    return SecretClient(vault_url=vault_url, credential=credential)


_SECRET_CLIENT: SecretClient | None = _secret_client()


def _get_secret(name: str, env_fallback: str | None = None) -> str:
    """Fetch a secret from Key Vault or fall back to an environment variable."""
    if env_fallback and os.getenv(env_fallback):
        return os.getenv(env_fallback)  # type: ignore[return-value]
    if _SECRET_CLIENT is not None:
        try:
            return _SECRET_CLIENT.get_secret(name).value or ""
        except Exception as exc:  # pragma: no cover - KV may be unavailable locally
            raise RuntimeError(f"Failed to load secret '{name}' from Key Vault") from exc
    raise RuntimeError(
        f"Secret '{name}' not found. Set AZURE_KEY_VAULT_URL or the equivalent env var."
    )


def _get_optional(name: str, env_fallback: str | None = None) -> str | None:
    try:
        return _get_secret(name, env_fallback)
    except RuntimeError:
        return None


class Config:
    """Runtime configuration. All attributes are read-only after import."""

    # Dataverse service principal (FPIP-Agent-Service app registration)
    DATAVERSE_URL: str = _get_optional("dataverse-url", "DATAVERSE_URL") or ""
    DATAVERSE_TENANT_ID: str = _get_optional("dataverse-tenant-id", "DATAVERSE_TENANT_ID") or ""
    DATAVERSE_CLIENT_ID: str = _get_optional("dataverse-client-id", "DATAVERSE_CLIENT_ID") or ""
    DATAVERSE_CLIENT_SECRET: str = _get_optional(
        "dataverse-client-secret", "DATAVERSE_CLIENT_SECRET"
    ) or ""

    # Azure OpenAI
    AZURE_OPENAI_ENDPOINT: str = _get_optional(
        "azure-openai-endpoint", "AZURE_OPENAI_ENDPOINT"
    ) or ""
    AZURE_OPENAI_API_KEY: str | None = _get_optional(
        "azure-openai-api-key", "AZURE_OPENAI_API_KEY"
    )
    AZURE_OPENAI_DEPLOYMENT: str = _get_optional(
        "azure-openai-deployment-name", "AZURE_OPENAI_DEPLOYMENT"
    ) or ""
    AZURE_OPENAI_API_VERSION: str = os.getenv("AZURE_OPENAI_API_VERSION", "2024-06-01")

    # Azure AI Search
    AZURE_SEARCH_ENDPOINT: str = _get_optional(
        "azure-search-endpoint", "AZURE_SEARCH_ENDPOINT"
    ) or ""
    AZURE_SEARCH_KEY: str | None = _get_optional("azure-search-key", "AZURE_SEARCH_KEY")

    # Microsoft Fabric SQL analytics endpoint
    FABRIC_CONNECTION_STRING: str | None = _get_optional(
        "fabric-connection-string", "FABRIC_CONNECTION_STRING"
    )

    # LangGraph checkpointer: Cosmos DB preferred, fallback to in-memory for local dev
    COSMOS_DB_CONNECTION_STRING: str | None = _get_optional(
        "cosmos-db-connection-string", "COSMOS_DB_CONNECTION_STRING"
    )
    COSMOS_DB_DATABASE: str = os.getenv("COSMOS_DB_DATABASE", "fpip-agent-checkpoints")

    # FastAPI
    APP_ENV: str = os.getenv("APP_ENV", "development").lower()
    PORT: int = int(os.getenv("PORT", "8000"))
    DEPLOYMENT_REGION: str = os.getenv("DEPLOYMENT_REGION", "local")
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))
    RATE_LIMIT_WINDOW_SECONDS: float = float(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    AUDIT_SIGNING_KEY: str = _get_optional("audit-signing-key", "AUDIT_SIGNING_KEY") or ""
    AUDIT_IMMUTABLE_STORAGE_URL: str = os.getenv("AUDIT_IMMUTABLE_STORAGE_URL", "")
    COMPLIANCE_PROVIDER_URL: str = os.getenv("COMPLIANCE_PROVIDER_URL", "")
    VENDOR_RISK_PROVIDER_URL: str = os.getenv("VENDOR_RISK_PROVIDER_URL", "")
    DEPLOYMENT_REGION: str = os.getenv("DEPLOYMENT_REGION", "local")
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))
    RATE_LIMIT_WINDOW_SECONDS: float = float(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    AUDIT_SIGNING_KEY: str = _get_optional("audit-signing-key", "AUDIT_SIGNING_KEY") or ""
    AUDIT_IMMUTABLE_STORAGE_URL: str = os.getenv("AUDIT_IMMUTABLE_STORAGE_URL", "")
    COMPLIANCE_PROVIDER_URL: str = os.getenv("COMPLIANCE_PROVIDER_URL", "")
    VENDOR_RISK_PROVIDER_URL: str = os.getenv("VENDOR_RISK_PROVIDER_URL", "")
    DEPLOYMENT_REGION: str = os.getenv("DEPLOYMENT_REGION", "local")
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))
    RATE_LIMIT_WINDOW_SECONDS: float = float(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    AUDIT_SIGNING_KEY: str = _get_optional("audit-signing-key", "AUDIT_SIGNING_KEY") or ""
    AUDIT_IMMUTABLE_STORAGE_URL: str = os.getenv("AUDIT_IMMUTABLE_STORAGE_URL", "")
    COMPLIANCE_PROVIDER_URL: str = os.getenv("COMPLIANCE_PROVIDER_URL", "")
    VENDOR_RISK_PROVIDER_URL: str = os.getenv("VENDOR_RISK_PROVIDER_URL", "")
    DEPLOYMENT_REGION: str = os.getenv("DEPLOYMENT_REGION", "local")
    RATE_LIMIT_REQUESTS: int = int(os.getenv("RATE_LIMIT_REQUESTS", "120"))
    RATE_LIMIT_WINDOW_SECONDS: float = float(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))
    AUDIT_SIGNING_KEY: str = _get_optional("audit-signing-key", "AUDIT_SIGNING_KEY") or ""
    AUDIT_IMMUTABLE_STORAGE_URL: str = os.getenv("AUDIT_IMMUTABLE_STORAGE_URL", "")
    COMPLIANCE_PROVIDER_URL: str = os.getenv("COMPLIANCE_PROVIDER_URL", "")
    VENDOR_RISK_PROVIDER_URL: str = os.getenv("VENDOR_RISK_PROVIDER_URL", "")
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
        if origin.strip()
    ]
    AGENT_API_TENANT_ID: str = os.getenv("AGENT_API_TENANT_ID", "")
    AGENT_API_AUDIENCE: str = os.getenv("AGENT_API_AUDIENCE", "")
    SUPPLIER_ID_CLAIM: str = os.getenv("SUPPLIER_ID_CLAIM", "extension_supplierId")
    try:
        ENTRA_GROUP_ROLE_MAP: dict[str, str] = json.loads(os.getenv("ENTRA_GROUP_ROLE_MAP", "{}"))
    except json.JSONDecodeError:
        ENTRA_GROUP_ROLE_MAP = {}

    @classmethod
    def as_dict(cls) -> dict[str, Any]:
        return {
            k: v
            for k, v in cls.__dict__.items()
            if not k.startswith("_") and not callable(v)
        }

    @classmethod
    def validate(cls) -> None:
        """Validate that required configuration is present."""
        required = {
            "DATAVERSE_URL": cls.DATAVERSE_URL,
            "DATAVERSE_TENANT_ID": cls.DATAVERSE_TENANT_ID,
            "DATAVERSE_CLIENT_ID": cls.DATAVERSE_CLIENT_ID,
            "DATAVERSE_CLIENT_SECRET": cls.DATAVERSE_CLIENT_SECRET,
            "AZURE_OPENAI_ENDPOINT": cls.AZURE_OPENAI_ENDPOINT,
            "AZURE_OPENAI_DEPLOYMENT": cls.AZURE_OPENAI_DEPLOYMENT,
            "AZURE_SEARCH_ENDPOINT": cls.AZURE_SEARCH_ENDPOINT,
            "AGENT_API_TENANT_ID": cls.AGENT_API_TENANT_ID,
            "AGENT_API_AUDIENCE": cls.AGENT_API_AUDIENCE,
        }
        missing = [k for k, v in required.items() if not v]
        if missing:
            raise RuntimeError(
                f"Missing required configuration: {', '.join(missing)}. "
                "Set AZURE_KEY_VAULT_URL or the corresponding environment variables."
            )






"""Dataverse Web API client used by the agent service (service-principal auth).

This client runs under the FPIP-Agent-Service app registration and performs
read-only queries. Row-level boundaries for Supplier Portal users are enforced
by appending explicit filters based on the calling user's context — do not rely
solely on the service principal's broader Dataverse security role.
"""
from __future__ import annotations

import logging
import re
from typing import Any

import msal
import requests

from app.config import Config

logger = logging.getLogger(__name__)

# Mapping from logical table name to Dataverse entity set (plural) name.
_ENTITY_SETS: dict[str, str] = {
    "fpip_supplier": "fpip_suppliers",
    "fpip_requisition": "fpip_requisitions",
    "fpip_tender": "fpip_tenders",
    "fpip_bid": "fpip_bids",
    "fpip_purchaseorder": "fpip_purchaseorders",
    "fpip_invoice": "fpip_invoices",
    "fpip_contract": "fpip_contracts",
    "fpip_compliancedocument": "fpip_compliancedocuments",
    "fpip_approvalrequest": "fpip_approvalrequests",
    "fpip_auditlogentry": "fpip_auditlogentries",
}

# Tables that contain a Supplier lookup and must be scoped for portal users.
_SUPPLIER_LOOKUP_TABLES = {
    "fpip_bid",
    "fpip_invoice",
    "fpip_compliancedocument",
    "fpip_contract",
    "fpip_purchaseorder",
}

_AGENT_TABLES: dict[str, set[str]] = {
    "executive": set(_ENTITY_SETS),
    "procurement": {"fpip_supplier", "fpip_requisition", "fpip_tender", "fpip_bid", "fpip_purchaseorder", "fpip_contract"},
    "finance": {"fpip_invoice", "fpip_purchaseorder", "fpip_contract", "fpip_requisition", "fpip_supplier"},
    "spend": {"fpip_requisition", "fpip_purchaseorder", "fpip_invoice", "fpip_supplier"},
    "contract": {"fpip_contract", "fpip_supplier", "fpip_purchaseorder"},
    "compliance": {"fpip_compliancedocument", "fpip_supplier", "fpip_approvalrequest", "fpip_auditlogentry"},
    "risk": {"fpip_supplier", "fpip_contract", "fpip_bid", "fpip_invoice"},
    "knowledge": {"fpip_requisition", "fpip_tender", "fpip_contract", "fpip_auditlogentry"},
    "supplier": {"fpip_supplier", "fpip_bid", "fpip_invoice", "fpip_compliancedocument"},
}
_GUID = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")


class DataverseClient:
    def __init__(self) -> None:
        self.base_url = Config.DATAVERSE_URL.rstrip("/")
        self._token: str | None = None
        self._app = msal.ConfidentialClientApplication(
            client_id=Config.DATAVERSE_CLIENT_ID,
            client_credential=Config.DATAVERSE_CLIENT_SECRET,
            authority=f"https://login.microsoftonline.com/{Config.DATAVERSE_TENANT_ID}",
        )

    def _get_token(self) -> str:
        if self._token is None:
            result = self._app.acquire_token_for_client(scopes=[f"{self.base_url}/.default"])
            if "access_token" not in result:
                error = result.get("error_description") or result.get("error") or "unknown"
                raise RuntimeError(f"Dataverse auth failed: {error}")
            self._token = result["access_token"]
        return self._token

    def query(
        self,
        table: str,
        filter_expression: str | None = None,
        select: str | None = None,
        top: int = 25,
        user_context: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """Run a read-only OData query against a Dataverse table."""
        if table not in _ENTITY_SETS:
            raise ValueError(
                f"Unknown table '{table}'. Valid tables: {list(_ENTITY_SETS)}"
            )

        user_context = user_context or {}
        agent_id = str(user_context.get("agent_id") or "")
        if table not in _AGENT_TABLES.get(agent_id, set()):
            raise PermissionError(f"Agent '{agent_id}' cannot query table '{table}'")

        entity_set = _ENTITY_SETS[table]
        url = f"{self.base_url}/api/data/v9.2/{entity_set}"
        params: dict[str, Any] = {"$top": max(1, min(int(top), 50))}
        if select:
            params["$select"] = select

        effective_filter = filter_expression or ""

        # Supplier isolation: role and supplier_id come only from verified Entra claims.
        if user_context.get("role") == "supplier":
            supplier_id = user_context.get("supplier_id")
            if not isinstance(supplier_id, str) or not _GUID.fullmatch(supplier_id):
                raise PermissionError("A valid supplier identity is required")
            if table == "fpip_supplier":
                supplier_filter = f"fpip_supplierid eq {supplier_id}"
                effective_filter = (
                    f"({effective_filter}) and {supplier_filter}"
                    if effective_filter
                    else supplier_filter
                )
            elif table in _SUPPLIER_LOOKUP_TABLES:
                supplier_filter = f"_fpip_supplier_value eq {supplier_id}"
                effective_filter = (
                    f"({effective_filter}) and {supplier_filter}"
                    if effective_filter
                    else supplier_filter
                )

        if effective_filter:
            params["$filter"] = effective_filter

        headers = {
            "Authorization": f"Bearer {self._get_token()}",
            "Accept": "application/json",
            "OData-MaxVersion": "4.0",
            "OData-Version": "4.0",
        }

        try:
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json().get("value", [])
        except requests.exceptions.RequestException as exc:
            logger.warning("Dataverse query failed: %s", exc)
            raise RuntimeError(f"Dataverse query failed: {exc}") from exc

    def write_audit_log(
        self,
        action: str,
        entity_reference: str,
        actor: str,
        actor_type: str = "AI Agent",
    ) -> None:
        """Best-effort audit-log write so the agent service leaves a trail."""
        from datetime import datetime, timezone

        url = f"{self.base_url}/api/data/v9.2/fpip_auditlogentries"
        body = {
            "fpip_timestamp": datetime.now(timezone.utc).isoformat(),
            "fpip_actor": actor,
            "fpip_actor_type": actor_type,
            "fpip_action": action,
            "fpip_entity_reference": entity_reference,
            "fpip_source_detail": "FPIP-Agent-Service",
        }
        headers = {
            "Authorization": f"Bearer {self._get_token()}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        try:
            resp = requests.post(url, headers=headers, json=body, timeout=15)
            resp.raise_for_status()
        except requests.exceptions.RequestException as exc:
            logger.warning("Audit log write failed: %s", exc)
            # Never fail a user request because the audit log could not be written.

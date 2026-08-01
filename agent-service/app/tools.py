"""LangChain tools exposed by the FPIP agent service.

Tools are read-only. Tool access per agent is gated by `agents_config.py`.
The calling user's context (role, supplier_id, username) is carried via a
ContextVar set by the FastAPI layer before each invocation.
"""
from __future__ import annotations

import contextvars
import json
import logging
from typing import Any

from langchain.tools import tool

from app.dataverse_client import DataverseClient
from app.fabric_client import run_fabric_query
from app.search_client import search_documents

logger = logging.getLogger(__name__)

# Set by api.py before running the agent graph for a request.
USER_CONTEXT: contextvars.ContextVar[dict[str, Any]] = contextvars.ContextVar(
    "user_context", default={}
)


def _current_user_context() -> dict[str, Any]:
    return USER_CONTEXT.get()


def _user_filter_note() -> str:
    ctx = _current_user_context()
    if ctx.get("role") == "supplier":
        return (
            " Supplier-scoped: results are filtered to the caller's own supplier "
            "record; do not attempt to query other suppliers."
        )
    return ""


@tool
def dataverse_query_tool(table: str, filter_expression: str = "") -> str:
    """Query a FPIP Dataverse table.

    Valid tables: fpip_supplier, fpip_requisition, fpip_tender, fpip_bid,
    fpip_purchaseorder, fpip_invoice, fpip_contract, fpip_compliancedocument,
    fpip_approvalrequest, fpip_auditlogentry.

    filter_expression is an OData $filter fragment, e.g.:
      - "fpip_status eq 1"
      - "startswith(fpip_title,'Warehouse')"
      - "fpip_amount gt 10000"
    """
    client = DataverseClient()
    try:
        rows = client.query(
            table=table,
            filter_expression=filter_expression or None,
            user_context=_current_user_context(),
            top=20,
        )
        return json.dumps(rows, default=str, indent=2)
    except Exception as exc:
        return f"Error querying Dataverse table '{table}': {exc}"


@tool
def fabric_sql_query_tool(query_name: str, params: str = "[]") -> str:
    """Run a read-only, allowlisted query against the Fabric SQL endpoint.

    Allowed query_name values:
      - recent_payments
      - outstanding_invoices_by_supplier
      - budget_utilization_by_department
      - spend_by_category (params: [fiscal_year_int])

    params is a JSON list of parameter values, e.g. "[2025]".
    """
    try:
        parsed_params = json.loads(params) if params else []
        if not isinstance(parsed_params, list):
            return "Error: params must be a JSON list."
        rows = run_fabric_query(query_name, parsed_params)
        return json.dumps(rows, default=str, indent=2)
    except Exception as exc:
        return f"Error running Fabric query '{query_name}': {exc}"


@tool
def search_policies_tool(query: str, top_k: int = 5) -> str:
    """Search policy documents, SOPs, and governance content (fpip-policies-index)."""
    try:
        results = search_documents("fpip-policies-index", query, top_k)
        return json.dumps(results, default=str, indent=2)
    except Exception as exc:
        return f"Error searching policies: {exc}"


@tool
def search_contracts_tool(query: str, top_k: int = 5) -> str:
    """Search contract documents and amendments (fpip-contracts-index)."""
    try:
        results = search_documents("fpip-contracts-index", query, top_k)
        return json.dumps(results, default=str, indent=2)
    except Exception as exc:
        return f"Error searching contracts: {exc}"


@tool
def search_supplier_documents_tool(query: str, top_k: int = 5) -> str:
    """Search supplier-submitted compliance and onboarding documents (fpip-supplier-docs-index)."""
    try:
        results = search_documents("fpip-supplier-docs-index", query, top_k)
        return json.dumps(results, default=str, indent=2)
    except Exception as exc:
        return f"Error searching supplier documents: {exc}"


@tool
def write_audit_log_tool(action: str, entity_reference: str) -> str:
    """Record an AI-agent action in the FPIP audit log (best-effort)."""
    ctx = _current_user_context()
    actor = ctx.get("username") or "FPIP-Agent-Service"
    client = DataverseClient()
    try:
        client.write_audit_log(
            action=action,
            entity_reference=entity_reference,
            actor=actor,
            actor_type="AI Agent",
        )
        return "Audit log entry written."
    except Exception as exc:
        logger.warning("Audit log tool failed: %s", exc)
        return "Audit log entry could not be written (non-fatal)."


# Map from tool name (as used in agents_config.py) to the Tool object.
TOOL_REGISTRY: dict[str, Any] = {
    "dataverse_query": dataverse_query_tool,
    "fabric_sql_query": fabric_sql_query_tool,
    "search_policies": search_policies_tool,
    "search_contracts": search_contracts_tool,
    "search_supplier_documents": search_supplier_documents_tool,
    "write_audit_log": write_audit_log_tool,
}


def resolve_tools(allowed_tools: tuple[str, ...]) -> list[Any]:
    """Return the LangChain Tool instances allowed for an agent."""
    missing = set(allowed_tools) - set(TOOL_REGISTRY)
    if missing:
        raise ValueError(f"Unknown tool names in agent config: {missing}")
    return [TOOL_REGISTRY[name] for name in allowed_tools]

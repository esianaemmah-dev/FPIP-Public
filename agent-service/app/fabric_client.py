"""Read-only, allowlisted query executor for the Microsoft Fabric SQL endpoint.

The LLM is never allowed to construct arbitrary SQL. It may only invoke one of
the predefined query templates below, with safe parameters. This protects the
bank-side OneLake data from prompt-injection-driven exfiltration.
"""
from __future__ import annotations

import logging
from typing import Any

import pyodbc

from app.config import Config

logger = logging.getLogger(__name__)

# Predefined, read-only query shapes. Parameter values are validated/sanitized.
_ALLOWED_QUERIES: dict[str, str] = {
    "recent_payments": """
        SELECT TOP 20
            payment_date,
            supplier_name,
            amount,
            currency,
            status
        FROM payments
        ORDER BY payment_date DESC
    """,
    "outstanding_invoices_by_supplier": """
        SELECT
            supplier_name,
            COUNT(*) AS invoice_count,
            SUM(amount) AS total_outstanding
        FROM invoices
        WHERE status = 'Held'
        GROUP BY supplier_name
        ORDER BY total_outstanding DESC
    """,
    "budget_utilization_by_department": """
        SELECT
            department,
            budget,
            spent,
            ROUND(100.0 * spent / NULLIF(budget, 0), 2) AS utilization_pct
        FROM budget_summary
        ORDER BY utilization_pct DESC
    """,
    "spend_by_category": """
        SELECT
            category,
            SUM(amount) AS total_spend,
            COUNT(*) AS transaction_count
        FROM spend_transactions
        WHERE fiscal_year = ?
        GROUP BY category
        ORDER BY total_spend DESC
    """,
}


def run_fabric_query(query_name: str, params: list[Any] | None = None) -> list[dict[str, Any]]:
    """Execute an allowlisted read-only query against the Fabric SQL endpoint."""
    if Config.FABRIC_CONNECTION_STRING is None:
        raise RuntimeError("Fabric connection string is not configured.")

    if query_name not in _ALLOWED_QUERIES:
        raise ValueError(
            f"Query '{query_name}' is not in the allowlist. "
            f"Allowed queries: {list(_ALLOWED_QUERIES)}"
        )

    sql = _ALLOWED_QUERIES[query_name]
    params = params or []

    # Extra safety: the allowlist already prevents dynamic SQL; this confirms no
    # destructive keywords slipped in (defense in depth).
    upper = sql.upper()
    forbidden = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "TRUNCATE ", "EXEC(", "EXECUTE("]
    if any(token in upper for token in forbidden):
        raise RuntimeError("Refusing to run a non-read-only SQL statement.")

    try:
        with pyodbc.connect(Config.FABRIC_CONNECTION_STRING, timeout=30) as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, params)
                columns = [desc[0] for desc in cursor.description]
                rows = cursor.fetchall()
                return [dict(zip(columns, row)) for row in rows]
    except pyodbc.Error as exc:
        logger.warning("Fabric query failed: %s", exc)
        raise RuntimeError(f"Fabric query failed: {exc}") from exc

"""Two-supplier cross-tenant isolation proof.

README.md and SECURITY.md both call out supplier isolation as the one access
boundary that "must not leak." test_dataverse_authorization.py checks the
scoping rules in isolation (one supplier, one table); this file specifically
proves that two *different* suppliers calling through the same code path —
including through the public `dataverse_query_tool` the LLM actually invokes
— can never see each other's records, and that a caller cannot use a crafted
`filter_expression` to escape its own scoping.
"""
from __future__ import annotations

import json
from typing import Any

import pytest

from app.dataverse_client import DataverseClient, _AGENT_TABLES, _SUPPLIER_LOOKUP_TABLES
from app.tools import USER_CONTEXT, dataverse_query_tool

SUPPLIER_A = "123e4567-e89b-42d3-a456-426614174000"
SUPPLIER_B = "223e4567-e89b-42d3-a456-426614174111"

# The Supplier Portal agent's own table allowlist (agent_id="supplier" in
# _AGENT_TABLES) is narrower than the full set of supplier-lookup tables —
# only test isolation on tables that agent can actually reach.
_SUPPLIER_AGENT_LOOKUP_TABLES = sorted(_AGENT_TABLES["supplier"] & _SUPPLIER_LOOKUP_TABLES)


def _client() -> DataverseClient:
    instance = DataverseClient.__new__(DataverseClient)
    instance.base_url = "https://example.crm.dynamics.com"
    instance._token = "test-token"
    instance._get_token = lambda: "test-token"  # type: ignore[method-assign]
    return instance


class _FakeDataverseBackend:
    """Stands in for Dataverse: returns every row and lets the sent $filter speak for itself."""

    def __init__(self, rows: list[dict[str, Any]]) -> None:
        self.rows = rows
        self.captured_filters: list[str] = []

    def get(self, url: str, **kwargs: Any):
        params = kwargs.get("params", {})
        self.captured_filters.append(params.get("$filter", ""))

        class _Response:
            def raise_for_status(_self) -> None:
                return None

            def json(_self) -> dict[str, Any]:
                return {"value": self.rows}

        return _Response()


@pytest.mark.parametrize("table", _SUPPLIER_AGENT_LOOKUP_TABLES)
def test_two_suppliers_receive_disjoint_filters_for_every_lookup_table(
    monkeypatch: pytest.MonkeyPatch, table: str
) -> None:
    backend = _FakeDataverseBackend(rows=[])
    monkeypatch.setattr("app.dataverse_client.requests.get", backend.get)

    _client().query(table, user_context={"agent_id": "supplier", "role": "supplier", "supplier_id": SUPPLIER_A})
    _client().query(table, user_context={"agent_id": "supplier", "role": "supplier", "supplier_id": SUPPLIER_B})

    filter_a, filter_b = backend.captured_filters
    assert SUPPLIER_A in filter_a and SUPPLIER_B not in filter_a
    assert SUPPLIER_B in filter_b and SUPPLIER_A not in filter_b
    assert filter_a != filter_b


def test_supplier_a_cannot_widen_scope_with_an_own_filter_naming_supplier_b(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Even a syntactically valid filter can't override the server-appended supplier scope."""
    backend = _FakeDataverseBackend(rows=[])
    monkeypatch.setattr("app.dataverse_client.requests.get", backend.get)

    _client().query(
        "fpip_invoice",
        filter_expression=f"_fpip_supplier_value eq {SUPPLIER_B}",
        user_context={"agent_id": "supplier", "role": "supplier", "supplier_id": SUPPLIER_A},
    )

    (sent_filter,) = backend.captured_filters
    # The caller's own clause is ANDed with, not substituted for, the server clause —
    # so the effective filter can only ever match rows for SUPPLIER_A.
    assert sent_filter == f"(_fpip_supplier_value eq {SUPPLIER_B}) and _fpip_supplier_value eq {SUPPLIER_A}"


@pytest.mark.parametrize(
    "malicious_filter",
    [
        "fpip_status eq 1) or (1 eq 1",
        "true) or (statecode eq 0",
        "1 eq 1) or (",
    ],
)
def test_unbalanced_parentheses_in_filter_expression_cannot_bypass_supplier_scoping(
    monkeypatch: pytest.MonkeyPatch, malicious_filter: str
) -> None:
    """Regression test for an OData filter-injection bypass.

    OData binds `and` tighter than `or`. Before the `_has_balanced_parentheses`
    guard, a filter_expression with an unmatched closing paren — plausibly
    supplied by an LLM under prompt injection, since filter_expression is a
    free-text tool argument — turned the server's supplier-scoping clause into
    one branch of an `or`, e.g.:
        (fpip_status eq 1) or (1 eq 1) and _fpip_supplier_value eq <A>
    which OData parses as `(fpip_status eq 1) OR (... AND supplier eq A)`,
    leaking every supplier's rows where fpip_status eq 1.
    """
    backend = _FakeDataverseBackend(rows=[])
    monkeypatch.setattr("app.dataverse_client.requests.get", backend.get)

    with pytest.raises(ValueError, match="unbalanced parentheses"):
        _client().query(
            "fpip_invoice",
            filter_expression=malicious_filter,
            user_context={"agent_id": "supplier", "role": "supplier", "supplier_id": SUPPLIER_A},
        )
    assert backend.captured_filters == []  # never reached Dataverse


def test_end_to_end_through_the_llm_tool_two_suppliers_never_cross_see_rows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Exercises the exact callable the agent's LLM invokes, not just the client underneath."""
    backend_a = _FakeDataverseBackend(rows=[{"fpip_invoiceid": "inv-a", "_fpip_supplier_value": SUPPLIER_A}])
    backend_b = _FakeDataverseBackend(rows=[{"fpip_invoiceid": "inv-b", "_fpip_supplier_value": SUPPLIER_B}])

    monkeypatch.setattr("app.tools.DataverseClient", _client)

    def route(url: str, **kwargs: Any):
        params = kwargs.get("params", {})
        active_filter = params.get("$filter", "")
        backend = backend_a if SUPPLIER_A in active_filter else backend_b
        return backend.get(url, **kwargs)

    monkeypatch.setattr("app.dataverse_client.requests.get", route)

    token_a = USER_CONTEXT.set({"agent_id": "supplier", "role": "supplier", "supplier_id": SUPPLIER_A})
    try:
        result_a = json.loads(dataverse_query_tool.invoke({"table": "fpip_invoice", "filter_expression": ""}))
    finally:
        USER_CONTEXT.reset(token_a)

    token_b = USER_CONTEXT.set({"agent_id": "supplier", "role": "supplier", "supplier_id": SUPPLIER_B})
    try:
        result_b = json.loads(dataverse_query_tool.invoke({"table": "fpip_invoice", "filter_expression": ""}))
    finally:
        USER_CONTEXT.reset(token_b)

    assert [row["fpip_invoiceid"] for row in result_a] == ["inv-a"]
    assert [row["fpip_invoiceid"] for row in result_b] == ["inv-b"]

"""Enforces the growth process in docs/FABRIC_QUERY_ALLOWLIST.md.

Every entry added to `_ALLOWED_QUERIES` must pass these checks in CI — the
allowlist is a security boundary against prompt-injection-driven exfiltration
of bank data, so its shape rules are asserted here rather than left to
reviewer attention alone.
"""
from __future__ import annotations

import pytest

from app.config import Config
from app.fabric_client import _ALLOWED_QUERIES, run_fabric_query
from app.tools import fabric_sql_query_tool

_FORBIDDEN_TOKENS = ("INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "TRUNCATE ", "EXEC(", "EXECUTE(")


@pytest.mark.parametrize("name,sql", _ALLOWED_QUERIES.items())
def test_every_allowlisted_query_is_a_single_readonly_select(name: str, sql: str) -> None:
    upper = sql.upper()
    assert upper.strip().startswith("SELECT"), f"{name} must be a single SELECT statement"
    assert ";" not in sql, f"{name} must not contain multiple statements"
    assert not any(token in upper for token in _FORBIDDEN_TOKENS), f"{name} contains a write/DDL keyword"


def test_every_allowlisted_query_is_documented_for_the_llm() -> None:
    description = fabric_sql_query_tool.description
    missing = [name for name in _ALLOWED_QUERIES if name not in description]
    assert not missing, (
        f"Query name(s) {missing} exist in _ALLOWED_QUERIES but are not listed in "
        "fabric_sql_query_tool's docstring — the LLM can't discover a template it "
        "can't read about. Update the docstring in tools.py alongside the allowlist."
    )


def test_unknown_query_name_is_rejected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(Config, "FABRIC_CONNECTION_STRING", "Driver={ODBC};Server=test;")
    with pytest.raises(ValueError, match="not in the allowlist"):
        run_fabric_query("drop_all_suppliers")


def test_query_is_rejected_without_a_configured_connection_string(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(Config, "FABRIC_CONNECTION_STRING", None)
    with pytest.raises(RuntimeError, match="not configured"):
        run_fabric_query("recent_payments")

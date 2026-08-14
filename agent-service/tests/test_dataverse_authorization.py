from __future__ import annotations

from typing import Any

import pytest

from app.dataverse_client import DataverseClient


def client() -> DataverseClient:
    instance = DataverseClient.__new__(DataverseClient)
    instance.base_url = "https://example.crm.dynamics.com"
    instance._token = "test-token"
    instance._get_token = lambda: "test-token"  # type: ignore[method-assign]
    return instance


def test_agent_cannot_query_a_table_outside_its_allowlist() -> None:
    with pytest.raises(PermissionError):
        client().query(
            "fpip_invoice",
            user_context={"agent_id": "procurement", "role": "procurement"},
        )


def test_supplier_cannot_query_internal_tables() -> None:
    with pytest.raises(PermissionError):
        client().query(
            "fpip_contract",
            user_context={
                "agent_id": "supplier",
                "role": "supplier",
                "supplier_id": "123e4567-e89b-42d3-a456-426614174000",
            },
        )


def test_supplier_identity_must_be_a_valid_guid() -> None:
    with pytest.raises(PermissionError):
        client().query(
            "fpip_invoice",
            user_context={"agent_id": "supplier", "role": "supplier", "supplier_id": "s2"},
        )


def test_supplier_table_query_is_always_self_scoped(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, Any] = {}

    class Response:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, list[Any]]:
            return {"value": []}

    def fake_get(url: str, **kwargs: Any) -> Response:
        captured.update(kwargs.get("params", {}))
        return Response()

    monkeypatch.setattr("app.dataverse_client.requests.get", fake_get)
    supplier_id = "123e4567-e89b-42d3-a456-426614174000"
    client().query(
        "fpip_supplier",
        user_context={"agent_id": "supplier", "role": "supplier", "supplier_id": supplier_id},
    )
    assert captured["$filter"] == f"fpip_supplierid eq {supplier_id}"
    assert captured["$top"] == 25

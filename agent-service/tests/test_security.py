from __future__ import annotations

import os

import pytest
from fastapi import HTTPException

from app.config import Config
from app.security import Principal, _principal_from_claims, authorize_agent, internal_thread_id


def principal(role: str = "procurement", subject: str = "user-1") -> Principal:
    return Principal(subject=subject, username="tester", role=role, supplier_id=None, claims={})


def test_role_is_derived_from_verified_claims() -> None:
    result = _principal_from_claims(
        {"oid": "user-1", "preferred_username": "buyer@example.test", "roles": ["FPIP-Procurement"]}
    )
    assert result.role == "procurement"
    assert result.username == "buyer@example.test"


def test_supplier_requires_server_issued_supplier_claim() -> None:
    with pytest.raises(HTTPException) as exc:
        _principal_from_claims({"oid": "supplier-user", "roles": ["FPIP-Supplier"]})
    assert exc.value.status_code == 403


def test_agent_access_is_role_gated() -> None:
    authorize_agent(principal("procurement"), "procurement")
    with pytest.raises(HTTPException) as exc:
        authorize_agent(principal("supplier"), "executive")
    assert exc.value.status_code == 403


def test_thread_storage_key_is_isolated_per_user() -> None:
    first = internal_thread_id(principal(subject="user-1"), "thread-123")
    second = internal_thread_id(principal(subject="user-2"), "thread-123")
    assert first != second
    assert first == internal_thread_id(principal(subject="user-1"), "thread-123")


def test_invalid_thread_id_is_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        internal_thread_id(principal(), "../other-user/thread")
    assert exc.value.status_code == 422


def test_auth_bypass_cannot_be_enabled_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    from app import security

    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setattr(Config, "APP_ENV", "production")
    with pytest.raises(RuntimeError):
        security._auth_disabled()
    monkeypatch.delenv("AUTH_DISABLED", raising=False)

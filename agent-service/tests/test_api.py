from __future__ import annotations

from fastapi.testclient import TestClient

from app.api import app
from app.config import Config


def test_health_and_security_headers() -> None:
    with TestClient(app) as client:
        response = client.get("/health", headers={"X-Request-ID": "test-request"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response.headers["X-Request-ID"] == "test-request"
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["X-Frame-Options"] == "DENY"


def test_agent_catalog_requires_authentication(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_DISABLED", "false")
    with TestClient(app) as client:
        response = client.get("/agents")
    assert response.status_code == 401


def test_local_development_catalog_is_role_filtered(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setattr(Config, "APP_ENV", "development")
    with TestClient(app) as client:
        response = client.get("/agents")
    assert response.status_code == 200
    assert len(response.json()) == 9


def test_caller_supplied_authorization_context_is_rejected(monkeypatch) -> None:
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setattr(Config, "APP_ENV", "development")
    with TestClient(app) as client:
        response = client.post(
            "/agents/procurement/invoke",
            json={
                "message": "Show open tenders",
                "user_context": {"role": "admin", "supplier_id": "another-supplier"},
            },
        )
    assert response.status_code == 422

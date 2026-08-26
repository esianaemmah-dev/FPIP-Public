from fastapi.testclient import TestClient

from app.api import app
from app.config import Config


def _client(monkeypatch):
    monkeypatch.setenv("AUTH_DISABLED", "true")
    monkeypatch.setattr(Config, "APP_ENV", "development")
    return TestClient(app)


def test_fraud_endpoint_is_live_and_audited(monkeypatch):
    with _client(monkeypatch) as client:
        response = client.post("/controls/fraud/assess", json={
            "transaction_id": "TX-1", "amount": 180000000,
            "duplicate_invoice": True, "requestor_is_approver": True,
        })
    assert response.status_code == 200
    assert response.json()["outcome"] == "block"
    assert len(response.json()["audit"]["record_hash"]) == 64
    assert response.headers["X-FPIP-Region"]
    assert "dur=" in response.headers["Server-Timing"]


def test_compliance_endpoint_fails_closed(monkeypatch):
    with _client(monkeypatch) as client:
        response = client.post("/controls/compliance/assess", json={
            "supplier_id": "SUP-1", "kyc": "pass", "aml": "pass",
            "sanctions": "match", "tax": "pass", "beneficial_ownership": "pass",
        })
    assert response.status_code == 200
    assert response.json()["outcome"] == "block"


def test_vendor_risk_and_milestone_workflow(monkeypatch):
    with _client(monkeypatch) as client:
        vendor = client.post("/controls/vendors/risk/assess", json={"supplier_id": "SUP-1", "sanctions_exposure": True})
        payment = client.post("/controls/payments/milestones/authorize", json={
            "contract_id": "C1", "milestone_id": "M1", "invoice_id": "I1",
            "acceptance_evidence_hash": "0123456789abcdef", "requestor": "alice",
            "approver": "bob", "compliance_status": "clear", "budget_status": "reserved",
        })
    assert vendor.json()["outcome"] == "block"
    assert payment.json()["outcome"] == "allow"
    assert payment.json()["payment_executed"] is False


def test_readiness_is_truthful_about_unproven_sla(monkeypatch):
    with _client(monkeypatch) as client:
        response = client.get("/controls/operational-readiness")
    assert response.status_code == 200
    assert response.json()["claims"]["active_active_99_999"] is False

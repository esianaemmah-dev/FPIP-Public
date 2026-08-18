from dataclasses import replace

from app.enterprise_controls import (
    SlidingWindowRateLimiter, TamperEvidentAuditChain, assess_compliance,
    assess_fraud, assess_vendor_risk, authorize_milestone_payment,
)


def test_rate_limiter_releases_expired_requests():
    now = [0.0]
    limiter = SlidingWindowRateLimiter(2, 10, lambda: now[0])
    assert limiter.allow("tenant:user")[0]
    assert limiter.allow("tenant:user")[0]
    allowed, retry = limiter.allow("tenant:user")
    assert not allowed and retry == 10
    now[0] = 11
    assert limiter.allow("tenant:user")[0]


def test_audit_chain_detects_tampering():
    chain = TamperEvidentAuditChain(b"x" * 32)
    first = chain.append("alice", "create", "rfq/1", {"amount": 10})
    second = chain.append("bob", "approve", "rfq/1", {"status": "approved"})
    assert chain.verify()
    assert not chain.verify([first, replace(second, actor="mallory")])


def test_fraud_blocks_duplicate_high_value_sod_violation():
    result = assess_fraud({"amount": 180_000_000, "duplicate_invoice": True, "requestor_is_approver": True})
    assert result.outcome == "block" and result.score == 100


def test_compliance_fails_closed_for_missing_and_failed_checks():
    assert assess_compliance({"kyc": "pass"}).outcome == "review"
    result = assess_compliance({"kyc": "pass", "aml": "pass", "sanctions": "match", "tax": "pass", "beneficial_ownership": "pass"})
    assert result.outcome == "block"


def test_vendor_sanctions_exposure_blocks():
    assert assess_vendor_risk({"sanctions_exposure": True}).outcome == "block"


def test_milestone_authorizes_workflow_but_not_payment_execution():
    valid = {"contract_id": "C1", "milestone_id": "M1", "invoice_id": "I1", "acceptance_evidence_hash": "abc", "requestor": "a", "approver": "b", "compliance_status": "clear", "budget_status": "reserved"}
    result = authorize_milestone_payment(valid)
    assert result.outcome == "allow"
    assert "workflow_authorized_not_executed" in result.reasons
    assert authorize_milestone_payment({**valid, "approver": "a"}).outcome == "block"

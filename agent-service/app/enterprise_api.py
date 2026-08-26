"""Authenticated, role-restricted enterprise control API.

Decisions authorize FPIP workflow progression only. No endpoint executes a bank payment.
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from app.config import Config
from app.enterprise_controls import (
    TamperEvidentAuditChain,
    assess_compliance,
    assess_fraud,
    assess_vendor_risk,
    authorize_milestone_payment,
)
from app.security import Principal, require_principal

router = APIRouter(prefix="/controls", tags=["enterprise-controls"])

_CONTROL_ROLES = {
    "readiness": {"admin", "executive", "auditor"},
    "fraud": {"admin", "executive", "procurement", "finance", "auditor"},
    "compliance": {"admin", "procurement", "auditor"},
    "vendor_risk": {"admin", "executive", "procurement", "auditor"},
    "milestone": {"admin", "finance", "budget_owner"},
}


def _audit_chain() -> TamperEvidentAuditChain:
    raw = Config.AUDIT_SIGNING_KEY.encode()
    if len(raw) < 32:
        if Config.APP_ENV == "production":
            raise HTTPException(status_code=503, detail="Audit signing is not configured")
        raw = b"local-development-audit-key-only-32-bytes"
    if not hasattr(_audit_chain, "instance"):
        _audit_chain.instance = TamperEvidentAuditChain(raw)  # type: ignore[attr-defined]
    return _audit_chain.instance  # type: ignore[attr-defined]


def _authorize(principal: Principal, control: str) -> None:
    if principal.role not in _CONTROL_ROLES[control]:
        raise HTTPException(status_code=403, detail="Enterprise control access denied for this role")


class FraudRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    transaction_id: str = Field(min_length=1, max_length=160)
    amount: float = Field(ge=0)
    duplicate_invoice: bool = False
    bank_account_changed_recently: bool = False
    requestor_is_approver: bool = False
    supplier_country_risk: str = "normal"


class ComplianceRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    supplier_id: str = Field(min_length=1, max_length=160)
    kyc: str
    aml: str
    sanctions: str
    tax: str
    beneficial_ownership: str


class VendorRiskRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    supplier_id: str = Field(min_length=1, max_length=160)
    on_time_delivery_pct: float = Field(default=100, ge=0, le=100)
    credit_score: float = Field(default=100, ge=0, le=100)
    adverse_media: bool = False
    sanctions_exposure: bool = False


class MilestoneRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contract_id: str = Field(min_length=1, max_length=160)
    milestone_id: str = Field(min_length=1, max_length=160)
    invoice_id: str = Field(min_length=1, max_length=160)
    acceptance_evidence_hash: str = Field(min_length=16, max_length=256)
    requestor: str = Field(min_length=1, max_length=160)
    approver: str = Field(min_length=1, max_length=160)
    compliance_status: str
    budget_status: str


def _respond(principal: Principal, action: str, resource: str, payload: dict[str, Any], decision) -> dict[str, Any]:
    record = _audit_chain().append(
        actor=principal.subject,
        action=action,
        resource=resource,
        payload={"request": payload, "decision": decision.outcome, "score": decision.score},
    )
    return {
        "outcome": decision.outcome,
        "score": decision.score,
        "reasons": list(decision.reasons),
        "requires_human_review": decision.requires_human_review,
        "audit": {"sequence": record.sequence, "record_hash": record.record_hash},
    }


@router.get("/operational-readiness")
async def operational_readiness(principal: Principal = Depends(require_principal)) -> dict[str, Any]:
    _authorize(principal, "readiness")
    capabilities = {
        "authentication": bool(Config.AGENT_API_AUDIENCE and Config.AGENT_API_TENANT_ID),
        "rate_limiting": Config.RATE_LIMIT_REQUESTS > 0,
        "tamper_evident_audit": len(Config.AUDIT_SIGNING_KEY.encode()) >= 32,
        "immutable_worm_export": bool(Config.AUDIT_IMMUTABLE_STORAGE_URL),
        "kyc_aml_provider": bool(Config.COMPLIANCE_PROVIDER_URL),
        "vendor_risk_provider": bool(Config.VENDOR_RISK_PROVIDER_URL),
        "deployment_region": Config.DEPLOYMENT_REGION,
    }
    return {
        "status": "configured" if all(v for k, v in capabilities.items() if k != "deployment_region") else "requires_tenant_configuration",
        "capabilities": capabilities,
        "claims": {"active_active_99_999": False, "reason": "Requires deployed multi-region architecture and measured tenant evidence"},
    }


@router.post("/fraud/assess")
async def fraud_assess(body: FraudRequest, principal: Principal = Depends(require_principal)) -> dict[str, Any]:
    _authorize(principal, "fraud")
    payload = body.model_dump()
    return _respond(principal, "fraud.assess", f"transaction/{body.transaction_id}", payload, assess_fraud(payload))


@router.post("/compliance/assess")
async def compliance_assess(body: ComplianceRequest, principal: Principal = Depends(require_principal)) -> dict[str, Any]:
    _authorize(principal, "compliance")
    payload = body.model_dump()
    checks = {k: payload[k] for k in ("kyc", "aml", "sanctions", "tax", "beneficial_ownership")}
    return _respond(principal, "compliance.assess", f"supplier/{body.supplier_id}", payload, assess_compliance(checks))


@router.post("/vendors/risk/assess")
async def vendor_risk_assess(body: VendorRiskRequest, principal: Principal = Depends(require_principal)) -> dict[str, Any]:
    _authorize(principal, "vendor_risk")
    payload = body.model_dump()
    return _respond(principal, "vendor-risk.assess", f"supplier/{body.supplier_id}", payload, assess_vendor_risk(payload))


@router.post("/payments/milestones/authorize")
async def milestone_authorize(body: MilestoneRequest, principal: Principal = Depends(require_principal)) -> dict[str, Any]:
    _authorize(principal, "milestone")
    payload = body.model_dump()
    response = _respond(principal, "milestone.authorize-workflow", f"contract/{body.contract_id}/milestone/{body.milestone_id}", payload, authorize_milestone_payment(payload))
    response["payment_executed"] = False
    return response

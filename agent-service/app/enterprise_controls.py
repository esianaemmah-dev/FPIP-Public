"""Deterministic enterprise controls used at FPIP trust boundaries.

These controls do not execute payments or replace regulated KYC/AML providers.
They provide fail-closed policy decisions, evidence, and extension points.
"""
from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from hashlib import sha256
import hmac
import json
from threading import Lock
from time import monotonic
from typing import Any, Callable, Iterable, Mapping


def _canonical(value: Mapping[str, Any]) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), default=str).encode()


class SlidingWindowRateLimiter:
    """Thread-safe, bounded in-process guard; use a distributed store in multi-region production."""

    def __init__(self, limit: int, window_seconds: float, clock: Callable[[], float] = monotonic):
        if limit < 1 or window_seconds <= 0:
            raise ValueError("limit and window_seconds must be positive")
        self.limit, self.window_seconds, self.clock = limit, window_seconds, clock
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str) -> tuple[bool, float]:
        now = self.clock()
        with self._lock:
            events = self._events[key]
            cutoff = now - self.window_seconds
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= self.limit:
                return False, max(0.0, self.window_seconds - (now - events[0]))
            events.append(now)
            return True, 0.0


@dataclass(frozen=True)
class AuditRecord:
    sequence: int
    occurred_at: str
    actor: str
    action: str
    resource: str
    payload_hash: str
    previous_hash: str
    record_hash: str


class TamperEvidentAuditChain:
    """HMAC-linked records. Export to tenant WORM storage for actual immutable retention."""

    def __init__(self, signing_key: bytes):
        if len(signing_key) < 32:
            raise ValueError("audit signing key must contain at least 32 bytes")
        self._key = signing_key
        self._records: list[AuditRecord] = []
        self._lock = Lock()

    def append(self, actor: str, action: str, resource: str, payload: Mapping[str, Any]) -> AuditRecord:
        with self._lock:
            previous = self._records[-1].record_hash if self._records else "GENESIS"
            body = {
                "sequence": len(self._records) + 1,
                "occurred_at": datetime.now(timezone.utc).isoformat(),
                "actor": actor,
                "action": action,
                "resource": resource,
                "payload_hash": sha256(_canonical(payload)).hexdigest(),
                "previous_hash": previous,
            }
            digest = hmac.new(self._key, _canonical(body), sha256).hexdigest()
            record = AuditRecord(**body, record_hash=digest)
            self._records.append(record)
            return record

    def verify(self, records: Iterable[AuditRecord] | None = None) -> bool:
        chain = list(self._records if records is None else records)
        previous = "GENESIS"
        for expected_sequence, record in enumerate(chain, 1):
            body = asdict(record)
            supplied = body.pop("record_hash")
            if record.sequence != expected_sequence or record.previous_hash != previous:
                return False
            expected = hmac.new(self._key, _canonical(body), sha256).hexdigest()
            if not hmac.compare_digest(supplied, expected):
                return False
            previous = supplied
        return True

    @property
    def records(self) -> tuple[AuditRecord, ...]:
        return tuple(self._records)


@dataclass(frozen=True)
class ControlDecision:
    outcome: str
    score: int
    reasons: tuple[str, ...]
    requires_human_review: bool


def assess_fraud(transaction: Mapping[str, Any]) -> ControlDecision:
    """Explainable baseline scorer; production ML may add evidence but cannot bypass hard rules."""
    score, reasons = 0, []
    amount = float(transaction.get("amount", 0) or 0)
    if amount >= 100_000_000:
        score += 30; reasons.append("high_value_transaction")
    if transaction.get("duplicate_invoice"):
        score += 45; reasons.append("duplicate_invoice")
    if transaction.get("bank_account_changed_recently"):
        score += 25; reasons.append("recent_bank_account_change")
    if transaction.get("requestor_is_approver"):
        score += 50; reasons.append("segregation_of_duties_violation")
    if transaction.get("supplier_country_risk") == "high":
        score += 20; reasons.append("high_risk_jurisdiction")
    score = min(score, 100)
    outcome = "block" if score >= 80 else "review" if score >= 40 else "allow"
    return ControlDecision(outcome, score, tuple(reasons), outcome != "allow")


def assess_compliance(checks: Mapping[str, str]) -> ControlDecision:
    required = ("kyc", "aml", "sanctions", "tax", "beneficial_ownership")
    missing = [name for name in required if checks.get(name) not in {"pass", "clear"}]
    if not missing:
        return ControlDecision("allow", 0, (), False)
    failures = [name for name in missing if checks.get(name) in {"fail", "match"}]
    reasons = tuple(f"{name}:{checks.get(name, 'missing')}" for name in missing)
    return ControlDecision("block" if failures else "review", 100 if failures else 60, reasons, True)


def assess_vendor_risk(metrics: Mapping[str, Any]) -> ControlDecision:
    score, reasons = 0, []
    if float(metrics.get("on_time_delivery_pct", 100)) < 80:
        score += 25; reasons.append("poor_delivery_performance")
    if float(metrics.get("credit_score", 100)) < 50:
        score += 35; reasons.append("weak_credit_score")
    if metrics.get("adverse_media"):
        score += 25; reasons.append("adverse_media")
    if metrics.get("sanctions_exposure"):
        score += 100; reasons.append("sanctions_exposure")
    score = min(score, 100)
    outcome = "block" if score >= 80 else "review" if score >= 40 else "allow"
    return ControlDecision(outcome, score, tuple(reasons), outcome != "allow")


def authorize_milestone_payment(request: Mapping[str, Any]) -> ControlDecision:
    """Authorize workflow progression only; never sends money to a bank or payment rail."""
    failures = []
    for field in ("contract_id", "milestone_id", "invoice_id", "acceptance_evidence_hash"):
        if not request.get(field):
            failures.append(f"missing_{field}")
    if request.get("requestor") == request.get("approver"):
        failures.append("segregation_of_duties_violation")
    if request.get("compliance_status") != "clear":
        failures.append("compliance_not_clear")
    if request.get("budget_status") != "reserved":
        failures.append("budget_not_reserved")
    if failures:
        return ControlDecision("block", 100, tuple(failures), True)
    return ControlDecision("allow", 0, ("workflow_authorized_not_executed",), False)

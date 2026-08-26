"""Reliability primitives for event-driven FPIP integrations and analytics."""
from __future__ import annotations

from collections import OrderedDict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from hashlib import sha256
import json
from threading import Lock
from time import monotonic
from typing import Any, Callable, Iterable, Mapping


class CapacityExceeded(RuntimeError):
    """Raised when bounded work queues must shed load rather than exhaust memory."""


@dataclass(frozen=True)
class EventEnvelope:
    event_id: str
    tenant_id: str
    event_type: str
    occurred_at: str
    schema_version: str
    payload: Mapping[str, Any]

    @classmethod
    def create(cls, event_id: str, tenant_id: str, event_type: str, payload: Mapping[str, Any], schema_version: str = "1.0"):
        if not all((event_id, tenant_id, event_type)):
            raise ValueError("event_id, tenant_id and event_type are required")
        return cls(event_id, tenant_id, event_type, datetime.now(timezone.utc).isoformat(), schema_version, dict(payload))

    @property
    def content_hash(self) -> str:
        body = {"event_id": self.event_id, "tenant_id": self.tenant_id, "event_type": self.event_type, "schema_version": self.schema_version, "payload": self.payload}
        return sha256(json.dumps(body, sort_keys=True, separators=(",", ":"), default=str).encode()).hexdigest()


class IdempotencyRegistry:
    """Bounded TTL registry. Replace with Cosmos/Redis conditional writes in active-active Azure."""

    def __init__(self, ttl_seconds: float = 86400, max_entries: int = 100_000, clock: Callable[[], float] = monotonic):
        if ttl_seconds <= 0 or max_entries < 1:
            raise ValueError("ttl_seconds and max_entries must be positive")
        self.ttl_seconds, self.max_entries, self.clock = ttl_seconds, max_entries, clock
        self._items: OrderedDict[str, tuple[float, str]] = OrderedDict()
        self._lock = Lock()

    def claim(self, key: str, content_hash: str) -> str:
        """Return accepted, replay, or conflict for a caller-owned idempotency key."""
        now = self.clock()
        with self._lock:
            while self._items and next(iter(self._items.values()))[0] <= now:
                self._items.popitem(last=False)
            existing = self._items.get(key)
            if existing:
                return "replay" if existing[1] == content_hash else "conflict"
            if len(self._items) >= self.max_entries:
                self._items.popitem(last=False)
            self._items[key] = (now + self.ttl_seconds, content_hash)
            return "accepted"


class BoundedEventBuffer:
    """Development adapter that applies deterministic back-pressure."""

    def __init__(self, capacity: int = 1000):
        if capacity < 1:
            raise ValueError("capacity must be positive")
        self._events: deque[EventEnvelope] = deque(maxlen=capacity)
        self.capacity = capacity
        self._lock = Lock()

    def publish(self, event: EventEnvelope) -> None:
        with self._lock:
            if len(self._events) >= self.capacity:
                raise CapacityExceeded("event buffer capacity exceeded")
            self._events.append(event)

    def consume(self) -> EventEnvelope | None:
        with self._lock:
            return self._events.popleft() if self._events else None

    def __len__(self) -> int:
        with self._lock:
            return len(self._events)


class CircuitState(str, Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 5, recovery_seconds: float = 30, clock: Callable[[], float] = monotonic):
        self.failure_threshold, self.recovery_seconds, self.clock = failure_threshold, recovery_seconds, clock
        self.failures, self.opened_at, self.state = 0, None, CircuitState.CLOSED

    def permit(self) -> bool:
        if self.state == CircuitState.OPEN and self.opened_at is not None and self.clock() - self.opened_at >= self.recovery_seconds:
            self.state = CircuitState.HALF_OPEN
        return self.state != CircuitState.OPEN

    def success(self) -> None:
        self.failures, self.opened_at, self.state = 0, None, CircuitState.CLOSED

    def failure(self) -> None:
        self.failures += 1
        if self.failures >= self.failure_threshold:
            self.state, self.opened_at = CircuitState.OPEN, self.clock()


def forecast_cash_requirements(history: Iterable[float], periods: int = 3, alpha: float = 0.45) -> list[float]:
    """Auditable exponential-smoothing baseline; tenant ML may replace it after validation."""
    values = [float(v) for v in history]
    if not values or periods < 1 or not 0 < alpha <= 1:
        raise ValueError("history, periods and alpha must be valid")
    level = values[0]
    for value in values[1:]:
        level = alpha * value + (1 - alpha) * level
    return [round(level, 2) for _ in range(periods)]

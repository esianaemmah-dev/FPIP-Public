import pytest

from app.reliability import (
    BoundedEventBuffer, CapacityExceeded, CircuitBreaker, CircuitState,
    EventEnvelope, IdempotencyRegistry, forecast_cash_requirements,
)


def test_event_hash_is_stable_and_sensitive_to_payload():
    a = EventEnvelope.create("1", "tenant", "invoice.created", {"amount": 10})
    b = EventEnvelope.create("1", "tenant", "invoice.created", {"amount": 10})
    c = EventEnvelope.create("1", "tenant", "invoice.created", {"amount": 11})
    assert a.content_hash == b.content_hash
    assert a.content_hash != c.content_hash


def test_idempotency_distinguishes_replay_and_conflict():
    registry = IdempotencyRegistry()
    assert registry.claim("key", "hash-a") == "accepted"
    assert registry.claim("key", "hash-a") == "replay"
    assert registry.claim("key", "hash-b") == "conflict"


def test_idempotency_expires():
    now = [0.0]
    registry = IdempotencyRegistry(ttl_seconds=5, clock=lambda: now[0])
    assert registry.claim("key", "hash") == "accepted"
    now[0] = 6
    assert registry.claim("key", "new") == "accepted"


def test_buffer_applies_backpressure_without_dropping_oldest():
    buffer = BoundedEventBuffer(capacity=1)
    event = EventEnvelope.create("1", "tenant", "invoice.created", {})
    buffer.publish(event)
    with pytest.raises(CapacityExceeded):
        buffer.publish(EventEnvelope.create("2", "tenant", "invoice.created", {}))
    assert buffer.consume() == event


def test_circuit_breaker_recovers_through_half_open():
    now = [0.0]
    breaker = CircuitBreaker(2, 10, lambda: now[0])
    breaker.failure(); breaker.failure()
    assert breaker.state == CircuitState.OPEN and not breaker.permit()
    now[0] = 11
    assert breaker.permit() and breaker.state == CircuitState.HALF_OPEN
    breaker.success()
    assert breaker.state == CircuitState.CLOSED


def test_forecast_is_deterministic_and_validated():
    assert forecast_cash_requirements([100, 200, 300], periods=2) == [214.75, 214.75]
    with pytest.raises(ValueError):
        forecast_cash_requirements([])


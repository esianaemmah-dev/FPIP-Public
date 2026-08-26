"""Distributed backing stores must behave like their in-process counterparts.

Fakes stand in for a real Redis/Cosmos server so these run in CI without live
infra; `test_build_*` cases prove the factories pick the distributed backend
when configured+reachable and fall back to the in-process adapter otherwise —
the same contract `graph._get_checkpointer` already established for Cosmos.
"""
from __future__ import annotations

import sys
import types
from typing import Any

import pytest

from app.config import Config
from app.distributed import (
    CosmosIdempotencyRegistry,
    RedisCircuitBreaker,
    RedisSlidingWindowRateLimiter,
    build_circuit_breaker,
    build_idempotency_registry,
    build_rate_limiter,
)
from app.enterprise_controls import SlidingWindowRateLimiter
from app.reliability import CircuitState, IdempotencyRegistry


class FakeRedis:
    """Minimal in-memory stand-in covering only the commands distributed.py calls."""

    def __init__(self) -> None:
        self._zsets: dict[str, dict[str, float]] = {}
        self._hashes: dict[str, dict[str, str]] = {}

    def zremrangebyscore(self, key: str, min_score: Any, max_score: float) -> None:
        z = self._zsets.get(key, {})
        self._zsets[key] = {m: s for m, s in z.items() if s > max_score}

    def zcard(self, key: str) -> int:
        return len(self._zsets.get(key, {}))

    def zrange(self, key: str, start: int, end: int, withscores: bool = False):
        items = sorted(self._zsets.get(key, {}).items(), key=lambda kv: kv[1])
        window = items[start : end + 1] if end != -1 else items[start:]
        return window if withscores else [m for m, _ in window]

    def zadd(self, key: str, mapping: dict[str, float]) -> None:
        self._zsets.setdefault(key, {}).update(mapping)

    def expire(self, key: str, seconds: int) -> None:
        pass  # no eviction needed for these tests

    def hget(self, key: str, field: str):
        return self._hashes.get(key, {}).get(field)

    def hgetall(self, key: str) -> dict[str, str]:
        return dict(self._hashes.get(key, {}))

    def hset(self, key: str, field: str, value: str) -> None:
        self._hashes.setdefault(key, {})[field] = value

    def hincrby(self, key: str, field: str, amount: int) -> int:
        current = int(self._hashes.setdefault(key, {}).get(field, "0"))
        current += amount
        self._hashes[key][field] = str(current)
        return current

    def delete(self, key: str) -> None:
        self._zsets.pop(key, None)
        self._hashes.pop(key, None)

    def ping(self) -> bool:
        return True


class FakeCosmosContainer:
    def __init__(self) -> None:
        self._items: dict[str, dict[str, Any]] = {}

    def create_item(self, body: dict[str, Any]) -> dict[str, Any]:
        from azure.cosmos import exceptions as cosmos_exceptions

        if body["id"] in self._items:
            raise cosmos_exceptions.CosmosResourceExistsError(status_code=409, message="exists")
        self._items[body["id"]] = body
        return body

    def read_item(self, item: str, partition_key: str) -> dict[str, Any]:
        return self._items[item]


# ---------------------------------------------------------------------------
# RedisSlidingWindowRateLimiter
# ---------------------------------------------------------------------------


def test_redis_rate_limiter_allows_up_to_the_limit_then_blocks_within_the_window():
    now = [0.0]
    limiter = RedisSlidingWindowRateLimiter(FakeRedis(), limit=2, window_seconds=10, clock=lambda: now[0])
    assert limiter.allow("tenant:user")[0]
    assert limiter.allow("tenant:user")[0]
    allowed, retry_after = limiter.allow("tenant:user")
    assert not allowed and retry_after == pytest.approx(10, abs=0.01)


def test_redis_rate_limiter_releases_after_the_window_expires():
    now = [0.0]
    limiter = RedisSlidingWindowRateLimiter(FakeRedis(), limit=1, window_seconds=10, clock=lambda: now[0])
    assert limiter.allow("k")[0]
    assert not limiter.allow("k")[0]
    now[0] = 11
    assert limiter.allow("k")[0]


def test_redis_rate_limiter_tracks_keys_independently():
    limiter = RedisSlidingWindowRateLimiter(FakeRedis(), limit=1, window_seconds=10)
    assert limiter.allow("tenant-a")[0]
    assert limiter.allow("tenant-b")[0]
    assert not limiter.allow("tenant-a")[0]


# ---------------------------------------------------------------------------
# RedisCircuitBreaker
# ---------------------------------------------------------------------------


def test_redis_circuit_breaker_opens_after_threshold_and_recovers_through_half_open():
    now = [0.0]
    breaker = RedisCircuitBreaker(FakeRedis(), "fabric", failure_threshold=2, recovery_seconds=10, clock=lambda: now[0])
    assert breaker.permit()
    breaker.failure()
    breaker.failure()
    assert breaker.state == CircuitState.OPEN
    assert not breaker.permit()
    now[0] = 11
    assert breaker.permit()
    assert breaker.state == CircuitState.HALF_OPEN
    breaker.success()
    assert breaker.state == CircuitState.CLOSED


def test_redis_circuit_breaker_shares_state_across_two_client_handles():
    """Simulates two replicas: separate breaker instances, same Redis backend."""
    shared_redis = FakeRedis()
    replica_1 = RedisCircuitBreaker(shared_redis, "search", failure_threshold=2)
    replica_2 = RedisCircuitBreaker(shared_redis, "search", failure_threshold=2)

    replica_1.failure()
    replica_2.failure()  # trips the shared threshold even though replica_1 saw only 1

    assert replica_1.state == CircuitState.OPEN
    assert replica_2.state == CircuitState.OPEN
    assert not replica_1.permit()


# ---------------------------------------------------------------------------
# CosmosIdempotencyRegistry
# ---------------------------------------------------------------------------


def test_cosmos_idempotency_registry_distinguishes_replay_and_conflict():
    registry = CosmosIdempotencyRegistry(FakeCosmosContainer())
    assert registry.claim("key", "hash-a") == "accepted"
    assert registry.claim("key", "hash-a") == "replay"
    assert registry.claim("key", "hash-b") == "conflict"


def test_cosmos_idempotency_registry_isolates_independent_keys():
    registry = CosmosIdempotencyRegistry(FakeCosmosContainer())
    assert registry.claim("key-1", "hash") == "accepted"
    assert registry.claim("key-2", "hash") == "accepted"


# ---------------------------------------------------------------------------
# Factories: pick distributed backend when configured+reachable, else fall back
# ---------------------------------------------------------------------------


def _install_fake_redis_module(monkeypatch: pytest.MonkeyPatch, fake_client: FakeRedis) -> None:
    fake_module = types.SimpleNamespace(
        Redis=types.SimpleNamespace(from_url=lambda *a, **k: fake_client)
    )
    monkeypatch.setitem(sys.modules, "redis", fake_module)


def test_build_rate_limiter_uses_redis_when_configured_and_reachable(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(Config, "REDIS_URL", "redis://localhost:6379/0")
    _install_fake_redis_module(monkeypatch, FakeRedis())
    limiter = build_rate_limiter(10, 60)
    assert isinstance(limiter, RedisSlidingWindowRateLimiter)


def test_build_rate_limiter_falls_back_when_redis_url_unset(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(Config, "REDIS_URL", None)
    limiter = build_rate_limiter(10, 60)
    assert isinstance(limiter, SlidingWindowRateLimiter)


def test_build_rate_limiter_falls_back_when_redis_is_unreachable(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(Config, "REDIS_URL", "redis://localhost:6379/0")

    class _UnreachableClient:
        def ping(self):
            raise ConnectionError("no route to host")

    fake_module = types.SimpleNamespace(
        Redis=types.SimpleNamespace(from_url=lambda *a, **k: _UnreachableClient())
    )
    monkeypatch.setitem(sys.modules, "redis", fake_module)
    limiter = build_rate_limiter(10, 60)
    assert isinstance(limiter, SlidingWindowRateLimiter)


def test_build_circuit_breaker_uses_redis_when_configured_and_reachable(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(Config, "REDIS_URL", "redis://localhost:6379/0")
    _install_fake_redis_module(monkeypatch, FakeRedis())
    breaker = build_circuit_breaker("fabric")
    assert isinstance(breaker, RedisCircuitBreaker)


def test_build_idempotency_registry_falls_back_when_cosmos_unset(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(Config, "COSMOS_DB_ENDPOINT", None)
    monkeypatch.setattr(Config, "COSMOS_DB_CONNECTION_STRING", None)
    registry = build_idempotency_registry()
    assert isinstance(registry, IdempotencyRegistry)

"""Distributed backing stores for reliability primitives.

`reliability.py` and `enterprise_controls.py` document their rate limiter,
idempotency registry, and circuit breaker as single-instance/dev adapters.
Once FPIP runs as multiple Container App replicas (or across two Azure
regions, per docs/ENTERPRISE_RESILIENCE.md), each replica's copy of an
in-memory primitive is blind to what every other replica is doing: a client
can get `RATE_LIMIT_REQUESTS` per replica instead of per fleet, two replicas
can both accept the same "idempotent" webhook, and one replica tripping a
breaker doesn't stop its siblings from hammering the same failing dependency.

This module adds Redis- and Cosmos DB-backed equivalents exposing the exact
same call signatures as their in-process counterparts, plus `build_*`
factories that pick the distributed backend when it's configured and reachable
and otherwise fall back to the in-process adapter with a logged warning — the
same fallback shape already used by `graph._get_checkpointer`.
"""
from __future__ import annotations

import logging
import time
import uuid
from typing import Any, Callable

from app.reliability import CircuitBreaker, CircuitState, IdempotencyRegistry
from app.enterprise_controls import SlidingWindowRateLimiter

logger = logging.getLogger(__name__)


class RedisSlidingWindowRateLimiter:
    """Fleet-wide sliding-window limiter shared by every replica via Redis.

    Uses a per-key sorted set of request timestamps (ZADD/ZREMRANGEBYSCORE/
    ZCARD), the same algorithm as the in-process limiter it replaces. The
    check-then-add is two round trips rather than one atomic Lua script, so
    concurrent replicas racing at the exact limit boundary can very rarely
    both admit a request — an acceptable trade for a soft rate limit against
    the operational cost of shipping and maintaining a Lua script, and still
    an enormous improvement over today's fully independent per-replica counts.
    """

    def __init__(
        self,
        client: Any,
        limit: int,
        window_seconds: float,
        clock: Callable[[], float] = time.time,
    ):
        if limit < 1 or window_seconds <= 0:
            raise ValueError("limit and window_seconds must be positive")
        self._client = client
        self.limit = limit
        self.window_seconds = window_seconds
        self._clock = clock

    def allow(self, key: str) -> tuple[bool, float]:
        redis_key = f"fpip:ratelimit:{key}"
        now = self._clock()
        cutoff = now - self.window_seconds

        self._client.zremrangebyscore(redis_key, "-inf", cutoff)
        count = self._client.zcard(redis_key)
        if count >= self.limit:
            oldest = self._client.zrange(redis_key, 0, 0, withscores=True)
            retry_after = self.window_seconds
            if oldest:
                _, oldest_score = oldest[0]
                retry_after = self.window_seconds - (now - float(oldest_score))
            return False, max(0.0, retry_after)

        member = f"{now}:{uuid.uuid4().hex}"
        self._client.zadd(redis_key, {member: now})
        self._client.expire(redis_key, int(self.window_seconds) + 1)
        return True, 0.0


class CosmosIdempotencyRegistry:
    """Cross-region idempotency via Cosmos DB conditional writes.

    Relies on `create_item` failing when an item with the same id already
    exists in the partition — that check-and-insert is atomic at the Cosmos
    level, so two replicas (or two regions) racing to claim the same
    idempotency key can never both win the "accepted" outcome.
    """

    def __init__(self, container: Any, ttl_seconds: int = 86400):
        self._container = container
        self._ttl_seconds = ttl_seconds

    def claim(self, key: str, content_hash: str) -> str:
        from azure.cosmos import exceptions as cosmos_exceptions

        try:
            self._container.create_item(
                {"id": key, "content_hash": content_hash, "ttl": self._ttl_seconds}
            )
            return "accepted"
        except cosmos_exceptions.CosmosResourceExistsError:
            existing = self._container.read_item(item=key, partition_key=key)
            return "replay" if existing.get("content_hash") == content_hash else "conflict"


class RedisCircuitBreaker:
    """Circuit breaker state shared by every replica via a Redis hash.

    Approximate under concurrent writers by design, matching the simplicity
    of the in-memory `CircuitBreaker` it replaces: a failure count that
    briefly overshoots the threshold under a race is an acceptable trade for
    not needing a distributed lock on every call — the breaker still opens
    within one or two extra failures, immaterial next to `recovery_seconds`.
    """

    def __init__(
        self,
        client: Any,
        name: str,
        failure_threshold: int = 5,
        recovery_seconds: float = 30,
        clock: Callable[[], float] = time.time,
    ):
        self._client = client
        self._key = f"fpip:breaker:{name}"
        self.failure_threshold = failure_threshold
        self.recovery_seconds = recovery_seconds
        self._clock = clock

    @staticmethod
    def _decode(value: Any) -> str | None:
        if value is None:
            return None
        return value.decode() if isinstance(value, bytes) else str(value)

    @property
    def state(self) -> CircuitState:
        raw = self._decode(self._client.hget(self._key, "state"))
        return CircuitState(raw) if raw else CircuitState.CLOSED

    def permit(self) -> bool:
        data = self._client.hgetall(self._key) or {}
        data = {self._decode(k): self._decode(v) for k, v in data.items()}
        state = data.get("state", CircuitState.CLOSED.value)
        opened_at = data.get("opened_at")
        if state == CircuitState.OPEN.value and opened_at and self._clock() - float(opened_at) >= self.recovery_seconds:
            self._client.hset(self._key, "state", CircuitState.HALF_OPEN.value)
            return True
        return state != CircuitState.OPEN.value

    def success(self) -> None:
        self._client.delete(self._key)

    def failure(self) -> None:
        failures = self._client.hincrby(self._key, "failures", 1)
        if failures >= self.failure_threshold:
            self._client.hset(self._key, "state", CircuitState.OPEN.value)
            self._client.hset(self._key, "opened_at", str(self._clock()))


def _redis_client(redis_url: str) -> Any:
    import redis

    client = redis.Redis.from_url(redis_url, socket_timeout=2, socket_connect_timeout=2)
    client.ping()
    return client


def build_rate_limiter(limit: int, window_seconds: float) -> Any:
    """Return a Redis-backed limiter if REDIS_URL is configured and reachable, else in-process."""
    from app.config import Config

    if Config.REDIS_URL:
        try:
            client = _redis_client(Config.REDIS_URL)
            logger.info("Using Redis-backed rate limiter (fleet-wide).")
            return RedisSlidingWindowRateLimiter(client, limit, window_seconds)
        except Exception as exc:
            logger.warning(
                "Redis rate limiter unavailable (%s); falling back to in-process limiter.", exc
            )
    else:
        logger.warning(
            "REDIS_URL not set. Rate limiting is per-replica, not fleet-wide. "
            "Set REDIS_URL for a multi-replica or multi-region production deployment."
        )
    return SlidingWindowRateLimiter(limit, window_seconds)


def build_circuit_breaker(name: str, failure_threshold: int = 5, recovery_seconds: float = 30) -> Any:
    """Return a Redis-backed circuit breaker if REDIS_URL is configured and reachable, else in-process."""
    from app.config import Config

    if Config.REDIS_URL:
        try:
            client = _redis_client(Config.REDIS_URL)
            logger.info("Using Redis-backed circuit breaker '%s' (fleet-wide).", name)
            return RedisCircuitBreaker(client, name, failure_threshold, recovery_seconds)
        except Exception as exc:
            logger.warning(
                "Redis circuit breaker '%s' unavailable (%s); falling back to in-process breaker.",
                name,
                exc,
            )
    else:
        logger.warning(
            "REDIS_URL not set. Circuit breaker '%s' state is per-replica, not fleet-wide.", name
        )
    return CircuitBreaker(failure_threshold, recovery_seconds)


def build_idempotency_registry(ttl_seconds: float = 86400, max_entries: int = 100_000) -> Any:
    """Return a Cosmos DB-backed registry if configured and reachable, else in-process."""
    from app.config import Config

    if Config.COSMOS_DB_ENDPOINT or Config.COSMOS_DB_CONNECTION_STRING:
        try:
            from azure.cosmos import CosmosClient
            from azure.identity import DefaultAzureCredential

            client = (
                CosmosClient.from_connection_string(Config.COSMOS_DB_CONNECTION_STRING)
                if Config.COSMOS_DB_CONNECTION_STRING
                else CosmosClient(Config.COSMOS_DB_ENDPOINT, credential=DefaultAzureCredential())
            )
            database = client.get_database_client(Config.COSMOS_DB_DATABASE)
            container = database.get_container_client(Config.COSMOS_IDEMPOTENCY_CONTAINER)
            logger.info("Using Cosmos DB-backed idempotency registry (cross-region).")
            return CosmosIdempotencyRegistry(container, ttl_seconds=int(ttl_seconds))
        except Exception as exc:
            logger.warning(
                "Cosmos idempotency store unavailable (%s); falling back to in-process registry.", exc
            )
    else:
        logger.warning(
            "COSMOS_DB_ENDPOINT not set. Idempotency claims are per-replica, not cross-region. "
            "Set COSMOS_DB_ENDPOINT for a multi-replica or multi-region production deployment."
        )
    return IdempotencyRegistry(ttl_seconds=ttl_seconds, max_entries=max_entries)

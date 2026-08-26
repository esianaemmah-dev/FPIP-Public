# FPIP Enterprise Resilience Architecture

## Implemented in code

- Bounded request rate limiting and load shedding — Redis-backed and
  fleet-wide when `REDIS_URL` is configured and reachable, falling back to a
  per-replica in-process limiter otherwise; the running agent API always
  builds its live limiter through this path (`app/distributed.py`,
  `build_rate_limiter`)
- Idempotency/replay/conflict detection primitives — Cosmos DB conditional
  writes give cross-region correctness when `COSMOS_DB_ENDPOINT` is
  configured (`build_idempotency_registry`); falls back to a bounded
  in-process registry. Not yet wired to a live call site — available for the
  next integration (e.g. inbound webhooks) that needs it.
- Bounded event buffering and explicit back-pressure — still an in-process
  development adapter (`BoundedEventBuffer`); production event durability is
  Service Bus Premium, not yet implemented here (see "Items requiring tenant
  evidence" below)
- Circuit-breaker state machine for external providers — Redis-backed and
  fleet-wide when `REDIS_URL` is configured (`build_circuit_breaker`), so one
  replica tripping a breaker stops every replica from hammering the same
  failing dependency; falls back to a per-replica in-process breaker. Not yet
  wired to a live outbound call site.
- Tamper-evident HMAC audit chain
- Fail-closed compliance and explainable fraud/vendor-risk controls
- RBAC-protected, versioned FastAPI surface
- Deterministic cash-requirement forecast baseline

All three distributed adapters above degrade to their single-instance
equivalent (with a logged warning) if the backing store is unset or
unreachable at startup — the service never fails to start because Redis or
Cosmos is unavailable, it just silently loses fleet-wide correctness until
that's fixed. Treat that warning log as an operational alert in any
multi-replica deployment.

## Azure tenant deployment target

Azure Front Door Premium routes to Container Apps in two regions. Each region uses at least two replicas, zone redundancy where supported, managed identity, private endpoints, Key Vault and Application Insights. Durable events use Service Bus Premium; cross-region idempotency uses Cosmos DB conditional writes. Audit records are exported to an Azure Storage container with time-based immutability and legal holds. Dataverse, Fabric and SharePoint remain the approved system boundaries.

No direct core-banking connector is introduced. Payment controls only authorize workflow progression; an approved Fabric/payment integration performs execution after human authorization.

## Items requiring tenant evidence

- Provision Azure Cache for Redis (zone-redundant) and set `REDIS_URL`; without
  it the deployed rate limiter and circuit breaker are correct per-replica but
  not fleet-wide
- Provision the Cosmos DB idempotency container and set `COSMOS_DB_ENDPOINT` /
  `COSMOS_IDEMPOTENCY_CONTAINER` once a caller (e.g. an inbound webhook) needs
  cross-region idempotency
- Front Door origin failover and DNS behavior
- Zone/region capacity and quota
- Dataverse and Cosmos backup/restore
- WORM retention policy lock
- Key rotation and managed-identity access
- Service Bus duplicate detection and dead-letter replay
- Load, soak, penetration and chaos-test results
- Approved KYC/AML, credit-risk and adverse-media providers
- Availability calculation across all dependencies

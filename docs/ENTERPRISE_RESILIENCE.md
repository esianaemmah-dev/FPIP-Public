# FPIP Enterprise Resilience Architecture

## Implemented in code

- Bounded request rate limiting and load shedding
- Idempotency/replay/conflict detection primitives
- Bounded event buffering and explicit back-pressure
- Circuit-breaker state machine for external providers
- Tamper-evident HMAC audit chain
- Fail-closed compliance and explainable fraud/vendor-risk controls
- RBAC-protected, versioned FastAPI surface
- Deterministic cash-requirement forecast baseline

## Azure tenant deployment target

Azure Front Door Premium routes to Container Apps in two regions. Each region uses at least two replicas, zone redundancy where supported, managed identity, private endpoints, Key Vault and Application Insights. Durable events use Service Bus Premium; cross-region idempotency uses Cosmos DB conditional writes. Audit records are exported to an Azure Storage container with time-based immutability and legal holds. Dataverse, Fabric and SharePoint remain the approved system boundaries.

No direct core-banking connector is introduced. Payment controls only authorize workflow progression; an approved Fabric/payment integration performs execution after human authorization.

## Items requiring tenant evidence

- Front Door origin failover and DNS behavior
- Zone/region capacity and quota
- Dataverse and Cosmos backup/restore
- WORM retention policy lock
- Key rotation and managed-identity access
- Service Bus duplicate detection and dead-letter replay
- Load, soak, penetration and chaos-test results
- Approved KYC/AML, credit-risk and adverse-media providers
- Availability calculation across all dependencies

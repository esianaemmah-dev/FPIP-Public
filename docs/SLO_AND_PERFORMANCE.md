# FPIP Service-Level Objectives and Performance Evidence

## Proposed production objectives

These are objectives, not current measured guarantees.

| Signal | Objective | Measurement |
|---|---:|---|
| API availability | 99.95% monthly initially | Azure Front Door and Application Insights synthetic checks |
| Read API latency | p95 < 500 ms | Application Insights request duration |
| Control decision latency | p95 < 750 ms excluding third-party providers | Distributed trace spans |
| Agent first-token latency | p95 < 3 seconds | SSE first-byte custom metric |
| Event acceptance | p95 < 250 ms | Ingestion endpoint span |
| Error rate | < 1% over 5 minutes | 5xx / total requests |
| Recovery point | <= 5 minutes | Dataverse, Cosmos and audit-export replication evidence |
| Recovery time | <= 30 minutes | Quarterly failover exercise |

The requested 99.999% target allows about 26 seconds of downtime per month and cannot be asserted from application code. It requires a contracted end-to-end Azure architecture, dependency SLAs, active-active deployment, operational staffing, and measured failover evidence.

## Load-test gate

Run `k6 run tests/load/enterprise-controls.js` against staging. Promotion requires zero unexpected failures, p95 below the stated threshold, no unbounded queue growth and stable CPU/memory after the soak period. Record environment, commit SHA, dataset size, virtual users, results and approver.

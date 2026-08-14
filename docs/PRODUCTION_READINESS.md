# FPIP production-readiness control matrix

This matrix separates repository-complete controls from customer-tenant evidence.
It must be reviewed before any bank or corporate production deployment.

| Control area | Repository control | Tenant evidence required |
|---|---|---|
| Identity | MSAL SPA; Entra JWT validation on agent API | App registrations, consent and conditional-access evidence |
| Authorization | UI RBAC; role-to-agent gates; per-agent table allowlists | Dataverse role exports and negative-access tests |
| Supplier isolation | Required Supplier lookup; query and search self-filters | Two-supplier cross-access penetration test |
| AI governance | Read-only constitution, scoped tools, user-isolated threads | Model deployment approval and prompt-injection test report |
| Data | 13-table Dataverse manifest; Fabric-only banking path | Data classification, residency and retention approval |
| Secrets | Placeholder-only public configuration; Key Vault integration | Key rotation and managed-identity evidence |
| Resilience | Health/readiness probes, 2–10 Container App replicas | Load, failover, backup and recovery results |
| Audit | Human/AI actor audit model and request correlation IDs | Immutable export/retention and SIEM alert verification |
| Delivery | Frontend, backend and manifest CI quality gates | Protected branch and required-check settings |
| Workflow | Four approval-flow definitions and configurable policies | Imported flows, approvers, escalation and SoD UAT |

## Release gate

The repository can reach a **9.7/10 implementation-readiness rating** when all
automated checks pass. A production deployment is not rated 9.7 until every
tenant-evidence item above is signed off. Azure-dependent evidence deliberately
remains a deployment placeholder because it must belong to the customer tenant.

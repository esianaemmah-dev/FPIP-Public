# FPIP production-readiness control matrix

This matrix separates repository-complete controls from customer-tenant evidence.
It must be reviewed before any bank or corporate production deployment.

| Control area | Repository control | Tenant evidence required |
|---|---|---|
| Identity | MSAL SPA; Entra JWT validation on agent API | App registrations, consent and conditional-access evidence |
| Authorization | UI RBAC; role-to-agent gates; per-agent table allowlists | Dataverse role exports and negative-access tests |
| Supplier isolation | Required Supplier lookup; query and search self-filters; automated two-supplier cross-tenant tests, including a fixed OData filter-injection bypass (`test_supplier_isolation.py`) | Two-supplier cross-access penetration test against a live Dataverse tenant — see [runbook A](#a-supplier-isolation--live-two-tenant-test) |
| AI governance | Read-only constitution, scoped tools, user-isolated threads | Model deployment approval and prompt-injection test report |
| Data | 13-table Dataverse manifest; Fabric-only banking path | Data classification, residency and retention approval |
| Secrets | Placeholder-only public configuration; Key Vault integration | Key rotation and managed-identity evidence |
| Resilience | Health/readiness probes, 2–10 Container App replicas | Load, failover, backup and recovery results |
| Audit | Human/AI actor audit model and request correlation IDs | Immutable export/retention and SIEM alert verification |
| Delivery | Frontend, backend and manifest CI quality gates | Protected branch and required-check settings |
| Workflow | Four approval-flow definitions and configurable policies | Imported flows, approvers, escalation and SoD UAT — see [runbook B](#b-approval-flows--activation-per-tenant) |
| Compliance / vendor-risk providers | Deterministic fail-closed baselines in `enterprise_controls.py` | Approved providers, DPA review, threshold validation — see [runbook C](#c-compliance-and-vendor-risk-providers--integration-prerequisites) |
| Authorization roles | 9 Dataverse security roles defined in `FPIP_Core/roles.md`, consistency enforced by `scripts/validate-role-artifacts.py` | Roles hand-configured per tenant; negative-access test per role; resolve the contract-manager SoD warning in `roles.md` |

## Activation runbooks

The matrix above names the evidence required; these are the procedures that
produce it. Each ends in a sign-off line that belongs in the deployment record.

### A. Supplier isolation — live two-tenant test

`agent-service/tests/test_supplier_isolation.py` proves isolation in unit tests
only, including a fixed OData filter-injection bypass. That fix is exactly why
the live test matters: the guarantee depends on Dataverse row-level security and
the agent's query filter agreeing in a real tenant.

1. Provision two suppliers (`Supplier A`, `Supplier B`) as `fpip_supplier` rows.
2. Create one Entra External ID user per supplier, each carrying the
   `extension_supplierId` claim (the claim name is `SUPPLIER_ID_CLAIM` in
   `agent-service/app/config.py`) for its own supplier only.
3. Assign both the **FPIP Supplier Portal User** role and nothing else.
4. Seed data owned by each supplier: at least one `fpip_bid`, `fpip_invoice` and
   `fpip_compliancedocument` per supplier, plus one internal `fpip_requisition`
   and one `fpip_tender` owned by neither.
5. Signed in as Supplier A, attempt each of these and record the result:
   - Supplier Portal listings show **only** A's bids, invoices and documents.
   - Direct Web API call for B's bid by GUID → expect 404/empty, never 200.
   - Same for B's invoice and compliance document.
   - Any internal table (`fpip_requisition`, `fpip_tender`,
     `fpip_purchaseorder`, `fpip_contract`, `fpip_approvalrequest`,
     `fpip_auditlogentry`) → expect no access.
   - Through the agent API: ask the supplier agent for "all bids" and for B's
     data by name; confirm neither returns B's rows.
   - Attempt a filter-injection style query (an unbalanced-parenthesis filter
     fragment) against a supplier-scoped table; confirm rejection.
6. Repeat the whole step 5 as Supplier B against A.
7. Confirm every attempt above appears in `fpip_auditlogentry`.

**Sign-off:** tester, date, tenant, and an explicit "no cross-supplier data was
returned in any attempt" statement. Any single 200 that should have been empty
blocks release.

### B. Approval flows — activation per tenant

The four definitions in `power-automate/` are exports, not running flows. Note
that approver identities are **not** edited into the flow JSON — all three
(`fpip_primary_approver`, `fpip_escalation_approver`, `fpip_committee_team`) are
read at runtime from the `fpip_approvalpolicy` row the flow looks up, so most of
this work is data, not flow editing.

1. Import all four flows (`requisition-approval`, `tender-award`,
   `invoice-exception`, `contract-renewal`) and connect Dataverse + Approvals.
2. Create the Dataverse **team** that `fpip_committee_team` will reference — the
   tender-award flow requires unanimous approval from its members.
3. Seed `fpip_approvalpolicy` rows, one per policy type, each with:
   `fpip_threshold_amount` + `fpip_threshold_currency`, real
   `fpip_primary_approver` and `fpip_escalation_approver` UPNs, the committee
   team for tender award, `fpip_requires_unanimous` set appropriately, and
   `fpip_active = true`.
4. Verify schema names in each flow's `filter` expressions match this tenant.
5. Test one record per flow in a sandbox: a requisition below threshold (primary
   approver only), one above (escalation), a tender award (every committee
   member must approve), an invoice with an exception flag, and a contract
   expiring within 90 days.
6. Confirm each run writes `fpip_auditlogentry` with `actor_type = Human (1)`.
7. Turn the flows on.

**Sign-off:** one test record reference per flow, the approver UPNs used, and
confirmation that no flow routes to a placeholder identity.

### C. Compliance and vendor-risk providers — integration prerequisites

`agent-service/app/enterprise_controls.py` ships deterministic baselines
(`assess_fraud`, `assess_compliance`, `assess_vendor_risk`,
`authorize_milestone_payment`), each returning a `ControlDecision`
(`outcome` ∈ allow/review/block, `score`, `reasons`, `requires_human_review`).
That dataclass is the integration seam: a provider supplies evidence that feeds
the score and reasons.

**Non-negotiable:** a provider response may *escalate* an outcome but must never
downgrade one. Hard rules — duplicate invoice, recently changed bank account, a
failed sanctions check — stay fail-closed regardless of what a provider returns,
and no provider may set `requires_human_review` to false.

1. Select and contract providers for KYC/AML and sanctions screening,
   credit/financial risk, and adverse-media. Record the institution's approval.
2. Complete data-sharing/DPA review — supplier identifiers and beneficial-owner
   data leave the tenant on these calls.
3. Point `COMPLIANCE_PROVIDER_URL` and `VENDOR_RISK_PROVIDER_URL`
   (`agent-service/app/config.py`) at the approved endpoints; store credentials
   in Key Vault and reach them via managed identity.
4. Wrap each outbound provider call in the circuit breaker from
   `app/distributed.py` so a provider outage degrades to fail-closed rather than
   hanging the control path.
5. Define and document the refresh SLA per feed (how stale a vendor-risk score
   may be before it is refused).
6. Have a second party independently validate scoring thresholds against a
   labelled sample before the model influences any live decision.

**Sign-off:** provider names, contract/DPA references, threshold-validation
result, and a test showing a provider timeout produces a fail-closed `review` or
`block` — never an `allow`.

## Release gate

The repository can reach a **9.7/10 implementation-readiness rating** when all
automated checks pass. A production deployment is not rated 9.7 until every
tenant-evidence item above is signed off. Azure-dependent evidence deliberately
remains a deployment placeholder because it must belong to the customer tenant.

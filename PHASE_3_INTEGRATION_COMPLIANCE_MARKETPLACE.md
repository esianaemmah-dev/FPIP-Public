# PHASE 3 — Integration, Compliance & Marketplace Readiness
### Read this before writing any code. Context for the coding agent.

**Prerequisite**: Phases 1 and 2 done — Dataverse + React UI working with real data, LangGraph agent service live and answering questions grounded in real Azure AI Search / Fabric data.

---

## Goal of this phase

Wire up the pieces that make FPIP sellable and operable at a bank: Power Automate workflows acting on the `fpip_approvalrequest` table, the real Fabric bank-side data handshake, SharePoint document management turned on for real, governance/audit wiring, and Azure Managed Application packaging for Partner Center submission.

**Definition of done**: a requisition over a configured threshold routes to an approver through Power Automate, the approver's decision writes back to Dataverse, an auditor can see a complete trail of who (or which agent) did what, and the Managed Application package validates and is ready for a Partner Center submission (or an AppSource submission — confirm which listing type was chosen before this phase, per `01_Azure_Architecture_Design.md`).

---

## Task 1 — Power Automate approval workflows

Build flows (Power Automate, not code) triggered on `fpip_approvalrequest` create/update:
- **Requisition approval** — routes to the requester's manager if amount is under the configured threshold, to the Procurement Director if over. Writes the decision back to `fpip_requisition.status`.
- **Tender award approval** — routes to the Procurement Committee (Dataverse team), requires all members to approve before `fpip_tender.status` moves to Awarded.
- **Invoice exception approval** — triggers only when `fpip_invoice.match_status` is not `3-Way Match` or `duplicate_flag` is true; routes to Finance.
- **Contract renewal approval** — triggers when a contract's `expiry_date` is within 90 days and no renewal record exists yet.

Each flow must write an entry to `fpip_auditlogentry` on every decision (actor_type: Human), so the Governance & Audit page has real data to show, not the static demo rows.

Confirm with the human before hardcoding specific dollar thresholds — these should be configurable (a small Dataverse "Approval Policy" settings table is the right no-code way to do this, not a value baked into the flow).

---

## Task 2 — Fabric bank-side handshake (test environment)

This task is about the **FPIP side** of the Fabric connection only — do not attempt to build or simulate the bank's own Data Factory pipeline, that is explicitly the bank's responsibility per `03_Fabric_Integration_and_Managed_App.md`.

- Provision a test Fabric workspace with a Lakehouse containing sample tables shaped like real banking data (transactions, payment confirmations, account balances) — this stands in for "the bank's OneLake" during development.
- Configure **Dataverse's Link to Microsoft Fabric** against this test workspace; confirm mirrored tables appear in Dataverse.
- Confirm the `fabric_sql_tool` built in Phase 2 can query this test Lakehouse's SQL analytics endpoint successfully.
- Document the exact onboarding steps a real bank's Fabric admin would need to follow to connect their production workspace — this becomes onboarding documentation, not code.

---

## Task 3 — SharePoint document management, for real

- Enable native SharePoint Document Management on `fpip_compliancedocument`, `fpip_contract`, and `fpip_supplier` in Dataverse (a configuration toggle, not code).
- Confirm the Azure AI Search SharePoint connector (set up in Phase 2) picks up new documents automatically without a manual re-index.
- Update the React UI's document upload flow (the Supplier Portal's "submit new document" modal from `FPIP_UI_Demo.html`) to actually upload into the linked SharePoint library through Dataverse, rather than just storing a placeholder URL as it did in Phase 1.

---

## Task 4 — Governance, audit, and Purview

- Confirm Dataverse's built-in audit logging is enabled on all `fpip_*` tables.
- Connect Microsoft Purview for data lineage and sensitivity labeling across Dataverse and the linked Fabric/SharePoint sources.
- Rebuild the Governance & Audit page's audit trail table (currently static rows in the demo) to read from `fpip_auditlogentry`, combining both Power Automate-driven human actions (Task 1) and AI agent actions (logged by the agent service in Phase 2 — confirm the agent service writes an audit entry on every tool call that reads sensitive data, not just on user-facing replies).

---

## Task 5 — Azure Managed Application packaging

- Finalize `mainTemplate.json`, `createUiDefinition.json`, and `viewDefinition.json` from the Phase 1 skeleton with real resource definitions: Dataverse environment reference, the Container App from Phase 2, Key Vault, Static Web App, and parameters for the Fabric workspace link.
- If the pricing model is usage-based, implement the Marketplace Metering Service webhook (small Azure Function, Python) per `01_Azure_Architecture_Design.md` Section 4. If pricing is flat/BYOL, confirm with the human that this can be skipped.
- Validate the full package with `az deployment group validate` against a clean test resource group, then a full test deployment end to end.
- Prepare Partner Center listing assets (description, screenshots — the polished `FPIP_UI_Demo.html` pages are a good source for these, categories, support contact) — this is a submission-readiness task, not a code task, but flag it here so nothing is missed before go-live.

---

## Acceptance checklist for Phase 3

- [ ] All four Power Automate approval flows are live and write back to Dataverse and the audit log
- [ ] Approval thresholds are configurable in Dataverse, not hardcoded in a flow
- [ ] Dataverse Link to Microsoft Fabric confirmed working against a test Lakehouse
- [ ] `fabric_sql_tool` successfully queries the test Lakehouse
- [ ] SharePoint document management is live on the three tables listed above, and the Supplier Portal upload flow uses it
- [ ] Azure AI Search re-indexes new SharePoint documents automatically
- [ ] Purview shows data lineage across Dataverse, Fabric, and SharePoint sources
- [ ] Governance & Audit page shows real audit entries from both human approvals and AI agent tool calls
- [ ] Managed Application package validates and deploys cleanly to a fresh test resource group
- [ ] Metering webhook implemented and tested, if the pricing model requires it — otherwise explicitly confirmed unnecessary
- [ ] Partner Center listing assets prepared

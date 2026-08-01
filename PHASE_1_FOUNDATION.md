# PHASE 1 — Foundation
### Read this before writing any code. Context for the coding agent.

**Project**: FPIP (Finance & Procurement Intelligence Platform) — Azure Managed Application for financial institutions.

**Confirmed architecture decisions** (do not deviate without flagging to the human):
- Distribution: **Azure Managed Application** — resources deploy into the customer's own Azure subscription/tenant.
- Data layer: **Microsoft Dataverse**.
- Frontend: **custom-coded React app** (not Power Apps) — reuse the layout, color system, and page structure already validated in `FPIP_UI_Demo.html`. Treat that file as the visual/UX source of truth for this phase.
- Auth: **Microsoft Entra ID** via MSAL.
- Workflow/approvals: **Power Automate**, triggered on Dataverse record changes — not built in this phase, but the schema below must support it.
- AI agents: **LangGraph**, not Copilot Studio — built in Phase 2, not this phase. Do not add Copilot Studio anywhere.
- Banking data: arrives via **Microsoft Fabric only** (see `03_Fabric_Integration_and_Managed_App.md`) — do not build any direct core-banking connector in this or any phase.
- Documents: **SharePoint/OneDrive**, referenced from Dataverse — do not build a custom document store.

Read `01_Azure_Architecture_Design.md`, `02_Feature_Roadmap_2026.md`, and `03_Fabric_Integration_and_Managed_App.md` in this same folder before starting — they contain the reasoning behind every decision above.

---

## Goal of this phase

Stand up the Dataverse schema, Entra ID auth, the Managed Application deployment skeleton, and a working React UI scaffold that authenticates and reads/writes real Dataverse records for the five FPIP modules: Executive, Procurement, Finance, Supplier Portal, Governance & Audit. No AI agents yet — that's Phase 2.

**Definition of done**: a developer can log in with an Entra ID account, see real data pulled from Dataverse in each of the five module views, create a requisition, and see it persist. No AI chat is expected to work yet — those UI slots can render a "coming in Phase 2" placeholder.

---

## Task 1 — Dataverse schema

Create a Dataverse solution named `FPIP_Core` containing these tables (use Dataverse's standard naming: prefix `fpip_`):

| Table | Key columns | Notes |
|---|---|---|
| `fpip_supplier` | name, status (choice: Prequalified/Approved/Suspended), category, risk_score (decimal), tax_cert_expiry (date) | Row-level security: a Supplier's portal user can only read their own record — configure via a security role scoped to the record owner/team |
| `fpip_requisition` | title, department (choice), category (choice), amount (currency), status (choice: Draft/Sourcing/Awaiting Approval/Escalated/PO Issued), budget_check_result (choice: Within Budget/Exceeds Budget) | Lookup to Supplier (optional at requisition stage) |
| `fpip_tender` | title, category, status (choice: Draft/Open/Evaluation/Awarded/Closed), closing_date, estimated_value | |
| `fpip_bid` | Lookup to Tender, Lookup to Supplier, price_score, compliance_score, delivery_score, status (choice: Submitted/Under Review/Shortlisted/Rejected) | |
| `fpip_purchaseorder` | Lookup to Requisition, Lookup to Supplier, po_number (autonumber), amount, status (choice: Pending Approval/Approved/Delivered) | |
| `fpip_invoice` | Lookup to PurchaseOrder, Lookup to Supplier, invoice_number, amount, match_status (choice: 3-Way Match/Qty Mismatch/Manual Review), duplicate_flag (yes/no), payment_status (choice: Held/Approved/Paid) | |
| `fpip_contract` | title, Lookup to Supplier, value, term_months, expiry_date | |
| `fpip_compliancedocument` | Lookup to Supplier, document_type (choice), expiry_date, status (choice: Verified/Renewal Due/Expired), sharepoint_url (text — see Task 4) | |
| `fpip_approvalrequest` | record_type (choice), Lookup (polymorphic — use a text field storing the related record's GUID + table name until Power Automate is built in a later phase), amount, status (choice: Pending/Approved/Rejected/Escalated), requested_by, waiting_since (datetime) | This table is what Phase-later Power Automate flows will act on |
| `fpip_auditlogentry` | timestamp, actor, actor_type (choice: Human/AI Agent), action, entity_reference, source_detail | Populate this from Dataverse's built-in audit log via a scheduled export, or write to it directly from every create/update — decide and document whichever approach is used |

**Security roles to configure** (Dataverse security, not application code):
- `FPIP Executive` — read all tables
- `FPIP Procurement` — read/write Requisition, Tender, Bid, PurchaseOrder; read Supplier, Contract
- `FPIP Finance` — read/write Invoice, PurchaseOrder (read); read Contract, Supplier
- `FPIP Auditor` — read-only on all tables, no write access anywhere
- `FPIP Supplier Portal User` — read/write only on records where they are the referenced Supplier (own Bids, own Invoices, own ComplianceDocuments); no visibility into other suppliers' data — this is the isolation guarantee, verify it with a real test user before calling this task done

---

## Task 2 — Entra ID setup

Register two Entra ID applications:
1. **`FPIP-Web-SPA`** — single-page application, redirect URIs for local dev (`http://localhost:5173`) and the Static Web App production URL. Delegated permission: `Dataverse user_impersonation` (or the equivalent Dataverse API scope). This is what the React app uses via MSAL.
2. **`FPIP-Supplier-External`** — same as above but configured for Entra External ID (guest/B2B or B2C flow, whichever the bank's Fabric/Entra setup supports) — used only by the Supplier Portal login, kept separate from internal staff auth intentionally.

Do not create a third "backend" app registration yet — that comes in Phase 2 for the LangGraph service.

---

## Task 3 — Managed Application deployment skeleton

Create the following in the repo, even if some values are placeholders for now:

```
/infra
  mainTemplate.json        (ARM template — Managed App resource group contents: Dataverse env reference, placeholder for Phase 2 Container App, Key Vault, Static Web App)
  createUiDefinition.json  (Partner Center install-time UI — parameters: region, environment name, Fabric workspace ID to link, plan tier)
  viewDefinition.json      (post-install management view shown to the publisher in Azure Portal)
```

Do not attempt to publish to Partner Center in this phase — just get the templates validating locally (`az deployment group validate`) against a test resource group.

---

## Task 4 — React UI scaffold

Stack: **Vite + React + TypeScript**, hosted on **Azure Static Web Apps**.

```
/app
  /src
    /auth        (MSAL config, login/logout, token acquisition for Dataverse scope)
    /api
      dataverseClient.ts   (thin wrapper around Dataverse Web API — GET/POST/PATCH against fpip_* tables using the acquired token)
    /pages
      ExecutiveDashboard.tsx
      Procurement.tsx
      Finance.tsx
      SupplierPortal.tsx
      Governance.tsx
      Copilot.tsx          (placeholder page — "AI agents arrive in Phase 2", no functional chat yet)
    /components            (reuse the visual patterns from FPIP_UI_Demo.html: KPI cards, pill statuses, tabs, sidebar nav, modal, toast — rebuild as React components, not a copy-paste of the static HTML)
    App.tsx
    main.tsx
  package.json
  vite.config.ts
```

Rebuild the sidebar collapse behavior, the tab switching, the modal system, and the toast notifications as real React state (`useState`/`useReducer`) — the static HTML demo used vanilla DOM manipulation, which should not be carried into the React version.

Wire `SharePoint/OneDrive` document links at this stage as **plain URLs stored in `fpip_compliancedocument.sharepoint_url`** — do not build any SharePoint upload UI yet; that's a later-phase nice-to-have once Dataverse's native SharePoint document management is enabled on the relevant tables.

---

## Acceptance checklist for Phase 1

- [ ] Dataverse solution `FPIP_Core` deployed with all 10 tables and 5 security roles
- [ ] A test user in each of the 5 roles can log in and see only what their role permits (verify Supplier isolation specifically — this is the one that must not leak)
- [ ] React app authenticates via MSAL against `FPIP-Web-SPA`
- [ ] Each of the five module pages reads real data from Dataverse (not mock data) and renders it in the layout style established by `FPIP_UI_Demo.html`
- [ ] A requisition created in the UI persists in Dataverse and is visible on reload
- [ ] ARM/Bicep templates validate locally
- [ ] Copilot page renders a clear "coming in Phase 2" placeholder — no broken chat UI

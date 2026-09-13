# FPIP_Core Security Roles (Phase 1, Task 1)

These are **Dataverse security roles** (configured in the Power Platform admin
center / Dataverse, not application code). They map to the FPIP personas defined
in `app/src/lib/rbac.ts`.

Every role ID the UI offers must appear here, because the React SPA calls the
Dataverse Web API **directly** with the signed-in user's delegated token —
`rbac.ts` only gates which screens render, it does not enforce data access. The
one exception is `admin`, which is backed by a built-in platform role (see
[FPIP Admin](#fpip-admin-platform-administrator) below).

## Roles

### FPIP Executive
- **Scope:** Organization (all records).
- **Permissions:** Read on all `fpip_*` tables. No create/write/delete.

### FPIP Procurement
- **Scope:** Organization.
- **Permissions:**
  - Read + Create + Write + Append: `fpip_requisition`, `fpip_tender`, `fpip_bid`, `fpip_purchaseorder`, `fpip_rfqschema`, `fpip_rfqresponse`
  - Read only: `fpip_supplier`, `fpip_contract`

### FPIP Finance
- **Scope:** Organization.
- **Permissions:**
  - Read + Create + Write + Append: `fpip_invoice`
  - Read only: `fpip_purchaseorder`, `fpip_contract`, `fpip_supplier`

### FPIP Auditor
- **Scope:** Organization.
- **Permissions:** Read only on all `fpip_*` tables. No create/write/delete/append anywhere.

### FPIP Supplier Portal User
- **Scope:** **User / Business-unit scoped via record ownership/team** — this is the
  isolation guarantee. A Supplier Portal user must only see records where they
  are the referenced Supplier.
- **Permissions:**
  - Read: published `fpip_rfqschema` records for tenders available to them
  - Create + Read + Write: `fpip_bid`, `fpip_invoice`, `fpip_compliancedocument`, `fpip_rfqresponse` — **only their own** (referenced `fpip_Supplier` = the supplier they represent)
  - Read: `fpip_supplier` — **only their own record**
  - No visibility into other suppliers' bids, invoices, documents, or into any
    internal-only tables (requisitions, tenders, POs, contracts, approval
    requests, audit log).

### FPIP HOD

- **Scope:** Read at **Organization** depth; Create at **User** depth.
- **Permissions:**
  - Create: `fpip_requisition`
  - Read: `fpip_requisition`
  - Nothing else — no write or delete, and no access to any other table.
- **Why Read is Organization-depth:** `budget_owner_dash` renders
  `BudgetOwner.tsx`, which reads requisitions across departments and filters
  client-side. A User-depth read would silently return nothing.
- **Why no Write:** `HodRequisition.tsx` submits new requisitions and lists
  existing ones; there is no edit path. Add Write (User depth) only when a
  draft-edit flow ships.

### FPIP Budget Owner

- **Scope:** Organization.
- **Permissions:**
  - Read: `fpip_requisition`, `fpip_invoice`, `fpip_purchaseorder`,
    `fpip_supplier`
  - **No create, write or delete anywhere** — this role is strictly read-only.
- **Where the read breadth comes from:** `budget_owner_dash` needs only
  `fpip_requisition`; the `finance` feature adds `Finance.tsx`
  (invoice/PO/supplier).
- **Matching AI-layer access:** `_AGENT_ROLES` in
  `agent-service/app/security.py` gives this role the **spend** and **knowledge**
  agents, whose tables (`fpip_requisition`, `fpip_purchaseorder`, `fpip_invoice`,
  `fpip_supplier`, `fpip_tender`, `fpip_contract`, `fpip_auditlogentry`) are a
  subset of the reads granted above — the agent can never surface a row the user
  cannot already open on screen. The **finance** agent is deliberately excluded:
  it is the Finance persona's surface, and this role has no invoice-handling
  duty. Keep that invariant when editing either list.
- **Note:** budget envelopes are **not** Dataverse data — they are hardcoded in
  `app/src/lib/budgetEnvelopes.ts`. This role backs the requisition list on the
  Budget Owner dashboard, not the envelope panel; a `fpip_budgetenvelope` table
  would be a separate feature.

### FPIP Contract Manager

- **Scope:** Organization.
- **Permissions:**
  - Create: `fpip_tender` (re-tendering an expiring contract via Tender Studio),
    `fpip_purchaseorder` (see the segregation-of-duties warning below)
  - Write: `fpip_tender` (award transitions a tender to `Awarded`)
  - Read: `fpip_contract`, `fpip_requisition`, `fpip_tender`, `fpip_bid`,
    `fpip_purchaseorder`, `fpip_compliancedocument`, `fpip_supplier`
  - No delete anywhere.
- **Where the breadth comes from:** `contract_mgr` alone needs only read on
  `fpip_contract`. The rest arrives via `tender_studio` (creates tenders),
  `document_vault` (compliance documents), and `procurement` — which renders
  `ProcurementTabs.tsx`.

> **⚠️ Segregation-of-duties warning.** The `procurement` feature gives this role
> the "Prepare award → LPO" action in `ProcurementTabs.tsx`, and that action is
> **not** separately gated by `approvals_act` or `tender_publish` (which this
> role does not have). It calls `awardBid()`
> (`app/src/api/repositories.ts`), which creates a purchase order and flips the
> tender to `Awarded`. A contract manager can therefore award tenders and
> originate POs — the privileges granted above reflect that reality rather than
> hiding it. If that is not intended, the fix is to remove `procurement` from
> `contract_manager` in `app/src/lib/rbac.ts`, or to gate the award button on
> `can('approvals_act')`, and then narrow this role to read-only plus
> `fpip_tender` create. Revisit before a production tenant sign-off.

### FPIP Admin (platform administrator)

- **Scope:** Not a bespoke FPIP role. Assign the built-in Power Platform
  **System Administrator** (or **System Customizer**, if environment-level
  configuration is not required).
- **Rationale:** the admin persona's actual work — configuring Fabric, Entra,
  SharePoint, metering and integration settings — lives outside Dataverse's
  row-level security model. `Admin.tsx` performs no Dataverse calls at all, so
  there is no table privilege set to express.
- **Known gap:** the in-app RBAC feature matrix persists to browser
  `localStorage` only (`app/src/context/RoleContext.tsx`). It has no server
  round-trip, no audit trail, and changes are invisible to other sessions and
  other admins. Treat the in-app matrix as a local preview, not as an
  authorization source.

### FPIP Agent Service (Phase 2 backend)

- **Scope:** Organization.
- **Permissions:** Read on all `fpip_*` tables. No create/write/delete/assign/share.
- **Notes:** This is the security role assigned to the `FPIP-Agent-Service` app
  registration's Dataverse Application User. The service principal itself has
  broad read access, but the agent service enforces additional boundaries by
  passing `user_context` from the React UI and filtering queries (especially for
  Supplier Portal users). The role must not include write privileges, because
  agents are read-only.

## How isolation is enforced

Dataverse row-level security is used, not application code:

1. Each Supplier Portal user is mapped to their `fpip_supplier` record (via an
   Entra External ID claim mapped to the supplier's contact/owner).
2. The `FPIP Supplier Portal User` role is scoped so the user only reads records
   they own or that are shared with their team. Lookups to `fpip_Supplier` carry
   the ownership context.
3. The agent service adds an explicit OData filter on supplier-scoped tables
   when `user_context.role == 'supplier'`.
4. **Verify with a real test Supplier user before calling Task 1 done** — confirm
   they cannot read another supplier's invoices/bids. This is the one isolation
   guarantee that must not leak.

## Known scoping limitation: department filtering

`BudgetOwner.tsx` filters requisitions against a hardcoded department list
(`['Operations', 'Facilities', 'Finance']`) rather than the signed-in user's own
department, so "My reqs" is not self-scoped for either `hod` or `budget_owner`
today — the Dataverse role grants org-wide read and the client narrows it to a
fixed set of departments for everyone.

Real per-user department scoping needs either a department claim on the token or
a Dataverse business-unit model, and would let these two roles drop from
Organization to Business Unit depth. Tracked as follow-up; the roles above are
correct for the UI as it currently behaves.

> Detailed privilege matrices (Create/Read/Write/Delete/Append/Assign/Share per
> table) are configured in the Dataverse security role editor. The summaries
> above are the authoritative intent; the editor configuration must match.

# FPIP_Core Security Roles (Phase 1, Task 1)

These are **Dataverse security roles** (configured in the Power Platform admin
center / Dataverse, not application code). They map to the five FPIP personas.

## Roles

### FPIP Executive
- **Scope:** Organization (all records).
- **Permissions:** Read on all `fpip_*` tables. No create/write/delete.

### FPIP Procurement
- **Scope:** Organization.
- **Permissions:**
  - Read + Create + Write + Append: `fpip_requisition`, `fpip_tender`, `fpip_bid`, `fpip_purchaseorder`
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
  - Read + Create + Write: `fpip_bid`, `fpip_invoice`, `fpip_compliancedocument` — **only their own** (referenced `fpip_Supplier` = the supplier they represent)
  - Read: `fpip_supplier` — **only their own record**
  - No visibility into other suppliers' bids, invoices, documents, or into any
    internal-only tables (requisitions, tenders, POs, contracts, approval
    requests, audit log).

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

> Detailed privilege matrices (Create/Read/Write/Delete/Append/Assign/Share per
> table) are configured in the Dataverse security role editor. The summaries
> above are the authoritative intent; the editor configuration must match.

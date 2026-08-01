# FPIP Dataverse — FPIP_Core solution (Phase 1, Task 1)

This folder defines the **FPIP_Core** Dataverse solution: 11 `fpip_*` tables and
6 security roles. It is the data layer for the whole platform.

> The `pac` (Power Platform CLI) is **not** installed in this development
> environment, so the recommended `pac` import path is documented below but was
> not run here. A runnable Web-API provisioning script (`provision-FpipCore.ps1`)
> is provided as the no-`pac` alternative.

## Structure

```
dataverse/
  FPIP_Core/
    solution.json                 # solution + publisher metadata + table list
    roles.md                      # the 6 security roles (intent spec)
    tables/
      fpip_supplier.json
      fpip_requisition.json
      fpip_tender.json
      fpip_bid.json
      fpip_purchaseorder.json
      fpip_invoice.json
      fpip_contract.json
      fpip_compliancedocument.json
      fpip_approvalrequest.json
      fpip_auditlogentry.json
  provision-FpipCore.ps1          # Web-API provisioning script (no pac required)
  README.md                       # this file
```

Each `tables/*.json` is a single table definition: logical name, display name,
primary name attribute, columns (with type + optionset values), and lookups
(with target table). The schema is the **single source of truth** — the React
app's `src/api/types.ts` and `src/api/optionSets.ts` mirror it, and Phase 2's
`agents_config.py` grounds against the same tables.

## Tables (11)

| Table | Purpose | Key columns |
|---|---|---|
| `fpip_supplier` | Approved suppliers | name, status, category, risk_score, tax_cert_expiry |
| `fpip_requisition` | Procurement requisitions | title, department, category, amount, status, budget_check_result |
| `fpip_tender` | RFQ/RFP tenders | title, category, status, closing_date, estimated_value |
| `fpip_bid` | Supplier bids w/ scores | Tender, Supplier, price/compliance/delivery score, status |
| `fpip_purchaseorder` | Purchase orders | Requisition, Supplier, po_number (autonumber), amount, status |
| `fpip_invoice` | Invoices w/ 3-way match | PurchaseOrder, Supplier, invoice_number, amount, match_status, duplicate_flag, payment_status |
| `fpip_contract` | Contracts | title, Supplier, value, term_months, expiry_date |
| `fpip_compliancedocument` | Compliance docs (SP URL) | Supplier, document_type, expiry_date, status, sharepoint_url |
| `fpip_approvalrequest` | Power Automate target (Phase 3) | record_type, related_record, amount, status, requested_by, waiting_since |
| `fpip_approvalpolicy` | Configurable approval thresholds | record_type, threshold_amount, approver_upn, escalation_upn |
| `fpip_auditlogentry` | Audit trail | timestamp, actor, actor_type (Human/AI Agent), action, entity_reference, source_detail |

## Provisioning

### Option A — Web API script (no `pac` required)

```powershell
# Requires: an Entra ID access token with Dataverse System Customizer rights.
.\provision-FpipCore.ps1 -DataverseUrl "https://contoso.crm.dynamics.com" -AccessToken $token
```

The script reads `FPIP_Core/solution.json` + `FPIP_Core/tables/*.json` and creates
the publisher, solution, all tables, columns (with optionsets) and lookup
relationships via the Dataverse Web API.

### Option B — Power Platform CLI (`pac`)

```powershell
pac auth create --url https://contoso.crm.dynamics.com
pac solution init --publisher-name FPIP --publisher-prefix fpip
# (generate table definitions from the manifests, then)
pac solution add-table ...      # one per table manifest
pac solution pack -f FPIP_Core -s Both
pac solution import --solution-file FPIP_Core.zip
```

## Security roles

Configure the 6 roles per `FPIP_Core/roles.md` in the Dataverse security role
editor (not code). **The Supplier Portal isolation must be verified with a real
test Supplier user** — confirm they cannot read another supplier's records.

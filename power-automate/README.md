# FPIP Power Automate Approval Flows (Phase 3)

These JSON files describe the four approval flows required for FPIP Phase 3.
They are intended to be imported or recreated in Power Automate against the
FPIP_Core Dataverse solution.

## Flows

| File | Trigger | Purpose |
|---|---|---|
| `requisition-approval.json` | `fpip_approvalrequest` create/update for Requisitions | Routes to manager or Procurement Director based on `fpip_approvalpolicy` threshold |
| `tender-award.json` | `fpip_approvalrequest` create/update for Tender Awards | Requires unanimous Procurement Committee approval |
| `invoice-exception.json` | `fpip_invoice` create/update with exception flags | Creates an approval request and routes to Finance Manager |
| `contract-renewal.json` | Daily recurrence | Finds contracts expiring ≤90 days and routes renewal approvals |

## How to import

1. Download the JSON file.
2. In Power Automate, choose **Import > Import Package (Legacy)** or recreate
   the flow from the JSON actions.
3. Update `assignedTo` values and `filter` expressions to match your Dataverse
   environment schema names and approver UPNs/team names.
4. Turn the flows on and test with a sandbox record.

## Required connections

- Dataverse (current environment)
- Approvals

## Notes

- Approval thresholds are read from `fpip_approvalpolicy`, not hardcoded in the
  flows. Add/update policy rows in Dataverse to change behavior without editing
  the flows.
- Each flow writes to `fpip_auditlogentry` with `actor_type = Human (1)`.
- For real committee/team approvals, replace `fpip_committee_team` with the
  appropriate Dataverse team or a semicolon-separated list of approver UPNs.


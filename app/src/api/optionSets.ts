// FPIP choice (OptionSet) definitions for the fpip_* tables.
// Choice fields are typed by their display labels for readability; OptionSet
// maps convert those labels to/from the integer values Dataverse stores.

export type SupplierStatus = 'Prequalified' | 'Approved' | 'Suspended';
export type ApprovalPolicyType = 'Requisition' | 'Tender Award' | 'Invoice Exception' | 'Contract Renewal';
export type RequisitionStatus =
  | 'Draft'
  | 'Sourcing'
  | 'Awaiting Approval'
  | 'Escalated'
  | 'PO Issued';
export type BudgetCheckResult = 'Within Budget' | 'Exceeds Budget';
export type TenderStatus = 'Draft' | 'Open' | 'Evaluation' | 'Awarded' | 'Closed';
export type BidStatus = 'Submitted' | 'Under Review' | 'Shortlisted' | 'Rejected';
export type PurchaseOrderStatus = 'Pending Approval' | 'Approved' | 'Delivered';
export type InvoiceMatchStatus = '3-Way Match' | 'Qty Mismatch' | 'Manual Review';
export type InvoicePaymentStatus = 'Held' | 'Approved' | 'Paid';
export type ComplianceDocStatus = 'Verified' | 'Renewal Due' | 'Expired';
export type ApprovalRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Escalated';
export type ActorType = 'Human' | 'AI Agent';

// Department / category are text-backed choices in Phase 1 (their optionset
// values are environment-specific); the client sends labels as text.
export type Department = 'Operations' | 'Facilities' | 'Finance' | 'Logistics' | 'Marketing';
export type Category =
  | 'ICT & Software'
  | 'Facilities'
  | 'Professional Services'
  | 'Logistics'
  | 'Capital Equipment';

/** Label -> integer OptionSet value. Values are illustrative defaults; a real
 *  Dataverse environment assigns its own optionset integers. The client uses
 *  these to build create/update payloads and to map reads back to labels. */
export const OptionSet: Record<string, Record<string, number>> = {
  fpip_supplier_status: { Prequalified: 1, Approved: 2, Suspended: 3 },
  fpip_requisition_status: {
    Draft: 1,
    Sourcing: 2,
    'Awaiting Approval': 3,
    Escalated: 4,
    'PO Issued': 5,
  },
  fpip_budget_check_result: { 'Within Budget': 1, 'Exceeds Budget': 2 },
  fpip_tender_status: { Draft: 1, Open: 2, Evaluation: 3, Awarded: 4, Closed: 5 },
  fpip_bid_status: { Submitted: 1, 'Under Review': 2, Shortlisted: 3, Rejected: 4 },
  fpip_po_status: { 'Pending Approval': 1, Approved: 2, Delivered: 3 },
  fpip_invoice_match_status: { '3-Way Match': 1, 'Qty Mismatch': 2, 'Manual Review': 3 },
  fpip_invoice_payment_status: { Held: 1, Approved: 2, Paid: 3 },
  fpip_compliance_status: { Verified: 1, 'Renewal Due': 2, Expired: 3 },
  fpip_contract_status: { Active: 1, Expired: 2, Renewed: 3 },
  fpip_approval_status: { Pending: 1, Approved: 2, Rejected: 3, Escalated: 4 },
  fpip_actor_type: { Human: 1, 'AI Agent': 2 },
  fpip_approvalpolicy_type: { Requisition: 1, 'Tender Award': 2, 'Invoice Exception': 3, 'Contract Renewal': 4 },
};

/** Reverse lookup: integer -> label for a given choice column. */
export function labelFor(column: string, value: number | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  const map = OptionSet[column];
  if (!map) return undefined;
  return Object.entries(map).find(([, v]) => v === value)?.[0];
}

/** Label -> integer for a given choice column. */
export function valueFor(column: string, label: string): number | undefined {
  return OptionSet[column]?.[label];
}

/**
 * Maps a record's logical choice column name to the OptionSet column key.
 * Keyed by logical field name; value is the OptionSet key used above.
 * (Multiple tables share the field name `fpip_status`, so each table's reader
 * supplies the right OptionSet key via this map.)
 */
export const ChoiceColumns: Record<string, string> = {
  fpip_supplier_status: 'fpip_supplier_status',
  fpip_requisition_status: 'fpip_requisition_status',
  fpip_budget_check_result: 'fpip_budget_check_result',
  fpip_tender_status: 'fpip_tender_status',
  fpip_bid_status: 'fpip_bid_status',
  fpip_purchaseorder_status: 'fpip_po_status',
  fpip_match_status: 'fpip_invoice_match_status',
  fpip_payment_status: 'fpip_invoice_payment_status',
  fpip_compliance_status: 'fpip_compliance_status',
  fpip_approvalrequest_status: 'fpip_approval_status',
  fpip_contract_status: 'fpip_contract_status',
  fpip_actor_type: 'fpip_actor_type',
  fpip_approvalpolicy_type: 'fpip_approvalpolicy_type',
};

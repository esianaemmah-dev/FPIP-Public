// Dataverse table interfaces (display form) for FPIP_Core. Field names use
// Dataverse logical names (fpip_*). Choice fields are typed by label (see
// ./optionSets); lookups are modelled as { id, name? }.

import type {
  ApprovalRequestStatus,
  ActorType,
  BidStatus,
  BudgetCheckResult,
  Category,
  ComplianceDocStatus,
  Department,
  InvoiceMatchStatus,
  InvoicePaymentStatus,
  PurchaseOrderStatus,
  RequisitionStatus,
  SupplierStatus,
  TenderStatus,
} from './optionSets';

export interface LookupRef {
  id: string;
  name?: string;
}

export interface FpipSupplier {
  fpip_supplierid: string;
  fpip_name: string;
  fpip_status?: SupplierStatus;
  fpip_category?: Category | string;
  fpip_riskscore?: number;
  fpip_taxcertexpiry?: string; // ISO date
}

export interface FpipRequisition {
  fpip_requisitionid: string;
  fpip_title: string;
  fpip_department?: Department | string;
  fpip_category?: Category | string;
  fpip_amount?: number;
  fpip_status?: RequisitionStatus;
  fpip_budget_check_result?: BudgetCheckResult;
  fpip_Supplier?: LookupRef;
}

export interface FpipTender {
  fpip_tenderid: string;
  fpip_title: string;
  fpip_category?: Category | string;
  fpip_status?: TenderStatus;
  fpip_closingdate?: string;
  fpip_estimatedvalue?: number;
  /** Demo / session fields — not all exist on Dataverse yet */
  fpip_Requisition?: LookupRef;
  fpip_draft_body?: string;
  fpip_template_name?: string;
  fpip_invitees?: string;
  fpip_green_light?: boolean;
  fpip_format?: string;
}

export interface FpipBid {
  fpip_bidid: string;
  fpip_Tender?: LookupRef;
  fpip_Supplier?: LookupRef;
  fpip_pricescore?: number;
  fpip_compliancescore?: number;
  fpip_deliveryscore?: number;
  fpip_status?: BidStatus;
}

export interface FpipPurchaseOrder {
  fpip_purchaseorderid: string;
  fpip_Requisition?: LookupRef;
  fpip_Supplier?: LookupRef;
  fpip_ponumber?: string;
  fpip_amount?: number;
  fpip_status?: PurchaseOrderStatus;
}

export interface FpipInvoice {
  fpip_invoiceid: string;
  fpip_PurchaseOrder?: LookupRef;
  fpip_Supplier?: LookupRef;
  fpip_invoicenumber?: string;
  fpip_amount?: number;
  fpip_match_status?: InvoiceMatchStatus;
  fpip_duplicate_flag?: boolean;
  fpip_payment_status?: InvoicePaymentStatus;
}

export interface FpipContract {
  fpip_contractid: string;
  fpip_title: string;
  fpip_Supplier?: LookupRef;
  fpip_value?: number;
  fpip_term_months?: number;
  fpip_expiry_date?: string;
  fpip_renewal_approval_created?: boolean;
  fpip_status?: 'Active' | 'Expired' | 'Renewed';
}

export interface FpipComplianceDocument {
  fpip_compliancedocumentid: string;
  fpip_Supplier?: LookupRef;
  fpip_document_type?: string;
  fpip_expiry_date?: string;
  fpip_status?: ComplianceDocStatus;
  fpip_sharepoint_url?: string;
}

export interface FpipApprovalRequest {
  fpip_approvalrequestid: string;
  fpip_record_type?: string;
  fpip_related_record?: string; // GUID + table name (polymorphic, pre-Power Automate)
  fpip_amount?: number;
  fpip_status?: ApprovalRequestStatus;
  fpip_requested_by?: string;
  fpip_waiting_since?: string;
}

export interface FpipApprovalPolicy {
  fpip_approvalpolicyid: string;
  fpip_name: string;
  fpip_policy_type?: 'Requisition' | 'Tender Award' | 'Invoice Exception' | 'Contract Renewal';
  fpip_threshold_amount?: number;
  fpip_threshold_currency?: string;
  fpip_primary_approver?: string;
  fpip_escalation_approver?: string;
  fpip_committee_team?: string;
  fpip_requires_unanimous?: boolean;
  fpip_active?: boolean;
}

export interface FpipAuditLogEntry {
  fpip_auditlogentryid: string;
  fpip_timestamp?: string;
  fpip_actor?: string;
  fpip_actor_type?: ActorType;
  fpip_action?: string;
  fpip_entity_reference?: string;
  fpip_source_detail?: string;
}

/** Logical collection name for each table. */
export const Tables = {
  supplier: 'fpip_suppliers',
  requisition: 'fpip_requisitions',
  tender: 'fpip_tenders',
  bid: 'fpip_bids',
  purchaseOrder: 'fpip_purchaseorders',
  invoice: 'fpip_invoices',
  contract: 'fpip_contracts',
  complianceDocument: 'fpip_compliancedocuments',
  approvalRequest: 'fpip_approvalrequests',
  approvalPolicy: 'fpip_approvalpolicies',
  auditLogEntry: 'fpip_auditlogentries',
} as const;

export type TableName = (typeof Tables)[keyof typeof Tables];

export type {
  SupplierStatus,
  RequisitionStatus,
  BudgetCheckResult,
  TenderStatus,
  BidStatus,
  PurchaseOrderStatus,
  InvoiceMatchStatus,
  InvoicePaymentStatus,
  ComplianceDocStatus,
  ApprovalRequestStatus,
  ApprovalPolicyType,
  ActorType,
  Department,
  Category,
} from './optionSets';

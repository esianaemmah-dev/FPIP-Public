// Typed Dataverse access for the fpip_* tables. Wraps the generic client with
// optionset int<->label conversion and lookup normalization. In demo mode
// (VITE_USE_DEMO_DATA=true) returns seed data in-memory (not real persistence).

import { getDataverseClient } from './dataverseClient';
import { labelFor, valueFor } from './optionSets';
import { Tables, type TableName, type LookupRef } from './types';
import type {
  FpipSupplier,
  FpipRequisition,
  FpipTender,
  FpipBid,
  FpipPurchaseOrder,
  FpipInvoice,
  FpipContract,
  FpipComplianceDocument,
  FpipApprovalRequest,
  FpipApprovalPolicy,
  FpipAuditLogEntry,
} from './types';
import { demoData, type DemoData } from './demoData';

const client = getDataverseClient();

// logical field name -> OptionSet key, per table (fpip_status differs per table).
const tableChoiceFields: Partial<Record<TableName, Record<string, string>>> = {
  fpip_suppliers: { fpip_status: 'fpip_supplier_status' },
  fpip_requisitions: { fpip_status: 'fpip_requisition_status', fpip_budget_check_result: 'fpip_budget_check_result' },
  fpip_tenders: { fpip_status: 'fpip_tender_status' },
  fpip_bids: { fpip_status: 'fpip_bid_status' },
  fpip_purchaseorders: { fpip_status: 'fpip_po_status' },
  fpip_invoices: { fpip_match_status: 'fpip_invoice_match_status', fpip_payment_status: 'fpip_invoice_payment_status' },
  fpip_contracts: { fpip_status: 'fpip_contract_status' },
  fpip_compliancedocuments: { fpip_status: 'fpip_compliance_status' },
  fpip_approvalrequests: { fpip_status: 'fpip_approval_status' },
  fpip_approvalpolicies: { fpip_policy_type: 'fpip_approvalpolicy_type' },
  fpip_auditlogentries: { fpip_actor_type: 'fpip_actor_type' },
};

const VALUE_SUFFIX = '_value';

// Convert a raw Dataverse record to display form: choice ints -> labels,
// _<nav>_value + formatted annotation -> { id, name } lookup.
function normalizeRecord<T>(table: TableName, raw: Record<string, unknown>): T {
  const choiceFields = tableChoiceFields[table] ?? {};
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (key.startsWith('@')) continue;
    if (key.startsWith('_') && key.endsWith(VALUE_SUFFIX)) {
      const logical = key.slice(1, -VALUE_SUFFIX.length);
      const fmtKey = `${key}@OData.Community.Display.V1.FormattedValue`;
      out[logical] = { id: String(val), name: raw[fmtKey] as string | undefined } as LookupRef;
      continue;
    }
    if (key.includes('@')) continue;
    const optionSetKey = choiceFields[key];
    if (optionSetKey && typeof val === 'number') {
      out[key] = labelFor(optionSetKey, val);
      continue;
    }
    out[key] = val;
  }
  return out as T;
}

// In-memory demo store (demo mode only) so a created requisition persists for
// the browser session — not real persistence.
const demoStore: DemoData = JSON.parse(JSON.stringify(demoData));

function cloneRows<T>(rows: T[]): T[] {
  return rows.map((r) => ({ ...r }));
}

async function fetchTable<T>(table: TableName): Promise<T[]> {
  const raw = await client.list<Record<string, unknown>>(table);
  return raw.map((r) => normalizeRecord<T>(table, r));
}

async function getTable<T>(table: TableName, demoRows: T[]): Promise<T[]> {
  return client.useDemo ? cloneRows(demoRows) : fetchTable<T>(table);
}

export async function getSuppliers(): Promise<FpipSupplier[]> {
  return getTable(Tables.supplier, demoStore.suppliers);
}
export async function getRequisitions(): Promise<FpipRequisition[]> {
  return getTable(Tables.requisition, demoStore.requisitions);
}
export async function getTenders(): Promise<FpipTender[]> {
  return getTable(Tables.tender, demoStore.tenders);
}
export async function getBids(): Promise<FpipBid[]> {
  return getTable(Tables.bid, demoStore.bids);
}
export async function getPurchaseOrders(): Promise<FpipPurchaseOrder[]> {
  return getTable(Tables.purchaseOrder, demoStore.purchaseOrders);
}
export async function getInvoices(): Promise<FpipInvoice[]> {
  return getTable(Tables.invoice, demoStore.invoices);
}
export async function getContracts(): Promise<FpipContract[]> {
  return getTable(Tables.contract, demoStore.contracts);
}
export async function getComplianceDocuments(): Promise<FpipComplianceDocument[]> {
  return getTable(Tables.complianceDocument, demoStore.complianceDocuments);
}
export async function getApprovalRequests(): Promise<FpipApprovalRequest[]> {
  return getTable(Tables.approvalRequest, demoStore.approvalRequests);
}
export async function getApprovalPolicies(): Promise<FpipApprovalPolicy[]> {
  return getTable(Tables.approvalPolicy, demoStore.approvalPolicies);
}
export async function getAuditLogEntries(): Promise<FpipAuditLogEntry[]> {
  return getTable(Tables.auditLogEntry, demoStore.auditLogEntries);
}

export type ApprovalDecision = 'Approved' | 'Rejected';

export interface ApprovalDecisionInput {
  id: string;
  decision: ApprovalDecision;
  actor?: string;
  recordType?: string;
  relatedRecord?: string;
}

/** PATCH fpip_approvalrequest status and write a Human audit log entry. */
export async function decideApprovalRequest(
  input: ApprovalDecisionInput,
): Promise<FpipApprovalRequest> {
  const statusValue = valueFor('fpip_approval_status', input.decision);
  if (statusValue === undefined) {
    throw new Error(`Unknown approval status: ${input.decision}`);
  }

  if (client.useDemo) {
    const idx = demoStore.approvalRequests.findIndex((r) => r.fpip_approvalrequestid === input.id);
    if (idx < 0) throw new Error(`Approval request ${input.id} not found`);
    demoStore.approvalRequests[idx] = {
      ...demoStore.approvalRequests[idx],
      fpip_status: input.decision,
    };
    demoStore.auditLogEntries.unshift({
      fpip_auditlogentryid: `al${Math.random().toString(36).slice(2, 9)}`,
      fpip_timestamp: new Date().toISOString(),
      fpip_actor: input.actor ?? 'FPIP Reviewer',
      fpip_actor_type: 'Human',
      fpip_action: `${input.decision} approval ${input.id}`,
      fpip_entity_reference: input.relatedRecord ?? input.recordType ?? input.id,
      fpip_source_detail: 'Workflows > Approvals',
    });
    return { ...demoStore.approvalRequests[idx] };
  }

  await client.update(Tables.approvalRequest, input.id, { fpip_status: statusValue });

  try {
    await client.create(Tables.auditLogEntry, {
      fpip_timestamp: new Date().toISOString(),
      fpip_actor: input.actor ?? 'Unknown',
      fpip_actor_type: valueFor('fpip_actor_type', 'Human'),
      fpip_action: `${input.decision} approval request`,
      fpip_entity_reference: input.relatedRecord ?? input.recordType ?? input.id,
      fpip_source_detail: 'Workflows > Approvals',
    });
  } catch {
    // Audit write is best-effort; decision already persisted.
  }

  return {
    fpip_approvalrequestid: input.id,
    fpip_status: input.decision,
    fpip_record_type: input.recordType,
    fpip_related_record: input.relatedRecord,
  };
}

export interface RequisitionInput {
  title: string;
  department: string;
  category: string;
  amount: number;
  /** When false, status Escalated + Exceeds Budget (hard gate unless override). */
  withinBudget?: boolean;
  allowOverBudgetOverride?: boolean;
  suggestedSupplier?: string;
}

// Create a requisition (Draft) and persist to Dataverse. Phase 1 DoD flow:
// a requisition created in the UI persists and is visible on reload.
export async function createRequisition(input: RequisitionInput): Promise<FpipRequisition> {
  const overBudget = input.withinBudget === false;
  const statusLabel = overBudget && !input.allowOverBudgetOverride ? 'Escalated' : 'Awaiting Approval';
  const budgetLabel = overBudget ? 'Exceeds Budget' : 'Within Budget';

  const payload: Record<string, unknown> = {
    fpip_title: input.title,
    fpip_department: input.department,
    fpip_category: input.category,
    fpip_amount: input.amount,
    fpip_status: valueFor('fpip_requisition_status', statusLabel),
    fpip_budget_check_result: valueFor('fpip_budget_check_result', budgetLabel),
  };

  if (client.useDemo) {
    const id = `r${Math.random().toString(36).slice(2, 9)}`;
    const rec: FpipRequisition = {
      fpip_requisitionid: id,
      fpip_title: input.title,
      fpip_department: input.department as FpipRequisition['fpip_department'],
      fpip_category: input.category,
      fpip_amount: input.amount,
      fpip_status: statusLabel as FpipRequisition['fpip_status'],
      fpip_budget_check_result: budgetLabel as FpipRequisition['fpip_budget_check_result'],
      fpip_Supplier: input.suggestedSupplier
        ? { id: 'suggested', name: input.suggestedSupplier }
        : undefined,
    };
    demoStore.requisitions.push(rec);
    return { ...rec };
  }

  const raw = await client.create<Record<string, unknown>>(Tables.requisition, payload);
  return normalizeRecord<FpipRequisition>(Tables.requisition, raw);
}

export interface ComplianceDocumentInput {
  supplierId: string;
  documentType: string;
  expiryDate?: string;
  sharepointUrl: string;
}

// Phase 1 Task 4: document links are stored as plain URLs in
// fpip_compliancedocument.sharepoint_url (no SharePoint upload UI yet).
export async function createComplianceDocument(
  input: ComplianceDocumentInput,
): Promise<FpipComplianceDocument> {
  const payload: Record<string, unknown> = {
    'fpip_Supplier@odata.bind': `${Tables.supplier}(${input.supplierId})`,
    fpip_document_type: input.documentType,
    fpip_sharepoint_url: input.sharepointUrl,
  };
  if (input.expiryDate) payload.fpip_expiry_date = input.expiryDate;

  if (client.useDemo) {
    const id = `d${Math.random().toString(36).slice(2, 9)}`;
    const rec: FpipComplianceDocument = {
      fpip_compliancedocumentid: id,
      fpip_Supplier: { id: input.supplierId, name: 'Kestrel Components Ltd.' },
      fpip_document_type: input.documentType,
      fpip_expiry_date: input.expiryDate,
      fpip_sharepoint_url: input.sharepointUrl,
    };
    demoStore.complianceDocuments.push(rec);
    return { ...rec };
  }

  const raw = await client.create<Record<string, unknown>>(Tables.complianceDocument, payload);
  return normalizeRecord<FpipComplianceDocument>(Tables.complianceDocument, raw);
}

export interface InvoiceInput {
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  amount: number;
  purchaseOrderId?: string;
  purchaseOrderNumber?: string;
  matchStatus?: FpipInvoice['fpip_match_status'];
  paymentStatus?: FpipInvoice['fpip_payment_status'];
  duplicate?: boolean;
}

export async function createInvoice(input: InvoiceInput): Promise<FpipInvoice> {
  if (client.useDemo) {
    const id = `i${Math.random().toString(36).slice(2, 9)}`;
    const rec: FpipInvoice = {
      fpip_invoiceid: id,
      fpip_invoicenumber: input.invoiceNumber,
      fpip_amount: input.amount,
      fpip_Supplier: { id: input.supplierId, name: input.supplierName },
      fpip_PurchaseOrder: input.purchaseOrderId
        ? { id: input.purchaseOrderId, name: input.purchaseOrderNumber ?? input.purchaseOrderId }
        : undefined,
      fpip_match_status: input.matchStatus ?? 'Manual Review',
      fpip_payment_status: input.paymentStatus ?? 'Held',
      fpip_duplicate_flag: input.duplicate ?? false,
    };
    demoStore.invoices.unshift(rec);
    return { ...rec };
  }
  const payload: Record<string, unknown> = {
    fpip_invoicenumber: input.invoiceNumber,
    fpip_amount: input.amount,
    'fpip_Supplier@odata.bind': `${Tables.supplier}(${input.supplierId})`,
    fpip_match_status: valueFor('fpip_invoice_match_status', input.matchStatus ?? 'Manual Review'),
    fpip_payment_status: valueFor('fpip_invoice_payment_status', input.paymentStatus ?? 'Held'),
    fpip_duplicate_flag: input.duplicate ?? false,
  };
  if (input.purchaseOrderId) {
    payload['fpip_PurchaseOrder@odata.bind'] = `${Tables.purchaseOrder}(${input.purchaseOrderId})`;
  }
  const raw = await client.create<Record<string, unknown>>(Tables.invoice, payload);
  return normalizeRecord<FpipInvoice>(Tables.invoice, raw);
}

export async function updateInvoiceMatch(
  id: string,
  matchStatus: NonNullable<FpipInvoice['fpip_match_status']>,
  paymentStatus?: FpipInvoice['fpip_payment_status'],
): Promise<FpipInvoice> {
  if (client.useDemo) {
    const idx = demoStore.invoices.findIndex((i) => i.fpip_invoiceid === id);
    if (idx < 0) throw new Error(`Invoice ${id} not found`);
    demoStore.invoices[idx] = {
      ...demoStore.invoices[idx],
      fpip_match_status: matchStatus,
      fpip_payment_status: paymentStatus ?? demoStore.invoices[idx].fpip_payment_status,
    };
    return { ...demoStore.invoices[idx] };
  }
  const payload: Record<string, unknown> = {
    fpip_match_status: valueFor('fpip_invoice_match_status', matchStatus),
  };
  if (paymentStatus) payload.fpip_payment_status = valueFor('fpip_invoice_payment_status', paymentStatus);
  await client.update(Tables.invoice, id, payload);
  return { fpip_invoiceid: id, fpip_match_status: matchStatus, fpip_payment_status: paymentStatus };
}

/** Match invoice amount/PO hint to best LPO and set match status. */
export async function autoMatchInvoiceToLpo(invoiceId: string): Promise<{
  invoice: FpipInvoice;
  po?: FpipPurchaseOrder;
  matched: boolean;
}> {
  const invoices = await getInvoices();
  const pos = await getPurchaseOrders();
  const inv = invoices.find((i) => i.fpip_invoiceid === invoiceId);
  if (!inv) throw new Error('Invoice not found');

  let po =
    (inv.fpip_PurchaseOrder?.id
      ? pos.find((p) => p.fpip_purchaseorderid === inv.fpip_PurchaseOrder!.id)
      : undefined) ??
    pos.find(
      (p) =>
        p.fpip_Supplier?.id === inv.fpip_Supplier?.id &&
        inv.fpip_amount != null &&
        Math.abs((p.fpip_amount ?? 0) - inv.fpip_amount) < 1,
    ) ??
    pos.find((p) => p.fpip_Supplier?.id === inv.fpip_Supplier?.id);

  const amountOk =
    po && inv.fpip_amount != null && Math.abs((po.fpip_amount ?? 0) - inv.fpip_amount) <= Math.max(50, (po.fpip_amount ?? 0) * 0.02);

  const matchStatus: NonNullable<FpipInvoice['fpip_match_status']> = amountOk
    ? '3-Way Match'
    : po
      ? 'Qty Mismatch'
      : 'Manual Review';

  if (client.useDemo) {
    const idx = demoStore.invoices.findIndex((i) => i.fpip_invoiceid === invoiceId);
    if (idx >= 0) {
      demoStore.invoices[idx] = {
        ...demoStore.invoices[idx],
        fpip_match_status: matchStatus,
        fpip_PurchaseOrder: po
          ? { id: po.fpip_purchaseorderid, name: po.fpip_ponumber ?? po.fpip_purchaseorderid }
          : demoStore.invoices[idx].fpip_PurchaseOrder,
        fpip_payment_status: amountOk ? 'Approved' : 'Held',
      };
      return { invoice: { ...demoStore.invoices[idx] }, po, matched: !!amountOk };
    }
  }

  const updated = await updateInvoiceMatch(invoiceId, matchStatus, amountOk ? 'Approved' : 'Held');
  return { invoice: updated, po, matched: !!amountOk };
}

export interface TenderInput {
  title: string;
  category: string;
  estimatedValue?: number;
  closingDate?: string;
  status?: FpipTender['fpip_status'];
  requisitionId?: string;
  requisitionTitle?: string;
  draftBody?: string;
  templateName?: string;
  invitees?: string[];
  format?: string;
}

export async function createTender(input: TenderInput): Promise<FpipTender> {
  const status = input.status ?? 'Open';
  const payload: Record<string, unknown> = {
    fpip_title: input.title,
    fpip_category: input.category,
    fpip_status: valueFor('fpip_tender_status', status),
  };
  if (input.estimatedValue != null) payload.fpip_estimatedvalue = input.estimatedValue;
  if (input.closingDate) payload.fpip_closingdate = input.closingDate;

  if (client.useDemo) {
    const id = `t${Math.random().toString(36).slice(2, 9)}`;
    const rec: FpipTender = {
      fpip_tenderid: id,
      fpip_title: input.title,
      fpip_category: input.category,
      fpip_status: status,
      fpip_closingdate: input.closingDate,
      fpip_estimatedvalue: input.estimatedValue,
      fpip_draft_body: input.draftBody,
      fpip_template_name: input.templateName,
      fpip_invitees: input.invitees?.join(', '),
      fpip_format: input.format,
      fpip_green_light: false,
      fpip_Requisition: input.requisitionId
        ? { id: input.requisitionId, name: input.requisitionTitle ?? input.title }
        : undefined,
    };
    demoStore.tenders.unshift(rec);
    if (input.requisitionId) {
      const idx = demoStore.requisitions.findIndex((r) => r.fpip_requisitionid === input.requisitionId);
      if (idx >= 0) {
        demoStore.requisitions[idx] = {
          ...demoStore.requisitions[idx],
          fpip_status: 'Sourcing',
        };
      }
    }
    return { ...rec };
  }

  const raw = await client.create<Record<string, unknown>>(Tables.tender, payload);
  return normalizeRecord<FpipTender>(Tables.tender, raw);
}

export async function updateTenderStatus(
  id: string,
  status: NonNullable<FpipTender['fpip_status']>,
  extras?: Partial<Pick<FpipTender, 'fpip_green_light'>>,
): Promise<FpipTender> {
  if (client.useDemo) {
    const idx = demoStore.tenders.findIndex((t) => t.fpip_tenderid === id);
    if (idx < 0) throw new Error(`Tender ${id} not found`);
    demoStore.tenders[idx] = {
      ...demoStore.tenders[idx],
      fpip_status: status,
      ...extras,
    };
    return { ...demoStore.tenders[idx] };
  }
  await client.update(Tables.tender, id, { fpip_status: valueFor('fpip_tender_status', status) });
  return { fpip_tenderid: id, fpip_title: '', fpip_status: status };
}

export interface BidInput {
  tenderId: string;
  tenderTitle: string;
  supplierId: string;
  supplierName: string;
  priceScore?: number;
  notes?: string;
  offerAmount?: number;
}

export async function createBid(input: BidInput): Promise<FpipBid> {
  const priceScore =
    input.priceScore ??
    (input.offerAmount != null ? Math.max(40, Math.min(98, Math.round(100 - input.offerAmount / 50000))) : 70);

  if (client.useDemo) {
    const id = `b${Math.random().toString(36).slice(2, 9)}`;
    const rec: FpipBid = {
      fpip_bidid: id,
      fpip_Tender: { id: input.tenderId, name: input.tenderTitle },
      fpip_Supplier: { id: input.supplierId, name: input.supplierName },
      fpip_pricescore: priceScore,
      fpip_compliancescore: 78,
      fpip_deliveryscore: 75,
      fpip_status: 'Submitted',
    };
    demoStore.bids.unshift(rec);
    const tIdx = demoStore.tenders.findIndex((t) => t.fpip_tenderid === input.tenderId);
    if (tIdx >= 0 && demoStore.tenders[tIdx].fpip_status === 'Open') {
      demoStore.tenders[tIdx] = { ...demoStore.tenders[tIdx], fpip_status: 'Evaluation' };
    }
    return { ...rec };
  }

  const payload: Record<string, unknown> = {
    'fpip_Tender@odata.bind': `${Tables.tender}(${input.tenderId})`,
    'fpip_Supplier@odata.bind': `${Tables.supplier}(${input.supplierId})`,
    fpip_pricescore: priceScore,
    fpip_compliancescore: 78,
    fpip_deliveryscore: 75,
    fpip_status: valueFor('fpip_bid_status', 'Submitted'),
  };
  const raw = await client.create<Record<string, unknown>>(Tables.bid, payload);
  return normalizeRecord<FpipBid>(Tables.bid, raw);
}

export interface PurchaseOrderInput {
  supplierId: string;
  supplierName: string;
  amount: number;
  requisitionId?: string;
  requisitionTitle?: string;
  tenderId?: string;
  tenderTitle?: string;
  status?: FpipPurchaseOrder['fpip_status'];
}

export async function createPurchaseOrder(input: PurchaseOrderInput): Promise<FpipPurchaseOrder> {
  const poNumber = `PO-${Math.floor(22000 + Math.random() * 7000)}`;
  const status = input.status ?? 'Pending Approval';

  if (client.useDemo) {
    const id = `p${Math.random().toString(36).slice(2, 9)}`;
    const rec: FpipPurchaseOrder = {
      fpip_purchaseorderid: id,
      fpip_ponumber: poNumber,
      fpip_amount: input.amount,
      fpip_status: status,
      fpip_Supplier: { id: input.supplierId, name: input.supplierName },
      fpip_Requisition: input.requisitionId
        ? { id: input.requisitionId, name: input.requisitionTitle ?? input.tenderTitle ?? 'Award' }
        : input.tenderTitle
          ? { id: input.tenderId ?? 'award', name: input.tenderTitle }
          : undefined,
    };
    demoStore.purchaseOrders.unshift(rec);
    if (input.tenderId) {
      const tIdx = demoStore.tenders.findIndex((t) => t.fpip_tenderid === input.tenderId);
      if (tIdx >= 0) {
        demoStore.tenders[tIdx] = { ...demoStore.tenders[tIdx], fpip_status: 'Awarded' };
      }
    }
    if (input.requisitionId) {
      const rIdx = demoStore.requisitions.findIndex((r) => r.fpip_requisitionid === input.requisitionId);
      if (rIdx >= 0) {
        demoStore.requisitions[rIdx] = {
          ...demoStore.requisitions[rIdx],
          fpip_status: 'PO Issued',
        };
      }
    }
    return { ...rec };
  }

  const payload: Record<string, unknown> = {
    'fpip_Supplier@odata.bind': `${Tables.supplier}(${input.supplierId})`,
    fpip_ponumber: poNumber,
    fpip_amount: input.amount,
    fpip_status: valueFor('fpip_po_status', status === 'Pending Approval' ? 'Pending Approval' : status),
  };
  if (input.requisitionId) {
    payload['fpip_Requisition@odata.bind'] = `${Tables.requisition}(${input.requisitionId})`;
  }
  const raw = await client.create<Record<string, unknown>>(Tables.purchaseOrder, payload);
  return normalizeRecord<FpipPurchaseOrder>(Tables.purchaseOrder, raw);
}

export async function updatePurchaseOrderStatus(
  id: string,
  status: NonNullable<FpipPurchaseOrder['fpip_status']> | string,
): Promise<FpipPurchaseOrder> {
  if (client.useDemo) {
    const idx = demoStore.purchaseOrders.findIndex((p) => p.fpip_purchaseorderid === id);
    if (idx < 0) throw new Error(`PO ${id} not found`);
    const mapped =
      status === 'Issued' || status === 'Draft' || status === 'Closed'
        ? status === 'Issued'
          ? 'Approved'
          : status === 'Closed'
            ? 'Delivered'
            : 'Pending Approval'
        : (status as FpipPurchaseOrder['fpip_status']);
    demoStore.purchaseOrders[idx] = {
      ...demoStore.purchaseOrders[idx],
      fpip_status: mapped,
    };
    return { ...demoStore.purchaseOrders[idx] };
  }
  const choice =
    status === 'Issued' || status === 'Approved'
      ? 'Approved'
      : status === 'Delivered' || status === 'Closed'
        ? 'Delivered'
        : 'Pending Approval';
  await client.update(Tables.purchaseOrder, id, { fpip_status: valueFor('fpip_po_status', choice) });
  return { fpip_purchaseorderid: id, fpip_status: choice as FpipPurchaseOrder['fpip_status'] };
}

export interface AwardInput {
  tenderId: string;
  bidId: string;
}

/** Award winning bid → mark tender Awarded + create LPO/PO. Requires green light in demo. */
export async function awardBid(input: AwardInput): Promise<{ tender: FpipTender; po: FpipPurchaseOrder }> {
  const tenders = await getTenders();
  const bids = await getBids();
  const tender = tenders.find((t) => t.fpip_tenderid === input.tenderId);
  const bid = bids.find((b) => b.fpip_bidid === input.bidId);
  if (!tender || !bid) throw new Error('Tender or bid not found');
  // Explicit false (newly published) must clear Compliance first; undefined seed rows may award.
  if (tender.fpip_green_light === false) {
    throw new Error('Compliance green light required before award');
  }

  const amount = tender.fpip_estimatedvalue ?? 0;
  const po = await createPurchaseOrder({
    supplierId: bid.fpip_Supplier?.id ?? 's1',
    supplierName: bid.fpip_Supplier?.name ?? 'Supplier',
    amount,
    tenderId: tender.fpip_tenderid,
    tenderTitle: tender.fpip_title,
    requisitionId: tender.fpip_Requisition?.id,
    requisitionTitle: tender.fpip_Requisition?.name,
    status: 'Pending Approval',
  });

  const updated = await updateTenderStatus(tender.fpip_tenderid, 'Awarded', { fpip_green_light: true });
  if (client.useDemo) {
    const bIdx = demoStore.bids.findIndex((b) => b.fpip_bidid === input.bidId);
    if (bIdx >= 0) demoStore.bids[bIdx] = { ...demoStore.bids[bIdx], fpip_status: 'Shortlisted' };
  }
  return { tender: updated, po };
}

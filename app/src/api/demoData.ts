// Seed data part 1 — suppliers, requisitions, tenders, bids, purchase orders,
// plus assembly of the full demoData object. Local visual review only; see
// header in demoDataMore.ts. Never enable in a deployed environment.

import type {
  FpipSupplier,
  FpipRequisition,
  FpipTender,
  FpipBid,
  FpipPurchaseOrder,
  FpipApprovalPolicy,
} from './types';
import { demoDataMore } from './demoDataMore';
import { demoDataMore2 } from './demoDataMore2';

const suppliers: FpipSupplier[] = [
  { fpip_supplierid: 's1', fpip_name: 'Halyard Systems', fpip_status: 'Approved', fpip_category: 'ICT & Software', fpip_riskscore: 78, fpip_taxcertexpiry: '2027-03-01' },
  { fpip_supplierid: 's2', fpip_name: 'Kestrel Components Ltd.', fpip_status: 'Approved', fpip_category: 'ICT & Software', fpip_riskscore: 64, fpip_taxcertexpiry: '2026-09-05' },
  { fpip_supplierid: 's3', fpip_name: 'Solveware Group', fpip_status: 'Approved', fpip_category: 'ICT & Software', fpip_riskscore: 71, fpip_taxcertexpiry: '2026-11-20' },
  { fpip_supplierid: 's4', fpip_name: 'Northbridge FM', fpip_status: 'Approved', fpip_category: 'Facilities', fpip_riskscore: 58, fpip_taxcertexpiry: '2026-08-18' },
  { fpip_supplierid: 's5', fpip_name: 'Meridian Logistics', fpip_status: 'Approved', fpip_category: 'Logistics', fpip_riskscore: 49, fpip_taxcertexpiry: '2027-01-12' },
  { fpip_supplierid: 's6', fpip_name: 'Carrow & Pine LLP', fpip_status: 'Prequalified', fpip_category: 'Professional Services', fpip_riskscore: 40, fpip_taxcertexpiry: '2026-12-01' },
];

const requisitions: FpipRequisition[] = [
  { fpip_requisitionid: 'r1', fpip_title: 'Data center racks', fpip_department: 'Operations', fpip_category: 'ICT & Software', fpip_amount: 412000, fpip_status: 'Awaiting Approval', fpip_budget_check_result: 'Within Budget', fpip_Supplier: { id: 's1', name: 'Halyard Systems' } },
  { fpip_requisitionid: 'r2', fpip_title: 'Regional office fit-out', fpip_department: 'Facilities', fpip_category: 'Facilities', fpip_amount: 268000, fpip_status: 'Escalated', fpip_budget_check_result: 'Exceeds Budget' },
  { fpip_requisitionid: 'r3', fpip_title: 'ERP managed support renewal', fpip_department: 'Finance', fpip_category: 'ICT & Software', fpip_amount: 3100000, fpip_status: 'Sourcing', fpip_budget_check_result: 'Within Budget' },
  { fpip_requisitionid: 'r4', fpip_title: 'Office supplies framework', fpip_department: 'Operations', fpip_category: 'Facilities', fpip_amount: 8400, fpip_status: 'PO Issued', fpip_budget_check_result: 'Within Budget' },
];

const tenders: FpipTender[] = [
  { fpip_tenderid: 't1', fpip_title: 'RFP-118 · ERP Managed Support', fpip_category: 'ICT & Software', fpip_status: 'Evaluation', fpip_closingdate: '2026-07-22', fpip_estimatedvalue: 3100000 },
  { fpip_tenderid: 't2', fpip_title: 'RFQ-241 · Network Hardware Refresh', fpip_category: 'ICT & Software', fpip_status: 'Open', fpip_closingdate: '2026-08-03', fpip_estimatedvalue: 540000 },
  { fpip_tenderid: 't3', fpip_title: 'RFQ-233 · Office Supplies Framework', fpip_category: 'Facilities', fpip_status: 'Open', fpip_closingdate: '2026-07-30', fpip_estimatedvalue: 120000 },
  { fpip_tenderid: 't4', fpip_title: 'RFP-104 · Fleet Maintenance', fpip_category: 'Logistics', fpip_status: 'Awarded', fpip_closingdate: '2026-06-18', fpip_estimatedvalue: 940000 },
];

const bids: FpipBid[] = [
  { fpip_bidid: 'b1', fpip_Tender: { id: 't1', name: 'RFP-118 · ERP Managed Support' }, fpip_Supplier: { id: 's1', name: 'Halyard Systems' }, fpip_pricescore: 74, fpip_compliancescore: 96, fpip_deliveryscore: 88, fpip_status: 'Under Review' },
  { fpip_bidid: 'b2', fpip_Tender: { id: 't1', name: 'RFP-118 · ERP Managed Support' }, fpip_Supplier: { id: 's3', name: 'Solveware Group' }, fpip_pricescore: 91, fpip_compliancescore: 80, fpip_deliveryscore: 70, fpip_status: 'Under Review' },
  { fpip_bidid: 'b3', fpip_Tender: { id: 't1', name: 'RFP-118 · ERP Managed Support' }, fpip_Supplier: { id: 's2', name: 'Kestrel Components Ltd.' }, fpip_pricescore: 66, fpip_compliancescore: 72, fpip_deliveryscore: 81, fpip_status: 'Submitted' },
];

const purchaseOrders: FpipPurchaseOrder[] = [
  { fpip_purchaseorderid: 'p1', fpip_Requisition: { id: 'r1', name: 'Data center racks' }, fpip_Supplier: { id: 's1', name: 'Halyard Systems' }, fpip_ponumber: 'PO-22841', fpip_amount: 412000, fpip_status: 'Pending Approval' },
  { fpip_purchaseorderid: 'p2', fpip_Supplier: { id: 's2', name: 'Kestrel Components Ltd.' }, fpip_ponumber: 'PO-22839', fpip_amount: 84200, fpip_status: 'Approved' },
  { fpip_purchaseorderid: 'p3', fpip_Supplier: { id: 's2', name: 'Kestrel Components Ltd.' }, fpip_ponumber: 'PO-22610', fpip_amount: 61800, fpip_status: 'Delivered' },
];

const approvalPolicies: FpipApprovalPolicy[] = [
  {
    fpip_approvalpolicyid: 'ap1',
    fpip_name: 'Requisition Approval Policy',
    fpip_policy_type: 'Requisition',
    fpip_threshold_amount: 250000,
    fpip_threshold_currency: 'USD',
    fpip_primary_approver: 'manager@oticgroupug.onmicrosoft.com',
    fpip_escalation_approver: 'procurement.director@oticgroupug.onmicrosoft.com',
    fpip_active: true,
  },
  {
    fpip_approvalpolicyid: 'ap2',
    fpip_name: 'Tender Award Committee',
    fpip_policy_type: 'Tender Award',
    fpip_committee_team: 'procurement-committee@oticgroupug.onmicrosoft.com',
    fpip_requires_unanimous: true,
    fpip_active: true,
  },
  {
    fpip_approvalpolicyid: 'ap3',
    fpip_name: 'Invoice Exception Approval',
    fpip_policy_type: 'Invoice Exception',
    fpip_primary_approver: 'finance.manager@oticgroupug.onmicrosoft.com',
    fpip_active: true,
  },
  {
    fpip_approvalpolicyid: 'ap4',
    fpip_name: 'Contract Renewal Approval',
    fpip_policy_type: 'Contract Renewal',
    fpip_primary_approver: 'legal.procurement@oticgroupug.onmicrosoft.com',
    fpip_active: true,
  },
];

export const demoData = {
  suppliers,
  requisitions,
  tenders,
  bids,
  purchaseOrders,
  ...demoDataMore,
  ...demoDataMore2,
  approvalPolicies,
};

export type DemoData = typeof demoData;

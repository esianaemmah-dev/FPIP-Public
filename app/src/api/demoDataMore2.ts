// Seed data part 3 — approval requests and audit log entries.
// Local visual review only (VITE_USE_DEMO_DATA=true); never in production.

import type { FpipApprovalRequest, FpipApprovalPolicy, FpipAuditLogEntry } from './types';

const approvalRequests: FpipApprovalRequest[] = [
  { fpip_approvalrequestid: 'a1', fpip_record_type: 'Purchase Order', fpip_related_record: 'p1|fpip_purchaseorders', fpip_amount: 412000, fpip_status: 'Pending', fpip_requested_by: 'D. Reyes, Procurement', fpip_waiting_since: '2026-07-06T09:00:00Z' },
  { fpip_approvalrequestid: 'a2', fpip_record_type: 'Tender Award', fpip_related_record: 't1|fpip_tenders', fpip_amount: 3100000, fpip_status: 'Pending', fpip_requested_by: 'Procurement Committee', fpip_waiting_since: '2026-07-10T13:30:00Z' },
  { fpip_approvalrequestid: 'a3', fpip_record_type: 'Contract Renewal', fpip_related_record: 'c3|fpip_contracts', fpip_amount: 1860000, fpip_status: 'Pending', fpip_requested_by: 'Legal & Procurement', fpip_waiting_since: '2026-07-03T11:15:00Z' },
];

const approvalPolicies: FpipApprovalPolicy[] = [
  { fpip_approvalpolicyid: 'ap1', fpip_name: 'Requisition Approval Policy', fpip_policy_type: 'Requisition', fpip_threshold_amount: 100000, fpip_threshold_currency: 'USD', fpip_primary_approver: 'Manager', fpip_escalation_approver: 'Procurement Director', fpip_active: true },
  { fpip_approvalpolicyid: 'ap2', fpip_name: 'Tender Award Policy', fpip_policy_type: 'Tender Award', fpip_threshold_amount: 0, fpip_threshold_currency: 'USD', fpip_committee_team: 'Procurement Committee', fpip_requires_unanimous: true, fpip_active: true },
  { fpip_approvalpolicyid: 'ap3', fpip_name: 'Invoice Exception Policy', fpip_policy_type: 'Invoice Exception', fpip_threshold_amount: 0, fpip_threshold_currency: 'USD', fpip_primary_approver: 'Finance Manager', fpip_active: true },
  { fpip_approvalpolicyid: 'ap4', fpip_name: 'Contract Renewal Policy', fpip_policy_type: 'Contract Renewal', fpip_threshold_amount: 0, fpip_threshold_currency: 'USD', fpip_primary_approver: 'Legal & Procurement', fpip_active: true },
];

const auditLogEntries: FpipAuditLogEntry[] = [
  { fpip_auditlogentryid: 'al1', fpip_timestamp: '2026-07-11T08:42:00Z', fpip_actor: 'P. Nathan', fpip_actor_type: 'Human', fpip_action: 'Approved payment PAY-6028', fpip_entity_reference: 'Meridian Logistics · $219,000', fpip_source_detail: 'Finance > Payments' },
  { fpip_auditlogentryid: 'al2', fpip_timestamp: '2026-07-10T15:05:00Z', fpip_actor: 'Procurement Agent', fpip_actor_type: 'AI Agent', fpip_action: 'Read bid evaluation for RFP-118', fpip_entity_reference: 'fpip_bids (3 rows)', fpip_source_detail: 'Agent service · tool: dataverse_query' },
  { fpip_auditlogentryid: 'al3', fpip_timestamp: '2026-07-09T10:20:00Z', fpip_actor: 'D. Reyes', fpip_actor_type: 'Human', fpip_action: 'Submitted requisition REQ-4471', fpip_entity_reference: 'Data center racks · $412,000', fpip_source_detail: 'Procurement > Requisitions' },
  { fpip_auditlogentryid: 'al4', fpip_timestamp: '2026-07-08T09:00:00Z', fpip_actor: 'Compliance Agent', fpip_actor_type: 'AI Agent', fpip_action: 'Flagged expired ISO certificate', fpip_entity_reference: 'Northbridge FM', fpip_source_detail: 'Agent service · tool: dataverse_query' },
  { fpip_auditlogentryid: 'al5', fpip_timestamp: '2026-07-07T16:45:00Z', fpip_actor: 'M. Okafor', fpip_actor_type: 'Human', fpip_action: 'Held invoice INV-88177 for review', fpip_entity_reference: 'Northbridge FM · $27,300', fpip_source_detail: 'Finance > Invoices' },
];

export const demoDataMore2 = { approvalRequests, approvalPolicies, auditLogEntries };

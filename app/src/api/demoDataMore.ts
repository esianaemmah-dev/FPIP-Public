// Seed data part 2 — invoices, contracts, compliance documents.
// Local visual review only (VITE_USE_DEMO_DATA=true); never in production.

import type {
  FpipInvoice,
  FpipContract,
  FpipComplianceDocument,
} from './types';

const invoices: FpipInvoice[] = [
  { fpip_invoiceid: 'i1', fpip_PurchaseOrder: { id: 'p2', name: 'PO-22839' }, fpip_Supplier: { id: 's2', name: 'Kestrel Components Ltd.' }, fpip_invoicenumber: 'INV-88213', fpip_amount: 42100, fpip_match_status: '3-Way Match', fpip_duplicate_flag: true, fpip_payment_status: 'Held' },
  { fpip_invoiceid: 'i2', fpip_PurchaseOrder: { id: 'p2', name: 'PO-22839' }, fpip_Supplier: { id: 's2', name: 'Kestrel Components Ltd.' }, fpip_invoicenumber: 'INV-88214', fpip_amount: 42100, fpip_match_status: '3-Way Match', fpip_duplicate_flag: true, fpip_payment_status: 'Held' },
  { fpip_invoiceid: 'i3', fpip_PurchaseOrder: { id: 'p1', name: 'PO-22841' }, fpip_Supplier: { id: 's1', name: 'Halyard Systems' }, fpip_invoicenumber: 'INV-88190', fpip_amount: 118600, fpip_match_status: '3-Way Match', fpip_duplicate_flag: false, fpip_payment_status: 'Approved' },
  { fpip_invoiceid: 'i4', fpip_Supplier: { id: 's4', name: 'Northbridge FM' }, fpip_invoicenumber: 'INV-88177', fpip_amount: 27300, fpip_match_status: 'Qty Mismatch', fpip_duplicate_flag: false, fpip_payment_status: 'Held' },
];

const contracts: FpipContract[] = [
  { fpip_contractid: 'c1', fpip_title: 'Cloud Infrastructure MSA', fpip_Supplier: { id: 's1', name: 'Halyard Systems' }, fpip_value: 2400000, fpip_term_months: 24, fpip_expiry_date: '2026-07-30' },
  { fpip_contractid: 'c2', fpip_title: 'Facilities Maintenance', fpip_Supplier: { id: 's4', name: 'Northbridge FM' }, fpip_value: 960000, fpip_term_months: 12, fpip_expiry_date: '2026-08-22' },
  { fpip_contractid: 'c3', fpip_title: 'Freight & Logistics', fpip_Supplier: { id: 's5', name: 'Meridian Logistics' }, fpip_value: 1800000, fpip_term_months: 24, fpip_expiry_date: '2026-09-14' },
  { fpip_contractid: 'c4', fpip_title: 'Legal Advisory Retainer', fpip_Supplier: { id: 's6', name: 'Carrow & Pine LLP' }, fpip_value: 240000, fpip_term_months: 12, fpip_expiry_date: '2026-10-09' },
  { fpip_contractid: 'c5', fpip_title: 'Fleet Maintenance', fpip_Supplier: { id: 's4', name: 'Northbridge FM' }, fpip_value: 940000, fpip_term_months: 36, fpip_expiry_date: '2029-06-18' },
];

const complianceDocuments: FpipComplianceDocument[] = [
  { fpip_compliancedocumentid: 'd1', fpip_Supplier: { id: 's2', name: 'Kestrel Components Ltd.' }, fpip_document_type: 'Tax Compliance Certificate', fpip_expiry_date: '2026-09-05', fpip_status: 'Renewal Due', fpip_sharepoint_url: 'https://contoso.sharepoint.com/sites/fpip-docs/tax_kestrel_2026.pdf' },
  { fpip_compliancedocumentid: 'd2', fpip_Supplier: { id: 's2', name: 'Kestrel Components Ltd.' }, fpip_document_type: 'ISO 9001 Certification', fpip_expiry_date: '2027-05-01', fpip_status: 'Verified', fpip_sharepoint_url: 'https://contoso.sharepoint.com/sites/fpip-docs/iso_kestrel.pdf' },
  { fpip_compliancedocumentid: 'd3', fpip_Supplier: { id: 's4', name: 'Northbridge FM' }, fpip_document_type: 'ISO Certification', fpip_expiry_date: '2026-06-30', fpip_status: 'Expired', fpip_sharepoint_url: 'https://contoso.sharepoint.com/sites/fpip-docs/iso_northbridge.pdf' },
  { fpip_compliancedocumentid: 'd4', fpip_Supplier: { id: 's3', name: 'Solveware Group' }, fpip_document_type: 'Tax Compliance Certificate', fpip_expiry_date: '2026-11-20', fpip_status: 'Renewal Due', fpip_sharepoint_url: 'https://contoso.sharepoint.com/sites/fpip-docs/tax_solveware.pdf' },
];

export const demoDataMore = { invoices, contracts, complianceDocuments };

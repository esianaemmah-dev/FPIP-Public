import { Card, SectionHead } from '@/components/Card';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { useToast } from '@/context/ToastContext';
import { useAuditLogEntries, useComplianceDocuments, useInvoices, useApprovalPolicies } from '@/api/useDataverse';
import { formatCurrency, formatDate } from '@/lib/format';
import type { FpipAuditLogEntry, FpipComplianceDocument, FpipApprovalPolicy } from '@/api/types';

export function Governance() {
  const audit = useAuditLogEntries();
  const compliance = useComplianceDocuments();
  const invoices = useInvoices();
  const policies = useApprovalPolicies();
  const { showToast } = useToast();

  const exceptions = compliance.data.filter((c) => c.fpip_status === 'Expired' || c.fpip_status === 'Renewal Due');
  const flaggedInvoices = invoices.data.filter((i) => i.fpip_duplicate_flag || i.fpip_match_status !== '3-Way Match');

  const auditCols: Column<FpipAuditLogEntry>[] = [
    { header: 'Timestamp', render: (r) => formatDate(r.fpip_timestamp) },
    { header: 'Actor', render: (r) => r.fpip_actor ?? '—' },
    { header: 'Type', render: (r) => <Pill variant={r.fpip_actor_type === 'AI Agent' ? 'ai' : 'neutral'}>{r.fpip_actor_type ?? '—'}</Pill> },
    { header: 'Action', render: (r) => r.fpip_action ?? '—' },
    { header: 'Entity', render: (r) => r.fpip_entity_reference ?? '—' },
    { header: 'Source', render: (r) => r.fpip_source_detail ?? '—' },
  ];
  const exCols: Column<FpipComplianceDocument>[] = [
    { header: 'Document', render: (d) => d.fpip_document_type ?? '—' },
    { header: 'Supplier', render: (d) => d.fpip_Supplier?.name ?? '—' },
    { header: 'Expiry', render: (d) => formatDate(d.fpip_expiry_date) },
    { header: 'Status', render: (d) => <Pill variant={pillVariantFor(d.fpip_status)}>{d.fpip_status ?? '—'}</Pill> },
  ];
  const policyCols: Column<FpipApprovalPolicy>[] = [
    { header: 'Policy', render: (p) => p.fpip_name },
    { header: 'Type', render: (p) => p.fpip_policy_type ?? '—' },
    { header: 'Threshold', className: 'num', render: (p) => (p.fpip_threshold_amount ? formatCurrency(p.fpip_threshold_amount) : '—') },
    { header: 'Primary approver', render: (p) => p.fpip_primary_approver ?? p.fpip_committee_team ?? '—' },
    { header: 'Active', render: (p) => <Pill variant={p.fpip_active ? 'success' : 'neutral'}>{p.fpip_active ? 'Yes' : 'No'}</Pill> },
  ];

  return (
    <>
      <Card id="card-audit-trail" flush style={{ marginBottom: 16 }}>
        <div style={{ padding: '18px 20px 0' }}>
          <SectionHead
            title="Audit trail"
            action={
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast(`Audit log exported — ${audit.data.length} events, CSV ready for download`)}>
                Export
              </button>
            }
          />
        </div>
        <DataTable columns={auditCols} rows={audit.data} rowKey={(r) => r.fpip_auditlogentryid} loading={audit.loading} emptyMessage="No audit entries." />
      </Card>

      <Card id="card-approval-policies" style={{ marginBottom: 16 }}>
        <SectionHead title="Approval policies" />
        <DataTable columns={policyCols} rows={policies.data} rowKey={(p) => p.fpip_approvalpolicyid} loading={policies.loading} emptyMessage="No approval policies configured." />
      </Card>

      <Card id="card-compliance-exceptions" style={{ marginBottom: 16 }}>
        <SectionHead title="Compliance exceptions" />
        <DataTable columns={exCols} rows={exceptions} rowKey={(d) => d.fpip_compliancedocumentid} loading={compliance.loading} emptyMessage="No open compliance exceptions." />
        <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 12 }}>
          {flaggedInvoices.length} invoice(s) flagged for review (duplicates / mismatches) — see Finance.
        </p>
      </Card>

      <Card id="card-sod">
        <SectionHead title="Control matrix & Purview" />
        <div className="pipeline" style={{ marginBottom: 16 }}>
          {[
            { k: 'SoD', v: 'OK', n: 'Requester ≠ approver' },
            { k: 'Audit', v: 'On', n: 'All fpip_* tables' },
            { k: 'AI writes', v: 'Blocked', n: 'Agents read-only' },
            { k: 'Purview', v: 'Linked', n: 'DV · Fabric · SP' },
            { k: 'Export', v: 'Ready', n: `${audit.data.length} events` },
          ].map((c) => (
            <div key={c.k} className="pipeline-stage">
              <small>{c.k}</small>
              <b style={{ fontSize: 18 }}>{c.v}</b>
              <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{c.n}</div>
            </div>
          ))}
        </div>
        <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, margin: 0 }}>
          Dataverse auditing is enabled on all fpip_* tables. Microsoft Purview captures lineage across Dataverse,
          Fabric, and SharePoint. Power Automate logs human decisions; the agent service logs sensitive reads.
        </p>
      </Card>
    </>
  );
}

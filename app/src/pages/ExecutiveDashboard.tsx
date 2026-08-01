import { useNavigate } from 'react-router-dom';
import {
  useApprovalRequests,
  useRequisitions,
  useContracts,
  useInvoices,
  useComplianceDocuments,
  useTenders,
} from '@/api/useDataverse';
import { Card, SectionHead } from '@/components/Card';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { DashChat } from '@/components/DashChat';
import { Icon } from '@/components/Icons';
import { useModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { useTenant } from '@/context/TenantContext';
import { formatCurrency, formatDate, formatMoney, daysUntil } from '@/lib/format';
import type { FpipApprovalRequest } from '@/api/types';

export function ExecutiveDashboard() {
  const navigate = useNavigate();
  const approvals = useApprovalRequests();
  const requisitions = useRequisitions();
  const contracts = useContracts();
  const invoices = useInvoices();
  const compliance = useComplianceDocuments();
  const tenders = useTenders();
  const { openModal, closeModal } = useModal();
  const { showToast } = useToast();
  const { account } = useFpipAuth();
  const { entity, currency } = useTenant();

  const userContext = {
    username: account?.username ?? account?.name ?? 'fpip-user',
    role: 'internal' as const,
  };

  const firstName = (account?.name ?? 'there').split(' ')[0];
  const pendingApprovals = approvals.data.filter((a) => a.fpip_status === 'Pending').length;
  const spendYtd = requisitions.data.reduce((s, r) => s + (r.fpip_amount ?? 0), 0);
  const contractsExpiring = contracts.data.filter((c) => {
    const d = daysUntil(c.fpip_expiry_date);
    return d !== null && d >= 0 && d <= 90;
  }).length;
  const exceptions =
    invoices.data.filter((i) => i.fpip_duplicate_flag || i.fpip_match_status !== '3-Way Match').length +
    compliance.data.filter((c) => c.fpip_status === 'Expired' || c.fpip_status === 'Renewal Due').length;

  const pipeline = {
    draft: requisitions.data.filter((r) => r.fpip_status === 'Draft').length,
    sourcing: requisitions.data.filter((r) => r.fpip_status === 'Sourcing').length,
    open: tenders.data.filter((t) => t.fpip_status === 'Open').length,
    eval: tenders.data.filter((t) => t.fpip_status === 'Evaluation').length,
    awarded: tenders.data.filter((t) => t.fpip_status === 'Awarded').length,
  };

  const pendingRows = approvals.data.filter((a) => a.fpip_status === 'Pending');

  const approvalColumns: Column<FpipApprovalRequest>[] = [
    { header: 'Record', render: (r) => r.fpip_record_type ?? '—' },
    {
      header: 'Amount',
      className: 'num',
      render: (r) => formatMoney(r.fpip_amount, currency),
    },
    { header: 'Requested by', render: (r) => r.fpip_requested_by ?? '—' },
    { header: 'Waiting since', render: (r) => formatDate(r.fpip_waiting_since) },
    {
      header: 'Status',
      render: (r) => <Pill variant={pillVariantFor(r.fpip_status)}>{r.fpip_status ?? '—'}</Pill>,
    },
  ];

  function openApproval(r: FpipApprovalRequest) {
    openModal({
      eyebrow: `${r.fpip_record_type} · ${r.fpip_status ?? 'Pending'}`,
      title: r.fpip_record_type ?? 'Approval',
      body: (
        <>
          <div className="modal-kv">
            <div>
              <span className="k">Amount</span>
              <span className="v">{formatMoney(r.fpip_amount, currency)}</span>
            </div>
            <div>
              <span className="k">Requested by</span>
              <span className="v">{r.fpip_requested_by ?? '—'}</span>
            </div>
            <div>
              <span className="k">Waiting since</span>
              <span className="v">{formatDate(r.fpip_waiting_since)}</span>
            </div>
            <div>
              <span className="k">Status</span>
              <span className="v">{r.fpip_status ?? '—'}</span>
            </div>
          </div>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                showToast('Recommended approve — open Workflows to sign off');
                closeModal();
                navigate('/workflows');
              }}
            >
              Open in Workflows
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                showToast('Escalated to director queue');
                closeModal();
              }}
            >
              Escalate
            </button>
          </div>
        </>
      ),
    });
  }

  return (
    <div className="polish-page">
      <header className="page-masthead">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name}</div>
            <h1>Good day, {firstName}</h1>
            <p>
              Live view of spend, approvals, and risk for {entity.name}. Act on the queue, then open
              Tender Studio when you are ready to source.
            </p>
          </div>
          <div className="page-masthead-meta">
            <div className="mast-stat">
              <b>{pendingApprovals}</b>
              <span>Pending</span>
            </div>
            <div className="mast-stat">
              <b>{exceptions}</b>
              <span>Exceptions</span>
            </div>
            <div className="mast-stat">
              <b>{contractsExpiring}</b>
              <span>Renewals</span>
            </div>
          </div>
        </div>
      </header>

      <div id="card-signals" className="polish-signals">
        <div className={`polish-signal ${pendingApprovals ? 'warn' : 'ok'}`}>
          <strong>{pendingApprovals ? 'Approvals waiting' : 'Queue clear'}</strong>
          <span>
            {pendingApprovals
              ? `${pendingApprovals} decisions need a human sign-off.`
              : 'No pending approvals for this entity.'}
          </span>
          {pendingApprovals > 0 ? (
            <div className="signal-actions action-row">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/workflows')}>
                Open Workflows
              </button>
            </div>
          ) : null}
        </div>
        <div className={`polish-signal ${exceptions ? 'danger' : 'ok'}`}>
          <strong>{exceptions ? 'Exceptions rising' : 'Controls healthy'}</strong>
          <span>
            {exceptions
              ? `${exceptions} invoice or compliance items need Finance or Audit.`
              : 'No open invoice or compliance exceptions.'}
          </span>
        </div>
        <div className="polish-signal ok">
          <strong>Tender Studio</strong>
          <span>Draft the next competition with AI-assisted criteria and weights.</span>
          <div className="signal-actions action-row">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/procurement/studio')}>
              <Icon name="sparkles" size={13} /> Open Studio
            </button>
          </div>
        </div>
      </div>

      <div id="card-kpis" className="grid g-4 polish-kpis" style={{ marginBottom: 20 }}>
        <KpiCard label="Active approvals" value={pendingApprovals} delta="Pending decisions" deltaTone="flat" />
        <KpiCard
          label="Requisition spend"
          value={formatCurrency(spendYtd, { compact: true, currency })}
          delta={`In ${currency}`}
          deltaTone="flat"
        />
        <KpiCard
          label="Contracts expiring ≤90d"
          value={contractsExpiring}
          delta="Renewals to track"
          deltaTone={contractsExpiring > 0 ? 'down' : 'flat'}
        />
        <KpiCard
          label="Open exceptions"
          value={exceptions}
          delta="Invoices + compliance"
          deltaTone={exceptions > 0 ? 'down' : 'flat'}
        />
      </div>

      <Card id="card-pipeline" className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Sourcing pipeline" />
        <div className="polish-pipeline">
          {(
            [
              ['Draft reqs', pipeline.draft],
              ['Sourcing', pipeline.sourcing],
              ['Open tenders', pipeline.open],
              ['Evaluation', pipeline.eval],
              ['Awarded', pipeline.awarded],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="polish-stage">
              <small>{label}</small>
              <b>{value}</b>
            </div>
          ))}
        </div>
      </Card>

      <div id="card-approvals" className="card card-flush polish-section" style={{ marginBottom: 16 }}>
        <div className="polish-section-pad">
          <SectionHead
            title="Approvals queue"
            action={
              <button type="button" className="link-btn" onClick={() => navigate('/workflows')}>
                Full queue
              </button>
            }
          />
        </div>
        <DataTable
          columns={approvalColumns}
          rows={pendingRows.length ? pendingRows : approvals.data}
          rowKey={(r) => r.fpip_approvalrequestid}
          loading={approvals.loading}
          emptyMessage="No pending approvals."
          onRowClick={openApproval}
        />
      </div>

      <Card className="polish-section">
        <SectionHead title="Executive brief" />
        <DashChat agentId="executive" userContext={userContext} height={300} />
      </Card>
    </div>
  );
}

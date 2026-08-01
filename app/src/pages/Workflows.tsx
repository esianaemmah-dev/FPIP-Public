import { useEffect, useMemo, useState } from 'react';
import { Card, SectionHead } from '@/components/Card';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { Icon } from '@/components/Icons';
import { useToast } from '@/context/ToastContext';
import { useRole } from '@/context/RoleContext';
import { useTenant } from '@/context/TenantContext';
import { useLocale } from '@/context/LocaleContext';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { useApprovalRequests } from '@/api/useDataverse';
import { decideApprovalRequest } from '@/api/repositories';
import { formatMoney, formatDate } from '@/lib/format';
import type { FpipApprovalRequest } from '@/api/types';

const POWER_FLOWS = [
  { name: 'Requisition approval', status: 'Connected', trigger: 'fpip_requisition · Submitted' },
  { name: 'Tender award', status: 'Connected', trigger: 'fpip_tender · Evaluation complete' },
  { name: 'Invoice exception', status: 'Connected', trigger: 'fpip_invoice · Exception raised' },
  { name: 'Contract renewal', status: 'Configured', trigger: 'fpip_contract · 60 days to expiry' },
];

export function Workflows() {
  const { data, loading, refresh } = useApprovalRequests();
  const { can } = useRole();
  const { entity, currency } = useTenant();
  const { t } = useLocale();
  const { showToast } = useToast();
  const { account } = useFpipAuth();
  const [local, setLocal] = useState<FpipApprovalRequest[]>([]);
  const [actingId, setActingId] = useState<string | null>(null);

  useEffect(() => {
    if (data.length) setLocal(data);
  }, [data]);

  const pending = useMemo(() => {
    const src = local.length ? local : data;
    return src.filter((r) => r.fpip_status === 'Pending');
  }, [local, data]);

  const canAct = can('approvals_act');
  const canPay = can('payments_release');
  const canPublish = can('tender_publish');

  async function act(row: FpipApprovalRequest, action: 'Approved' | 'Rejected') {
    if (!canAct) {
      showToast('Your role cannot act on approvals');
      return;
    }
    const id = row.fpip_approvalrequestid;
    setActingId(id);
    const prev = local.length ? local : data;
    setLocal(
      prev.map((r) => (r.fpip_approvalrequestid === id ? { ...r, fpip_status: action } : r)),
    );
    try {
      await decideApprovalRequest({
        id,
        decision: action,
        actor: account?.name ?? account?.username ?? 'Unknown',
        recordType: row.fpip_record_type,
        relatedRecord: row.fpip_related_record,
      });
      showToast(
        action === 'Approved'
          ? 'Decision saved to Dataverse — Power Automate notified'
          : 'Rejection saved to Dataverse — submitter can be notified',
      );
      refresh?.();
    } catch (err) {
      setLocal(prev);
      showToast(err instanceof Error ? err.message : 'Failed to update approval in Dataverse');
    } finally {
      setActingId(null);
    }
  }

  const cols: Column<FpipApprovalRequest>[] = [
    { header: 'Type', render: (r) => r.fpip_record_type ?? '—' },
    { header: 'Reference', render: (r) => r.fpip_related_record?.split('|')[0] ?? '—' },
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
    {
      header: 'Actions',
      render: (r) =>
        r.fpip_status === 'Pending' ? (
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!canAct || actingId === r.fpip_approvalrequestid}
              title={!canAct ? 'Requires approvals_act' : undefined}
              onClick={() => void act(r, 'Approved')}
            >
              Approve
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!canAct || actingId === r.fpip_approvalrequestid}
              onClick={() => void act(r, 'Rejected')}
            >
              Reject
            </button>
          </div>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead" id="wf-queue">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name}</div>
            <h1>{t('workflows.title')}</h1>
            <p>{t('workflows.sub')}</p>
          </div>
          <div className="page-masthead-meta">
            <div className="mast-stat">
              <b>{pending.length}</b>
              <span>In queue</span>
            </div>
            <div className="platform-cap-badges">
              <span className={canAct ? 'cap on' : 'cap off'}>
                Approvals {canAct ? 'enabled' : 'read-only'}
              </span>
              <span className={canPublish ? 'cap on' : 'cap off'}>
                Publish {canPublish ? 'enabled' : 'blocked'}
              </span>
              <span className={canPay ? 'cap on' : 'cap off'}>
                Payments {canPay ? 'enabled' : 'blocked'}
              </span>
            </div>
          </div>
        </div>
      </header>

      <Card flush className="polish-section" style={{ marginBottom: 16 }}>
        <div className="polish-section-pad">
          <SectionHead title={`Pending queue · ${pending.length}`} />
        </div>
        <DataTable
          columns={cols}
          rows={pending}
          rowKey={(r) => r.fpip_approvalrequestid}
          loading={loading}
          emptyMessage="No pending approvals for this entity."
        />
      </Card>

      <Card id="wf-flows" className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Power Automate flows" />
        <div className="flow-grid">
          {POWER_FLOWS.map((f) => (
            <div key={f.name} className="flow-card">
              <div className="flow-card-top">
                <Icon name="wand" size={16} />
                <Pill variant="success">{f.status}</Pill>
              </div>
              <strong>{f.name}</strong>
              <span>{f.trigger}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card id="wf-sod" className="polish-section">
        <SectionHead title="Segregation of duties" />
        <div className="sod-grid">
          {[
            { rule: 'Requester ≠ approver', status: 'Enforced' },
            { rule: 'AI agents cannot approve', status: 'Enforced' },
            { rule: 'Dual sign-off > $500k', status: 'Policy active' },
            { rule: 'Supplier isolation', status: 'Enforced' },
          ].map((s) => (
            <div key={s.rule} className="sod-row">
              <Icon name="check" size={14} />
              <span>{s.rule}</span>
              <Pill variant="success">{s.status}</Pill>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

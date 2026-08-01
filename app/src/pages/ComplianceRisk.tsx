import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, SectionHead } from '@/components/Card';
import { Pill } from '@/components/Pill';
import { useComplianceDocuments, useTenders, updateTenderStatus } from '@/api/useDataverse';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/context/ToastContext';
import { useNotifications } from '@/context/NotificationContext';
import { formatDate } from '@/lib/format';

const UAT_ITEMS = [
  { id: 'u1', tender: 'RFP-118 · ERP Managed Support', item: 'UAT sign-off pack', status: 'Pending' as const },
  { id: 'u2', tender: 'RFP-118 · ERP Managed Support', item: 'Delivery acceptance checklist', status: 'Incomplete' as const },
  { id: 'u3', tender: 'RFQ-241 · Network Hardware', item: 'Site inspection photos', status: 'Submitted' as const },
];

export function ComplianceRisk() {
  const compliance = useComplianceDocuments();
  const tenders = useTenders();
  const navigate = useNavigate();
  const { entity } = useTenant();
  const { showToast } = useToast();
  const { push, pushActivity } = useNotifications();
  const [uat, setUat] = useState(UAT_ITEMS);

  const exceptions = useMemo(
    () =>
      compliance.data.filter((d) => d.fpip_status === 'Expired' || d.fpip_status === 'Renewal Due'),
    [compliance.data],
  );

  // UAT is the hard gate; document exceptions are advisory for the officer.
  const blocked = uat.some((u) => u.status !== 'Submitted');
  const evalTender =
    tenders.data.find((t) => t.fpip_status === 'Evaluation' || t.fpip_green_light === false) ??
    tenders.data.find((t) => t.fpip_status === 'Open') ??
    tenders.data[0];

  function submitUat(id: string) {
    setUat((rows) => rows.map((u) => (u.id === id ? { ...u, status: 'Submitted' as const } : u)));
    showToast('UAT evidence recorded');
    pushActivity({
      actor: 'Compliance Officer',
      action: 'Submitted UAT evidence',
      detail: uat.find((u) => u.id === id)?.item ?? id,
      href: '/compliance',
    });
  }

  async function grantGreenLight() {
    if (blocked) {
      showToast('Cannot grant green light — clear exceptions and complete UAT first');
      return;
    }
    if (!evalTender) {
      showToast('No tender available for green light');
      return;
    }
    try {
      await updateTenderStatus(evalTender.fpip_tenderid, evalTender.fpip_status ?? 'Evaluation', {
        fpip_green_light: true,
      });
      push({
        kind: 'compliance',
        title: 'Green light granted',
        body: `${evalTender.fpip_title} cleared for award / LPO.`,
        href: '/procurement',
      });
      pushActivity({
        actor: 'Compliance Officer',
        action: 'Granted tender green light',
        detail: evalTender.fpip_title,
        href: '/procurement',
      });
      showToast('Green light granted — procurement may award and create LPO');
      tenders.refresh();
      navigate('/procurement');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Green light failed');
    }
  }

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name} · Risk & compliance</div>
            <h1>Compliance & Risk portal</h1>
            <p>
              Defined home for compliance checks, UAT submissions, and the green-light gate before
              tender execution. Exceptions also surface on Procurement and Supplier views.
            </p>
          </div>
          <div className="page-masthead-meta">
            <div className="mast-stat">
              <b>{exceptions.length}</b>
              <span>Exceptions</span>
            </div>
            <div className="mast-stat">
              <b>{uat.filter((u) => u.status !== 'Submitted').length}</b>
              <span>UAT open</span>
            </div>
          </div>
        </div>
      </header>

      <div className={`gate-card ${blocked ? 'blocked' : 'clear'}`} style={{ marginBottom: 16 }}>
        <h3>{blocked ? 'Green light blocked' : 'Ready for green light'}</h3>
        <p style={{ margin: '0 0 14px', color: 'var(--ink-soft)', fontSize: 13.5 }}>
          {blocked
            ? 'Resolve compliance exceptions and complete UAT before awarding execution authority.'
            : `All gates clear for ${evalTender?.fpip_title ?? 'selected tender'}.`}
        </p>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => void grantGreenLight()} disabled={blocked}>
          Grant green light
        </button>
      </div>

      <Card className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Compliance exceptions (also on Procurement / Supplier)" />
        {exceptions.length === 0 ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No open document exceptions.</p>
        ) : (
          <div className="sod-grid">
            {exceptions.map((d) => (
              <div key={d.fpip_compliancedocumentid} className="sod-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                <strong>{d.fpip_document_type}</strong>
                <span>{d.fpip_Supplier?.name ?? '—'} · expires {formatDate(d.fpip_expiry_date)}</span>
                <Pill variant="danger">{d.fpip_status}</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="polish-section">
        <SectionHead title="UAT submissions" />
        <div className="sod-grid">
          {uat.map((u) => (
            <div key={u.id} className="sod-row" style={{ gridTemplateColumns: '1.2fr 1fr auto auto' }}>
              <div>
                <strong>{u.item}</strong>
                <div className="retention-meta">{u.tender}</div>
              </div>
              <Pill variant={u.status === 'Submitted' ? 'success' : 'warn'}>{u.status}</Pill>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={u.status === 'Submitted'}
                onClick={() => submitUat(u.id)}
              >
                Submit evidence
              </button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

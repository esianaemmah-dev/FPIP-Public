import { Card, SectionHead } from '@/components/Card';
import { useRequisitions } from '@/api/useDataverse';
import { useTenant } from '@/context/TenantContext';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { formatMoney } from '@/lib/format';
import { Pill, pillVariantFor } from '@/components/Pill';
import { useNavigate } from 'react-router-dom';
import { BUDGET_ENVELOPES } from '@/lib/budgetEnvelopes';

const ENVELOPES = BUDGET_ENVELOPES.filter((e) =>
  ['Operations', 'Facilities', 'Finance', 'ICT'].includes(e.dept),
).map((e) => ({ dept: e.dept, used: e.usedPct, cap: e.cap }));

export function BudgetOwner() {
  const requisitions = useRequisitions();
  const { entity, currency } = useTenant();
  const { account } = useFpipAuth();
  const navigate = useNavigate();

  const mine = requisitions.data.filter((r) =>
    ['Operations', 'Facilities', 'Finance'].includes(String(r.fpip_department)),
  );

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name} · Budget owner</div>
            <h1>Budget owner dashboard</h1>
            <p>
              Your envelopes, HOD requisitions against budget, and overrun alerts — without the full
              Finance desk.
            </p>
          </div>
          <div className="page-masthead-meta">
            <div className="mast-stat">
              <b>{mine.length}</b>
              <span>My reqs</span>
            </div>
          </div>
        </div>
      </header>

      <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
        Signed in as {account?.name ?? 'Budget owner'}
      </p>

      <Card className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Department envelopes" />
        <div className="sod-grid">
          {ENVELOPES.map((b) => (
            <div key={b.dept} className="sod-row" style={{ gridTemplateColumns: '120px 1fr 100px' }}>
              <strong>{b.dept}</strong>
              <div>
                <div className="score-bar">
                  <i style={{ width: `${b.used}%`, background: b.used > 85 ? 'var(--danger)' : 'var(--teal)' }} />
                </div>
                <div className="retention-meta">{b.used}% of {formatMoney(b.cap, currency)}</div>
              </div>
              <span>{b.used > 85 ? 'Watch' : 'OK'}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="polish-section">
        <SectionHead
          title="Requisitions against budget"
          action={
            <button type="button" className="link-btn" onClick={() => navigate('/hod')}>
              HOD submit
            </button>
          }
        />
        <div className="sod-grid">
          {mine.map((r) => (
            <div key={r.fpip_requisitionid} className="sod-row" style={{ gridTemplateColumns: '1.4fr 1fr auto auto' }}>
              <strong>{r.fpip_title}</strong>
              <span>{formatMoney(r.fpip_amount, currency)}</span>
              <Pill variant={pillVariantFor(r.fpip_budget_check_result)}>{r.fpip_budget_check_result ?? '—'}</Pill>
              <Pill variant={pillVariantFor(r.fpip_status)}>{r.fpip_status ?? '—'}</Pill>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

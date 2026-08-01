import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, SectionHead } from '@/components/Card';
import { Pill, pillVariantFor } from '@/components/Pill';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/context/ToastContext';
import { useNotifications } from '@/context/NotificationContext';
import { useCreateRequisition, useRequisitions } from '@/api/useDataverse';
import type { Category, Department } from '@/api/types';
import { formatMoney, formatCurrency } from '@/lib/format';
import { checkBudget } from '@/lib/budgetEnvelopes';
import { extractQuoteFromFile, type QuoteExtract } from '@/lib/documentAi';
import { ExtractDetailPanel } from '@/components/ExtractDetail';

const DEPARTMENTS: Department[] = ['Operations', 'Facilities', 'Finance', 'Logistics', 'Marketing'];
const CATEGORIES: Category[] = [
  'ICT & Software',
  'Facilities',
  'Professional Services',
  'Logistics',
  'Capital Equipment',
];

const COST_CENTRES: Record<string, string> = {
  Operations: 'CC-OPS-100',
  Facilities: 'CC-FAC-220',
  Finance: 'CC-FIN-310',
  Logistics: 'CC-LOG-410',
  Marketing: 'CC-MKT-510',
};

const GL_ACCOUNTS: Record<string, string> = {
  'ICT & Software': '6100 · IT Services',
  Facilities: '6200 · Facilities & Premises',
  'Professional Services': '6300 · Professional Fees',
  Logistics: '6400 · Transport & Logistics',
  'Capital Equipment': '1500 · CapEx Equipment',
};

const PROCESS = [
  {
    n: '01',
    title: 'HOD submits',
    body: 'Upload a supplier quote or fill the bank form — cost centre and GL auto-fill.',
  },
  {
    n: '02',
    title: 'Budget gate',
    body: 'FPIP blocks over-budget submits unless a named override is recorded.',
  },
  {
    n: '03',
    title: 'Procurement intake',
    body: 'Procurement converts approved requisitions to RFQ / RFP in Tender Studio.',
  },
  {
    n: '04',
    title: 'Award → LPO',
    body: 'After award, LPO issues and feeds Finance invoice match.',
  },
];

export function HodRequisition() {
  const { account } = useFpipAuth();
  const { entity, currency } = useTenant();
  const { showToast } = useToast();
  const { push, pushActivity } = useNotifications();
  const { submit, submitting } = useCreateRequisition();
  const requisitions = useRequisitions();
  const navigate = useNavigate();

  const hodName = account?.name ?? 'Head of Department';
  const myReqs = useMemo(() => requisitions.data.slice().reverse().slice(0, 8), [requisitions.data]);
  const [dept, setDept] = useState<Department>('Facilities');
  const [cat, setCat] = useState<Category>('Facilities');
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [neededBy, setNeededBy] = useState('');
  const [justification, setJustification] = useState('');
  const [priority, setPriority] = useState('Normal');
  const [suggested, setSuggested] = useState('');
  const [overrideBudget, setOverrideBudget] = useState(false);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [quoteLabel, setQuoteLabel] = useState<string | null>(null);
  const [quoteExtract, setQuoteExtract] = useState<QuoteExtract | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const costCentre = COST_CENTRES[dept] ?? 'CC-GEN-000';
  const gl = GL_ACCOUNTS[cat] ?? '6000 · General';
  const budgetLine = useMemo(() => `${dept} · FY26 · ${currency}`, [dept, currency]);
  const amtNum = parseFloat(amount);
  const budget = useMemo(
    () => (Number.isFinite(amtNum) && amtNum > 0 ? checkBudget(dept, amtNum) : null),
    [dept, amtNum],
  );

  async function onQuoteFile(file: File | null) {
    if (!file) return;
    setQuoteBusy(true);
    try {
      const q = await extractQuoteFromFile(file);
      setTitle(q.title);
      setAmount(String(q.amount));
      setSuggested(q.supplierName);
      if (CATEGORIES.includes(q.category as Category)) setCat(q.category as Category);
      setJustification(
        `${q.notes}\n\nQuote ref: ${q.quoteRef ?? '—'}\nLines:\n${q.lineItems
          .map((l) => `• ${l.description}${l.total != null ? ` — ${l.total}` : ''}`)
          .join('\n')}`,
      );
      if (q.deliveryDate && /^\d{4}-\d{2}-\d{2}/.test(q.deliveryDate)) setNeededBy(q.deliveryDate.slice(0, 10));
      setQuoteLabel(file.name);
      setQuoteExtract(q);
      showToast(`Quote “${file.name}” filled the form (${Math.round(q.confidence * 100)}% confidence)`);
    } catch {
      showToast('Could not read quote — fill the form manually');
    } finally {
      setQuoteBusy(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!title.trim()) return setErr('Title is required.');
    if (Number.isNaN(amt) || amt <= 0) return setErr('Enter a valid amount.');
    if (!justification.trim()) return setErr('Business justification is required.');
    const gate = checkBudget(dept, amt);
    if (!gate.withinBudget && !overrideBudget) {
      return setErr(
        `Exceeds remaining envelope (${formatMoney(gate.remaining, currency)} left in ${gate.envelopeDept}). Tick budget override to escalate.`,
      );
    }
    setErr(null);
    try {
      await submit({
        title: title.trim(),
        department: dept,
        category: cat,
        amount: amt,
        withinBudget: gate.withinBudget,
        allowOverBudgetOverride: overrideBudget,
        suggestedSupplier: suggested.trim() || undefined,
      });
      push({
        kind: 'requisition',
        title: `HOD requisition · ${title.trim()}`,
        body: `${hodName} · ${costCentre} · ${currency} ${amt.toLocaleString()}${
          !gate.withinBudget ? ' · OVER BUDGET' : ''
        }`,
        href: '/notifications',
      });
      pushActivity({
        actor: `HOD · ${dept}`,
        action: gate.withinBudget ? 'Submitted requisition' : 'Submitted over-budget (override)',
        detail: `${title.trim()} · ${currency} ${amt.toLocaleString()}`,
        href: '/notifications',
      });
      showToast(
        gate.withinBudget
          ? 'Requisition submitted — within budget'
          : 'Submitted with override — escalated to Budget Owner / Procurement',
      );
      requisitions.refresh();
      setTitle('');
      setAmount('');
      setJustification('');
      setSuggested('');
      setOverrideBudget(false);
      setQuoteLabel(null);
      setQuoteExtract(null);
    } catch {
      setErr('Submit failed — please try again.');
    }
  }

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name} · HOD intake</div>
            <h1>Submit a requisition</h1>
            <p>
              Upload a supplier quote to auto-fill, or complete the bank form. Hard budget gate before
              Procurement can convert.
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/notifications')}>
            My intake status
          </button>
        </div>
      </header>

      <div className="process-steps">
        {PROCESS.map((s) => (
          <div key={s.n} className="process-step">
            <div className="step-num">Step {s.n}</div>
            <strong>{s.title}</strong>
            <p>{s.body}</p>
          </div>
        ))}
      </div>

      <Card className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Quote → requisition (AI intake)" />
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-soft)' }}>
          Drop a supplier quote (.txt / .md / .pdf). FPIP extracts title, amount, and supplier — review then
          submit.
        </p>
        <label className="studio-field" style={{ maxWidth: 420 }}>
          <span>Supplier quote</span>
          <input
            type="file"
            accept=".txt,.md,.csv,.pdf,.doc,.docx"
            disabled={quoteBusy}
            onChange={(e) => void onQuoteFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {quoteExtract ? (
          <div style={{ marginTop: 14 }}>
            <ExtractDetailPanel
              title={quoteLabel ?? 'Supplier quote'}
              confidence={quoteExtract.confidence}
              source={quoteExtract.source}
              rows={[
                { label: 'Quote ref', value: quoteExtract.quoteRef ?? '—' },
                { label: 'Supplier', value: quoteExtract.supplierName },
                {
                  label: 'Amount',
                  value: `${quoteExtract.currency ?? currency} ${quoteExtract.amount.toLocaleString()}`,
                },
                { label: 'Category', value: quoteExtract.category },
                { label: 'Delivery', value: quoteExtract.deliveryDate ?? '—' },
                { label: 'Fields found', value: quoteExtract.fieldsFound.join(', ') },
              ]}
            >
              <div className="extract-lines">
                <div className="extract-label">Line items</div>
                {quoteExtract.lineItems.map((l, i) => (
                  <div key={i} className="extract-line">
                    <span>{l.description}</span>
                    <span>
                      {l.qty != null ? `×${l.qty}` : ''}{' '}
                      {l.total != null ? formatCurrency(l.total) : l.unitPrice != null ? formatCurrency(l.unitPrice) : ''}
                    </span>
                  </div>
                ))}
              </div>
            </ExtractDetailPanel>
          </div>
        ) : quoteLabel ? (
          <p style={{ fontSize: 12.5, color: 'var(--teal)', marginTop: 8 }}>Loaded from {quoteLabel}</p>
        ) : null}
      </Card>

      <Card className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Recent requisitions (visible to Procurement)" />
        {myReqs.length === 0 ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>None yet — submit below.</p>
        ) : (
          <div className="sod-grid">
            {myReqs.map((r) => (
              <div key={r.fpip_requisitionid} className="sod-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <strong>{r.fpip_title}</strong>
                <span>{formatMoney(r.fpip_amount, currency)}</span>
                <Pill variant={pillVariantFor(r.fpip_status)}>{r.fpip_status ?? '—'}</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="polish-section">
        <SectionHead title="Bank requisition form" />
        <form onSubmit={(e) => void onSubmit(e)}>
          <div className="bank-form-grid">
            <label>
              Requested by (auto)
              <input readOnly value={hodName} />
            </label>
            <label>
              Entity (auto)
              <input readOnly value={entity.name} />
            </label>
            <label>
              Department
              <select value={dept} onChange={(e) => setDept(e.target.value as Department)}>
                {DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <label>
              Cost centre (auto)
              <input readOnly value={costCentre} />
            </label>
            <label>
              Category
              <select value={cat} onChange={(e) => setCat(e.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              GL account (auto)
              <input readOnly value={gl} />
            </label>
            <label>
              Budget line (auto)
              <input readOnly value={budgetLine} />
            </label>
            <label>
              Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option>Normal</option>
                <option>Urgent</option>
                <option>Board priority</option>
              </select>
            </label>
            <label className="span-2">
              Title / goods or services
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Regional office fit-out — Kampala branch"
              />
            </label>
            <label>
              Estimated amount ({currency})
              <input
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label>
              Needed by
              <input type="date" value={neededBy} onChange={(e) => setNeededBy(e.target.value)} />
            </label>
            <label className="span-2">
              Business justification
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Link to approved budget / board paper / operational need…"
              />
            </label>
            <label className="span-2">
              Suggested suppliers (optional)
              <input
                value={suggested}
                onChange={(e) => setSuggested(e.target.value)}
                placeholder="Names for procurement awareness — not a commitment"
              />
            </label>
          </div>

          {budget ? (
            <div
              className={`gate-card ${budget.withinBudget ? 'clear' : 'blocked'}`}
              style={{ marginTop: 14, padding: 12 }}
            >
              <h3 style={{ fontSize: 15, margin: '0 0 6px' }}>
                {budget.withinBudget ? 'Within remaining envelope' : 'Hard budget gate'}
              </h3>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--ink-soft)' }}>
                {budget.envelopeDept}: {budget.usedPct}% used · {formatMoney(budget.remaining, currency)} remaining
                of {formatMoney(budget.cap, currency)}
              </p>
              {!budget.withinBudget ? (
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={overrideBudget}
                    onChange={(e) => setOverrideBudget(e.target.checked)}
                  />
                  Record budget override (escalates — audit logged)
                </label>
              ) : null}
            </div>
          ) : null}

          {err ? (
            <div style={{ color: 'var(--danger)', fontSize: 12.5, marginTop: 12 }}>{err}</div>
          ) : null}
          <div className="action-row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting || quoteBusy}>
              {submitting ? 'Submitting…' : 'Submit to FPIP'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

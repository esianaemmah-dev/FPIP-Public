import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Icon, type IconName } from '@/components/Icons';
import { useToast } from '@/context/ToastContext';
import { useNav } from '@/context/NavContext';
import { useNotifications } from '@/context/NotificationContext';
import { invokeAgentStream } from '@/api/agentService';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { getContracts, getRequisitions } from '@/api/repositories';
import { useCreateTender } from '@/api/useDataverse';
import { classNames } from '@/lib/format';

type TenderFormat = 'rfp' | 'rfq' | 'rfi' | 'framework' | 'mini';

interface FormatOption {
  id: TenderFormat;
  title: string;
  fullName: string;
  subtitle: string;
  icon: IconName;
  pages: string;
  tone: string;
}

const FORMATS: FormatOption[] = [
  {
    id: 'rfp',
    title: 'RFP',
    fullName: 'Request for Proposal',
    subtitle: 'Complex, scored, multi-criteria competition',
    icon: 'megaphone',
    pages: '12–24 pages',
    tone: 'Formal · strategic',
  },
  {
    id: 'rfq',
    title: 'RFQ',
    fullName: 'Request for Quotation',
    subtitle: 'Price-led response against fixed specifications',
    icon: 'spend',
    pages: '4–8 pages',
    tone: 'Precise · commercial',
  },
  {
    id: 'rfi',
    title: 'RFI',
    fullName: 'Request for Information',
    subtitle: 'Market scan before committing to source',
    icon: 'search',
    pages: '3–6 pages',
    tone: 'Exploratory',
  },
  {
    id: 'framework',
    title: 'Framework',
    fullName: 'Framework agreement',
    subtitle: 'Multi-supplier panel with call-off rules',
    icon: 'layout',
    pages: '10–18 pages',
    tone: 'Structured · legal',
  },
  {
    id: 'mini',
    title: 'Mini-comp',
    fullName: 'Mini-competition',
    subtitle: 'Fast call-off under an existing framework',
    icon: 'wand',
    pages: '2–5 pages',
    tone: 'Agile · focused',
  },
];

const SUPPLIER_POOL = [
  'Halyard Systems',
  'Kestrel Components Ltd.',
  'Solveware Group',
  'Northbridge FM',
  'Meridian Logistics',
  'Carrow & Pine LLP',
];

const STEPS = ['Format', 'Brief', 'Generate', 'Publish'] as const;

function localDraft(
  format: TenderFormat,
  title: string,
  category: string,
  value: string,
  closing: string,
  scope: string,
  invitees: string[],
): string {
  const fmt = FORMATS.find((f) => f.id === format)!;
  const ref = `${fmt.title}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const valueFmt = value ? `USD ${Number(value).toLocaleString()}` : 'TBC';
  const closeFmt = closing
    ? new Date(closing).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'TBC';

  return `# ${fmt.fullName} (${fmt.title})
**${title || 'Untitled tender'}**

| Field | Detail |
|---|---|
| Reference | ${ref} |
| Category | ${category || 'General'} |
| Estimated value | ${valueFmt} |
| Closing date | ${closeFmt} |
| Competition type | Invited · ${invitees.length || 'open'} supplier(s) |
| Classification | Internal — Procurement |

## 1. Purpose
${scope || 'Describe the business need, current state, and outcomes expected from the successful supplier.'}

## 2. Scope of supply
- Deliverables aligned to **${category || 'the stated category'}**
- Service levels, acceptance criteria, and handover
- Knowledge transfer and exit provisions
- Security, continuity, and change-control expectations for banking operations

## 3. Evaluation approach
Award remains a human committee decision. For RFQ-style competitions, evaluate compliant bids on total cost of ownership. Mandatory requirements are pass/fail.

## 4. Invited suppliers
${invitees.length ? invitees.map((n) => `- ${n}`).join('\n') : '- Open market (no shortlist selected)'}

## 5. Timeline
- Clarification window: 7 calendar days from publish
- Submission deadline: ${closeFmt}
- Evaluation & shortlist: 10 business days
- Award recommendation (human committee): thereafter

## 6. Submission requirements
1. Commercial proposal (pricing schedule / TCO)
2. Technical response mapped to requirements
3. Compliance attestations and certificates
4. Implementation plan and named team

## 7. Conditions
This document does not constitute an offer. The issuing organisation may cancel or amend the process without liability. AI-assisted drafting in FPIP Tender Studio does not replace procurement or legal review.

---
*FPIP Tender Studio · Draft · ${new Date().toLocaleString('en-GB')} · Not for award*
`;
}

/** Lightweight markdown → structured preview (no extra dependency). */
function DraftDocument({ text }: { text: string }) {
  const blocks = useMemo(() => parseDraft(text), [text]);
  return <div className="doc-body">{blocks}</div>;
}

function parseDraft(text: string): ReactNode[] {
  const lines = text.split('\n');
  const out: ReactNode[] = [];
  let listBuf: string[] = [];
  let tableBuf: string[][] = [];
  let key = 0;

  const flushList = () => {
    if (!listBuf.length) return;
    out.push(
      <ul key={`ul-${key++}`}>
        {listBuf.map((item, i) => (
          <li key={i} dangerouslySetInnerHTML={{ __html: inlineMd(item) }} />
        ))}
      </ul>,
    );
    listBuf = [];
  };

  const flushTable = () => {
    if (tableBuf.length < 2) {
      tableBuf = [];
      return;
    }
    const [head, , ...rows] = tableBuf;
    out.push(
      <table key={`tbl-${key++}`} className="doc-table">
        <thead>
          <tr>
            {head.map((c, i) => (
              <th key={i}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((c, ci) => (
                <td key={ci} dangerouslySetInnerHTML={{ __html: inlineMd(c) }} />
              ))}
            </tr>
          ))}
        </tbody>
      </table>,
    );
    tableBuf = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('|')) {
      flushList();
      const cells = line
        .split('|')
        .slice(1, -1)
        .map((c) => c.trim());
      if (/^[-:| ]+$/.test(line.replace(/\|/g, ''))) {
        tableBuf.push([]);
      } else {
        tableBuf.push(cells);
      }
      continue;
    }
    flushTable();

    if (/^[-*] /.test(line)) {
      listBuf.push(line.replace(/^[-*] /, ''));
      continue;
    }
    flushList();

    if (!line.trim()) {
      out.push(<div key={`sp-${key++}`} className="doc-spacer" />);
      continue;
    }
    if (line.startsWith('# ')) {
      out.push(<h1 key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(line.slice(2)) }} />);
      continue;
    }
    if (line.startsWith('## ')) {
      out.push(<h2 key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(line.slice(3)) }} />);
      continue;
    }
    if (line.startsWith('### ')) {
      out.push(<h3 key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(line.slice(4)) }} />);
      continue;
    }
    if (line.startsWith('---')) {
      out.push(<hr key={key++} />);
      continue;
    }
    if (line.startsWith('*') && line.endsWith('*') && !line.startsWith('**')) {
      out.push(<p key={key++} className="doc-meta" dangerouslySetInnerHTML={{ __html: inlineMd(line.replace(/^\*|\*$/g, '')) }} />);
      continue;
    }
    out.push(<p key={key++} dangerouslySetInnerHTML={{ __html: inlineMd(line) }} />);
  }
  flushList();
  flushTable();
  return out;
}

function inlineMd(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

export function TenderStudio() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { showToast } = useToast();
  const { selectAgent } = useNav();
  const { push, pushActivity } = useNotifications();
  const { account } = useFpipAuth();
  const { submit: publishTender, submitting: publishing } = useCreateTender();

  const [format, setFormat] = useState<TenderFormat>('rfp');
  const [title, setTitle] = useState('ERP Managed Support Renewal');
  const [category, setCategory] = useState('ICT & Software');
  const [value, setValue] = useState('3100000');
  const [closing, setClosing] = useState('2026-08-28');
  const [scope, setScope] = useState(
    'Renew and harden managed support for the core ERP estate across finance, procurement and treasury, with 24×7 P1 coverage and a clear path to reduce customisations.',
  );
  const [invitees, setInvitees] = useState<string[]>(['Halyard Systems', 'Solveware Group', 'Kestrel Components Ltd.']);
  const [draft, setDraft] = useState('');
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState(0);
  const [showRaw, setShowRaw] = useState(false);
  const [fromReqLabel, setFromReqLabel] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [templateText, setTemplateText] = useState<string>('');

  const fromReqId = searchParams.get('fromReq');
  const fromContractId = searchParams.get('fromContract');

  useEffect(() => {
    if (fromContractId !== 'extract') return;
    const t = searchParams.get('title');
    const supplier = searchParams.get('supplier');
    const val = searchParams.get('value');
    if (t) setTitle(t);
    if (val) setValue(val);
    setFormat('rfp');
    setStep(1);
    setScope(
      `Re-tender from Contract Agent extract.\n\nIncumbent: ${supplier ?? '—'}.\n\n` +
        `Preserve continuity and open competition per policy.`,
    );
    setFromReqLabel(t ? `Contract extract · ${t}` : 'Contract extract');
    showToast('Brief prefilled from Contract Agent');
  }, [fromContractId, searchParams, showToast]);

  useEffect(() => {
    if (!fromReqId) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await getRequisitions();
        const req = rows.find((r) => r.fpip_requisitionid === fromReqId);
        if (!req || cancelled) return;
        setTitle(req.fpip_title);
        setCategory(String(req.fpip_category ?? 'General'));
        setValue(String(req.fpip_amount ?? ''));
        setFormat('rfq');
        setStep(1);
        setScope(
          `Converted from HOD / department requisition **${req.fpip_title}** (${req.fpip_department ?? 'Department'}).\n\n` +
            `Budget check: ${req.fpip_budget_check_result ?? 'Pending'}. Status at conversion: ${req.fpip_status ?? '—'}.\n\n` +
            `Define specifications, evaluation criteria, and invitees below, then generate the RFQ pack.`,
        );
        setFromReqLabel(req.fpip_title);
        showToast(`Brief prefilled from requisition “${req.fpip_title}”`);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromReqId, showToast]);

  useEffect(() => {
    if (!fromContractId || fromContractId === 'extract') return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await getContracts();
        const c = rows.find((x) => x.fpip_contractid === fromContractId);
        if (!c || cancelled) return;
        setTitle(`Renewal · ${c.fpip_title}`);
        setCategory('Professional Services');
        setValue(String(c.fpip_value ?? ''));
        setFormat('rfp');
        setStep(1);
        setScope(
          `Re-tender / renewal hand-off from Contract Manager for **${c.fpip_title}**.\n\n` +
            `Incumbent: ${c.fpip_Supplier?.name ?? '—'}. Expiry: ${c.fpip_expiry_date ?? '—'}.\n\n` +
            `Preserve continuity requirements and open competition per policy.`,
        );
        setFromReqLabel(`Contract · ${c.fpip_title}`);
        showToast(`Brief prefilled from contract “${c.fpip_title}”`);
      } catch {
        /* keep defaults */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fromContractId, showToast]);

  const selectedFormat = FORMATS.find((f) => f.id === format)!;
  const valueLabel = value ? `$${Number(value).toLocaleString()}` : '—';
  const closingLabel = closing
    ? new Date(closing).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  const userContext = useMemo(
    () => ({
      username: account?.username ?? account?.name ?? 'fpip-user',
      role: 'internal' as const,
    }),
    [account],
  );

  function toggleInvitee(name: string) {
    setInvitees((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  async function onTemplateFile(file: File | null) {
    if (!file) {
      setTemplateName(null);
      setTemplateText('');
      return;
    }
    setTemplateName(file.name);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.html') || lower.endsWith('.csv')) {
      const text = await file.text();
      setTemplateText(text.slice(0, 12000));
      showToast(`Template “${file.name}” loaded — AI will follow its structure`);
      return;
    }
    // Binary office/PDF: keep name; AI is instructed to mirror bank template sections
    setTemplateText(
      `[Binary template uploaded: ${file.name} (${Math.round(file.size / 1024)} KB). ` +
        `Mirror Novaris / bank tender pack structure: letterhead, purpose, scope, evaluation matrix, ` +
        `submission checklist, timeline, conditions. Preserve any known section headings typical of this bank's ${selectedFormat.title} template.]`,
    );
    showToast(`Template “${file.name}” attached — AI will follow bank pack structure`);
  }

  async function generateWithAi(e?: FormEvent) {
    e?.preventDefault();
    setGenerating(true);
    setStep(2);
    setDraft('');
    const templateBlock = templateText
      ? [
          `CRITICAL: Follow this bank tender TEMPLATE structure and section order. Fill content for the brief below; do not invent a different outline.`,
          `Template file: ${templateName ?? 'uploaded'}`,
          '----- TEMPLATE START -----',
          templateText.slice(0, 8000),
          '----- TEMPLATE END -----',
        ].join('\n')
      : 'No bank template uploaded — use a clear banking procurement document structure.';

    const prompt = [
      `Draft a complete ${selectedFormat.fullName} (${selectedFormat.title}) tender document for banking procurement.`,
      templateBlock,
      `Title: ${title}`,
      `Category: ${category}`,
      `Estimated value: $${value}`,
      `Closing date: ${closing}`,
      `Scope: ${scope}`,
      `Invitees: ${invitees.join(', ') || 'open market'}`,
      `Evaluation: keep brief — pass/fail mandatory requirements; commercial award on total cost among compliant bids. Do not invent detailed percentage weight tables.`,
      `Tone: ${selectedFormat.tone}. Use markdown headings. Do not approve or award — draft only.`,
      `Do not mention sports or unrelated topics. Stay within procurement document structure.`,
    ].join('\n');

    try {
      await new Promise<void>((resolve, reject) => {
        void invokeAgentStream({
          agentId: 'procurement',
          message: prompt,
          userContext,
          onToken: (t) => setDraft((d) => d + t),
          onError: (msg) => reject(new Error(msg)),
          onDone: () => resolve(),
        });
      });
      showToast('Tender pack drafted — human review required before publish');
      setStep(3);
    } catch {
      const fallback = localDraft(format, title, category, value, closing, scope, invitees);
      const withTemplate = templateName
        ? `${fallback}\n\n## Template adherence\nDraft prepared to follow uploaded bank template: **${templateName}**.\n`
        : fallback;
      setDraft(withTemplate);
      showToast('Assistant unreachable — used Studio local draft (template noted)');
      setStep(3);
    } finally {
      setGenerating(false);
    }
  }

  async function publishDraft() {
    if (!draft) return;
    try {
      const created = await publishTender({
        title,
        category,
        estimatedValue: value ? Number(value) : undefined,
        closingDate: closing || undefined,
        status: 'Open',
        requisitionId: fromReqId ?? undefined,
        requisitionTitle: fromReqLabel ?? undefined,
        draftBody: draft,
        templateName: templateName ?? undefined,
        invitees,
        format: selectedFormat.title,
      });
      push({
        kind: 'tender',
        title: `Tender published · ${title}`,
        body: `${invitees.length} invitees · Open competition · awaiting supplier bids & compliance gate`,
        href: '/supplier',
      });
      pushActivity({
        actor: 'Procurement',
        action: 'Published open tender',
        detail: `${created.fpip_title} · ${created.fpip_tenderid}`,
        href: '/procurement',
      });
      showToast(`“${title}” is live as Open tender — suppliers notified`);
      navigate('/procurement');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Publish failed');
    }
  }

  return (
    <div className="studio">
      <header className="studio-masthead">
        <div className="studio-masthead-main">
          <div className="studio-breadcrumb">
            <button type="button" className="studio-crumb" onClick={() => navigate('/procurement')}>
              Procurement
            </button>
            <span>/</span>
            <span>Tender Studio</span>
          </div>
          <h1>Tender Studio</h1>
          <p>
            Compose, generate, and publish competition packs. FPIP Assistant drafts; humans still publish and
            award.
          </p>
        </div>
        <div className="studio-masthead-aside">
          <div className="studio-status-block">
            <span className="studio-status-label">Document status</span>
            <span className={classNames('studio-status-pill', draft ? 'ready' : 'draft')}>
              {generating ? 'Generating' : draft ? 'Ready for review' : 'Draft brief'}
            </span>
          </div>
          <div className="studio-masthead-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/procurement')}>
              Exit
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void generateWithAi()}
              disabled={generating}
            >
              <Icon name="sparkles" size={14} /> {generating ? 'Generating…' : 'Generate pack'}
            </button>
          </div>
        </div>
      </header>

      {fromReqLabel ? (
        <div className="polish-signal ok" style={{ margin: '12px 0 0' }}>
          <strong>Converted from requisition</strong>
          <span>
            Brief prefilled from “{fromReqLabel}”. Format set to RFQ — review specs, then generate and publish.
          </span>
        </div>
      ) : null}

      <div className="studio-meta-bar" id="studio-formats">
        <div>
          <span className="meta-label">Format</span>
          <strong>
            {selectedFormat.title} · {selectedFormat.fullName}
          </strong>
        </div>
        <div>
          <span className="meta-label">Est. value</span>
          <strong>{valueLabel}</strong>
        </div>
        <div>
          <span className="meta-label">Closing</span>
          <strong>{closingLabel}</strong>
        </div>
        <div>
          <span className="meta-label">Invitees</span>
          <strong>{invitees.length} shortlisted</strong>
        </div>
        <div>
          <span className="meta-label">Classification</span>
          <strong>Internal · Procurement</strong>
        </div>
      </div>

      <nav className="studio-progress" aria-label="Studio steps">
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={classNames('studio-progress-step', step === i && 'active', step > i && 'done')}
            onClick={() => setStep(i)}
          >
            <span className="studio-progress-index">{step > i ? <Icon name="check" size={12} /> : i + 1}</span>
            <span className="studio-progress-label">{label}</span>
            {i < STEPS.length - 1 ? <span className="studio-progress-line" aria-hidden /> : null}
          </button>
        ))}
      </nav>

      <section className="studio-format-rail" aria-label="Competition format">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={classNames('format-rail-item', format === f.id && 'selected')}
            onClick={() => {
              setFormat(f.id);
              setStep(0);
            }}
          >
            <span className="format-rail-code">{f.title}</span>
            <span className="format-rail-name">{f.fullName}</span>
            <span className="format-rail-pages">{f.pages}</span>
          </button>
        ))}
      </section>

      <div className="studio-workspace" id="studio-brief">
        <form className="studio-composer" onSubmit={(e) => void generateWithAi(e)}>
          <section className="studio-section">
            <header className="studio-section-head">
              <h2>Commercial envelope</h2>
              <p>Title, category, value and closing date for this competition.</p>
            </header>
            <label className="studio-field">
              <span>Title</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <div className="studio-row">
              <label className="studio-field">
                <span>Category</span>
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                  {['ICT & Software', 'Facilities', 'Logistics', 'Professional Services', 'Banking Ops'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="studio-field">
                <span>Estimated value (USD)</span>
                <input type="number" min={0} value={value} onChange={(e) => setValue(e.target.value)} />
              </label>
              <label className="studio-field">
                <span>Closing date</span>
                <input type="date" value={closing} onChange={(e) => setClosing(e.target.value)} />
              </label>
            </div>
            <label className="studio-field">
              <span>Scope & outcomes</span>
              <textarea rows={5} value={scope} onChange={(e) => setScope(e.target.value)} />
            </label>
            <label className="studio-field">
              <span>Bank tender template (optional)</span>
              <input
                type="file"
                accept=".txt,.md,.html,.csv,.doc,.docx,.pdf"
                onChange={(e) => void onTemplateFile(e.target.files?.[0] ?? null)}
              />
              <span style={{ fontSize: 12, color: 'var(--ink-faint)', marginTop: 6 }}>
                {templateName
                  ? `Using “${templateName}” — generate will instruct AI to follow this structure.`
                  : 'Upload your bank RFP/RFQ Word/PDF/text pack. AI fills your brief into that outline.'}
              </span>
            </label>
          </section>

          <section className="studio-section">
            <header className="studio-section-head">
              <h2>Invite shortlist</h2>
              <p>Suppliers notified when the pack is published.</p>
            </header>
            <div className="studio-invite-grid">
              {SUPPLIER_POOL.map((name) => {
                const on = invitees.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    className={classNames('invite-row', on && 'on')}
                    onClick={() => toggleInvitee(name)}
                  >
                    <span className="invite-check">{on ? <Icon name="check" size={14} /> : null}</span>
                    <span>{name}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="studio-actions" id="studio-generate">
            <button type="button" className="btn btn-ghost" onClick={() => selectAgent()}>
              Open FPIP Assistant
            </button>
            <button type="submit" className="btn btn-primary" disabled={generating}>
              <Icon name="sparkles" size={15} /> {generating ? 'Drafting pack…' : 'Generate pack'}
            </button>
          </div>
        </form>

        <aside className="studio-preview" id="studio-preview">
          <div className="studio-preview-head">
            <div>
              <div className="studio-kicker">Competition pack</div>
              <h2>
                {selectedFormat.title} · {title || 'Untitled'}
              </h2>
            </div>
            <div className="studio-preview-meta">
              <span className="meta-chip">{invitees.length} invitees</span>
              <span className="meta-chip">{selectedFormat.pages}</span>
            </div>
          </div>

          <div className="doc-sheet">
            <div className="doc-letterhead">
              <div>
                <div className="doc-org">Novaris Group</div>
                <div className="doc-dept">Procurement · FPIP</div>
              </div>
              <div className="doc-badge">DRAFT — NOT AWARDED</div>
            </div>
            <div className="studio-preview-body">
              {draft ? (
                showRaw ? (
                  <pre className="studio-md">{draft}</pre>
                ) : (
                  <DraftDocument text={draft} />
                )
              ) : (
                <div className="studio-empty">
                  <Icon name="doc" size={28} />
                  <h3>No pack generated yet</h3>
                  <p>Select a format, complete the brief, then generate. The formal pack preview appears here.</p>
                </div>
              )}
              {generating ? <div className="studio-generating">Drafting with FPIP Assistant…</div> : null}
            </div>
          </div>

          <div className="studio-preview-foot">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!draft}
              onClick={() => setShowRaw((v) => !v)}
            >
              {showRaw ? 'Formatted view' : 'Raw markdown'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!draft}
              onClick={() => {
                void navigator.clipboard.writeText(draft);
                showToast('Pack copied to clipboard');
              }}
            >
              Copy
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!draft || generating || publishing}
              onClick={() => void publishDraft()}
            >
              {publishing ? 'Publishing…' : 'Publish as Open tender'}
            </button>
          </div>
          <p className="studio-disclaimer">
            AI drafts are recommendations only. Publish and award remain human-controlled under FPIP policy.
          </p>
        </aside>
      </div>
    </div>
  );
}

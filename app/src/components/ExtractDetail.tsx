import { Pill } from '@/components/Pill';
import { classNames } from '@/lib/format';

export interface DetailRow {
  label: string;
  value: string;
  hint?: string;
}

export function ExtractDetailPanel({
  title,
  confidence,
  source,
  rows,
  children,
}: {
  title: string;
  confidence: number;
  source: string;
  rows: DetailRow[];
  children?: React.ReactNode;
}) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="extract-panel">
      <div className="extract-panel-head">
        <div>
          <div className="extract-kicker">AI extract detail</div>
          <strong>{title}</strong>
        </div>
        <div className="extract-meta">
          <Pill variant={pct >= 75 ? 'success' : pct >= 55 ? 'warn' : 'danger'}>{pct}% confidence</Pill>
          <span className="extract-source">{source === 'text' ? 'Parsed text' : 'OCR heuristic'}</span>
        </div>
      </div>
      <div className="extract-grid">
        {rows.map((r) => (
          <div key={r.label} className="extract-cell">
            <span className="extract-label">{r.label}</span>
            <span className="extract-value">{r.value || '—'}</span>
            {r.hint ? <span className="extract-hint">{r.hint}</span> : null}
          </div>
        ))}
      </div>
      {children}
    </div>
  );
}

export function MatchRationale({
  matched,
  checks,
}: {
  matched: boolean;
  checks: { label: string; ok: boolean; detail: string }[];
}) {
  return (
    <div className={classNames('match-rationale', matched ? 'ok' : 'warn')}>
      <strong>{matched ? 'Auto-match passed' : 'Needs Finance review'}</strong>
      <ul>
        {checks.map((c) => (
          <li key={c.label} className={c.ok ? 'pass' : 'fail'}>
            <span>{c.ok ? '✓' : '!'}</span>
            <div>
              <b>{c.label}</b>
              <div>{c.detail}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

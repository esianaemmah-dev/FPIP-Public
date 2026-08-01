interface BarRowProps {
  label: string;
  value: number; // 0-100
  display?: string;
  tone?: 'indigo' | 'success' | 'warn' | 'danger';
}

const toneColor: Record<NonNullable<BarRowProps['tone']>, string> = {
  indigo: 'var(--indigo-2)',
  success: 'var(--success)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
};

export function BarRow({ label, value, display, tone = 'indigo' }: BarRowProps) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="bar-row">
      <div className="bar-label">{label}</div>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: `${clamped}%`, background: toneColor[tone] }} />
      </div>
      <div className="bar-val">{display ?? clamped}</div>
    </div>
  );
}

import type { ReactNode } from 'react';

interface PillProps {
  variant: 'success' | 'warn' | 'danger' | 'neutral' | 'ai';
  children: ReactNode;
}

export function Pill({ variant, children }: PillProps) {
  return (
    <span className={`pill pill-${variant}`}>
      <span className="pill-dot" />
      {children}
    </span>
  );
}

/** Map common status labels to a pill variant for consistent rendering. */
export function pillVariantFor(label: string | undefined): PillProps['variant'] {
  if (!label) return 'neutral';
  const l = label.toLowerCase();
  if (/(approved|paid|verified|delivered|released|complete|3-way match|within budget)/.test(l)) return 'success';
  if (/(pending|awaiting|under review|renewal|review|sourcing|submitted|draft|open)/.test(l)) return 'warn';
  if (/(reject|suspend|expired|exceeds|mismatch|duplicate|held|escalat)/.test(l)) return 'danger';
  if (/(shortlist|evaluation|awarded|po issued)/.test(l)) return 'ai';
  return 'neutral';
}

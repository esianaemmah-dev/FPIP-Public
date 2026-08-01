import type { ReactNode } from 'react';

interface KpiCardProps {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'flat';
}

export function KpiCard({ label, value, delta, deltaTone = 'flat' }: KpiCardProps) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value">{value}</div>
      {delta ? <div className={`kpi-delta ${deltaTone}`}>{delta}</div> : null}
    </div>
  );
}

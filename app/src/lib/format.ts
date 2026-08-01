// Small formatting helpers shared across pages.

export function formatCurrency(n: number | undefined | null, opts?: { compact?: boolean; currency?: string }): string {
  if (n === undefined || n === null) return '—';
  const currency = opts?.currency ?? 'USD';
  if (opts?.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(n);
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

/** Alias with explicit currency for multi-entity tenants */
export function formatMoney(n: number | undefined | null, currency = 'USD'): string {
  return formatCurrency(n, { currency });
}

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function daysUntil(iso: string | undefined | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const ms = d.getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

export function formatRelativeDays(iso: string | undefined | null): string {
  const days = daysUntil(iso);
  if (days === null) return '—';
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return 'today';
  return `in ${days} days`;
}

export function classNames(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

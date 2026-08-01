// In-app notifications + activity feed (discovery meeting + step 2).

export type NotificationKind =
  | 'approval'
  | 'tender'
  | 'compliance'
  | 'finance'
  | 'requisition'
  | 'system';

export interface FpipNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
}

export interface ActivityItem {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
  href?: string;
}

const SEED_NOTIFICATIONS: FpipNotification[] = [
  {
    id: 'n1',
    kind: 'approval',
    title: 'Approval waiting · Tender award',
    body: 'RFP-118 ERP Managed Support needs committee sign-off ($3.1M).',
    createdAt: new Date(Date.now() - 2 * 3600_000).toISOString(),
    read: false,
    href: '/workflows',
  },
  {
    id: 'n2',
    kind: 'compliance',
    title: 'Compliance exception · Tax cert',
    body: 'Northbridge FM certificate expires within 30 days — green light blocked.',
    createdAt: new Date(Date.now() - 5 * 3600_000).toISOString(),
    read: false,
    href: '/compliance',
  },
  {
    id: 'n3',
    kind: 'requisition',
    title: 'HOD requisition submitted',
    body: 'Regional office fit-out from Facilities HOD — budget exceeded, escalation open.',
    createdAt: new Date(Date.now() - 26 * 3600_000).toISOString(),
    read: false,
    href: '/hod',
  },
  {
    id: 'n4',
    kind: 'tender',
    title: 'RFQ open for apply',
    body: 'RFQ-241 Network Hardware Refresh is open — suppliers can upload packs.',
    createdAt: new Date(Date.now() - 30 * 3600_000).toISOString(),
    read: true,
    href: '/rfq',
  },
  {
    id: 'n5',
    kind: 'finance',
    title: 'Invoice–LPO mismatch',
    body: 'INV-88177 amount differs from LPO-PO-22610 — Finance desk.',
    createdAt: new Date(Date.now() - 48 * 3600_000).toISOString(),
    read: true,
    href: '/finance',
  },
];

const SEED_ACTIVITY: ActivityItem[] = [
  {
    id: 'a1',
    at: new Date(Date.now() - 1 * 3600_000).toISOString(),
    actor: 'P. Nathan',
    action: 'Approved payment',
    detail: 'PAY-6028 · Meridian Logistics',
    href: '/finance',
  },
  {
    id: 'a2',
    at: new Date(Date.now() - 3 * 3600_000).toISOString(),
    actor: 'D. Reyes',
    action: 'Converted requisition → tender',
    detail: 'Data center racks → draft RFQ in Studio',
    href: '/procurement/studio',
  },
  {
    id: 'a3',
    at: new Date(Date.now() - 8 * 3600_000).toISOString(),
    actor: 'Compliance Officer',
    action: 'UAT green light pending',
    detail: 'RFP-118 delivery acceptance checklist incomplete',
    href: '/compliance',
  },
  {
    id: 'a4',
    at: new Date(Date.now() - 20 * 3600_000).toISOString(),
    actor: 'HOD · Facilities',
    action: 'Submitted requisition',
    detail: 'Regional office fit-out · $268,000',
    href: '/hod',
  },
  {
    id: 'a5',
    at: new Date(Date.now() - 40 * 3600_000).toISOString(),
    actor: 'Contract Manager',
    action: 'Flagged renewal',
    detail: 'Northbridge FM MSA · 62 days to expiry',
    href: '/contracts-mgr',
  },
];

export function seedNotifications(): FpipNotification[] {
  return SEED_NOTIFICATIONS.map((n) => ({ ...n }));
}

export function seedActivity(): ActivityItem[] {
  return SEED_ACTIVITY.map((a) => ({ ...a }));
}

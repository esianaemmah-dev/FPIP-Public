// Unified navigation: one sidebar for modules + in-page actions.

import type { IconName } from '@/components/Icons';
import type { FeatureId } from '@/lib/rbac';

export type NavAction =
  | { type: 'route'; path: string }
  | { type: 'scroll'; target: string }
  | { type: 'tab'; group: string; tab: string }
  | { type: 'agent'; agent: string };

export interface SideLink {
  label: string;
  icon: IconName;
  action: NavAction;
  badge?: string;
  feature?: FeatureId;
}

export interface SideNavConfig {
  title: string;
  sub: string;
  org: string;
  role: string;
  links: SideLink[];
}

export interface ModuleItem {
  key: string;
  path: string;
  icon: IconName;
  label: string;
  feature: FeatureId;
}

/** Primary rail only — secondary tools live under “In this view”. */
export const modules: ModuleItem[] = [
  { key: 'dashboard', path: '/dashboard', icon: 'grid', label: 'Home', feature: 'dashboard' },
  { key: 'procurement', path: '/procurement', icon: 'cart', label: 'Procurement', feature: 'procurement' },
  { key: 'finance', path: '/finance', icon: 'finance', label: 'Finance', feature: 'finance' },
  { key: 'compliance', path: '/compliance', icon: 'shield', label: 'Compliance', feature: 'compliance_risk' },
  { key: 'workflows', path: '/workflows', icon: 'scale', label: 'Approvals', feature: 'workflows' },
  { key: 'vault', path: '/vault', icon: 'doc', label: 'Documents', feature: 'document_vault' },
  { key: 'supplier', path: '/supplier', icon: 'building', label: 'Supplier Portal', feature: 'supplier' },
  { key: 'copilot', path: '/copilot', icon: 'robot', label: 'Assistant', feature: 'copilot' },
  { key: 'admin', path: '/admin', icon: 'lock', label: 'Admin', feature: 'admin' },
];

export const sideNav: Record<string, SideNavConfig> = {
  dashboard: {
    title: 'Home',
    sub: 'Spend, approvals, and risk',
    org: 'Novaris Group',
    role: 'Executive',
    links: [
      { label: 'Signals', icon: 'alert', action: { type: 'scroll', target: 'card-signals' } },
      { label: 'KPIs', icon: 'grid', action: { type: 'scroll', target: 'card-kpis' } },
      { label: 'Approvals', icon: 'doc', action: { type: 'scroll', target: 'card-approvals' } },
      { label: 'Pipeline', icon: 'bar', action: { type: 'scroll', target: 'card-pipeline' } },
    ],
  },
  procurement: {
    title: 'Procurement',
    sub: 'Source, tender, evaluate, contract',
    org: 'Novaris Group',
    role: 'Procurement',
    links: [
      { label: 'Requisitions', icon: 'doc', action: { type: 'tab', group: 'procurement', tab: 'requisitions' } },
      { label: 'Tenders', icon: 'megaphone', action: { type: 'tab', group: 'procurement', tab: 'tenders' } },
      { label: 'Bids', icon: 'scale', action: { type: 'tab', group: 'procurement', tab: 'bids' } },
      { label: 'Contracts', icon: 'contract', action: { type: 'tab', group: 'procurement', tab: 'contracts' } },
      { label: 'Tender Studio', icon: 'sparkles', action: { type: 'route', path: '/procurement/studio' }, badge: 'AI', feature: 'tender_studio' },
      { label: 'RFQ builder', icon: 'layout', action: { type: 'route', path: '/rfq' }, feature: 'rfq_builder' },
      { label: 'LPO desk', icon: 'doc', action: { type: 'route', path: '/lpo' }, feature: 'lpo_desk' },
      { label: 'Suppliers', icon: 'building', action: { type: 'route', path: '/suppliers-db' }, feature: 'supplier_db' },
      { label: 'HOD submit', icon: 'user', action: { type: 'route', path: '/hod' }, feature: 'hod_submit' },
      { label: 'Contract manager', icon: 'contract', action: { type: 'route', path: '/contracts-mgr' }, feature: 'contract_mgr' },
    ],
  },
  'suppliers-db': {
    title: 'Suppliers',
    sub: 'Register, compare, documents',
    org: 'Novaris Group',
    role: 'Procurement',
    links: [
      { label: 'Back to Procurement', icon: 'cart', action: { type: 'route', path: '/procurement' } },
      { label: 'LPO desk', icon: 'doc', action: { type: 'route', path: '/lpo' }, feature: 'lpo_desk' },
    ],
  },
  rfq: {
    title: 'RFQ builder',
    sub: 'Form builder and publish',
    org: 'Novaris Group',
    role: 'Procurement',
    links: [
      { label: 'Back to Procurement', icon: 'cart', action: { type: 'route', path: '/procurement' } },
      { label: 'LPO desk', icon: 'doc', action: { type: 'route', path: '/lpo' }, feature: 'lpo_desk' },
    ],
  },
  lpo: {
    title: 'LPO desk',
    sub: 'Local purchase orders',
    org: 'Novaris Group',
    role: 'Procurement',
    links: [
      { label: 'Back to Procurement', icon: 'cart', action: { type: 'route', path: '/procurement' } },
      { label: 'Finance match', icon: 'finance', action: { type: 'route', path: '/finance' }, feature: 'finance' },
    ],
  },
  hod: {
    title: 'HOD submit',
    sub: 'Department requisition form',
    org: 'Novaris Group',
    role: 'Head of Department',
    links: [
      { label: 'Budget view', icon: 'bar', action: { type: 'route', path: '/budget' }, feature: 'budget_owner_dash' },
      { label: 'Procurement', icon: 'cart', action: { type: 'route', path: '/procurement' }, feature: 'procurement' },
    ],
  },
  budget: {
    title: 'Budget',
    sub: 'Envelopes and spend',
    org: 'Novaris Group',
    role: 'Budget Owner',
    links: [
      { label: 'Finance', icon: 'finance', action: { type: 'route', path: '/finance' }, feature: 'finance' },
      { label: 'HOD submit', icon: 'user', action: { type: 'route', path: '/hod' }, feature: 'hod_submit' },
    ],
  },
  compliance: {
    title: 'Compliance',
    sub: 'UAT and green light',
    org: 'Novaris Group',
    role: 'Risk & Compliance',
    links: [
      { label: 'Green light', icon: 'check', action: { type: 'route', path: '/compliance' } },
      { label: 'Governance', icon: 'shield', action: { type: 'route', path: '/governance' }, feature: 'governance' },
      { label: 'Documents', icon: 'doc', action: { type: 'route', path: '/vault' }, feature: 'document_vault' },
    ],
  },
  'contracts-mgr': {
    title: 'Contracts',
    sub: 'Portfolio and renewals',
    org: 'Novaris Group',
    role: 'Contract Manager',
    links: [
      { label: 'Back to Procurement', icon: 'cart', action: { type: 'route', path: '/procurement' } },
      { label: 'Documents', icon: 'doc', action: { type: 'route', path: '/vault' }, feature: 'document_vault' },
    ],
  },
  notifications: {
    title: 'Inbox',
    sub: 'Alerts and activity',
    org: 'Novaris Group',
    role: 'All users',
    links: [
      { label: 'Approvals', icon: 'scale', action: { type: 'route', path: '/workflows' }, feature: 'workflows' },
      { label: 'Home', icon: 'grid', action: { type: 'route', path: '/dashboard' }, feature: 'dashboard' },
    ],
  },
  finance: {
    title: 'Finance',
    sub: 'Match, release, budgets',
    org: 'Novaris Group',
    role: 'Finance',
    links: [
      { label: 'Invoices', icon: 'alert', action: { type: 'tab', group: 'finance', tab: 'invoices' } },
      { label: 'Payments', icon: 'card', action: { type: 'tab', group: 'finance', tab: 'payments' } },
      { label: 'Budgets', icon: 'bar', action: { type: 'tab', group: 'finance', tab: 'budgets' } },
      { label: 'Forecast', icon: 'spend', action: { type: 'tab', group: 'finance', tab: 'forecast' } },
      { label: 'Budget owner', icon: 'bar', action: { type: 'route', path: '/budget' }, feature: 'budget_owner_dash' },
      { label: 'LPO desk', icon: 'doc', action: { type: 'route', path: '/lpo' }, feature: 'lpo_desk' },
    ],
  },
  supplier: {
    title: 'Supplier Portal',
    sub: 'Opportunities and compliance',
    org: 'Kestrel Components Ltd.',
    role: 'External Supplier',
    links: [
      { label: 'Invitations', icon: 'megaphone', action: { type: 'scroll', target: 'card-supplier-tenders' } },
      { label: 'Submit bid', icon: 'send', action: { type: 'scroll', target: 'card-bid-studio' } },
      { label: 'Invoices', icon: 'card', action: { type: 'scroll', target: 'card-supplier-invoices' } },
      { label: 'Documents', icon: 'doc', action: { type: 'scroll', target: 'card-supplier-docs' } },
    ],
  },
  governance: {
    title: 'Governance',
    sub: 'Audit and policy',
    org: 'Novaris Group',
    role: 'Audit',
    links: [
      { label: 'Audit trail', icon: 'shield', action: { type: 'scroll', target: 'card-audit-trail' } },
      { label: 'Policies', icon: 'scale', action: { type: 'scroll', target: 'card-approval-policies' } },
      { label: 'Exceptions', icon: 'alert', action: { type: 'scroll', target: 'card-compliance-exceptions' } },
      { label: 'Compliance', icon: 'check', action: { type: 'route', path: '/compliance' }, feature: 'compliance_risk' },
    ],
  },
  workflows: {
    title: 'Approvals',
    sub: 'Human sign-off queues',
    org: 'Novaris Group',
    role: 'Operations',
    links: [
      { label: 'Pending', icon: 'scale', action: { type: 'scroll', target: 'wf-queue' } },
      { label: 'Flows', icon: 'wand', action: { type: 'scroll', target: 'wf-flows' } },
      { label: 'Controls', icon: 'shield', action: { type: 'scroll', target: 'wf-sod' } },
    ],
  },
  vault: {
    title: 'Documents',
    sub: 'Contracts and evidence',
    org: 'Novaris Group',
    role: 'Records',
    links: [
      { label: 'All documents', icon: 'doc', action: { type: 'scroll', target: 'vault-all' } },
      { label: 'Contracts', icon: 'contract', action: { type: 'scroll', target: 'vault-contracts' } },
      { label: 'Compliance', icon: 'shield', action: { type: 'scroll', target: 'vault-compliance' } },
    ],
  },
  copilot: {
    title: 'Assistant',
    sub: 'Ask anything about FPIP',
    org: 'Novaris Group',
    role: 'AI',
    links: [
      { label: 'Home', icon: 'grid', action: { type: 'route', path: '/dashboard' }, feature: 'dashboard' },
      { label: 'Procurement', icon: 'cart', action: { type: 'route', path: '/procurement' }, feature: 'procurement' },
      { label: 'Finance', icon: 'finance', action: { type: 'route', path: '/finance' }, feature: 'finance' },
      { label: 'Supplier portal', icon: 'building', action: { type: 'route', path: '/supplier' }, feature: 'supplier' },
    ],
  },
  studio: {
    title: 'Tender Studio',
    sub: 'Compose and publish',
    org: 'Novaris Group',
    role: 'Procurement',
    links: [
      { label: 'Back to Procurement', icon: 'arrowRight', action: { type: 'route', path: '/procurement' } },
      { label: 'Format', icon: 'layout', action: { type: 'scroll', target: 'studio-formats' } },
      { label: 'Brief', icon: 'doc', action: { type: 'scroll', target: 'studio-brief' } },
      { label: 'Generate', icon: 'sparkles', action: { type: 'scroll', target: 'studio-generate' } },
    ],
  },
  admin: {
    title: 'Admin',
    sub: 'Roles and access',
    org: 'Novaris Group',
    role: 'Platform Admin',
    links: [
      { label: 'Roles', icon: 'lock', action: { type: 'scroll', target: 'admin-rbac' } },
      { label: 'Features', icon: 'layout', action: { type: 'scroll', target: 'admin-matrix' } },
      { label: 'Integrations', icon: 'layout', action: { type: 'route', path: '/integrations' } },
    ],
  },
  integrations: {
    title: 'Integrations',
    sub: 'Connectors',
    org: 'Novaris Group',
    role: 'Platform',
    links: [
      { label: 'All connectors', icon: 'layout', action: { type: 'scroll', target: 'integrations-grid' } },
      { label: 'Admin', icon: 'user', action: { type: 'route', path: '/admin' }, feature: 'admin' },
    ],
  },
};

export type NavKey = keyof typeof sideNav;

export function navKeyFromPath(pathname: string): NavKey {
  if (pathname.startsWith('/procurement/studio')) return 'studio';
  if (pathname.startsWith('/suppliers-db')) return 'suppliers-db';
  if (pathname.startsWith('/contracts-mgr')) return 'contracts-mgr';
  if (pathname.startsWith('/lpo')) return 'lpo';
  const seg = pathname.replace(/^\//, '').split('/')[0];
  if (seg && seg in sideNav) return seg as NavKey;
  return 'dashboard';
}

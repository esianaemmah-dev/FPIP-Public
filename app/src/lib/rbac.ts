// Role-based access for FPIP — departments, features, and admin matrix.

import type { IconName } from '@/components/Icons';

export type RoleId =
  | 'admin'
  | 'executive'
  | 'procurement'
  | 'finance'
  | 'auditor'
  | 'supplier'
  | 'hod'
  | 'budget_owner'
  | 'contract_manager';

export type FeatureId =
  | 'dashboard'
  | 'procurement'
  | 'tender_studio'
  | 'finance'
  | 'supplier'
  | 'governance'
  | 'copilot'
  | 'admin'
  | 'integrations'
  | 'approvals_act'
  | 'payments_release'
  | 'tender_publish'
  | 'policy_edit'
  | 'user_admin'
  | 'integration_admin'
  | 'workflows'
  | 'document_vault'
  | 'notifications'
  | 'hod_submit'
  | 'supplier_db'
  | 'compliance_risk'
  | 'budget_owner_dash'
  | 'contract_mgr'
  | 'rfq_builder'
  | 'lpo_desk';

export interface RoleDef {
  id: RoleId;
  name: string;
  department: string;
  description: string;
  icon: IconName;
  /** Modules / capabilities this role may open */
  features: FeatureId[];
  /** Human-readable access summary for the RBAC matrix */
  can: string[];
  cannot: string[];
}

export const FEATURE_LABELS: Record<FeatureId, string> = {
  dashboard: 'Command Center',
  procurement: 'Procurement',
  tender_studio: 'Tender Studio',
  finance: 'Finance',
  supplier: 'Supplier Portal',
  governance: 'Governance & Audit',
  copilot: 'AI Assistant',
  admin: 'Administration',
  integrations: 'Integrations',
  approvals_act: 'Act on approvals',
  payments_release: 'Release payments',
  tender_publish: 'Publish tenders',
  policy_edit: 'Edit approval policies',
  user_admin: 'Manage users & roles',
  integration_admin: 'Configure integrations',
  workflows: 'Approval workflows',
  document_vault: 'Document vault',
  notifications: 'Notifications & activity',
  hod_submit: 'HOD requisition submit',
  supplier_db: 'Supplier database',
  compliance_risk: 'Compliance & Risk portal',
  budget_owner_dash: 'Budget owner dashboard',
  contract_mgr: 'Contract manager portal',
  rfq_builder: 'RFQ form builder',
  lpo_desk: 'LPO desk',
};

/** Map app routes / module keys to feature gates */
export const MODULE_FEATURE: Record<string, FeatureId> = {
  dashboard: 'dashboard',
  procurement: 'procurement',
  finance: 'finance',
  supplier: 'supplier',
  governance: 'governance',
  copilot: 'copilot',
  admin: 'admin',
  integrations: 'integrations',
  studio: 'tender_studio',
  notifications: 'notifications',
  hod: 'hod_submit',
  'suppliers-db': 'supplier_db',
  compliance: 'compliance_risk',
  budget: 'budget_owner_dash',
  'contracts-mgr': 'contract_mgr',
  rfq: 'rfq_builder',
  lpo: 'lpo_desk',
};

export const ROLES: RoleDef[] = [
  {
    id: 'admin',
    name: 'Platform Admin',
    department: 'IT / Platform',
    description: 'Full tenant control — users, roles, integrations, and every module.',
    icon: 'lock',
    features: [
      'dashboard',
      'procurement',
      'tender_studio',
      'finance',
      'supplier',
      'governance',
      'copilot',
      'admin',
      'integrations',
      'approvals_act',
      'payments_release',
      'tender_publish',
      'policy_edit',
      'user_admin',
      'integration_admin',
      'workflows',
      'document_vault',
      'notifications',
      'hod_submit',
      'supplier_db',
      'compliance_risk',
      'budget_owner_dash',
      'contract_mgr',
      'rfq_builder',
      'lpo_desk',
    ],
    can: [
      'Open every module',
      'Assign roles to departments and users',
      'Toggle feature access per department',
      'Configure Fabric, Dataverse, SharePoint, Entra, Metering',
      'Override policy and audit settings',
    ],
    cannot: ['Agents still cannot approve or pay on behalf of humans'],
  },
  {
    id: 'executive',
    name: 'Executive',
    department: 'Executive Office',
    description: 'Cross-org visibility for spend, risk, and decisions — no operational write paths.',
    icon: 'exec',
    features: ['dashboard', 'governance', 'copilot', 'procurement', 'finance', 'workflows', 'notifications', 'budget_owner_dash'],
    can: [
      'Command Center KPIs and pipeline',
      'View procurement & finance (read)',
      'Governance audit trail',
      'Ask FPIP Assistant',
    ],
    cannot: ['Publish tenders', 'Release payments', 'Edit RBAC or integrations'],
  },
  {
    id: 'procurement',
    name: 'Procurement',
    department: 'Procurement',
    description: 'Source-to-contract: requisitions, tenders, bids, contracts, Tender Studio.',
    icon: 'cart',
    features: [
      'dashboard',
      'procurement',
      'tender_studio',
      'copilot',
      'approvals_act',
      'tender_publish',
      'workflows',
      'document_vault',
      'notifications',
      'supplier_db',
      'rfq_builder',
      'compliance_risk',
      'hod_submit',
      'lpo_desk',
    ],
    can: [
      'Requisitions, tenders, bid board, contracts',
      'Tender Studio + RFQ builder',
      'Supplier database & tender-tied compare',
      'LPO lifecycle after award',
      'Recommend / route approvals',
      'Ask FPIP Assistant (procurement-grounded)',
    ],
    cannot: ['Release payments', 'Edit org-wide RBAC', 'Change integration connectors'],
  },
  {
    id: 'finance',
    name: 'Finance',
    department: 'Finance',
    description: 'Invoice exceptions, payment runs, budgets, and cash foresight.',
    icon: 'finance',
    features: ['dashboard', 'finance', 'copilot', 'approvals_act', 'payments_release', 'workflows', 'notifications', 'budget_owner_dash', 'lpo_desk'],
    can: [
      'Exception desk and invoice–LPO matching',
      'Payment runs and budget views',
      'Clear exceptions / release payments',
      'Ask FPIP Assistant (finance-grounded)',
    ],
    cannot: ['Publish tenders', 'Supplier portal records', 'Manage integrations'],
  },
  {
    id: 'auditor',
    name: 'Auditor',
    department: 'Audit & Compliance',
    description: 'Read-only control plane across audit, policy, and exceptions.',
    icon: 'shield',
    features: ['dashboard', 'governance', 'copilot', 'document_vault', 'compliance_risk', 'notifications'],
    can: [
      'Full audit trail and policy view',
      'Compliance & Risk portal / UAT gate',
      'Control matrix / SoD monitoring',
      'Ask FPIP Assistant (compliance-grounded)',
    ],
    cannot: ['Create tenders or payments', 'Change role assignments', 'Act as supplier'],
  },
  {
    id: 'supplier',
    name: 'Supplier',
    department: 'External suppliers',
    description: 'Isolated portal — own invitations, bids, invoices, and documents only.',
    icon: 'building',
    features: ['supplier', 'copilot', 'notifications'],
    can: [
      'Own tender invitations and bid studio',
      'Own invoices and compliance documents (portal only)',
      'Ask FPIP Assistant (supplier-scoped)',
    ],
    cannot: [
      'Document Vault (org-wide contracts & all suppliers)',
      'See other suppliers',
      'Internal finance/procurement modules',
      'Admin or integrations',
    ],
  },
  {
    id: 'hod',
    name: 'Head of Department',
    department: 'Business units',
    description: 'Submit bank-style requisitions into FPIP with auto-populated cost centres.',
    icon: 'user',
    features: ['hod_submit', 'budget_owner_dash', 'notifications', 'copilot', 'dashboard'],
    can: ['Submit HOD requisitions', 'View own budget envelope', 'Ask FPIP Assistant'],
    cannot: ['Publish tenders', 'Release payments', 'Manage suppliers'],
  },
  {
    id: 'budget_owner',
    name: 'Budget Owner',
    department: 'Finance / Business',
    description: 'Envelope ownership and requisition spend against department budgets.',
    icon: 'bar',
    features: ['budget_owner_dash', 'finance', 'notifications', 'copilot', 'dashboard'],
    can: ['Budget owner dashboard', 'View finance budgets', 'Track HOD requisitions'],
    cannot: ['Publish tenders', 'Act as supplier'],
  },
  {
    id: 'contract_manager',
    name: 'Contract Manager',
    department: 'Legal / Procurement',
    description: 'Contract portfolio, renewals, and hand-off to re-tender.',
    icon: 'contract',
    features: ['contract_mgr', 'procurement', 'tender_studio', 'document_vault', 'notifications', 'copilot', 'dashboard'],
    can: ['Contract manager portal', 'View contracts & vault', 'Hand renewals into Tender Studio'],
    cannot: ['Release payments', 'Edit RBAC'],
  },
];

export function getRole(id: RoleId): RoleDef {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}

export function roleHasFeature(roleId: RoleId, feature: FeatureId, overrides?: Partial<Record<RoleId, FeatureId[]>>): boolean {
  const custom = overrides?.[roleId];
  const list = custom ?? getRole(roleId).features;
  return list.includes(feature);
}

/** Keyword router — one UI assistant, specialist tools underneath. */
export function routeAssistantIntent(message: string): string {
  const m = message.toLowerCase();
  if (/(invoice|payment|budget|cash|3-way|duplicate)/.test(m)) return 'finance';
  if (/(tender|bid|rfp|rfq|requisition|sourc|award|supplier score)/.test(m)) return 'procurement';
  if (/(contract|renewal|clause|obligation)/.test(m)) return 'contract';
  if (/(compliance|policy|audit|sod|purview)/.test(m)) return 'compliance';
  if (/(risk|concentrat|exposure)/.test(m)) return 'risk';
  if (/(spend|saving|categor)/.test(m)) return 'spend';
  if (/(onboard|my bid|my invoice|tax cert)/.test(m)) return 'supplier';
  if (/(handbook|sop|knowledge|how do we)/.test(m)) return 'knowledge';
  return 'executive';
}

export interface IntegrationDef {
  id: string;
  name: string;
  category: string;
  status: 'Connected' | 'Configured' | 'Available' | 'Attention';
  description: string;
  owner: string;
}

export const INTEGRATIONS: IntegrationDef[] = [
  {
    id: 'dataverse',
    name: 'Microsoft Dataverse',
    category: 'Data',
    status: 'Connected',
    description: 'FPIP_Core tables, security roles, and approval policies.',
    owner: 'Platform Admin',
  },
  {
    id: 'entra',
    name: 'Microsoft Entra ID',
    category: 'Identity',
    status: 'Connected',
    description: 'Staff SPA, supplier external app, and agent service principal.',
    owner: 'Platform Admin',
  },
  {
    id: 'fabric',
    name: 'Microsoft Fabric',
    category: 'Banking data',
    status: 'Configured',
    description: 'OneLake / SQL analytics for payments and budget utilization.',
    owner: 'Finance + IT',
  },
  {
    id: 'sharepoint',
    name: 'SharePoint / OneDrive',
    category: 'Documents',
    status: 'Configured',
    description: 'Compliance docs, contracts, and AI Search grounding indexes.',
    owner: 'Procurement',
  },
  {
    id: 'ai-search',
    name: 'Azure AI Search',
    category: 'AI',
    status: 'Available',
    description: 'Policies, contracts, and supplier-document indexes for the Assistant.',
    owner: 'Platform Admin',
  },
  {
    id: 'openai',
    name: 'Azure OpenAI',
    category: 'AI',
    status: 'Connected',
    description: 'LLM backend for the unified FPIP Assistant (LangGraph service).',
    owner: 'Platform Admin',
  },
  {
    id: 'power-automate',
    name: 'Power Automate',
    category: 'Workflow',
    status: 'Configured',
    description: 'Requisition, tender award, invoice exception, and renewal flows.',
    owner: 'Procurement + Finance',
  },
  {
    id: 'metering',
    name: 'Marketplace Metering',
    category: 'Commercial',
    status: 'Available',
    description: 'Optional usage webhook for Partner Center billing.',
    owner: 'Platform Admin',
  },
];

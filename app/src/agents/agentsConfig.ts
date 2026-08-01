// The nine FPIP agent personas as static config. Ported from the
// FPIP_UI_Demo.html `agents` array. In Phase 1 this drives the (non-functional)
// Copilot agent picker; in Phase 2 the LangGraph service mirrors this exact
// spec in agents_config.py (system prompt, allowed tools, grounding index).

import type { IconName } from '@/components/Icons';

export interface AgentDef {
  id: string;
  name: string;
  icon: IconName;
  desc: string;
  scope: string;
}

export const agents: AgentDef[] = [
  { id: 'executive', name: 'Executive Agent', icon: 'exec', desc: 'Board-ready summaries, KPIs, decision alerts', scope: 'Reads: dashboards, spend, risk, contracts, approvals · Cannot approve or pay' },
  { id: 'procurement', name: 'Procurement Agent', icon: 'cart', desc: 'Bid comparison, sourcing, tender evaluation', scope: 'Reads: requisitions, tenders, bids, supplier scores · Cannot award tenders' },
  { id: 'finance', name: 'Finance Agent', icon: 'spend', desc: 'Budget variance, invoice review, reporting', scope: 'Reads: invoices, budgets, cost centers · Cannot release payment' },
  { id: 'spend', name: 'Spend Agent', icon: 'bar', desc: 'Spend trends, savings, category leakage', scope: 'Reads: spend history, category and supplier data' },
  { id: 'contract', name: 'Contract Agent', icon: 'contract', desc: 'Clause extraction, renewals, obligations', scope: 'Reads: contract repository, obligations, renewal dates' },
  { id: 'compliance', name: 'Compliance Agent', icon: 'compliance', desc: 'Policy, documents, approval compliance', scope: 'Reads: policies, supplier documents, approval logs' },
  { id: 'risk', name: 'Risk Agent', icon: 'risk', desc: 'Supplier, contract and concentration risk', scope: 'Reads: supplier risk scores, exposure, contracts' },
  { id: 'knowledge', name: 'Knowledge Agent', icon: 'knowledge', desc: 'Semantic search across policies & records', scope: 'Reads: policies, SOPs, tenders, historical decisions' },
  { id: 'supplier', name: 'Supplier Agent', icon: 'building', desc: 'Onboarding, document checks, categorization', scope: 'Reads: supplier applications and submitted documents' },
];

export function getAgent(id: string): AgentDef | undefined {
  return agents.find((a) => a.id === id);
}

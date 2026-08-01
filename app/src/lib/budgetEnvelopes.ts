/** Shared department envelopes for budget gates (demo figures aligned with Finance / Budget Owner). */

export interface BudgetEnvelope {
  dept: string;
  usedPct: number;
  cap: number;
}

export const BUDGET_ENVELOPES: BudgetEnvelope[] = [
  { dept: 'Operations', usedPct: 72, cap: 4200000 },
  { dept: 'Facilities', usedPct: 91, cap: 1800000 },
  { dept: 'Finance', usedPct: 54, cap: 2600000 },
  { dept: 'ICT', usedPct: 88, cap: 5100000 },
  { dept: 'Logistics', usedPct: 63, cap: 1500000 },
  { dept: 'Marketing', usedPct: 48, cap: 900000 },
  { dept: 'ICT & Software', usedPct: 88, cap: 5100000 },
];

export type BudgetGateResult = {
  withinBudget: boolean;
  remaining: number;
  usedPct: number;
  cap: number;
  envelopeDept: string;
};

export function checkBudget(department: string, amount: number): BudgetGateResult {
  const env =
    BUDGET_ENVELOPES.find((e) => e.dept.toLowerCase() === department.toLowerCase()) ??
    BUDGET_ENVELOPES.find((e) => department.toLowerCase().includes(e.dept.toLowerCase())) ??
    BUDGET_ENVELOPES[0];
  const spent = (env.usedPct / 100) * env.cap;
  const remaining = Math.max(0, env.cap - spent);
  return {
    withinBudget: amount <= remaining,
    remaining,
    usedPct: env.usedPct,
    cap: env.cap,
    envelopeDept: env.dept,
  };
}

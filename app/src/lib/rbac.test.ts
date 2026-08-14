import { describe, expect, it } from 'vitest';
import { roleHasFeature, routeAssistantIntent } from './rbac';
import { resolveRoleFromEntraClaims } from './entraRoles';
import { checkBudget } from './budgetEnvelopes';

describe('FPIP authorization controls', () => {
  it('prevents suppliers from opening internal finance and governance modules', () => {
    expect(roleHasFeature('supplier', 'finance')).toBe(false);
    expect(roleHasFeature('supplier', 'governance')).toBe(false);
    expect(roleHasFeature('supplier', 'supplier')).toBe(true);
  });

  it('resolves only recognized Entra application roles', () => {
    expect(resolveRoleFromEntraClaims({ roles: ['FPIP-Procurement'] })).toBe('procurement');
    expect(resolveRoleFromEntraClaims({ roles: ['Global-Administrator'] })).toBeNull();
  });
});

describe('FPIP deterministic controls', () => {
  it('routes sensitive questions to the correct specialist', () => {
    expect(routeAssistantIntent('Show invoice exceptions')).toBe('finance');
    expect(routeAssistantIntent('Compare tender bids')).toBe('procurement');
    expect(routeAssistantIntent('Review segregation of duties')).toBe('compliance');
  });

  it('blocks an amount above the remaining department envelope', () => {
    const result = checkBudget('Facilities', 200_000);
    expect(result.remaining).toBe(162_000);
    expect(result.withinBudget).toBe(false);
  });
});

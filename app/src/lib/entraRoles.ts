// Map Microsoft Entra ID app roles / security groups to FPIP department roles.
// Configure group Object IDs in Entra, then set VITE_ENTRA_GROUP_MAP (JSON) in production.

import type { RoleId } from '@/lib/rbac';

/** Default mapping by group display name (demo + docs). Override via env JSON. */
export const DEFAULT_GROUP_ROLE_MAP: Record<string, RoleId> = {
  'FPIP-Platform-Admin': 'admin',
  'FPIP-Admin': 'admin',
  'FPIP-Executive': 'executive',
  'FPIP-Procurement': 'procurement',
  'FPIP-Finance': 'finance',
  'FPIP-Auditor': 'auditor',
  'FPIP-Supplier': 'supplier',
  'FPIP-HOD': 'hod',
  'FPIP-Budget-Owner': 'budget_owner',
  'FPIP-Contract-Manager': 'contract_manager',
};

function loadEnvGroupMap(): Record<string, RoleId> {
  try {
    const raw = import.meta.env.VITE_ENTRA_GROUP_MAP;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, RoleId> = {};
    for (const [groupId, role] of Object.entries(parsed)) {
      if (isRoleId(role)) out[groupId] = role;
    }
    return out;
  } catch {
    return {};
  }
}

function isRoleId(v: string): v is RoleId {
  return [
    'admin',
    'executive',
    'procurement',
    'finance',
    'auditor',
    'supplier',
    'hod',
    'budget_owner',
    'contract_manager',
  ].includes(v);
}

const ENV_MAP = loadEnvGroupMap();

export function resolveRoleFromEntraClaims(claims: Record<string, unknown> | undefined): RoleId | null {
  if (!claims) return null;

  const roles = (claims.roles as string[] | undefined) ?? [];
  for (const r of roles) {
    const key = r.replace(/^FPIP[-_]?/i, 'FPIP-');
    if (DEFAULT_GROUP_ROLE_MAP[key]) return DEFAULT_GROUP_ROLE_MAP[key];
    if (isRoleId(r)) return r;
  }

  const groups = (claims.groups as string[] | undefined) ?? [];
  for (const g of groups) {
    if (ENV_MAP[g]) return ENV_MAP[g];
  }

  // Named groups in token (some tenants emit group names)
  const groupNames = (claims.group_names as string[] | undefined) ?? [];
  for (const name of groupNames) {
    if (DEFAULT_GROUP_ROLE_MAP[name]) return DEFAULT_GROUP_ROLE_MAP[name];
  }

  return null;
}

export function entraGroupsFromClaims(claims: Record<string, unknown> | undefined): string[] {
  if (!claims) return [];
  const roles = (claims.roles as string[] | undefined) ?? [];
  const groups = (claims.groups as string[] | undefined) ?? [];
  return [...roles, ...groups.map((id) => ENV_MAP[id] ? `group:${id.slice(0, 8)}…` : id.slice(0, 8) + '…')];
}

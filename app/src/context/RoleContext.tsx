import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { isDemoMode } from '@/api/dataverseClient';
import { entraGroupsFromClaims, resolveRoleFromEntraClaims } from '@/lib/entraRoles';
import {
  ROLES,
  getRole,
  roleHasFeature,
  type FeatureId,
  type RoleId,
} from '@/lib/rbac';

const STORAGE_ROLE = 'fpip.role';
const STORAGE_OVERRIDES = 'fpip.featureOverrides';
const STORAGE_VIEW_AS = 'fpip.viewAs';

interface RoleContextValue {
  roleId: RoleId;
  role: ReturnType<typeof getRole>;
  /** Entra-resolved role (ignores view-as) */
  entraRoleId: RoleId | null;
  entraGroups: string[];
  isDemoRolePicker: boolean;
  isViewAs: boolean;
  setRoleId: (id: RoleId) => void;
  clearViewAs: () => void;
  can: (feature: FeatureId) => boolean;
  featureOverrides: Partial<Record<RoleId, FeatureId[]>>;
  setRoleFeatures: (roleId: RoleId, features: FeatureId[]) => void;
  resetOverrides: () => void;
  roles: typeof ROLES;
}

const RoleContext = createContext<RoleContextValue | null>(null);

function loadRole(): RoleId {
  try {
    const v = localStorage.getItem(STORAGE_ROLE) as RoleId | null;
    if (v && ROLES.some((r) => r.id === v)) return v;
  } catch {
    /* ignore */
  }
  return 'admin';
}

function loadOverrides(): Partial<Record<RoleId, FeatureId[]>> {
  try {
    const raw = localStorage.getItem(STORAGE_OVERRIDES);
    if (raw) return JSON.parse(raw) as Partial<Record<RoleId, FeatureId[]>>;
  } catch {
    /* ignore */
  }
  return {};
}

function loadViewAs(): RoleId | null {
  try {
    const v = localStorage.getItem(STORAGE_VIEW_AS) as RoleId | null;
    if (v && ROLES.some((r) => r.id === v)) return v;
  } catch {
    /* ignore */
  }
  return null;
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const { account } = useFpipAuth();
  const claims = account?.idTokenClaims as Record<string, unknown> | undefined;
  const entraResolved = resolveRoleFromEntraClaims(claims);
  const entraGroups = entraGroupsFromClaims(claims);

  const [demoRoleId, setDemoRoleId] = useState<RoleId>(loadRole);
  const [viewAs, setViewAs] = useState<RoleId | null>(loadViewAs);
  const [featureOverrides, setFeatureOverrides] = useState(loadOverrides);

  const isDemoRolePicker = isDemoMode;
  const entraRoleId = entraResolved;

  // Sync Entra role when account loads (live mode)
  useEffect(() => {
    if (isDemoMode || !entraResolved) return;
    if (!viewAs) {
      setDemoRoleId(entraResolved);
    }
  }, [entraResolved, viewAs]);

  const effectiveRoleId: RoleId = viewAs ?? (isDemoMode ? demoRoleId : entraResolved ?? demoRoleId ?? 'executive');

  const setRoleId = useCallback(
    (id: RoleId) => {
      if (isDemoMode) {
        setDemoRoleId(id);
        setViewAs(null);
        try {
          localStorage.setItem(STORAGE_ROLE, id);
          localStorage.removeItem(STORAGE_VIEW_AS);
        } catch {
          /* ignore */
        }
        return;
      }
      // Live: only platform admin may view-as another department
      const adminRole = entraResolved === 'admin' || demoRoleId === 'admin';
      if (adminRole && id !== entraResolved) {
        setViewAs(id);
        try {
          localStorage.setItem(STORAGE_VIEW_AS, id);
        } catch {
          /* ignore */
        }
      }
    },
    [isDemoMode, entraResolved, demoRoleId],
  );

  const clearViewAs = useCallback(() => {
    setViewAs(null);
    try {
      localStorage.removeItem(STORAGE_VIEW_AS);
    } catch {
      /* ignore */
    }
  }, []);

  const setRoleFeatures = useCallback((id: RoleId, features: FeatureId[]) => {
    setFeatureOverrides((prev) => {
      const next = { ...prev, [id]: features };
      try {
        localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const resetOverrides = useCallback(() => {
    setFeatureOverrides({});
    try {
      localStorage.removeItem(STORAGE_OVERRIDES);
    } catch {
      /* ignore */
    }
  }, []);

  const can = useCallback(
    (feature: FeatureId) => {
      // Suppliers never see org-wide Document Vault (even if an old override enabled it).
      if (effectiveRoleId === 'supplier' && feature === 'document_vault') return false;
      return roleHasFeature(effectiveRoleId, feature, featureOverrides);
    },
    [effectiveRoleId, featureOverrides],
  );

  // One-time cleanup: drop document_vault from persisted supplier overrides.
  useEffect(() => {
    const supplierFeatures = featureOverrides.supplier;
    if (!supplierFeatures?.includes('document_vault')) return;
    const cleaned = supplierFeatures.filter((f) => f !== 'document_vault');
    setFeatureOverrides((prev) => {
      const next = { ...prev, supplier: cleaned };
      try {
        localStorage.setItem(STORAGE_OVERRIDES, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, [featureOverrides.supplier]);

  const value = useMemo<RoleContextValue>(
    () => ({
      roleId: effectiveRoleId,
      role: getRole(effectiveRoleId),
      entraRoleId,
      entraGroups,
      isDemoRolePicker,
      isViewAs: Boolean(viewAs),
      setRoleId,
      clearViewAs,
      can,
      featureOverrides,
      setRoleFeatures,
      resetOverrides,
      roles: ROLES,
    }),
    [
      effectiveRoleId,
      entraRoleId,
      entraGroups,
      isDemoRolePicker,
      viewAs,
      setRoleId,
      clearViewAs,
      can,
      featureOverrides,
      setRoleFeatures,
      resetOverrides,
    ],
  );

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getEntity,
  LEGAL_ENTITIES,
  SUPPORTED_CURRENCIES,
  type LegalEntity,
  type SupportedCurrency,
} from '@/lib/tenant';

const STORAGE_ENTITY = 'fpip.entity';
const STORAGE_CURRENCY = 'fpip.currency';

interface TenantContextValue {
  entity: LegalEntity;
  entityId: string;
  setEntityId: (id: string) => void;
  currency: SupportedCurrency;
  setCurrency: (c: SupportedCurrency) => void;
  entities: typeof LEGAL_ENTITIES;
  currencies: typeof SUPPORTED_CURRENCIES;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function loadEntityId(): string {
  try {
    const v = localStorage.getItem(STORAGE_ENTITY);
    if (v && LEGAL_ENTITIES.some((e) => e.id === v)) return v;
  } catch {
    /* ignore */
  }
  return LEGAL_ENTITIES[0].id;
}

function loadCurrency(): SupportedCurrency {
  try {
    const v = localStorage.getItem(STORAGE_CURRENCY) as SupportedCurrency | null;
    if (v && SUPPORTED_CURRENCIES.includes(v)) return v;
  } catch {
    /* ignore */
  }
  return 'USD';
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [entityId, setEntityIdState] = useState(loadEntityId);
  const [currency, setCurrencyState] = useState<SupportedCurrency>(loadCurrency);

  const setEntityId = useCallback((id: string) => {
    setEntityIdState(id);
    const ent = getEntity(id);
    setCurrencyState(ent.currency as SupportedCurrency);
    try {
      localStorage.setItem(STORAGE_ENTITY, id);
      localStorage.setItem(STORAGE_CURRENCY, ent.currency);
    } catch {
      /* ignore */
    }
  }, []);

  const setCurrency = useCallback((c: SupportedCurrency) => {
    setCurrencyState(c);
    try {
      localStorage.setItem(STORAGE_CURRENCY, c);
    } catch {
      /* ignore */
    }
  }, []);

  const entity = useMemo(() => getEntity(entityId), [entityId]);

  const value = useMemo<TenantContextValue>(
    () => ({
      entity,
      entityId,
      setEntityId,
      currency,
      setCurrency,
      entities: LEGAL_ENTITIES,
      currencies: SUPPORTED_CURRENCIES,
    }),
    [entity, entityId, setEntityId, currency, setCurrency],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error('useTenant must be used within TenantProvider');
  return ctx;
}

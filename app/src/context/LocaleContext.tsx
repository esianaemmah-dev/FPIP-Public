import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { LOCALES, t as translate, type LocaleId } from '@/lib/i18n';

const STORAGE_LOCALE = 'fpip.locale';

interface LocaleContextValue {
  locale: LocaleId;
  setLocale: (id: LocaleId) => void;
  t: (key: string) => string;
  locales: typeof LOCALES;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

function loadLocale(): LocaleId {
  try {
    const v = localStorage.getItem(STORAGE_LOCALE) as LocaleId | null;
    if (v === 'en' || v === 'fr') return v;
  } catch {
    /* ignore */
  }
  return 'en';
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<LocaleId>(loadLocale);

  const setLocale = useCallback((id: LocaleId) => {
    setLocaleState(id);
    try {
      localStorage.setItem(STORAGE_LOCALE, id);
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback((key: string) => translate(locale, key), [locale]);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, setLocale, t, locales: LOCALES }),
    [locale, setLocale, t],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

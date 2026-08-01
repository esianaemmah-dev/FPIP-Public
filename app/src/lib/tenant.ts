// Multi-entity tenant context for international deployments.

export interface LegalEntity {
  id: string;
  name: string;
  country: string;
  currency: string;
  fiscalYearStart: string; // MM-DD
  timezone: string;
}

export const LEGAL_ENTITIES: LegalEntity[] = [
  {
    id: 'novaris-uk',
    name: 'Novaris Group Ltd',
    country: 'United Kingdom',
    currency: 'GBP',
    fiscalYearStart: '04-01',
    timezone: 'Europe/London',
  },
  {
    id: 'novaris-de',
    name: 'Novaris Deutschland GmbH',
    country: 'Germany',
    currency: 'EUR',
    fiscalYearStart: '01-01',
    timezone: 'Europe/Berlin',
  },
  {
    id: 'novaris-us',
    name: 'Novaris US Inc.',
    country: 'United States',
    currency: 'USD',
    fiscalYearStart: '01-01',
    timezone: 'America/New_York',
  },
  {
    id: 'novaris-sg',
    name: 'Novaris Asia Pte Ltd',
    country: 'Singapore',
    currency: 'SGD',
    fiscalYearStart: '04-01',
    timezone: 'Asia/Singapore',
  },
];

export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP', 'SGD'] as const;
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

export function getEntity(id: string): LegalEntity {
  return LEGAL_ENTITIES.find((e) => e.id === id) ?? LEGAL_ENTITIES[0];
}

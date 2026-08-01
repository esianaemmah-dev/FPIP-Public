// Persist RFQ form schemas locally (demo / offline). Replace with Dataverse later.

export type RfqFieldType = 'text' | 'textarea' | 'file' | 'date' | 'number' | 'checkbox';

export interface StoredRfqField {
  id: string;
  label: string;
  type: RfqFieldType;
  required: boolean;
}

export interface StoredRfqSchema {
  id: string;
  title: string;
  specs: string;
  fields: StoredRfqField[];
  publishedAt?: string;
  updatedAt: string;
}

export interface StoredRfqResponse {
  id: string;
  rfqId: string;
  supplierName: string;
  submittedAt: string;
  answers: Record<string, string>;
  files: string[];
}

const SCHEMA_KEY = 'fpip.rfq.schemas';
const RESP_KEY = 'fpip.rfq.responses';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function listRfqSchemas(): StoredRfqSchema[] {
  return readJson<StoredRfqSchema[]>(SCHEMA_KEY, []);
}

export function saveRfqSchema(schema: Omit<StoredRfqSchema, 'updatedAt'> & { updatedAt?: string }): StoredRfqSchema {
  const next: StoredRfqSchema = {
    ...schema,
    updatedAt: new Date().toISOString(),
  };
  const all = listRfqSchemas();
  const idx = all.findIndex((s) => s.id === next.id);
  if (idx >= 0) all[idx] = next;
  else all.unshift(next);
  writeJson(SCHEMA_KEY, all);
  return next;
}

export function listRfqResponses(rfqId?: string): StoredRfqResponse[] {
  const all = readJson<StoredRfqResponse[]>(RESP_KEY, []);
  return rfqId ? all.filter((r) => r.rfqId === rfqId) : all;
}

export function saveRfqResponse(resp: StoredRfqResponse): void {
  const all = listRfqResponses();
  all.unshift(resp);
  writeJson(RESP_KEY, all);
}

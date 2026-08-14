// RFQ persistence adapter. Demo/offline mode uses localStorage; authenticated
// production mode stores schemas and responses in Dataverse.

import { getDataverseClient } from '@/api/dataverseClient';
import { Tables, type FpipRfqResponse, type FpipRfqSchema } from '@/api/types';

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
  dataverseId?: string;
}

export interface StoredRfqResponse {
  id: string;
  rfqId: string;
  supplierName: string;
  submittedAt: string;
  answers: Record<string, string>;
  files: string[];
  supplierId?: string;
  dataverseId?: string;
}

const SCHEMA_KEY = 'fpip.rfq.schemas';
const RESP_KEY = 'fpip.rfq.responses';
const client = getDataverseClient();

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function parseJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function escapeOData(value: string): string {
  return value.replace(/'/g, "''");
}

function fromSchema(row: FpipRfqSchema): StoredRfqSchema {
  return {
    id: row.fpip_external_id,
    title: row.fpip_title,
    specs: row.fpip_specifications ?? '',
    fields: parseJson<StoredRfqField[]>(row.fpip_fields_json, []),
    publishedAt: row.fpip_published_at,
    updatedAt: row.fpip_updated_at ?? new Date().toISOString(),
    dataverseId: row.fpip_rfqschemaid,
  };
}

function fromResponse(row: FpipRfqResponse): StoredRfqResponse {
  return {
    id: row.fpip_response_reference,
    rfqId: row.fpip_rfq_external_id,
    supplierName: row.fpip_supplier_name,
    submittedAt: row.fpip_submitted_at,
    answers: parseJson<Record<string, string>>(row.fpip_answers_json, {}),
    files: parseJson<string[]>(row.fpip_files_json, []),
    supplierId: row.fpip_Supplier?.id,
    dataverseId: row.fpip_rfqresponseid,
  };
}

export async function listRfqSchemas(): Promise<StoredRfqSchema[]> {
  if (client.useDemo) return readJson<StoredRfqSchema[]>(SCHEMA_KEY, []);
  const rows = await client.list<FpipRfqSchema>(Tables.rfqSchema, '$orderby=fpip_updated_at desc');
  return rows.map(fromSchema);
}

export async function saveRfqSchema(
  schema: Omit<StoredRfqSchema, 'updatedAt'> & { updatedAt?: string },
): Promise<StoredRfqSchema> {
  const next: StoredRfqSchema = { ...schema, updatedAt: new Date().toISOString() };
  if (client.useDemo) {
    const all = await listRfqSchemas();
    const idx = all.findIndex((item) => item.id === next.id);
    if (idx >= 0) all[idx] = next;
    else all.unshift(next);
    writeJson(SCHEMA_KEY, all);
    return next;
  }

  const payload: Record<string, unknown> = {
    fpip_title: next.title,
    fpip_external_id: next.id,
    fpip_specifications: next.specs,
    fpip_fields_json: JSON.stringify(next.fields),
    fpip_updated_at: next.updatedAt,
  };
  if (next.publishedAt) payload.fpip_published_at = next.publishedAt;
  if (next.dataverseId) {
    await client.update(Tables.rfqSchema, next.dataverseId, payload);
    return next;
  }
  const existing = await client.list<FpipRfqSchema>(
    Tables.rfqSchema,
    `$filter=fpip_external_id eq '${escapeOData(next.id)}'&$top=1`,
  );
  if (existing[0]) {
    await client.update(Tables.rfqSchema, existing[0].fpip_rfqschemaid, payload);
    return { ...next, dataverseId: existing[0].fpip_rfqschemaid };
  }
  return fromSchema(await client.create<FpipRfqSchema>(Tables.rfqSchema, payload));
}

export async function listRfqResponses(rfqId?: string): Promise<StoredRfqResponse[]> {
  if (client.useDemo) {
    const all = readJson<StoredRfqResponse[]>(RESP_KEY, []);
    return rfqId ? all.filter((row) => row.rfqId === rfqId) : all;
  }
  const filter = rfqId ? `$filter=fpip_rfq_external_id eq '${escapeOData(rfqId)}'&` : '';
  const rows = await client.list<FpipRfqResponse>(Tables.rfqResponse, `${filter}$orderby=fpip_submitted_at desc`);
  return rows.map(fromResponse);
}

export async function saveRfqResponse(resp: StoredRfqResponse): Promise<StoredRfqResponse> {
  if (client.useDemo) {
    const all = await listRfqResponses();
    all.unshift(resp);
    writeJson(RESP_KEY, all);
    return resp;
  }
  const schemas = await client.list<FpipRfqSchema>(
    Tables.rfqSchema,
    `$filter=fpip_external_id eq '${escapeOData(resp.rfqId)}'&$top=1`,
  );
  const schema = schemas[0];
  if (!schema) throw new Error(`RFQ schema ${resp.rfqId} is not persisted.`);
  const payload: Record<string, unknown> = {
    fpip_response_reference: resp.id,
    fpip_rfq_external_id: resp.rfqId,
    fpip_supplier_name: resp.supplierName,
    fpip_submitted_at: resp.submittedAt,
    fpip_answers_json: JSON.stringify(resp.answers),
    fpip_files_json: JSON.stringify(resp.files),
    'fpip_RfqSchema@odata.bind': `${Tables.rfqSchema}(${schema.fpip_rfqschemaid})`,
  };
  if (resp.supplierId) payload['fpip_Supplier@odata.bind'] = `${Tables.supplier}(${resp.supplierId})`;
  return fromResponse(await client.create<FpipRfqResponse>(Tables.rfqResponse, payload));
}

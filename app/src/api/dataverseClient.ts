// Dataverse Web API thin wrapper (Phase 1 Task 4). Generic GET/POST/PATCH/DELETE
// against the fpip_* collections using an MSAL-acquired bearer token. Typed
// table access + choice/lookup mapping lives in ./repositories.

const API_VERSION = '9.2';

export interface DataverseClientConfig {
  baseUrl: string;
  useDemo: boolean;
}

type TokenProvider = () => Promise<string>;

let tokenProvider: TokenProvider | null = null;

/** Wired up once by the AuthProvider so client calls can fetch a bearer token. */
export function setDataverseTokenProvider(provider: TokenProvider): void {
  tokenProvider = provider;
}

export class DataverseError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'DataverseError';
    this.status = status;
  }
}

class DataverseClient {
  readonly baseUrl: string;
  readonly useDemo: boolean;

  constructor(cfg: DataverseClientConfig) {
    this.baseUrl = (cfg.baseUrl || '').replace(/\/$/, '');
    this.useDemo = cfg.useDemo;
  }

  private path(collection: string, id?: string, query?: string): string {
    let p = `/api/data/v${API_VERSION}/${collection}`;
    if (id) p += `(${id})`;
    if (query) p += `?${query}`;
    return p;
  }

  private async buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    };
    if (!this.useDemo) {
      const token = tokenProvider ? await tokenProvider() : '';
      headers.Authorization = `Bearer ${token}`;
    }
    if (extra) Object.assign(headers, extra);
    return headers;
  }

  async request(
    method: string,
    collection: string,
    opts: { id?: string; query?: string; body?: unknown; extraHeaders?: Record<string, string> } = {},
  ): Promise<Response> {
    if (this.useDemo) {
      throw new DataverseError('Demo mode does not call Dataverse directly.', 0);
    }
    if (!this.baseUrl) {
      throw new DataverseError('VITE_DATAVERSE_URL is not configured.', 0);
    }
    const headers = await this.buildHeaders(
      opts.body !== undefined ? { 'Content-Type': 'application/json', ...opts.extraHeaders } : opts.extraHeaders,
    );
    const res = await fetch(`${this.baseUrl}${this.path(collection, opts.id, opts.query)}`, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new DataverseError(`Dataverse ${method} ${collection} failed: ${res.status} ${text}`, res.status);
    }
    return res;
  }

  /** GET a collection -> Dataverse `value` array (raw, unmapped). */
  async list<T>(collection: string, query?: string): Promise<T[]> {
    const res = await this.request('GET', collection, { query });
    const json = (await res.json()) as { value: T[] };
    return json.value;
  }

  /** POST a record. Uses Prefer: return=representation so the created record is
   *  returned (raw, unmapped). */
  async create<T>(collection: string, body: Record<string, unknown>): Promise<T> {
    const res = await this.request('POST', collection, {
      body,
      extraHeaders: { Prefer: 'return=representation' },
    });
    return (await res.json()) as T;
  }

  /** PATCH a record by id. */
  async update(collection: string, id: string, body: Record<string, unknown>): Promise<void> {
    await this.request('PATCH', collection, { id, body });
  }

  /** DELETE a record by id. */
  async delete(collection: string, id: string): Promise<void> {
    await this.request('DELETE', collection, { id });
  }
}

let client: DataverseClient | null = null;

function demoFlagFromUrl(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('demo') === '1';
  } catch {
    return false;
  }
}

/** Auth / Dataverse bypass. Production is currently demo-first (no MS authenticator required). */
export function getDataverseClient(): DataverseClient {
  if (!client) {
    const useDemo =
      import.meta.env.VITE_USE_DEMO_DATA === 'true' ||
      import.meta.env.VITE_DISABLE_MS_AUTH === 'true' ||
      demoFlagFromUrl();
    client = new DataverseClient({
      baseUrl: import.meta.env.VITE_DATAVERSE_URL ?? '',
      useDemo,
    });
  }
  return client;
}

export const isDemoMode =
  import.meta.env.VITE_USE_DEMO_DATA === 'true' ||
  import.meta.env.VITE_DISABLE_MS_AUTH === 'true' ||
  (typeof window !== 'undefined' && demoFlagFromUrl());

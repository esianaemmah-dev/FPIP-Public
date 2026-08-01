/** Clarification Q&A threads on open tenders (buyer ↔ supplier). */

export interface TenderQaMessage {
  id: string;
  tenderId: string;
  author: string;
  role: 'procurement' | 'supplier';
  body: string;
  at: string;
}

const KEY = 'fpip.tenderQa.v1';

function load(): TenderQaMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TenderQaMessage[]) : [];
  } catch {
    return [];
  }
}

function save(rows: TenderQaMessage[]) {
  localStorage.setItem(KEY, JSON.stringify(rows));
}

export function listTenderQa(tenderId: string): TenderQaMessage[] {
  return load()
    .filter((m) => m.tenderId === tenderId)
    .sort((a, b) => a.at.localeCompare(b.at));
}

export function postTenderQa(input: Omit<TenderQaMessage, 'id' | 'at'> & { at?: string }): TenderQaMessage {
  const msg: TenderQaMessage = {
    id: `q${Math.random().toString(36).slice(2, 9)}`,
    at: input.at ?? new Date().toISOString(),
    tenderId: input.tenderId,
    author: input.author,
    role: input.role,
    body: input.body,
  };
  const rows = load();
  rows.push(msg);
  save(rows);
  return msg;
}

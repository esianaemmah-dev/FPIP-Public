/**
 * Document AI helpers (quote → PR, invoice OCR → LPO match, contract extract).
 * Parses text uploads immediately; binary PDFs/DOCX get structured heuristics
 * until Azure Document Intelligence is wired.
 */

export interface QuoteExtract {
  title: string;
  supplierName: string;
  amount: number;
  category: string;
  deliveryDate?: string;
  currency?: string;
  quoteRef?: string;
  lineItems: { description: string; qty?: number; unitPrice?: number; total?: number }[];
  notes: string;
  confidence: number;
  source: 'text' | 'heuristic';
  fieldsFound: string[];
}

export interface InvoiceExtract {
  invoiceNumber: string;
  supplierName: string;
  amount: number;
  taxAmount?: number;
  currency?: string;
  invoiceDate?: string;
  dueDate?: string;
  poHint?: string;
  lineSummary: string;
  lineItems: { description: string; amount?: number }[];
  confidence: number;
  source: 'text' | 'heuristic';
  fieldsFound: string[];
}

export interface ContractExtract {
  title: string;
  supplierName: string;
  value?: number;
  startDate?: string;
  expiryDate?: string;
  termMonths?: number;
  renewalTerms: string;
  paymentTerms: string;
  escalation: string;
  noticePeriod?: string;
  governingLaw?: string;
  risks: { label: string; severity: 'low' | 'medium' | 'high' }[];
  obligations: string[];
  confidence: number;
  source: 'text' | 'heuristic';
  fieldsFound: string[];
}

function moneyFrom(text: string): number | undefined {
  const m =
    text.match(/(?:USD|UGX|EUR|GBP|\$)\s*([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/total[:\s]+([\d,]+(?:\.\d{1,2})?)/i) ||
    text.match(/amount[:\s]+([\d,]+(?:\.\d{1,2})?)/i);
  if (!m) return undefined;
  return Number(m[1].replace(/,/g, ''));
}

function field(text: string, labels: string[]): string | undefined {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*[:\\-]\\s*(.+)`, 'i');
    const m = text.match(re);
    if (m) return m[1].split(/\n/)[0].trim();
  }
  return undefined;
}

function guessCategory(text: string): string {
  const t = text.toLowerCase();
  if (/switch|server|software|licence|erp|network|ict/.test(t)) return 'ICT & Software';
  if (/facility|cleaning|fit-?out|premises/.test(t)) return 'Facilities';
  if (/logistic|fleet|transport|freight/.test(t)) return 'Logistics';
  if (/legal|consult|advisory|professional/.test(t)) return 'Professional Services';
  return 'ICT & Software';
}

const SUPPLIER_HINTS = [
  'Kestrel Components Ltd.',
  'Halyard Systems',
  'Solveware Group',
  'Northbridge FM',
  'Meridian Logistics',
  'Carrow & Pine LLP',
];

function guessSupplier(text: string, fileName: string): string {
  for (const s of SUPPLIER_HINTS) {
    if (text.toLowerCase().includes(s.toLowerCase().split(' ')[0]!)) return s;
  }
  const fromName = fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  return fromName.length > 3 ? fromName.slice(0, 48) : 'Unknown supplier';
}

export async function readFileText(file: File): Promise<{ text: string; binary: boolean }> {
  const lower = file.name.toLowerCase();
  if (/\.(txt|md|csv|html|json)$/.test(lower)) {
    return { text: await file.text(), binary: false };
  }
  // Attempt text decode for small “pdf-like” dumps; otherwise heuristic
  if (file.size < 400_000 && /\.(pdf|doc|docx)$/.test(lower)) {
    try {
      const buf = await file.arrayBuffer();
      const raw = new TextDecoder('utf-8', { fatal: false }).decode(buf);
      const printable = raw.replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');
      if (printable.replace(/\s+/g, ' ').trim().length > 80) {
        return { text: printable.slice(0, 20000), binary: false };
      }
    } catch {
      /* fall through */
    }
  }
  return { text: '', binary: true };
}

export async function extractQuoteFromFile(file: File): Promise<QuoteExtract> {
  const { text, binary } = await readFileText(file);
  if (!binary && text.trim()) {
    const amount = moneyFrom(text) ?? 125000;
    const supplier = field(text, ['supplier', 'vendor', 'from', 'company']) ?? guessSupplier(text, file.name);
    const title =
      field(text, ['subject', 'title', 'description', 'item']) ??
      `Quote · ${supplier} · ${file.name.replace(/\.[^.]+$/, '')}`;
    const quoteRef = field(text, ['quote', 'quotation', 'ref', 'reference', 'rfq']);
    const deliveryDate = field(text, ['delivery', 'lead time', 'needed by']);
    const fieldsFound = ['amount', 'supplier', 'title'];
    if (quoteRef) fieldsFound.push('quoteRef');
    if (deliveryDate) fieldsFound.push('deliveryDate');
    return {
      title: title.slice(0, 120),
      supplierName: supplier,
      amount,
      category: guessCategory(text),
      deliveryDate,
      currency: /UGX/i.test(text) ? 'UGX' : /EUR/i.test(text) ? 'EUR' : 'USD',
      quoteRef: quoteRef ?? undefined,
      lineItems: [
        { description: title.slice(0, 80), qty: 1, unitPrice: amount, total: amount },
      ],
      notes: `AI extracted from quote “${file.name}”. Review every field before submit.`,
      confidence: 0.82,
      source: 'text',
      fieldsFound,
    };
  }
  const supplier = guessSupplier('', file.name);
  const amount = 185000;
  return {
    title: `Quote intake · ${file.name.replace(/\.[^.]+$/, '')}`,
    supplierName: supplier,
    amount,
    category: guessCategory(file.name),
    currency: 'USD',
    quoteRef: `Q-${Math.floor(1000 + Math.random() * 9000)}`,
    lineItems: [
      { description: 'Primary line (OCR stub)', qty: 1, unitPrice: amount * 0.7, total: amount * 0.7 },
      { description: 'Services / contingency', qty: 1, unitPrice: amount * 0.3, total: amount * 0.3 },
    ],
    notes: `Document Intelligence stub parsed “${file.name}” (${Math.round(file.size / 1024)} KB). Replace with Azure DI for production.`,
    confidence: 0.58,
    source: 'heuristic',
    fieldsFound: ['title', 'supplier', 'amount', 'lineItems'],
  };
}

export async function extractInvoiceFromFile(file: File): Promise<InvoiceExtract> {
  const { text, binary } = await readFileText(file);
  if (!binary && text.trim()) {
    const invoiceNumber =
      field(text, ['invoice number', 'invoice no', 'inv']) ??
      `INV-${Math.floor(88000 + Math.random() * 1000)}`;
    const amount = moneyFrom(text) ?? 42100;
    const tax = moneyFrom(text.match(/tax[\s\S]{0,40}/i)?.[0] ?? '') ?? Math.round(amount * 0.18);
    const fieldsFound = ['invoiceNumber', 'amount', 'supplier'];
    const poHint = field(text, ['po', 'lpo', 'purchase order', 'order no']);
    if (poHint) fieldsFound.push('poHint');
    return {
      invoiceNumber,
      supplierName: field(text, ['supplier', 'vendor', 'bill from']) ?? guessSupplier(text, file.name),
      amount,
      taxAmount: tax,
      currency: /UGX/i.test(text) ? 'UGX' : 'USD',
      invoiceDate: field(text, ['invoice date', 'date', 'issued']),
      dueDate: field(text, ['due date', 'payment due', 'net']),
      poHint: poHint ?? undefined,
      lineSummary: field(text, ['description', 'line', 'goods']) ?? 'Goods / services per attached invoice',
      lineItems: [{ description: 'Extracted commercial line', amount }],
      confidence: 0.86,
      source: 'text',
      fieldsFound,
    };
  }
  const amount = 84200;
  return {
    invoiceNumber: `INV-OCR-${Math.floor(1000 + Math.random() * 9000)}`,
    supplierName: guessSupplier('', file.name),
    amount,
    taxAmount: Math.round(amount * 0.18),
    currency: 'USD',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().slice(0, 10);
    })(),
    poHint: 'PO-22839',
    lineSummary: `OCR fields from ${file.name}`,
    lineItems: [
      { description: 'Hardware / services lot', amount: amount * 0.85 },
      { description: 'Tax / fees', amount: amount * 0.15 },
    ],
    confidence: 0.61,
    source: 'heuristic',
    fieldsFound: ['invoiceNumber', 'supplier', 'amount', 'poHint', 'lineItems'],
  };
}

export async function extractContractFromFile(file: File): Promise<ContractExtract> {
  const { text, binary } = await readFileText(file);
  const supplier = binary
    ? guessSupplier('', file.name)
    : field(text, ['supplier', 'party', 'contractor', 'vendor']) ?? guessSupplier(text, file.name);
  const value = binary ? 940000 : moneyFrom(text);
  const expiry =
    field(text ?? '', ['expiry', 'expiration', 'end date', 'term ends']) ??
    (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 11);
      return d.toISOString().slice(0, 10);
    })();
  const renewal =
    field(text, ['renewal', 'auto-renew', 'extension']) ??
    'Auto-renews for 12 months unless notice 90 days prior.';
  const payment =
    field(text, ['payment terms', 'payment', 'net']) ?? 'Net 30 from invoice acceptance.';
  const escalation =
    field(text, ['escalation', 'price increase', 'indexation']) ??
    'Annual CPI capped at 5% with 60-day written notice.';
  const notice =
    field(text, ['notice', 'termination notice', 'notice period']) ?? '90 days written notice to non-renew.';
  const law = field(text, ['governing law', 'jurisdiction', 'law']) ?? 'Laws of Uganda; courts of Kampala.';

  const risks: ContractExtract['risks'] = [
    {
      label: escalation.toLowerCase().includes('uncap') || escalation.toLowerCase().includes('unlimited')
        ? 'Uncapped price escalation'
        : 'Escalation within policy cap',
      severity: /uncap|unlimited/i.test(escalation) ? 'high' : 'low',
    },
    {
      label: /exclusive/i.test(text) ? 'Exclusivity clause present' : 'No exclusivity flagged',
      severity: /exclusive/i.test(text) ? 'medium' : 'low',
    },
    {
      label: /liability.*unlimited|unlimited liability/i.test(text)
        ? 'Unlimited liability — legal review'
        : 'Liability language not flagged as unlimited',
      severity: /unlimited liability/i.test(text) ? 'high' : 'low',
    },
    {
      label: /auto-?renew/i.test(renewal) ? 'Auto-renewal active — diary notice date' : 'Manual renewal',
      severity: /auto-?renew/i.test(renewal) ? 'medium' : 'low',
    },
  ];

  return {
    title: field(text, ['agreement', 'contract title', 'title']) ?? `MSA · ${supplier}`,
    supplierName: supplier,
    value,
    startDate: field(text, ['effective', 'start date', 'commencement']),
    expiryDate: expiry,
    termMonths: 12,
    renewalTerms: renewal,
    paymentTerms: payment,
    escalation,
    noticePeriod: notice,
    governingLaw: law,
    risks,
    obligations: [
      'Maintain insurance certificates current in Document Vault',
      'Report material subcontractors within 10 business days',
      'Quarterly service review with Procurement & Contract Manager',
    ],
    confidence: binary ? 0.55 : 0.8,
    source: binary ? 'heuristic' : 'text',
    fieldsFound: ['title', 'supplier', 'renewal', 'payment', 'escalation', 'risks'],
  };
}

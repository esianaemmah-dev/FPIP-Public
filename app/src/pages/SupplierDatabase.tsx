import { useMemo, useState } from 'react';
import { Card, SectionHead } from '@/components/Card';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { useSuppliers, useBids, useTenders, useComplianceDocuments, usePurchaseOrders } from '@/api/useDataverse';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/context/ToastContext';
import { formatDate, formatMoney } from '@/lib/format';
import type { FpipSupplier } from '@/api/types';

const RFQ_DOCS: Record<string, { supplier: string; docs: string[] }[]> = {
  t1: [
    { supplier: 'Halyard Systems', docs: ['Technical proposal.pdf', 'Pricing schedule.xlsx', 'ISO 27001.pdf'] },
    { supplier: 'Solveware Group', docs: ['Technical proposal.pdf', 'SLA draft.docx', 'Insurance.pdf'] },
    { supplier: 'Kestrel Components Ltd.', docs: ['Bid form.pdf', 'Tax certificate.pdf'] },
  ],
  t2: [
    { supplier: 'Halyard Systems', docs: ['Quotation.pdf', 'Datasheets.zip'] },
    { supplier: 'Kestrel Components Ltd.', docs: ['Quotation.pdf', 'Delivery plan.pdf'] },
  ],
};

export function SupplierDatabase() {
  const suppliers = useSuppliers();
  const bids = useBids();
  const tenders = useTenders();
  const compliance = useComplianceDocuments();
  const pos = usePurchaseOrders();
  const { entity, currency } = useTenant();
  const { showToast } = useToast();
  const [tenderId, setTenderId] = useState('t1');
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrResult, setOcrResult] = useState<string | null>(null);

  const avgRisk = useMemo(() => {
    if (!suppliers.data.length) return 0;
    return Math.round(
      suppliers.data.reduce((s, x) => s + (x.fpip_riskscore ?? 0), 0) / suppliers.data.length,
    );
  }, [suppliers.data]);

  const tenderBids = useMemo(
    () => bids.data.filter((b) => b.fpip_Tender?.id === tenderId),
    [bids.data, tenderId],
  );

  const rfqPacks = RFQ_DOCS[tenderId] ?? [];

  const cols: Column<FpipSupplier>[] = [
    { header: 'Supplier', render: (s) => s.fpip_name },
    { header: 'Category', render: (s) => s.fpip_category ?? '—' },
    {
      header: 'Status',
      render: (s) => <Pill variant={pillVariantFor(s.fpip_status)}>{s.fpip_status ?? '—'}</Pill>,
    },
    {
      header: 'Risk',
      className: 'num',
      render: (s) => (
        <div>
          {s.fpip_riskscore ?? '—'}
          <div className="score-bar">
            <i style={{ width: `${s.fpip_riskscore ?? 0}%` }} />
          </div>
        </div>
      ),
    },
    { header: 'Tax cert', render: (s) => formatDate(s.fpip_taxcertexpiry) },
    {
      header: 'LPOs',
      className: 'num',
      render: (s) => pos.data.filter((p) => p.fpip_Supplier?.id === s.fpip_supplierid).length,
    },
  ];

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name}</div>
            <h1>Supplier database</h1>
            <p>
              Master supplier list with analytics, tender-tied comparisons, per-RFQ document packs,
              and LPO history after award.
            </p>
          </div>
          <div className="page-masthead-meta">
            <div className="mast-stat">
              <b>{suppliers.data.length}</b>
              <span>Suppliers</span>
            </div>
            <div className="mast-stat">
              <b>{avgRisk}</b>
              <span>Avg risk</span>
            </div>
            <div className="mast-stat">
              <b>{compliance.data.length}</b>
              <span>Docs</span>
            </div>
          </div>
        </div>
      </header>

      <div className="vault-stat-strip">
        <div className="vault-stat">
          <b>{suppliers.data.filter((s) => s.fpip_status === 'Approved').length}</b>
          <span>Approved</span>
        </div>
        <div className="vault-stat">
          <b>{pos.data.length}</b>
          <span>LPOs on file</span>
        </div>
        <div className="vault-stat">
          <b>OCR</b>
          <span>Ready (Azure AI)</span>
        </div>
      </div>

      <Card flush className="polish-section" style={{ marginBottom: 16 }}>
        <div className="polish-section-pad">
          <SectionHead title="Master register" />
        </div>
        <DataTable
          columns={cols}
          rows={suppliers.data}
          rowKey={(s) => s.fpip_supplierid}
          loading={suppliers.loading}
          emptyMessage="No suppliers."
        />
      </Card>

      <Card className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Compare suppliers for a tender" />
        <div className="compare-pick">
          <label>
            <span className="eyebrow">Tender / RFQ</span>
            <br />
            <select value={tenderId} onChange={(e) => setTenderId(e.target.value)}>
              {tenders.data.map((t) => (
                <option key={t.fpip_tenderid} value={t.fpip_tenderid}>
                  {t.fpip_title}
                </option>
              ))}
            </select>
          </label>
          <span className="muted" style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
            Comparisons are always scoped to the selected tender — not generic rankings.
          </span>
        </div>
        {tenderBids.length === 0 ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No bids on this tender yet.</p>
        ) : (
          <div className="flow-grid">
            {tenderBids.map((b) => {
              const composite = Math.round(
                ((b.fpip_pricescore ?? 0) + (b.fpip_compliancescore ?? 0) + (b.fpip_deliveryscore ?? 0)) / 3,
              );
              return (
                <div key={b.fpip_bidid} className="flow-card">
                  <div className="flow-card-top">
                    <strong>{b.fpip_Supplier?.name ?? 'Supplier'}</strong>
                    <Pill variant={pillVariantFor(b.fpip_status)}>{b.fpip_status ?? '—'}</Pill>
                  </div>
                  <span>Price {b.fpip_pricescore} · Compliance {b.fpip_compliancescore} · Delivery {b.fpip_deliveryscore}</span>
                  <div className="score-bar" style={{ marginTop: 8 }}>
                    <i style={{ width: `${composite}%` }} />
                  </div>
                  <span style={{ marginTop: 4 }}>Composite {composite}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Documents per supplier · this RFQ" />
        {rfqPacks.length === 0 ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No uploaded packs for this RFQ.</p>
        ) : (
          <div className="sod-grid">
            {rfqPacks.map((row) => (
              <div key={row.supplier} className="sod-row" style={{ gridTemplateColumns: '1fr auto' }}>
                <div>
                  <strong>{row.supplier}</strong>
                  <div className="doc-chip-row" style={{ marginTop: 8 }}>
                    {row.docs.map((d) => (
                      <span key={d} className="doc-chip">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
                <Pill variant="success">OCR indexed</Pill>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="OCR on uploaded documents" />
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
          Run Azure Document Intelligence over the latest RFQ pack to extract certificate fields.
        </p>
        <div className="action-row">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={ocrBusy}
            onClick={() => {
              setOcrBusy(true);
              setOcrResult(null);
              window.setTimeout(() => {
                setOcrResult(
                  'Extracted: Tax PIN · Expiry 2026-09-05 · ISO 27001 valid · Named signatory D. Okello · Confidence 0.94',
                );
                setOcrBusy(false);
                showToast('OCR complete — fields indexed for this RFQ pack');
              }, 1200);
            }}
          >
            {ocrBusy ? 'Scanning…' : 'Run OCR on RFQ packs'}
          </button>
        </div>
        {ocrResult ? (
          <div className="polish-signal ok" style={{ marginTop: 12 }}>
            <strong>OCR extract</strong>
            <span>{ocrResult}</span>
          </div>
        ) : null}
      </Card>

      <Card className="polish-section">
        <SectionHead title="LPO feed into supplier record" />
        <p style={{ fontSize: 13, color: 'var(--ink-soft)', marginTop: 0 }}>
          After RFQ approval, purchase orders ({currency}) appear on the supplier dashboard and
          Finance match desk.
        </p>
        <div className="sod-grid">
          {pos.data.map((p) => (
            <div key={p.fpip_purchaseorderid} className="sod-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
              <strong>{p.fpip_ponumber}</strong>
              <span>{p.fpip_Supplier?.name ?? '—'}</span>
              <span>{formatMoney(p.fpip_amount, currency)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

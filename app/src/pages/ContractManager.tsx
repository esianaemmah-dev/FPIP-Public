import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, SectionHead } from '@/components/Card';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { ExtractDetailPanel } from '@/components/ExtractDetail';
import { useContracts } from '@/api/useDataverse';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/context/ToastContext';
import { useNotifications } from '@/context/NotificationContext';
import { formatDate, formatMoney, daysUntil } from '@/lib/format';
import type { FpipContract } from '@/api/types';
import { extractContractFromFile, type ContractExtract } from '@/lib/documentAi';

export function ContractManager() {
  const contracts = useContracts();
  const navigate = useNavigate();
  const { entity, currency } = useTenant();
  const { showToast } = useToast();
  const { push, pushActivity } = useNotifications();
  const [busy, setBusy] = useState(false);
  const [extract, setExtract] = useState<ContractExtract | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const renewals = useMemo(
    () =>
      contracts.data.filter((c) => {
        const d = daysUntil(c.fpip_expiry_date);
        return d !== null && d >= 0 && d <= 90;
      }),
    [contracts.data],
  );

  async function onContractFile(file: File | null) {
    if (!file) return;
    setBusy(true);
    try {
      const result = await extractContractFromFile(file);
      setExtract(result);
      setFileName(file.name);
      pushActivity({
        actor: 'Contract Agent',
        action: 'Extracted contract terms',
        detail: `${result.title} · ${file.name} · ${Math.round(result.confidence * 100)}%`,
        href: '/contracts-mgr',
      });
      showToast(`Contract Agent extracted terms from “${file.name}”`);
    } catch {
      showToast('Could not read contract');
    } finally {
      setBusy(false);
    }
  }

  const cols: Column<FpipContract>[] = [
    { header: 'Contract', render: (c) => c.fpip_title },
    { header: 'Supplier', render: (c) => c.fpip_Supplier?.name ?? '—' },
    { header: 'Value', className: 'num', render: (c) => formatMoney(c.fpip_value, currency) },
    { header: 'Expiry', render: (c) => formatDate(c.fpip_expiry_date) },
    {
      header: 'Status',
      render: (c) => <Pill variant={pillVariantFor(c.fpip_status)}>{c.fpip_status ?? '—'}</Pill>,
    },
    {
      header: 'Action',
      render: (c) => (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            push({
              kind: 'tender',
              title: `Renewal → Studio · ${c.fpip_title}`,
              body: 'Contract Manager handed off to Tender Studio for re-tender.',
              href: `/procurement/studio?fromContract=${c.fpip_contractid}`,
            });
            pushActivity({
              actor: 'Contract Manager',
              action: 'Started renewal → Studio',
              detail: c.fpip_title,
              href: `/procurement/studio?fromContract=${c.fpip_contractid}`,
            });
            showToast('Opening Tender Studio with contract brief');
            navigate(`/procurement/studio?fromContract=${c.fpip_contractid}`);
          }}
        >
          Re-tender in Studio
        </button>
      ),
    },
  ];

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name} · Contract manager</div>
            <h1>Contract manager portal</h1>
            <p>
              Portfolio, detailed Contract Agent extracts, renewal windows, and hand-off to Tender Studio.
            </p>
          </div>
          <div className="page-masthead-meta">
            <div className="mast-stat">
              <b>{contracts.data.length}</b>
              <span>Active set</span>
            </div>
            <div className="mast-stat">
              <b>{renewals.length}</b>
              <span>≤90 days</span>
            </div>
          </div>
        </div>
      </header>

      <Card className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Contract Agent" />
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-soft)' }}>
          Upload an MSA / call-off. AI returns renewal, payment, escalation, obligations, and risk severity —
          then open Studio for re-tender.
        </p>
        <label className="studio-field" style={{ maxWidth: 420 }}>
          <span>Contract file</span>
          <input
            type="file"
            accept=".txt,.md,.pdf,.doc,.docx"
            disabled={busy}
            onChange={(e) => void onContractFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {extract ? (
          <div style={{ marginTop: 16 }}>
            <ExtractDetailPanel
              title={fileName ? `${extract.title} · ${fileName}` : extract.title}
              confidence={extract.confidence}
              source={extract.source}
              rows={[
                { label: 'Supplier', value: extract.supplierName },
                {
                  label: 'Contract value',
                  value: extract.value != null ? formatMoney(extract.value, currency) : '—',
                },
                { label: 'Start', value: extract.startDate ?? '—' },
                { label: 'Expiry', value: extract.expiryDate ?? '—' },
                { label: 'Term', value: extract.termMonths != null ? `${extract.termMonths} months` : '—' },
                { label: 'Notice', value: extract.noticePeriod ?? '—' },
                { label: 'Payment terms', value: extract.paymentTerms },
                { label: 'Escalation', value: extract.escalation },
                { label: 'Renewal', value: extract.renewalTerms },
                { label: 'Governing law', value: extract.governingLaw ?? '—' },
              ]}
            >
              <div className="extract-lines">
                <div className="extract-label">Risk flags</div>
                {extract.risks.map((r) => (
                  <div key={r.label} className="extract-line">
                    <span>{r.label}</span>
                    <Pill variant={r.severity === 'high' ? 'danger' : r.severity === 'medium' ? 'warn' : 'success'}>
                      {r.severity}
                    </Pill>
                  </div>
                ))}
              </div>
              <div className="extract-lines" style={{ marginTop: 10 }}>
                <div className="extract-label">Key obligations</div>
                {extract.obligations.map((o) => (
                  <div key={o} className="extract-line">
                    <span>{o}</span>
                  </div>
                ))}
              </div>
              <div className="action-row" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const q = new URLSearchParams({
                      fromContract: 'extract',
                      title: extract.title,
                      supplier: extract.supplierName,
                      value: String(extract.value ?? ''),
                    });
                    navigate(`/procurement/studio?${q.toString()}`);
                  }}
                >
                  Open in Tender Studio
                </button>
              </div>
            </ExtractDetailPanel>
          </div>
        ) : null}
      </Card>

      <Card flush className="polish-section">
        <div className="polish-section-pad">
          <SectionHead title="Contract portfolio" />
        </div>
        <DataTable
          columns={cols}
          rows={contracts.data}
          rowKey={(c) => c.fpip_contractid}
          loading={contracts.loading}
          emptyMessage="No contracts."
        />
      </Card>
    </div>
  );
}

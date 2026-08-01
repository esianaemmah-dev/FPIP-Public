import { useMemo } from 'react';
import { Card, SectionHead } from '@/components/Card';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { useToast } from '@/context/ToastContext';
import { useTenant } from '@/context/TenantContext';
import { useLocale } from '@/context/LocaleContext';
import { useComplianceDocuments, useContracts } from '@/api/useDataverse';
import { formatDate, daysUntil } from '@/lib/format';
import type { FpipComplianceDocument, FpipContract } from '@/api/types';

const RETENTION = [
  { label: 'Contracts & MSAs', years: 7, jurisdiction: 'UK / EU baseline' },
  { label: 'Tax & compliance certificates', years: 6, jurisdiction: 'Statutory' },
  { label: 'Tender packs & evaluation', years: 5, jurisdiction: 'Procurement policy' },
  { label: 'Audit & AI inspection logs', years: 10, jurisdiction: 'Banking regulator' },
];

export function DocumentVault() {
  const compliance = useComplianceDocuments();
  const contracts = useContracts();
  const { entity } = useTenant();
  const { t } = useLocale();
  const { showToast } = useToast();

  const renewalsDue = useMemo(
    () =>
      compliance.data.filter((d) => d.fpip_status === 'Expired' || d.fpip_status === 'Renewal Due')
        .length,
    [compliance.data],
  );

  const contractsNearExpiry = useMemo(
    () =>
      contracts.data.filter((c) => {
        const d = daysUntil(c.fpip_expiry_date);
        return d !== null && d >= 0 && d <= 90;
      }).length,
    [contracts.data],
  );

  const docCols: Column<FpipComplianceDocument>[] = [
    { header: 'Document', render: (d) => d.fpip_document_type ?? '—' },
    { header: 'Supplier', render: (d) => d.fpip_Supplier?.name ?? '—' },
    { header: 'Expiry', render: (d) => formatDate(d.fpip_expiry_date) },
    {
      header: 'Status',
      render: (d) => <Pill variant={pillVariantFor(d.fpip_status)}>{d.fpip_status ?? '—'}</Pill>,
    },
    {
      header: 'Store',
      render: (d) =>
        d.fpip_sharepoint_url ? (
          <a href={d.fpip_sharepoint_url} target="_blank" rel="noreferrer" className="vault-link">
            SharePoint
          </a>
        ) : (
          'FPIP vault'
        ),
    },
  ];

  const contractCols: Column<FpipContract>[] = [
    { header: 'Contract', render: (c) => c.fpip_title ?? '—' },
    { header: 'Supplier', render: (c) => c.fpip_Supplier?.name ?? '—' },
    { header: 'Expiry', render: (c) => formatDate(c.fpip_expiry_date) },
    {
      header: 'Status',
      render: (c) => <Pill variant={pillVariantFor(c.fpip_status)}>{c.fpip_status ?? '—'}</Pill>,
    },
  ];

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead" id="vault-all">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name}</div>
            <h1>{t('vault.title')}</h1>
            <p>{t('vault.sub')}</p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => showToast('Export queued — Purview-labelled archive for auditors')}
          >
            Export for audit
          </button>
        </div>
      </header>

      <div className="vault-stat-strip">
        <div className="vault-stat">
          <b>{compliance.data.length}</b>
          <span>Compliance docs</span>
        </div>
        <div className="vault-stat">
          <b>{contracts.data.length}</b>
          <span>Contracts</span>
        </div>
        <div className="vault-stat">
          <b>{renewalsDue + contractsNearExpiry}</b>
          <span>Need attention</span>
        </div>
      </div>

      <Card id="vault-compliance" flush className="polish-section" style={{ marginBottom: 16 }}>
        <div className="polish-section-pad">
          <SectionHead title="Compliance evidence" />
        </div>
        <DataTable
          columns={docCols}
          rows={compliance.data}
          rowKey={(d) => d.fpip_compliancedocumentid}
          loading={compliance.loading}
          emptyMessage="No compliance documents."
        />
      </Card>

      <Card id="vault-contracts" flush className="polish-section" style={{ marginBottom: 16 }}>
        <div className="polish-section-pad">
          <SectionHead title="Contracts repository" />
        </div>
        <DataTable
          columns={contractCols}
          rows={contracts.data}
          rowKey={(c) => c.fpip_contractid}
          loading={contracts.loading}
          emptyMessage="No contracts."
        />
      </Card>

      <Card id="vault-retention" className="polish-section">
        <SectionHead title="Retention & jurisdiction" />
        <div className="retention-grid">
          {RETENTION.map((r) => (
            <div key={r.label} className="retention-row">
              <div>
                <strong>{r.label}</strong>
                <div className="retention-meta">{r.jurisdiction}</div>
              </div>
              <span className="retention-years">{r.years} years</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

import { useState } from 'react';
import { Tabs } from '@/components/Tabs';
import { Card, SectionHead } from '@/components/Card';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { DashChat } from '@/components/DashChat';
import { useModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useNav } from '@/context/NavContext';
import { useNotifications } from '@/context/NotificationContext';
import {
  useInvoices,
  usePurchaseOrders,
  useSuppliers,
  createInvoice,
  autoMatchInvoiceToLpo,
} from '@/api/useDataverse';
import { formatCurrency } from '@/lib/format';
import type { FpipInvoice, FpipPurchaseOrder } from '@/api/types';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { useNavigate } from 'react-router-dom';
import { extractInvoiceFromFile, type InvoiceExtract } from '@/lib/documentAi';
import { ExtractDetailPanel, MatchRationale } from '@/components/ExtractDetail';

const PAYMENT_RUNS = [
  { id: 'pr1', name: 'Weekly AP — West', amount: 1284000, invoices: 42, status: 'Ready for release', window: 'Today 16:00' },
  { id: 'pr2', name: 'Supplier framework drawdown', amount: 640200, invoices: 11, status: 'Held — exception', window: 'Tomorrow' },
  { id: 'pr3', name: 'Facilities retainer', amount: 188000, invoices: 6, status: 'Scheduled', window: 'Fri' },
];

const BUDGETS = [
  { dept: 'Operations', used: 72, cap: 4200000 },
  { dept: 'Facilities', used: 91, cap: 1800000 },
  { dept: 'Finance', used: 54, cap: 2600000 },
  { dept: 'ICT', used: 88, cap: 5100000 },
  { dept: 'Logistics', used: 63, cap: 1500000 },
];

const FORECAST = [
  { week: 'This week', outflow: 1.42, inflow: 0.2, note: 'AP run + ERP retainer' },
  { week: 'W+1', outflow: 0.86, inflow: 0.15, note: 'Facilities call-offs' },
  { week: 'W+2', outflow: 2.1, inflow: 0.4, note: 'Possible tender award escrow' },
  { week: 'W+3', outflow: 0.55, inflow: 0.1, note: 'Steady state' },
];

export function Finance() {
  return (
    <>
      <div className="feature-strip">
        <div className="signal-card danger">
          <strong>3-way exceptions</strong>
          <span>Qty mismatch and duplicate flags waiting on Finance desk.</span>
        </div>
        <div className="signal-card warn">
          <strong>Payment holds</strong>
          <span>One run blocked until exception cleared.</span>
        </div>
        <div className="signal-card ok">
          <strong>Within SLA</strong>
          <span>92% of matched invoices paid inside 5 days.</span>
        </div>
        <div className="signal-card">
          <strong>Fabric feed</strong>
          <span>Payment confirmations mirrored from bank OneLake.</span>
        </div>
      </div>
      <Tabs
        group="finance"
        tabs={[
          { id: 'invoices', label: 'Exception desk' },
          { id: 'payments', label: 'Payment runs' },
          { id: 'budgets', label: 'Budgets' },
          { id: 'forecast', label: 'Cash forecast' },
        ]}
        defaultTab="invoices"
      />
      <FinanceBody />
    </>
  );
}

function FinanceBody() {
  const { currentTab } = useNav();
  const tab = currentTab('finance') || 'invoices';
  if (tab === 'payments') return <PaymentsTab />;
  if (tab === 'budgets') return <BudgetsTab />;
  if (tab === 'forecast') return <ForecastTab />;
  return <InvoicesTab />;
}

function InvoicesTab() {
  const invoices = useInvoices();
  const pos = usePurchaseOrders();
  const suppliers = useSuppliers();
  const { openModal, closeModal } = useModal();
  const { showToast } = useToast();
  const { push, pushActivity } = useNotifications();
  const { account } = useFpipAuth();
  const navigate = useNavigate();
  const [ocrBusy, setOcrBusy] = useState(false);
  const [lastOcr, setLastOcr] = useState<{
    fileName: string;
    extract: InvoiceExtract;
    matched: boolean;
    po?: FpipPurchaseOrder;
    invoiceNumber: string;
  } | null>(null);

  async function onInvoiceFile(file: File | null) {
    if (!file) return;
    setOcrBusy(true);
    try {
      const extracted = await extractInvoiceFromFile(file);
      const supplier =
        suppliers.data.find((s) =>
          s.fpip_name.toLowerCase().includes(extracted.supplierName.toLowerCase().split(' ')[0]!),
        ) ??
        suppliers.data.find((s) => s.fpip_name === extracted.supplierName) ??
        suppliers.data[1] ??
        suppliers.data[0];
      const poHint = extracted.poHint?.toLowerCase();
      const po =
        pos.data.find((p) => poHint && p.fpip_ponumber?.toLowerCase() === poHint) ??
        pos.data.find((p) => p.fpip_Supplier?.id === supplier?.fpip_supplierid);

      const created = await createInvoice({
        invoiceNumber: extracted.invoiceNumber,
        supplierId: supplier?.fpip_supplierid ?? 's2',
        supplierName: supplier?.fpip_name ?? extracted.supplierName,
        amount: extracted.amount,
        purchaseOrderId: po?.fpip_purchaseorderid,
        purchaseOrderNumber: po?.fpip_ponumber,
        matchStatus: 'Manual Review',
        paymentStatus: 'Held',
      });
      const match = await autoMatchInvoiceToLpo(created.fpip_invoiceid);
      setLastOcr({
        fileName: file.name,
        extract: extracted,
        matched: match.matched,
        po: match.po,
        invoiceNumber: created.fpip_invoicenumber ?? extracted.invoiceNumber,
      });
      push({
        kind: 'finance',
        title: match.matched
          ? `OCR matched · ${created.fpip_invoicenumber}`
          : `OCR needs review · ${created.fpip_invoicenumber}`,
        body: `${extracted.supplierName} · ${formatCurrency(extracted.amount)} → ${
          match.po?.fpip_ponumber ?? 'no LPO'
        }`,
        href: '/finance',
      });
      pushActivity({
        actor: 'Finance AI',
        action: match.matched ? 'OCR invoice auto-matched to LPO' : 'OCR invoice queued for review',
        detail: `${created.fpip_invoicenumber} · ${file.name}`,
        href: '/finance',
      });
      showToast(
        match.matched
          ? `${created.fpip_invoicenumber} auto-matched to ${match.po?.fpip_ponumber}`
          : `${created.fpip_invoicenumber} created — LPO match needs review`,
      );
      invoices.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Invoice OCR failed');
    } finally {
      setOcrBusy(false);
    }
  }

  function openInvoice(r: FpipInvoice) {
    const lpo = pos.data.find((p) => p.fpip_purchaseorderid === r.fpip_PurchaseOrder?.id)
      ?? pos.data.find((p) => p.fpip_Supplier?.id === r.fpip_Supplier?.id);
    const amountOk = lpo && r.fpip_amount != null && Math.abs((lpo.fpip_amount ?? 0) - r.fpip_amount) < 1;
    openModal({
      eyebrow: r.fpip_match_status ?? 'Invoice',
      title: r.fpip_invoicenumber ?? 'Invoice',
      body: (
        <>
          <div className="modal-kv">
            <div>
              <span className="k">Supplier</span>
              <span className="v">{r.fpip_Supplier?.name ?? '—'}</span>
            </div>
            <div>
              <span className="k">Invoice amount</span>
              <span className="v">{formatCurrency(r.fpip_amount)}</span>
            </div>
            <div>
              <span className="k">Linked LPO</span>
              <span className="v">{lpo?.fpip_ponumber ?? r.fpip_PurchaseOrder?.name ?? '—'}</span>
            </div>
            <div>
              <span className="k">LPO amount</span>
              <span className="v">{formatCurrency(lpo?.fpip_amount)}</span>
            </div>
            <div>
              <span className="k">Match</span>
              <span className="v">{r.fpip_match_status ?? '—'}</span>
            </div>
            <div>
              <span className="k">Payment</span>
              <span className="v">{r.fpip_payment_status ?? '—'}</span>
            </div>
          </div>
          <div className="lpo-match">
            <span>Invoice</span>
            <span className={amountOk ? 'match-ok' : 'match-bad'}>{amountOk ? 'LPO match' : 'LPO mismatch'}</span>
            <span>LPO / PO</span>
          </div>
          {r.fpip_duplicate_flag ? <Pill variant="danger">Possible duplicate</Pill> : null}
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                showToast('Exception cleared — invoice released to payment run');
                closeModal();
              }}
            >
              Clear exception
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                showToast('Held for supplier clarification');
                closeModal();
              }}
            >
              Hold & request credit
            </button>
          </div>
        </>
      ),
    });
  }

  const columns: Column<FpipInvoice>[] = [
    { header: 'Invoice', render: (r) => r.fpip_invoicenumber ?? '—' },
    { header: 'Supplier', render: (r) => r.fpip_Supplier?.name ?? '—' },
    {
      header: 'LPO',
      render: (r) =>
        r.fpip_PurchaseOrder?.name ??
        pos.data.find((p) => p.fpip_Supplier?.id === r.fpip_Supplier?.id)?.fpip_ponumber ??
        '—',
    },
    { header: 'PO match', render: (r) => <Pill variant={pillVariantFor(r.fpip_match_status)}>{r.fpip_match_status ?? '—'}</Pill> },
    {
      header: 'Flags',
      render: (r) =>
        r.fpip_duplicate_flag ? <Pill variant="danger">Possible duplicate</Pill> : <Pill variant="neutral">None</Pill>,
    },
    { header: 'Payment', render: (r) => <Pill variant={pillVariantFor(r.fpip_payment_status)}>{r.fpip_payment_status ?? '—'}</Pill> },
    { header: 'Amount', className: 'num', render: (r) => formatCurrency(r.fpip_amount) },
  ];

  return (
    <>
      <Card style={{ marginBottom: 16 }}>
        <SectionHead title="Invoice OCR → LPO match" />
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-soft)' }}>
          Upload a supplier invoice. AI extracts number, amount, and supplier, then auto-matches to the best
          LPO (Azure Document Intelligence stub — swap keys for production).
        </p>
        <div className="action-row" style={{ alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <label className="btn btn-primary btn-sm" style={{ cursor: ocrBusy ? 'wait' : 'pointer' }}>
            {ocrBusy ? 'Reading invoice…' : 'Upload invoice (OCR)'}
            <input
              type="file"
              accept=".txt,.md,.csv,.pdf,.doc,.docx"
              hidden
              disabled={ocrBusy}
              onChange={(e) => void onInvoiceFile(e.target.files?.[0] ?? null)}
            />
          </label>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/integrations')}>
            SharePoint / DI connectors
          </button>
        </div>
        {lastOcr ? (
          <div style={{ marginTop: 16 }}>
            <ExtractDetailPanel
              title={`${lastOcr.invoiceNumber} · ${lastOcr.fileName}`}
              confidence={lastOcr.extract.confidence}
              source={lastOcr.extract.source}
              rows={[
                { label: 'Supplier', value: lastOcr.extract.supplierName },
                {
                  label: 'Gross amount',
                  value: formatCurrency(lastOcr.extract.amount),
                  hint: lastOcr.extract.taxAmount != null ? `Tax ~ ${formatCurrency(lastOcr.extract.taxAmount)}` : undefined,
                },
                { label: 'Invoice date', value: lastOcr.extract.invoiceDate ?? '—' },
                { label: 'Due date', value: lastOcr.extract.dueDate ?? '—' },
                { label: 'PO / LPO hint', value: lastOcr.extract.poHint ?? '—' },
                { label: 'Line summary', value: lastOcr.extract.lineSummary },
              ]}
            >
              <div className="extract-lines">
                <div className="extract-label">OCR line items</div>
                {lastOcr.extract.lineItems.map((l, i) => (
                  <div key={i} className="extract-line">
                    <span>{l.description}</span>
                    <span>{l.amount != null ? formatCurrency(l.amount) : ''}</span>
                  </div>
                ))}
              </div>
              <MatchRationale
                matched={lastOcr.matched}
                checks={[
                  {
                    label: 'Supplier on LPO',
                    ok: !!lastOcr.po && lastOcr.po.fpip_Supplier?.name != null,
                    detail: lastOcr.po
                      ? `Linked ${lastOcr.po.fpip_ponumber} · ${lastOcr.po.fpip_Supplier?.name}`
                      : 'No LPO found for supplier / PO hint',
                  },
                  {
                    label: 'Amount within 2%',
                    ok: lastOcr.matched,
                    detail: lastOcr.po
                      ? `Invoice ${formatCurrency(lastOcr.extract.amount)} vs LPO ${formatCurrency(lastOcr.po.fpip_amount)}`
                      : 'Cannot compare without LPO',
                  },
                  {
                    label: 'Duplicate scan',
                    ok: true,
                    detail: 'No exact duplicate invoice number in current desk load',
                  },
                ]}
              />
            </ExtractDetailPanel>
          </div>
        ) : null}
      </Card>
      <SectionHead
        title="Invoice ↔ LPO matching"
        action={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => {
              showToast('SharePoint invoice folder watched — new files will create draft invoices');
              navigate('/integrations');
            }}
          >
            Automate via SharePoint
          </button>
        }
      />
      <Card style={{ marginBottom: 16 }}>
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-soft)' }}>
          Each invoice is matched against the Local Purchase Order (LPO). Mismatches and duplicates stay on this desk
          until Finance clears them.
        </p>
        {invoices.data.slice(0, 3).map((inv) => {
          const lpo =
            pos.data.find((p) => p.fpip_purchaseorderid === inv.fpip_PurchaseOrder?.id) ??
            pos.data.find((p) => p.fpip_Supplier?.id === inv.fpip_Supplier?.id);
          const ok =
            lpo &&
            inv.fpip_amount != null &&
            Math.abs((lpo.fpip_amount ?? 0) - inv.fpip_amount) < 1 &&
            inv.fpip_match_status === '3-Way Match';
          return (
            <div key={inv.fpip_invoiceid} className="lpo-match">
              <div>
                <strong>{inv.fpip_invoicenumber}</strong>
                <div className="retention-meta">{formatCurrency(inv.fpip_amount)}</div>
              </div>
              <span className={ok ? 'match-ok' : 'match-bad'}>{ok ? 'Matched to LPO' : 'Review vs LPO'}</span>
              <div style={{ textAlign: 'right' }}>
                <strong>{lpo?.fpip_ponumber ?? 'No LPO'}</strong>
                <div className="retention-meta">{formatCurrency(lpo?.fpip_amount)}</div>
              </div>
            </div>
          );
        })}
      </Card>
      <Card flush className="ledger-bg" style={{ marginBottom: 16 }}>
        <DataTable
          columns={columns}
          rows={invoices.data}
          rowKey={(r) => r.fpip_invoiceid}
          loading={invoices.loading}
          emptyMessage="No invoices."
          onRowClick={openInvoice}
        />
      </Card>
      <DashChat
        suggestions={[
          'How much did we spend with Kestrel last quarter?',
          'Which invoices are held for LPO mismatch?',
          'Find POs stuck pending approval over $50k',
        ]}
        agentId="finance"
        userContext={{ username: account?.username ?? 'finance-user', role: 'internal' }}
        height={260}
      />
    </>
  );
}

function PaymentsTab() {
  const { showToast } = useToast();
  return (
    <Card>
      <SectionHead title="Payment approval queue" />
      <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6, marginTop: 0 }}>
        Runs are staged from matched invoices and confirmed against Fabric payment events from the bank OneLake.
      </p>
      <div className="pipeline" style={{ marginTop: 16 }}>
        {PAYMENT_RUNS.map((r) => (
          <div key={r.id} className="pipeline-stage" style={{ gridColumn: 'span 1' }}>
            <small>{r.window}</small>
            <b style={{ fontSize: 16 }}>{r.name}</b>
            <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 8 }}>
              {formatCurrency(r.amount)} · {r.invoices} invoices
            </div>
            <Pill variant={pillVariantFor(r.status)}>{r.status}</Pill>
            <div className="action-row">
              <button type="button" className="btn btn-primary btn-sm" onClick={() => showToast(`Released ${r.name}`)}>
                Release
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast('Run split for review')}>
                Split
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function BudgetsTab() {
  return (
    <Card>
      <SectionHead title="Budget utilization by department" />
      <p style={{ color: 'var(--ink-soft)', lineHeight: 1.6 }}>
        Live envelopes are read from Fabric analytics; figures below are the operating snapshot used for procurement
        gates.
      </p>
      <div style={{ marginTop: 18 }}>
        {BUDGETS.map((b) => (
          <div key={b.dept} className="budget-row">
            <span>{b.dept}</span>
            <div className="budget-track">
              <div className={`budget-fill${b.used > 90 ? ' over' : ''}`} style={{ width: `${b.used}%` }} />
            </div>
            <strong>
              {b.used}% · {formatCurrency(b.cap)}
            </strong>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ForecastTab() {
  return (
    <Card>
      <SectionHead title="4-week cash outflow foresight" />
      <div className="pipeline" style={{ marginTop: 8 }}>
        {FORECAST.map((f) => (
          <div key={f.week} className="pipeline-stage">
            <small>{f.week}</small>
            <b>${f.outflow.toFixed(2)}M</b>
            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{f.note}</div>
            <div style={{ fontSize: 11, color: 'var(--teal)', marginTop: 6 }}>Inflows ~${f.inflow}M</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

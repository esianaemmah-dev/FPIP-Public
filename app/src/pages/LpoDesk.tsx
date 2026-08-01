import { useMemo, useState } from 'react';
import { Card, SectionHead } from '@/components/Card';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { usePurchaseOrders, useSuppliers, updatePurchaseOrderStatus } from '@/api/useDataverse';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/context/ToastContext';
import { useNotifications } from '@/context/NotificationContext';
import { formatMoney } from '@/lib/format';
import type { FpipPurchaseOrder } from '@/api/types';

const LPO_STEPS = ['Draft', 'Pending Approval', 'Approved', 'Issued', 'Delivered', 'Closed'];

export function LpoDesk() {
  const pos = usePurchaseOrders();
  const suppliers = useSuppliers();
  const { entity, currency } = useTenant();
  const { showToast } = useToast();
  const { push, pushActivity } = useNotifications();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<Record<string, string>>({});

  const rows = useMemo(
    () =>
      pos.data.map((p) => ({
        ...p,
        fpip_status: (localStatus[p.fpip_purchaseorderid] ?? p.fpip_status) as FpipPurchaseOrder['fpip_status'],
      })),
    [pos.data, localStatus],
  );

  const selected = rows.find((r) => r.fpip_purchaseorderid === (selectedId ?? rows[0]?.fpip_purchaseorderid));
  const supplier = suppliers.data.find((s) => s.fpip_supplierid === selected?.fpip_Supplier?.id);

  async function advance(po: FpipPurchaseOrder) {
    const cur = localStatus[po.fpip_purchaseorderid] ?? po.fpip_status ?? 'Draft';
    const idx = LPO_STEPS.indexOf(cur);
    const next = LPO_STEPS[Math.min(idx + 1, LPO_STEPS.length - 1)] ?? 'Approved';
    setLocalStatus((m) => ({ ...m, [po.fpip_purchaseorderid]: next }));
    try {
      await updatePurchaseOrderStatus(po.fpip_purchaseorderid, next);
      pos.refresh();
    } catch {
      /* local status still advances for UX */
    }
    pushActivity({
      actor: 'Procurement',
      action: `LPO → ${next}`,
      detail: `${po.fpip_ponumber} · ${po.fpip_Supplier?.name ?? ''}`,
      href: '/lpo',
    });
    if (next === 'Issued' || next === 'Approved') {
      push({
        kind: 'finance',
        title: `LPO ${po.fpip_ponumber} ready for Finance match`,
        body: `${po.fpip_Supplier?.name ?? 'Supplier'} · ${formatMoney(po.fpip_amount, currency)}`,
        href: '/finance',
      });
    }
    showToast(`${po.fpip_ponumber} moved to ${next}`);
  }

  function printLpo() {
    if (!selected) return;
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
      showToast('Allow pop-ups to print the bank LPO');
      return;
    }
    w.document.write(`<!doctype html><html><head><title>${selected.fpip_ponumber}</title>
<style>
  body{font-family:Georgia,serif;padding:40px;color:#111}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#555;font-size:13px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th,td{border:1px solid #ccc;padding:10px;text-align:left;font-size:13px}
  .head{display:flex;justify-content:space-between;border-bottom:2px solid #232e52;padding-bottom:12px}
  .stamp{margin-top:40px;font-size:12px;color:#666}
</style></head><body>
<div class="head">
  <div>
    <h1>LOCAL PURCHASE ORDER</h1>
    <div class="sub">${entity.name} · Local Purchase Order</div>
  </div>
  <div style="text-align:right">
    <strong>${selected.fpip_ponumber}</strong><br/>
    Status: ${selected.fpip_status ?? '—'}
  </div>
</div>
<p><strong>Supplier:</strong> ${selected.fpip_Supplier?.name ?? '—'}<br/>
<strong>Requisition:</strong> ${selected.fpip_Requisition?.name ?? '—'}<br/>
<strong>Amount:</strong> ${formatMoney(selected.fpip_amount, currency)}</p>
<table>
  <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Amount</th></tr></thead>
  <tbody>
    <tr><td>1</td><td>${selected.fpip_Requisition?.name ?? 'Goods / services per award'}</td><td>1</td><td>Lot</td><td>${formatMoney(selected.fpip_amount, currency)}</td></tr>
  </tbody>
</table>
<p class="stamp">Generated from FPIP · ${new Date().toLocaleString()} · Not a live bank printout — template for HFB LPO alignment.</p>
<script>window.print()</script>
</body></html>`);
    w.document.close();
  }

  const cols: Column<FpipPurchaseOrder>[] = [
    { header: 'LPO / PO', render: (r) => r.fpip_ponumber ?? '—' },
    { header: 'Supplier', render: (r) => r.fpip_Supplier?.name ?? '—' },
    { header: 'Requisition', render: (r) => r.fpip_Requisition?.name ?? '—' },
    { header: 'Amount', className: 'num', render: (r) => formatMoney(r.fpip_amount, currency) },
    {
      header: 'Status',
      render: (r) => <Pill variant={pillVariantFor(r.fpip_status)}>{r.fpip_status ?? '—'}</Pill>,
    },
    {
      header: 'Action',
      render: (r) => (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => void advance(r)}>
          Advance
        </button>
      ),
    },
  ];

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name} · LPO</div>
            <h1>Local Purchase Orders</h1>
            <p>
              LPO lifecycle after RFQ award — draft through delivery — with an in-system bank LPO print
              template for review.
            </p>
          </div>
          <div className="page-masthead-meta">
            <div className="mast-stat">
              <b>{rows.length}</b>
              <span>LPOs</span>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={printLpo} disabled={!selected}>
              Print bank LPO
            </button>
          </div>
        </div>
      </header>

      <div className="process-steps">
        {LPO_STEPS.map((s, i) => (
          <div key={s} className="process-step">
            <div className="step-num">0{i + 1}</div>
            <strong>{s}</strong>
            <p>{i === 0 ? 'Created from award' : i === LPO_STEPS.length - 1 ? 'Archived to supplier DB' : 'Human gate'}</p>
          </div>
        ))}
      </div>

      <Card flush className="polish-section" style={{ marginBottom: 16 }}>
        <div className="polish-section-pad">
          <SectionHead title="LPO register" />
        </div>
        <DataTable
          columns={cols}
          rows={rows}
          rowKey={(r) => r.fpip_purchaseorderid}
          loading={pos.loading}
          emptyMessage="No purchase orders / LPOs."
          onRowClick={(r) => setSelectedId(r.fpip_purchaseorderid)}
        />
      </Card>

      {selected ? (
        <Card className="polish-section">
          <SectionHead title={`Selected · ${selected.fpip_ponumber}`} />
          <div className="bank-form-grid">
            <label>
              Supplier
              <input readOnly value={selected.fpip_Supplier?.name ?? ''} />
            </label>
            <label>
              Risk score
              <input readOnly value={String(supplier?.fpip_riskscore ?? '—')} />
            </label>
            <label>
              Amount ({currency})
              <input readOnly value={formatMoney(selected.fpip_amount, currency)} />
            </label>
            <label>
              Status
              <input readOnly value={String(selected.fpip_status ?? '')} />
            </label>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--ink-faint)', marginTop: 14 }}>
            Align this printout with the bank LPO shared in Teams (HFB-BID / New Vision pack) before go-live.
          </p>
        </Card>
      ) : null}
    </div>
  );
}

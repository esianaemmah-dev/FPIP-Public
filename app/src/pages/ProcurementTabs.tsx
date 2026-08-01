import { useNavigate } from 'react-router-dom';
import { Card, SectionHead } from '@/components/Card';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { BarRow } from '@/components/BarRow';
import { AiPanel } from '@/components/AiPanel';
import { Icon } from '@/components/Icons';
import { useModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useNav } from '@/context/NavContext';
import { useNotifications } from '@/context/NotificationContext';
import { useTenders, useBids, useContracts, useAwardBid } from '@/api/useDataverse';
import { formatCurrency, formatDate, daysUntil } from '@/lib/format';
import type { FpipTender, FpipContract, FpipBid } from '@/api/types';

function scoreTone(v: number): 'success' | 'warn' | 'danger' {
  if (v >= 85) return 'success';
  if (v >= 70) return 'warn';
  return 'danger';
}

export function TendersTab() {
  const navigate = useNavigate();
  const tenders = useTenders();
  const bids = useBids();
  const { selectAgent } = useNav();
  const { openModal, closeModal } = useModal();
  const { showToast } = useToast();
  const { push, pushActivity } = useNotifications();
  const { submit: award, submitting: awarding } = useAwardBid();

  const evalTender = tenders.data.find((t) => t.fpip_status === 'Evaluation') ?? tenders.data[0];
  const evalBids = evalTender ? bids.data.filter((b) => b.fpip_Tender?.id === evalTender.fpip_tenderid) : [];

  async function prepareAward(t: FpipTender) {
    const tenderBids = bids.data.filter((b) => b.fpip_Tender?.id === t.fpip_tenderid);
    const winner =
      tenderBids.slice().sort((a, b) => {
        const sa = (a.fpip_pricescore ?? 0) + (a.fpip_compliancescore ?? 0) + (a.fpip_deliveryscore ?? 0);
        const sb = (b.fpip_pricescore ?? 0) + (b.fpip_compliancescore ?? 0) + (b.fpip_deliveryscore ?? 0);
        return sb - sa;
      })[0];
    if (!winner) {
      showToast('No bids to award — wait for supplier responses');
      return;
    }
    try {
      const result = await award({ tenderId: t.fpip_tenderid, bidId: winner.fpip_bidid });
      push({
        kind: 'tender',
        title: `Awarded · ${t.fpip_title}`,
        body: `Winner ${winner.fpip_Supplier?.name} · LPO ${result.po.fpip_ponumber} created`,
        href: '/lpo',
      });
      pushActivity({
        actor: 'Procurement Committee',
        action: 'Awarded tender → LPO',
        detail: `${t.fpip_title} → ${result.po.fpip_ponumber}`,
        href: '/lpo',
      });
      showToast(`Awarded to ${winner.fpip_Supplier?.name} — ${result.po.fpip_ponumber} on LPO desk`);
      tenders.refresh();
      bids.refresh();
      closeModal();
      navigate('/lpo');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Award failed');
    }
  }

  function openTender(t: FpipTender) {
    openModal({
      eyebrow: t.fpip_status ?? 'Tender',
      title: t.fpip_title,
      body: (
        <>
          <div className="modal-kv">
            <div>
              <span className="k">Category</span>
              <span className="v">{t.fpip_category ?? '—'}</span>
            </div>
            <div>
              <span className="k">Closes</span>
              <span className="v">{formatDate(t.fpip_closingdate)}</span>
            </div>
            <div>
              <span className="k">Est. value</span>
              <span className="v">{formatCurrency(t.fpip_estimatedvalue)}</span>
            </div>
            <div>
              <span className="k">Bids</span>
              <span className="v">{bids.data.filter((b) => b.fpip_Tender?.id === t.fpip_tenderid).length}</span>
            </div>
            <div>
              <span className="k">Green light</span>
              <span className="v">
                {t.fpip_green_light === false ? 'Required' : t.fpip_green_light ? 'Granted' : 'N/A (legacy)'}
              </span>
            </div>
          </div>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                closeModal();
                navigate('/procurement/studio');
              }}
            >
              Duplicate in Studio
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                showToast('Clarification notice queued to invitees');
                closeModal();
              }}
            >
              Send clarification
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={awarding || t.fpip_status === 'Awarded'}
              onClick={() => void prepareAward(t)}
            >
              {awarding ? 'Awarding…' : 'Prepare award → LPO'}
            </button>
          </div>
        </>
      ),
    });
  }

  const columns: Column<FpipTender>[] = [
    { header: 'Tender', render: (t) => t.fpip_title },
    { header: 'Category', render: (t) => t.fpip_category ?? '—' },
    { header: 'Closes', render: (t) => formatDate(t.fpip_closingdate) },
    { header: 'Est. value', className: 'num', render: (t) => formatCurrency(t.fpip_estimatedvalue) },
    { header: 'Status', render: (t) => <Pill variant={pillVariantFor(t.fpip_status)}>{t.fpip_status ?? '—'}</Pill> },
  ];

  return (
    <>
      <SectionHead
        title="Tenders"
        action={
          <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/procurement/studio')}>
            <Icon name="sparkles" size={14} /> Open Tender Studio
          </button>
        }
      />
      <Card flush style={{ marginBottom: 16 }}>
        <DataTable
          columns={columns}
          rows={tenders.data}
          rowKey={(t) => t.fpip_tenderid}
          loading={tenders.loading}
          emptyMessage="No tenders."
          onRowClick={openTender}
        />
      </Card>

      {evalTender ? (
        <Card>
          <SectionHead title={`Bid evaluation — ${evalTender.fpip_title}`} />
          <div className="grid g-3">
            {evalBids.map((b: FpipBid) => (
              <div key={b.fpip_bidid}>
                <h3 style={{ fontSize: 15 }}>{b.fpip_Supplier?.name ?? 'Supplier'}</h3>
                <BarRow label="Price score" value={b.fpip_pricescore ?? 0} tone={scoreTone(b.fpip_pricescore ?? 0)} />
                <BarRow label="Compliance" value={b.fpip_compliancescore ?? 0} tone={scoreTone(b.fpip_compliancescore ?? 0)} />
                <BarRow label="Delivery rating" value={b.fpip_deliveryscore ?? 0} tone={scoreTone(b.fpip_deliveryscore ?? 0)} />
                <div className="action-row">
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => showToast(`Shortlisted ${b.fpip_Supplier?.name ?? 'supplier'} for committee`)}
                  >
                    Shortlist
                  </button>
                </div>
              </div>
            ))}
            {evalBids.length === 0 ? <p style={{ color: 'var(--ink-faint)' }}>No bids submitted for this tender.</p> : null}
          </div>
          <AiPanel tag="FPIP Assistant" icon="robot">
            <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-soft)' }}>
              Ask for a side-by-side award recommendation. The assistant never awards — committee sign-off stays human.
            </p>
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: 'var(--teal-tint)', color: 'var(--teal)', marginTop: 14 }}
              onClick={() => selectAgent()}
            >
              Ask FPIP Assistant →
            </button>
          </AiPanel>
        </Card>
      ) : null}
    </>
  );
}

export function BidsTab() {
  const bids = useBids();
  const { showToast } = useToast();
  const columns: Column<FpipBid>[] = [
    { header: 'Tender', render: (b) => b.fpip_Tender?.name ?? '—' },
    { header: 'Supplier', render: (b) => b.fpip_Supplier?.name ?? '—' },
    { header: 'Price', className: 'num', render: (b) => b.fpip_pricescore ?? '—' },
    { header: 'Compliance', className: 'num', render: (b) => b.fpip_compliancescore ?? '—' },
    { header: 'Delivery', className: 'num', render: (b) => b.fpip_deliveryscore ?? '—' },
    { header: 'Status', render: (b) => <Pill variant={pillVariantFor(b.fpip_status)}>{b.fpip_status ?? '—'}</Pill> },
  ];
  return (
    <>
      <SectionHead
        title="Bid board"
        action={
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => showToast('Comparative scorecard exported')}>
            Export scorecard
          </button>
        }
      />
      <Card flush>
        <DataTable columns={columns} rows={bids.data} rowKey={(b) => b.fpip_bidid} loading={bids.loading} emptyMessage="No bids yet." />
      </Card>
    </>
  );
}

export function ContractsTab() {
  const contracts = useContracts();
  const { showToast } = useToast();
  const { openModal, closeModal } = useModal();

  function openContract(c: FpipContract) {
    const d = daysUntil(c.fpip_expiry_date);
    openModal({
      eyebrow: 'Contract',
      title: c.fpip_title,
      body: (
        <>
          <div className="modal-kv">
            <div>
              <span className="k">Supplier</span>
              <span className="v">{c.fpip_Supplier?.name ?? '—'}</span>
            </div>
            <div>
              <span className="k">Value</span>
              <span className="v">{formatCurrency(c.fpip_value)}</span>
            </div>
            <div>
              <span className="k">Term</span>
              <span className="v">{c.fpip_term_months ? `${c.fpip_term_months} mo` : '—'}</span>
            </div>
            <div>
              <span className="k">Expiry</span>
              <span className="v">
                {formatDate(c.fpip_expiry_date)} {d !== null && d <= 90 ? <Pill variant="warn">{d}d</Pill> : null}
              </span>
            </div>
          </div>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                showToast('Renewal approval request created');
                closeModal();
              }}
            >
              Start renewal approval
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                showToast('Amendment workspace opened');
                closeModal();
              }}
            >
              Draft amendment
            </button>
          </div>
        </>
      ),
    });
  }

  const columns: Column<FpipContract>[] = [
    { header: 'Contract', render: (c) => c.fpip_title },
    { header: 'Supplier', render: (c) => c.fpip_Supplier?.name ?? '—' },
    { header: 'Value', className: 'num', render: (c) => formatCurrency(c.fpip_value) },
    { header: 'Term', render: (c) => (c.fpip_term_months ? `${c.fpip_term_months} mo` : '—') },
    {
      header: 'Expiry',
      render: (c) => {
        const d = daysUntil(c.fpip_expiry_date);
        const soon = d !== null && d >= 0 && d <= 90;
        return (
          <span>
            {formatDate(c.fpip_expiry_date)} {soon ? <Pill variant="warn">Renewal due</Pill> : null}
          </span>
        );
      },
    },
  ];

  return (
    <>
      <SectionHead title="Contracts" />
      <Card flush>
        <DataTable
          columns={columns}
          rows={contracts.data}
          rowKey={(c) => c.fpip_contractid}
          loading={contracts.loading}
          emptyMessage="No contracts."
          onRowClick={openContract}
        />
      </Card>
    </>
  );
}

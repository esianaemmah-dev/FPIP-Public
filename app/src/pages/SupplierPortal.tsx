import { useMemo, useState, type FormEvent } from 'react';
import { Card, SectionHead } from '@/components/Card';
import { KpiCard } from '@/components/KpiCard';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { Icon } from '@/components/Icons';
import { ComplianceDocForm } from '@/components/forms';
import { DashChat } from '@/components/DashChat';
import { useModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useNotifications } from '@/context/NotificationContext';
import { useFpipAuth } from '@/auth/useFpipAuth';
import { useSuppliers, useTenders, useInvoices, useComplianceDocuments, useCreateBid } from '@/api/useDataverse';
import { formatCurrency, formatDate } from '@/lib/format';
import type { FpipTender, FpipInvoice, FpipComplianceDocument } from '@/api/types';
import { listTenderQa, postTenderQa } from '@/lib/tenderQa';

const SUPPLIER_ID = 's2';

export function SupplierPortal() {
  const suppliers = useSuppliers();
  const tenders = useTenders();
  const invoices = useInvoices();
  const compliance = useComplianceDocuments();
  const { submit: submitBidApi, submitting } = useCreateBid();
  const { openModal, closeModal } = useModal();
  const { showToast } = useToast();
  const { push, pushActivity } = useNotifications();
  const { account } = useFpipAuth();

  const [bidTenderId, setBidTenderId] = useState('');
  const [bidPrice, setBidPrice] = useState('');
  const [bidNotes, setBidNotes] = useState('');
  const [qaTenderId, setQaTenderId] = useState('');
  const [qaBody, setQaBody] = useState('');
  const [qaTick, setQaTick] = useState(0);
  const qaThread = useMemo(
    () => (qaTenderId ? listTenderQa(qaTenderId) : []),
    [qaTenderId, qaTick],
  );

  const userContext = {
    username: account?.username ?? account?.name ?? 'supplier-user',
    role: 'supplier' as const,
    supplier_id: SUPPLIER_ID,
  };

  const me = suppliers.data.find((s) => s.fpip_supplierid === SUPPLIER_ID) ?? suppliers.data[0];
  const invitations = tenders.data.filter((t) => t.fpip_status === 'Open' || t.fpip_status === 'Evaluation');
  const myInvoices = invoices.data.filter((i) => i.fpip_Supplier?.id === SUPPLIER_ID);
  const myDocs = compliance.data.filter((c) => c.fpip_Supplier?.id === SUPPLIER_ID);
  const outstanding = myInvoices.filter((i) => i.fpip_payment_status === 'Held').reduce((s, i) => s + (i.fpip_amount ?? 0), 0);
  const health = myDocs.some((d) => d.fpip_status === 'Expired')
    ? 'At risk'
    : myDocs.some((d) => d.fpip_status === 'Renewal Due')
      ? 'Attention'
      : 'Good';

  function openNewDocument() {
    openModal({
      eyebrow: 'Compliance Document',
      title: 'Submit new document',
      body: (
        <ComplianceDocForm
          supplierId={SUPPLIER_ID}
          onDone={() => {
            closeModal();
            showToast('Document submitted — pending verification');
            compliance.refresh();
          }}
          onCancel={closeModal}
        />
      ),
    });
  }

  async function submitBid(e: FormEvent) {
    e.preventDefault();
    const tender = invitations.find((t) => t.fpip_tenderid === bidTenderId);
    if (!tender || !bidPrice) {
      showToast('Select a tender and enter a commercial offer');
      return;
    }
    try {
      await submitBidApi({
        tenderId: tender.fpip_tenderid,
        tenderTitle: tender.fpip_title,
        supplierId: me?.fpip_supplierid ?? SUPPLIER_ID,
        supplierName: me?.fpip_name ?? 'Supplier',
        offerAmount: Number(bidPrice),
        notes: bidNotes,
      });
      push({
        kind: 'tender',
        title: `Bid received · ${tender.fpip_title}`,
        body: `${me?.fpip_name ?? 'Supplier'} offered $${Number(bidPrice).toLocaleString()}`,
        href: '/procurement',
      });
      pushActivity({
        actor: me?.fpip_name ?? 'Supplier',
        action: 'Submitted bid',
        detail: `${tender.fpip_title} · $${Number(bidPrice).toLocaleString()}`,
        href: '/procurement',
      });
      showToast(`Bid submitted on ${tender.fpip_title} — visible on bid board`);
      setBidPrice('');
      setBidNotes('');
      tenders.refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Bid submit failed');
    }
  }

  const tenderCols: Column<FpipTender>[] = [
    { header: 'Tender', render: (t) => t.fpip_title },
    { header: 'Category', render: (t) => t.fpip_category ?? '—' },
    { header: 'Closes', render: (t) => formatDate(t.fpip_closingdate) },
    { header: 'Est. value', className: 'num', render: (t) => formatCurrency(t.fpip_estimatedvalue) },
    { header: 'Status', render: (t) => <Pill variant={pillVariantFor(t.fpip_status)}>{t.fpip_status ?? '—'}</Pill> },
  ];
  const invoiceCols: Column<FpipInvoice>[] = [
    { header: 'Invoice', render: (i) => i.fpip_invoicenumber ?? '—' },
    { header: 'PO', render: (i) => i.fpip_PurchaseOrder?.name ?? '—' },
    { header: 'Status', render: (i) => <Pill variant={pillVariantFor(i.fpip_payment_status)}>{i.fpip_payment_status ?? '—'}</Pill> },
    { header: 'Amount', className: 'num', render: (i) => formatCurrency(i.fpip_amount) },
  ];
  const docCols: Column<FpipComplianceDocument>[] = [
    { header: 'Document', render: (d) => d.fpip_document_type ?? '—' },
    { header: 'Expiry', render: (d) => formatDate(d.fpip_expiry_date) },
    { header: 'Status', render: (d) => <Pill variant={pillVariantFor(d.fpip_status)}>{d.fpip_status ?? '—'}</Pill> },
  ];

  return (
    <>
      <div className="supplier-hero" id="supplier-hero-anchor">
        <div className="supplier-hero-left">
          <div className="supplier-badge">{me?.fpip_name?.charAt(0) ?? 'K'}</div>
          <div>
            <div style={{ fontFamily: "'Fraunces',serif", fontSize: 19, fontWeight: 600 }}>{me?.fpip_name ?? 'Supplier'}</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink-faint)' }}>
              Supplier ID {me?.fpip_supplierid ?? '—'} · {me?.fpip_category ?? '—'} · Risk score {me?.fpip_riskscore ?? '—'}
            </div>
          </div>
        </div>
        <div className="isolation-note">
          <Icon name="lock" size={15} /> Isolated portal — you only see your own records
        </div>
      </div>

      <div className="feature-strip">
        <div className="signal-card ok">
          <strong>Invitations live</strong>
          <span>{invitations.length} open competitions you can respond to.</span>
        </div>
        <div className="signal-card warn">
          <strong>Payments held</strong>
          <span>{formatCurrency(outstanding)} waiting on match clearance.</span>
        </div>
        <div className="signal-card">
          <strong>Tax certificate</strong>
          <span>Expires {formatDate(me?.fpip_taxcertexpiry)} — renew early.</span>
        </div>
        <div className="signal-card">
          <strong>Bid studio</strong>
          <span>Price, attach narrative, submit without leaving the portal.</span>
        </div>
      </div>

      <div className="grid g-4" style={{ marginBottom: 16 }}>
        <KpiCard label="Application status" value={me?.fpip_status ?? '—'} delta={me?.fpip_category ?? ''} deltaTone="flat" />
        <KpiCard label="Open invitations" value={invitations.length} delta="Ready to bid" deltaTone="flat" />
        <KpiCard label="Outstanding invoices" value={formatCurrency(outstanding, { compact: true })} delta="Held for review" deltaTone={outstanding > 0 ? 'down' : 'flat'} />
        <KpiCard label="Compliance health" value={health} delta={`${myDocs.length} documents`} deltaTone={health === 'Good' ? 'flat' : 'down'} />
      </div>

      <div className="grid g-2">
        <Card id="card-supplier-tenders">
          <SectionHead title="My tender invitations" />
          <DataTable
            columns={tenderCols}
            rows={invitations}
            rowKey={(t) => t.fpip_tenderid}
            loading={tenders.loading}
            emptyMessage="No invitations."
            onRowClick={(t) => {
              setBidTenderId(t.fpip_tenderid);
              document.getElementById('card-bid-studio')?.scrollIntoView({ behavior: 'smooth' });
            }}
          />
        </Card>
        <Card id="card-supplier-invoices">
          <SectionHead title="My invoices & payments" />
          <DataTable columns={invoiceCols} rows={myInvoices} rowKey={(i) => i.fpip_invoiceid} loading={invoices.loading} emptyMessage="No invoices." />
        </Card>
      </div>

      <Card style={{ marginTop: 16 }}>
        <SectionHead title="Clarification Q&A" />
        <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ink-soft)' }}>
          Ask Procurement about an open invitation before you bid — answers stay on the tender thread.
        </p>
        <div className="studio-row">
          <label className="studio-field">
            <span>Tender</span>
            <select
              value={qaTenderId}
              onChange={(e) => {
                setQaTenderId(e.target.value);
                setQaTick((n) => n + 1);
              }}
            >
              <option value="">Select invitation…</option>
              {invitations.map((t) => (
                <option key={t.fpip_tenderid} value={t.fpip_tenderid}>
                  {t.fpip_title}
                </option>
              ))}
            </select>
          </label>
        </div>
        {qaTenderId ? (
          <>
            <div className="sod-grid" style={{ marginBottom: 12 }}>
              {qaThread.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-faint)' }}>No questions yet.</p>
              ) : (
                qaThread.map((m) => (
                  <div key={m.id} className="sod-row" style={{ gridTemplateColumns: '120px 1fr' }}>
                    <strong>{m.role === 'supplier' ? 'You' : 'Procurement'}</strong>
                    <span>{m.body}</span>
                  </div>
                ))
              )}
            </div>
            <label className="studio-field">
              <span>Your question</span>
              <textarea rows={2} value={qaBody} onChange={(e) => setQaBody(e.target.value)} />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => {
                if (!qaBody.trim()) return;
                postTenderQa({
                  tenderId: qaTenderId,
                  author: me?.fpip_name ?? 'Supplier',
                  role: 'supplier',
                  body: qaBody.trim(),
                });
                // Demo auto-reply from procurement
                postTenderQa({
                  tenderId: qaTenderId,
                  author: 'Procurement',
                  role: 'procurement',
                  body: 'Noted — clarification will be issued to all invitees within 2 business days (demo reply).',
                });
                setQaBody('');
                setQaTick((n) => n + 1);
                pushActivity({
                  actor: me?.fpip_name ?? 'Supplier',
                  action: 'Posted tender clarification',
                  detail: invitations.find((t) => t.fpip_tenderid === qaTenderId)?.fpip_title ?? qaTenderId,
                  href: '/procurement',
                });
                showToast('Question posted — Procurement notified');
              }}
            >
              Post question
            </button>
          </>
        ) : null}
      </Card>

      <Card id="card-bid-studio" style={{ marginTop: 16 }}>
        <SectionHead title="Bid response studio" />
        <form onSubmit={(e) => void submitBid(e)} className="studio-panel" style={{ boxShadow: 'none', border: 'none', padding: 0 }}>
          <div className="studio-row">
            <label className="studio-field">
              <span>Tender</span>
              <select value={bidTenderId} onChange={(e) => setBidTenderId(e.target.value)} required>
                <option value="">Select invitation…</option>
                {invitations.map((t) => (
                  <option key={t.fpip_tenderid} value={t.fpip_tenderid}>
                    {t.fpip_title}
                  </option>
                ))}
              </select>
            </label>
            <label className="studio-field">
              <span>Commercial offer (USD)</span>
              <input type="number" min={0} value={bidPrice} onChange={(e) => setBidPrice(e.target.value)} required />
            </label>
            <label className="studio-field">
              <span>Delivery weeks</span>
              <input type="number" min={1} defaultValue={8} />
            </label>
          </div>
          <label className="studio-field">
            <span>Technical narrative</span>
            <textarea rows={4} value={bidNotes} onChange={(e) => setBidNotes(e.target.value)} placeholder="Approach, team, assumptions…" />
          </label>
          <div className="studio-actions" style={{ border: 'none', paddingTop: 0 }}>
            <button type="button" className="btn btn-ghost" onClick={() => showToast('Draft saved privately')}>
              Save draft
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Icon name="send" size={14} /> {submitting ? 'Submitting…' : 'Submit bid'}
            </button>
          </div>
        </form>
      </Card>

      <Card id="card-supplier-docs" style={{ marginTop: 16 }}>
        <SectionHead
          title="My compliance documents"
          action={
            <button type="button" className="btn btn-brass btn-sm" onClick={openNewDocument}>
              + Submit new document
            </button>
          }
        />
        <DataTable columns={docCols} rows={myDocs} rowKey={(d) => d.fpip_compliancedocumentid} loading={compliance.loading} emptyMessage="No documents." />
      </Card>

      <Card style={{ marginTop: 16 }}>
        <SectionHead title="Supplier Agent" />
        <DashChat agentId="supplier" userContext={userContext} height={280} />
      </Card>
    </>
  );
}

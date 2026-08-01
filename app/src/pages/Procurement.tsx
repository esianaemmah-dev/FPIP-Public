import { useNavigate } from 'react-router-dom';
import { Tabs } from '@/components/Tabs';
import { Card, SectionHead } from '@/components/Card';
import { DataTable, type Column } from '@/components/DataTable';
import { Pill, pillVariantFor } from '@/components/Pill';
import { Icon } from '@/components/Icons';
import { RequisitionForm } from '@/components/forms';
import { useModal } from '@/context/ModalContext';
import { useToast } from '@/context/ToastContext';
import { useNav } from '@/context/NavContext';
import { useRequisitions } from '@/api/useDataverse';
import { formatCurrency } from '@/lib/format';
import type { FpipRequisition } from '@/api/types';
import { TendersTab, ContractsTab, BidsTab } from './ProcurementTabs';

export function Procurement() {
  const navigate = useNavigate();
  return (
    <>
      <div className="feature-strip">
        <div className="signal-card ok">
          <strong>HOD → requisition → RFQ</strong>
          <span>Defined intake, auto-filled bank form, then convert to tender.</span>
          <div className="action-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/hod')}>
              HOD form
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => navigate('/rfq')}>
              RFQ builder
            </button>
          </div>
        </div>
        <div className="signal-card warn">
          <strong>Supplier database</strong>
          <span>Tender-tied compare, per-RFQ docs, LPO feed after award.</span>
          <div className="action-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/suppliers-db')}>
              Open Supplier DB
            </button>
          </div>
        </div>
        <div className="signal-card">
          <strong>Compliance gate</strong>
          <span>Exceptions surface here; green light lives in Compliance & Risk.</span>
          <div className="action-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/compliance')}>
              Open gate
            </button>
          </div>
        </div>
        <div className="signal-card danger">
          <strong>Studio</strong>
          <span>AI-assisted RFP / RFQ packs with human publish.</span>
          <div className="action-row" style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/procurement/studio')}>
              Tender Studio
            </button>
          </div>
        </div>
      </div>
      <Tabs
        group="procurement"
        tabs={[
          { id: 'requisitions', label: 'Requisitions' },
          { id: 'tenders', label: 'Tenders' },
          { id: 'bids', label: 'Bid board' },
          { id: 'contracts', label: 'Contracts' },
        ]}
        defaultTab="requisitions"
      />
      <ProcurementBody />
    </>
  );
}

function ProcurementBody() {
  const { currentTab } = useNav();
  const tab = currentTab('procurement') || 'requisitions';
  if (tab === 'tenders') return <TendersTab />;
  if (tab === 'bids') return <BidsTab />;
  if (tab === 'contracts') return <ContractsTab />;
  return <RequisitionsTab />;
}

function RequisitionsTab() {
  const navigate = useNavigate();
  const requisitions = useRequisitions();
  const { openModal, closeModal } = useModal();
  const { showToast } = useToast();

  function openNewRequisition() {
    openModal({
      eyebrow: 'New Requisition',
      title: 'Create requisition',
      body: (
        <RequisitionForm
          onDone={(title) => {
            closeModal();
            showToast(`Requisition "${title}" submitted for budget check`);
            requisitions.refresh();
          }}
          onCancel={closeModal}
        />
      ),
    });
  }

  function openDetail(r: FpipRequisition) {
    openModal({
      eyebrow: r.fpip_status ?? 'Requisition',
      title: r.fpip_title,
      body: (
        <>
          <div className="modal-kv">
            <div>
              <span className="k">Department</span>
              <span className="v">{r.fpip_department ?? '—'}</span>
            </div>
            <div>
              <span className="k">Category</span>
              <span className="v">{r.fpip_category ?? '—'}</span>
            </div>
            <div>
              <span className="k">Amount</span>
              <span className="v">{formatCurrency(r.fpip_amount)}</span>
            </div>
            <div>
              <span className="k">Budget</span>
              <span className="v">{r.fpip_budget_check_result ?? '—'}</span>
            </div>
          </div>
          <div className="action-row">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                if (r.fpip_budget_check_result === 'Exceeds Budget' && r.fpip_status === 'Escalated') {
                  showToast('Blocked — clear budget escalation / override before converting to tender');
                  return;
                }
                closeModal();
                navigate(`/procurement/studio?fromReq=${r.fpip_requisitionid}`);
              }}
            >
              <Icon name="sparkles" size={14} /> Convert to tender
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                closeModal();
                navigate('/rfq');
              }}
            >
              Open RFQ builder
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                showToast('Sourcing pack shared with category lead');
                closeModal();
              }}
            >
              Route to sourcing
            </button>
          </div>
        </>
      ),
    });
  }

  const columns: Column<FpipRequisition>[] = [
    { header: 'Title', render: (r) => r.fpip_title },
    { header: 'Department', render: (r) => r.fpip_department ?? '—' },
    { header: 'Category', render: (r) => r.fpip_category ?? '—' },
    { header: 'Amount', className: 'num', render: (r) => formatCurrency(r.fpip_amount) },
    { header: 'Budget check', render: (r) => <Pill variant={pillVariantFor(r.fpip_budget_check_result)}>{r.fpip_budget_check_result ?? '—'}</Pill> },
    { header: 'Status', render: (r) => <Pill variant={pillVariantFor(r.fpip_status)}>{r.fpip_status ?? '—'}</Pill> },
  ];

  return (
    <>
      <SectionHead
        title="Requisitions"
        action={
          <div className="action-row" style={{ marginTop: 0 }}>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/procurement/studio')}>
              <Icon name="sparkles" size={14} /> Tender Studio
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={openNewRequisition}>
              + New requisition
            </button>
          </div>
        }
      />
      <Card flush>
        <DataTable
          columns={columns}
          rows={requisitions.data}
          rowKey={(r) => r.fpip_requisitionid}
          loading={requisitions.loading}
          emptyMessage="No requisitions yet."
          onRowClick={openDetail}
        />
      </Card>
    </>
  );
}

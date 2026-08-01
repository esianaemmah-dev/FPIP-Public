import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, SectionHead } from '@/components/Card';
import { useTenant } from '@/context/TenantContext';
import { useToast } from '@/context/ToastContext';
import { useNotifications } from '@/context/NotificationContext';
import { Icon } from '@/components/Icons';
import { useCreateTender, useCreateBid } from '@/api/useDataverse';
import {
  listRfqResponses,
  listRfqSchemas,
  saveRfqResponse,
  saveRfqSchema,
  type RfqFieldType,
  type StoredRfqField,
} from '@/lib/rfqStore';

const PALETTE: { type: RfqFieldType; label: string }[] = [
  { type: 'text', label: 'Short text' },
  { type: 'textarea', label: 'Long text / specs' },
  { type: 'number', label: 'Quoted price' },
  { type: 'date', label: 'Delivery date' },
  { type: 'file', label: 'Document upload' },
  { type: 'checkbox', label: 'Compliance attestation' },
];

const STARTER: StoredRfqField[] = [
  { id: 'f1', label: 'Company legal name', type: 'text', required: true },
  { id: 'f2', label: 'Technical response to specifications', type: 'textarea', required: true },
  { id: 'f3', label: 'Total quoted price', type: 'number', required: true },
  { id: 'f4', label: 'Proposed delivery date', type: 'date', required: true },
  { id: 'f5', label: 'Upload: technical proposal', type: 'file', required: true },
  { id: 'f6', label: 'Upload: pricing schedule', type: 'file', required: true },
  { id: 'f7', label: 'Upload: tax / compliance certificates', type: 'file', required: true },
  { id: 'f8', label: 'I confirm documents are current and accurate', type: 'checkbox', required: true },
];

const DEFAULT_ID = 'rfq-default';

export function RfqBuilder() {
  const { entity } = useTenant();
  const { showToast } = useToast();
  const { push, pushActivity } = useNotifications();
  const navigate = useNavigate();
  const { submit: publishTender } = useCreateTender();
  const { submit: createBidRow } = useCreateBid();
  const [rfqId] = useState(DEFAULT_ID);
  const [fields, setFields] = useState<StoredRfqField[]>(STARTER);
  const [title, setTitle] = useState('RFQ · Network Hardware Refresh');
  const [specs, setSpecs] = useState(
    'Supply and install core switches per attached BOM. Include warranty, SLA, and training.',
  );
  const [responses, setResponses] = useState(listRfqResponses(DEFAULT_ID));

  useEffect(() => {
    const existing = listRfqSchemas().find((s) => s.id === DEFAULT_ID);
    if (existing) {
      setTitle(existing.title);
      setSpecs(existing.specs);
      setFields(existing.fields);
    }
  }, []);

  function persist(extra?: { publishedAt?: string }) {
    saveRfqSchema({
      id: rfqId,
      title,
      specs,
      fields,
      publishedAt: extra?.publishedAt,
    });
  }

  function addField(type: RfqFieldType) {
    const meta = PALETTE.find((p) => p.type === type)!;
    setFields((rows) => [
      ...rows,
      {
        id: `f${Math.random().toString(36).slice(2, 7)}`,
        label: meta.label,
        type,
        required: type === 'file',
      },
    ]);
  }

  function removeField(id: string) {
    setFields((rows) => rows.filter((f) => f.id !== id));
  }

  function saveDraft() {
    persist();
    showToast('RFQ schema saved locally (browser) — ready for Dataverse later');
  }

  async function publish() {
    const publishedAt = new Date().toISOString();
    persist({ publishedAt });
    try {
      const tender = await publishTender({
        title,
        category: 'ICT & Software',
        status: 'Open',
        draftBody: specs,
        format: 'RFQ',
        invitees: ['Kestrel Components Ltd.', 'Halyard Systems'],
      });
      push({
        kind: 'tender',
        title: 'RFQ published · Open tender',
        body: `${title} — apply form live; tender ${tender.fpip_tenderid} on bid board.`,
        href: '/supplier',
      });
      pushActivity({
        actor: 'Procurement',
        action: 'Published RFQ → Open tender',
        detail: title,
        href: '/procurement',
      });
      showToast('RFQ published — Open tender created and suppliers notified');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Publish failed');
    }
  }

  async function simulateSupplierResponse() {
    const resp = {
      id: `resp${Math.random().toString(36).slice(2, 8)}`,
      rfqId,
      supplierName: 'Kestrel Components Ltd.',
      submittedAt: new Date().toISOString(),
      answers: {
        f1: 'Kestrel Components Ltd.',
        f3: '518000',
        f4: '2026-09-15',
      },
      files: ['Technical_proposal.pdf', 'Pricing.xlsx', 'Tax_cert.pdf'],
    };
    saveRfqResponse(resp);
    setResponses(listRfqResponses(rfqId));
    try {
      const schemas = listRfqSchemas();
      const published = schemas.find((s) => s.id === rfqId);
      await createBidRow({
        tenderId: 't2',
        tenderTitle: published?.title ?? title,
        supplierId: 's2',
        supplierName: 'Kestrel Components Ltd.',
        offerAmount: 518000,
        notes: 'Simulated RFQ apply with document uploads',
      });
    } catch {
      /* bid board optional if tender missing */
    }
    showToast('Sample supplier response saved — bid board updated');
  }

  return (
    <div className="platform-page polish-page">
      <header className="page-masthead">
        <div className="page-masthead-row">
          <div>
            <div className="eyebrow">{entity.name} · RFQ builder</div>
            <h1>RFQ form builder</h1>
            <p>
              Google Forms–style builder with local persistence. Publish notifies suppliers; responses
              (including uploads) are stored for procurement review.
            </p>
          </div>
          <div className="action-row">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/procurement')}>
              Back to Procurement
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={saveDraft}>
              Save schema
            </button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void publish()}>
              <Icon name="megaphone" size={14} /> Publish & notify
            </button>
          </div>
        </div>
      </header>

      <Card className="polish-section" style={{ marginBottom: 16 }}>
        <SectionHead title="Task specification & requirements" />
        <div className="bank-form-grid">
          <label className="span-2">
            RFQ title
            <input value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="span-2">
            Specifications (sent in tender notification)
            <textarea value={specs} onChange={(e) => setSpecs(e.target.value)} />
          </label>
        </div>
      </Card>

      <div className="rfq-builder">
        <Card className="polish-section">
          <SectionHead title="Add field" />
          <div className="rfq-palette">
            {PALETTE.map((p) => (
              <button key={p.type} type="button" onClick={() => addField(p.type)}>
                + {p.label}
              </button>
            ))}
          </div>
        </Card>

        <Card className="polish-section">
          <SectionHead title={`Supplier apply form · ${fields.length} fields`} />
          <div className="rfq-canvas">
            {fields.map((f) => (
              <div key={f.id} className="rfq-field">
                <div>
                  <strong>
                    {f.label}
                    {f.required ? ' *' : ''}
                  </strong>
                  <span>
                    {f.type}
                    {f.type === 'file' ? ' · suppliers upload here' : ''}
                  </span>
                </div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeField(f.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="polish-section" style={{ marginTop: 16 }}>
        <SectionHead
          title={`Supplier responses · ${responses.length}`}
          action={
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void simulateSupplierResponse()}>
              Simulate supplier apply
            </button>
          }
        />
        {responses.length === 0 ? (
          <p style={{ color: 'var(--ink-faint)', fontSize: 13 }}>No responses yet — publish then collect uploads.</p>
        ) : (
          <div className="sod-grid">
            {responses.map((r) => (
              <div key={r.id} className="sod-row" style={{ gridTemplateColumns: '1fr 1fr auto' }}>
                <div>
                  <strong>{r.supplierName}</strong>
                  <div className="retention-meta">{new Date(r.submittedAt).toLocaleString()}</div>
                </div>
                <div className="doc-chip-row">
                  {r.files.map((f) => (
                    <span key={f} className="doc-chip">
                      {f}
                    </span>
                  ))}
                </div>
                <span>Quote {r.answers.f3 ?? '—'}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

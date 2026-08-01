// Modal forms used by the Procurement (new requisition) and Supplier Portal
// (submit compliance document) pages. Both persist to Dataverse via the
// repository hooks.

import { useState, type FormEvent } from 'react';
import { ModalField } from '@/context/ModalContext';
import { useCreateRequisition, useCreateComplianceDocument } from '@/api/useDataverse';
import type { Department, Category } from '@/api/types';

const departments: Department[] = ['Operations', 'Facilities', 'Finance', 'Logistics', 'Marketing'];
const categories: Category[] = [
  'ICT & Software',
  'Facilities',
  'Professional Services',
  'Logistics',
  'Capital Equipment',
];
const docTypes = [
  'Tax Compliance Certificate',
  'ISO Certification',
  'Insurance Certificate',
  'Certificate of Incorporation',
  'Other',
];

interface RequisitionFormProps {
  onDone: (title: string) => void;
  onCancel: () => void;
}

export function RequisitionForm({ onDone, onCancel }: RequisitionFormProps) {
  const { submit, submitting } = useCreateRequisition();
  const [title, setTitle] = useState('');
  const [dept, setDept] = useState<Department>(departments[0]);
  const [cat, setCat] = useState<Category>(categories[0]);
  const [amount, setAmount] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function handle(e: FormEvent) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!title.trim()) return setErr('Title is required.');
    if (Number.isNaN(amt) || amt <= 0) return setErr('Enter a valid amount.');
    setErr(null);
    try {
      await submit({ title: title.trim(), department: dept, category: cat, amount: amt });
      onDone(title.trim());
    } catch {
      setErr('Failed to submit — check Dataverse configuration.');
    }
  }

  return (
    <form onSubmit={handle}>
      <ModalField label="Title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Warehouse racking framework" />
      </ModalField>
      <ModalField label="Department">
        <select value={dept} onChange={(e) => setDept(e.target.value as Department)}>
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </ModalField>
      <ModalField label="Category">
        <select value={cat} onChange={(e) => setCat(e.target.value as Category)}>
          {categories.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </ModalField>
      <ModalField label="Estimated amount">
        <input type="number" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
      </ModalField>
      {err ? <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{err}</div> : null}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit requisition'}
        </button>
      </div>
    </form>
  );
}

interface ComplianceDocFormProps {
  supplierId: string;
  onDone: () => void;
  onCancel: () => void;
}

export function ComplianceDocForm({ supplierId, onDone, onCancel }: ComplianceDocFormProps) {
  const { submit, submitting } = useCreateComplianceDocument();
  const [type, setType] = useState(docTypes[0]);
  const [expiry, setExpiry] = useState('');
  const [url, setUrl] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function handle(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return setErr('SharePoint URL is required.');
    setErr(null);
    try {
      await submit({ supplierId, documentType: type, expiryDate: expiry || undefined, sharepointUrl: url.trim() });
      onDone();
    } catch {
      setErr('Failed to submit — check Dataverse configuration.');
    }
  }

  return (
    <form onSubmit={handle}>
      <ModalField label="Document type">
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {docTypes.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </ModalField>
      <ModalField label="Expiry date">
        <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
      </ModalField>
      <ModalField label="SharePoint URL">
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://contoso.sharepoint.com/.../doc.pdf" />
      </ModalField>
      {err ? <div style={{ color: 'var(--danger)', fontSize: 12.5, marginBottom: 8 }}>{err}</div> : null}
      <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: '8px 0 12px' }}>
        Phase 3 stores the document link in Dataverse; enable SharePoint document management in the Power Platform admin center to upload files directly.
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit document'}
        </button>
      </div>
    </form>
  );
}

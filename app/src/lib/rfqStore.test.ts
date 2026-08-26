// RFQ builder / supplier-response persistence — the workflow behind the RFQ
// Builder and Supplier Portal "submit bid" flow. Demo mode is the actual
// local-dev default (VITE_USE_DEMO_DATA=true per README) and is fully
// deterministic via localStorage, so it's exercised directly here rather than
// mocked away — a bug in the roundtrip is exactly what would make a supplier's
// submitted bid "disappear" after a reload.
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/dataverseClient', () => ({
  getDataverseClient: () => ({ useDemo: true, list: vi.fn(), create: vi.fn(), update: vi.fn() }),
}));

import { listRfqResponses, listRfqSchemas, saveRfqResponse, saveRfqSchema } from './rfqStore';

describe('RFQ schema persistence (RFQ Builder)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('is empty before anything has been saved', async () => {
    expect(await listRfqSchemas()).toEqual([]);
  });

  it('persists a new schema and returns it on the next read (survives a reload)', async () => {
    await saveRfqSchema({
      id: 'rfq-default',
      title: 'RFQ · Warehouse Racking',
      specs: 'Heavy-duty racking, 20 bays.',
      fields: [{ id: 'f1', label: 'Company name', type: 'text', required: true }],
    });

    const reloaded = await listRfqSchemas();
    expect(reloaded).toHaveLength(1);
    expect(reloaded[0]).toMatchObject({ id: 'rfq-default', title: 'RFQ · Warehouse Racking' });
    expect(reloaded[0].updatedAt).toBeTruthy();
  });

  it('updates the existing schema in place instead of duplicating it', async () => {
    await saveRfqSchema({ id: 'rfq-default', title: 'v1', specs: '', fields: [] });
    await saveRfqSchema({ id: 'rfq-default', title: 'v2', specs: '', fields: [] });

    const all = await listRfqSchemas();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe('v2');
  });

  it('keeps schemas for different RFQs independent', async () => {
    await saveRfqSchema({ id: 'rfq-a', title: 'A', specs: '', fields: [] });
    await saveRfqSchema({ id: 'rfq-b', title: 'B', specs: '', fields: [] });

    const all = await listRfqSchemas();
    expect(all.map((s) => s.id).sort()).toEqual(['rfq-a', 'rfq-b']);
  });
});

describe('RFQ supplier response persistence (Supplier Portal submit bid)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists a supplier submission and returns it scoped to its RFQ', async () => {
    await saveRfqResponse({
      id: 'resp-1',
      rfqId: 'rfq-default',
      supplierName: 'Kestrel Components Ltd.',
      submittedAt: new Date().toISOString(),
      answers: { f1: 'Kestrel Components Ltd.' },
      files: [],
      supplierId: 'sup-123',
    });

    const forThisRfq = await listRfqResponses('rfq-default');
    expect(forThisRfq).toHaveLength(1);
    expect(forThisRfq[0].supplierName).toBe('Kestrel Components Ltd.');

    const forOtherRfq = await listRfqResponses('rfq-other');
    expect(forOtherRfq).toEqual([]);
  });

  it('keeps two suppliers responding to the same RFQ as separate submissions', async () => {
    await saveRfqResponse({
      id: 'resp-a',
      rfqId: 'rfq-default',
      supplierName: 'Supplier A',
      submittedAt: new Date().toISOString(),
      answers: {},
      files: [],
    });
    await saveRfqResponse({
      id: 'resp-b',
      rfqId: 'rfq-default',
      supplierName: 'Supplier B',
      submittedAt: new Date().toISOString(),
      answers: {},
      files: [],
    });

    const responses = await listRfqResponses('rfq-default');
    expect(responses.map((r) => r.supplierName).sort()).toEqual(['Supplier A', 'Supplier B']);
  });
});

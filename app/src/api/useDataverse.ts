// React data hooks for the fpip_* tables. Each list hook returns { data,
// loading, error, refresh }; useCreateRequisition exposes a submit() mutation.

import { useCallback, useEffect, useState } from 'react';
import {
  awardBid,
  autoMatchInvoiceToLpo,
  createBid,
  createComplianceDocument,
  createInvoice,
  createPurchaseOrder,
  createRequisition,
  createTender,
  type AwardInput,
  type BidInput,
  type ComplianceDocumentInput,
  type PurchaseOrderInput,
  type RequisitionInput,
  type TenderInput,
  getApprovalRequests,
  getApprovalPolicies,
  getAuditLogEntries,
  getBids,
  getComplianceDocuments,
  getContracts,
  getInvoices,
  getPurchaseOrders,
  getRequisitions,
  getSuppliers,
  getTenders,
  updatePurchaseOrderStatus,
  updateTenderStatus,
} from './repositories';
import type {
  FpipApprovalPolicy,
  FpipApprovalRequest,
  FpipAuditLogEntry,
  FpipBid,
  FpipComplianceDocument,
  FpipContract,
  FpipInvoice,
  FpipPurchaseOrder,
  FpipRequisition,
  FpipSupplier,
  FpipTender,
} from './types';

export interface ListState<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

function useList<T>(fetcher: () => Promise<T[]>): ListState<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetcher()
      .then((rows) => {
        if (active) {
          setData(rows);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load data.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // fetcher is a stable module function; refresh is driven by nonce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return { data, loading, error, refresh };
}

export function useSuppliers(): ListState<FpipSupplier> {
  return useList(getSuppliers);
}
export function useRequisitions(): ListState<FpipRequisition> {
  return useList(getRequisitions);
}
export function useTenders(): ListState<FpipTender> {
  return useList(getTenders);
}
export function useBids(): ListState<FpipBid> {
  return useList(getBids);
}
export function usePurchaseOrders(): ListState<FpipPurchaseOrder> {
  return useList(getPurchaseOrders);
}
export function useInvoices(): ListState<FpipInvoice> {
  return useList(getInvoices);
}
export function useContracts(): ListState<FpipContract> {
  return useList(getContracts);
}
export function useComplianceDocuments(): ListState<FpipComplianceDocument> {
  return useList(getComplianceDocuments);
}
export function useApprovalRequests(): ListState<FpipApprovalRequest> {
  return useList(getApprovalRequests);
}
export function useApprovalPolicies(): ListState<FpipApprovalPolicy> {
  return useList(getApprovalPolicies);
}
export function useAuditLogEntries(): ListState<FpipAuditLogEntry> {
  return useList(getAuditLogEntries);
}

export interface CreateRequisitionState {
  submit: (input: RequisitionInput) => Promise<FpipRequisition>;
  submitting: boolean;
  error: string | null;
}

export function useCreateRequisition(): CreateRequisitionState {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (input: RequisitionInput) => {
    setSubmitting(true);
    setError(null);
    try {
      return await createRequisition(input);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create requisition.';
      setError(msg);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error };
}

export interface CreateComplianceDocumentState {
  submit: (input: ComplianceDocumentInput) => Promise<FpipComplianceDocument>;
  submitting: boolean;
  error: string | null;
}

export function useCreateComplianceDocument(): CreateComplianceDocumentState {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (input: ComplianceDocumentInput) => {
    setSubmitting(true);
    setError(null);
    try {
      return await createComplianceDocument(input);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit document.');
      throw err;
    } finally {
      setSubmitting(false);
    }
  }, []);

  return { submit, submitting, error };
}

export function useCreateTender() {
  const [submitting, setSubmitting] = useState(false);
  const submit = useCallback(async (input: TenderInput) => {
    setSubmitting(true);
    try {
      return await createTender(input);
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { submit, submitting };
}

export function useCreateBid() {
  const [submitting, setSubmitting] = useState(false);
  const submit = useCallback(async (input: BidInput) => {
    setSubmitting(true);
    try {
      return await createBid(input);
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { submit, submitting };
}

export function useAwardBid() {
  const [submitting, setSubmitting] = useState(false);
  const submit = useCallback(async (input: AwardInput) => {
    setSubmitting(true);
    try {
      return await awardBid(input);
    } finally {
      setSubmitting(false);
    }
  }, []);
  return { submit, submitting };
}

export {
  createTender,
  createBid,
  createPurchaseOrder,
  createInvoice,
  autoMatchInvoiceToLpo,
  updateTenderStatus,
  updatePurchaseOrderStatus,
  awardBid,
};
export type { TenderInput, BidInput, PurchaseOrderInput, AwardInput };

import { useCallback, useMemo } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import {
  createFinanceRepository,
  type FinanceRepository,
  type FinancialAdjustment,
  type Invoice,
  type InvoiceItem,
  type PatientFinanceSummary,
  type Payment,
  type PaymentAllocation,
  type Refund,
} from '../repositories/FinanceRepository';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

export interface UsePatientFinanceOptions {
  tenantId?: string | null;
  patientId?: string | null;
  repository?: FinanceRepository;
  enabled?: boolean;
}

export interface PatientFinanceState {
  summary: PatientFinanceSummary | null;
  invoices: Invoice[];
  invoiceItems: InvoiceItem[];
  payments: Payment[];
  paymentAllocations: PaymentAllocation[];
  refunds: Refund[];
  financialAdjustments: FinancialAdjustment[];
}

export interface UsePatientFinanceResult extends PatientFinanceState {
  loading: boolean;
  isLoading: boolean;
  error: Error | null;
  isError: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_FINANCE_STATE: PatientFinanceState = {
  summary: null,
  invoices: [],
  invoiceItems: [],
  payments: [],
  paymentAllocations: [],
  refunds: [],
  financialAdjustments: [],
};

const UNAVAILABLE_ERROR = 'Supabase client is not configured for finance access.';

export function usePatientFinance({ tenantId, patientId, repository, enabled = true }: UsePatientFinanceOptions): UsePatientFinanceResult {
  const canFetch = Boolean(tenantId && patientId) && enabled;

  const financeRepository = useMemo(() => {
    if (repository) return repository;
    if (!isSupabaseConfigured) return null;
    return createFinanceRepository({ backend: 'supabase' });
  }, [repository]);

  const queryFn = useCallback(async (): Promise<PatientFinanceState> => {
    if (!tenantId || !patientId) return EMPTY_FINANCE_STATE;
    if (!financeRepository) throw new Error(UNAVAILABLE_ERROR);

    const [summary, invoices, invoiceItems, payments, paymentAllocations, refunds, financialAdjustments] = await Promise.all([
      financeRepository.getPatientFinanceSummary({ tenantId, patientId }),
      financeRepository.listInvoices({ tenantId, patientId, includeArchived: true, limit: 100 }),
      financeRepository.listInvoiceItems({ tenantId, patientId, includeArchived: true, limit: 200 }),
      financeRepository.listPayments({ tenantId, patientId, includeArchived: true, limit: 100 }),
      financeRepository.listPaymentAllocations({ tenantId, patientId, includeVoided: true, limit: 200 }),
      financeRepository.listRefunds({ tenantId, patientId, includeArchived: true, limit: 50 }),
      financeRepository.listFinancialAdjustments({ tenantId, patientId, includeArchived: true, limit: 50 }),
    ]);

    return { summary, invoices, invoiceItems, payments, paymentAllocations, refunds, financialAdjustments };
  }, [financeRepository, patientId, tenantId]);

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<PatientFinanceState>({
    queryFn,
    initialData: EMPTY_FINANCE_STATE,
    enabled: canFetch,
  });

  return {
    ...data,
    loading: isLoading,
    isLoading,
    error,
    isError,
    refresh: refetch,
  };
}

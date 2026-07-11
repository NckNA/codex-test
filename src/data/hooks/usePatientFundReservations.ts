import { useCallback, useMemo } from 'react';
import { getFundReservationCapabilities } from '../../components/finance/fundReservationPermissions';
import type { FinanceUserRole } from '../../components/finance/financePermissions';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  createFinanceRepository,
  type FinanceRepository,
  type PatientFundReservation,
  type Payment,
  type PaymentFundCapacity,
} from '../repositories/FinanceRepository';
import { useAsyncQuery } from './useAsyncQuery';

export interface UsePatientFundReservationsOptions {
  tenantId?: string | null;
  patientId?: string | null;
  role?: FinanceUserRole;
  payments?: Payment[];
  repository?: FinanceRepository;
  enabled?: boolean;
}

export interface PatientFundReservationsData {
  reservations: PatientFundReservation[];
  capacities: Record<string, PaymentFundCapacity>;
}

const EMPTY_DATA: PatientFundReservationsData = { reservations: [], capacities: {} };

function safeListError() {
  return new Error('Не удалось загрузить кредит и депозиты пациента.');
}

export function usePatientFundReservations({
  tenantId,
  patientId,
  role,
  payments = [],
  repository,
  enabled = true,
}: UsePatientFundReservationsOptions) {
  const capabilities = useMemo(() => getFundReservationCapabilities(role), [role]);
  const financeRepository = useMemo(() => {
    if (repository) return repository;
    if (!isSupabaseConfigured) return null;
    return createFinanceRepository({ backend: 'supabase' });
  }, [repository]);

  const paymentKey = useMemo(
    () => payments.map((payment) => `${payment.id}:${payment.status}:${payment.updatedAt ?? ''}`).sort().join('|'),
    [payments],
  );
  const contextKey = tenantId && patientId
    ? `${tenantId}:${patientId}:${role ?? ''}:${paymentKey}`
    : null;
  const canFetch = Boolean(
    enabled
    && contextKey
    && capabilities.canViewReservations
    && financeRepository,
  );

  const queryFn = useCallback(async (): Promise<PatientFundReservationsData> => {
    if (!tenantId || !patientId || !financeRepository || !capabilities.canViewReservations) return EMPTY_DATA;
    try {
      const reservationsPromise = financeRepository.getPatientFundReservations({ tenantId, patientId });
      const capacityEntriesPromise = Promise.all(
        payments
          .filter((payment) => payment.tenantId === tenantId && payment.patientId === patientId)
          .map(async (payment) => {
            const capacity = await financeRepository.getPaymentFundCapacity({
              tenantId,
              patientId,
              paymentId: payment.id,
            });
            return [payment.id, capacity] as const;
          }),
      );
      const [reservations, capacityEntries] = await Promise.all([reservationsPromise, capacityEntriesPromise]);
      const capacities: Record<string, PaymentFundCapacity> = {};
      for (const [paymentId, capacity] of capacityEntries) {
        if (capacity) capacities[paymentId] = capacity;
      }
      return { reservations, capacities };
    } catch {
      throw safeListError();
    }
  }, [capabilities.canViewReservations, financeRepository, patientId, payments, tenantId]);

  const query = useAsyncQuery<PatientFundReservationsData>({
    queryFn,
    initialData: EMPTY_DATA,
    enabled: canFetch,
    queryKey: contextKey,
    resetOnDisable: true,
  });

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    reservations: query.data.reservations,
    capacities: query.data.capacities,
    loading: query.isLoading,
    isLoading: query.isLoading,
    error: query.error ? safeListError() : null,
    isError: query.isError,
    refresh,
    capabilities,
  };
}

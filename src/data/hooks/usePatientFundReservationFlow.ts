/* eslint-disable react-hooks/set-state-in-effect -- finance context changes intentionally clear stale mutation state */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getFundReservationCapabilities } from '../../components/finance/fundReservationPermissions';
import type { FinanceUserRole } from '../../components/finance/financePermissions';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  createFinanceRepository,
  type FinanceRepository,
  type Invoice,
  type PatientFundReservation,
  type PaymentAllocation,
  type PaymentFundCapacity,
} from '../repositories/FinanceRepository';
import {
  createFinanceRpcClient,
  type FinanceRpcClient,
  type PatientFundReservationOperationResult,
} from '../repositories/FinanceRpcClient';

export type FundReservationActionName = 'create' | 'release' | 'consume';
export type FundReservationActionState = 'idle' | 'submitting' | 'reconciling' | 'succeeded' | 'failed';

export interface CreateFundReservationValues {
  paymentId: string;
  amount: number;
  purposeType: PatientFundReservation['purposeType'];
  purposeLabel?: string | null;
  appointmentId?: string | null;
  treatmentPlanId?: string | null;
  expiresAt?: string | null;
  notes?: string | null;
}

export interface ReleaseFundReservationValues {
  reservationId: string;
  reason: string;
}

export interface UseReservedCreditValues {
  reservationId: string;
  invoiceId: string;
  amount: number;
}

export interface UsePatientFundReservationFlowOptions {
  tenantId?: string | null;
  patientId?: string | null;
  role?: FinanceUserRole;
  repository?: FinanceRepository;
  rpcClient?: FinanceRpcClient;
  reservations?: PatientFundReservation[];
  invoices?: Invoice[];
  onChanged?: () => Promise<void> | void;
  refreshReservations?: () => Promise<void> | void;
}

interface OperationKeyRecord {
  signature: string;
  key: string;
}

interface ReconciledFacts {
  reservations: PatientFundReservation[];
  allocations: PaymentAllocation[];
  capacity: PaymentFundCapacity | null;
}

const GENERIC_SAFE_FAILURE = 'Не удалось выполнить операцию. Данные обновлены, повторите попытку.';
const RECONCILING_MESSAGE = 'Проверяем текущее состояние операции…';

function operationKey(prefix: string, tenantId: string, patientId: string, entityId: string) {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}:${tenantId}:${patientId}:${entityId}:${suffix}`;
}

function normalizeOptional(value?: string | null) {
  const normalized = value?.trim() ?? '';
  return normalized || null;
}

function validatePurpose(values: CreateFundReservationValues) {
  if (!['general', 'appointment', 'treatment_plan', 'service', 'other'].includes(values.purposeType)) {
    throw new Error('Выберите назначение депозита.');
  }
  if (values.purposeType === 'other') {
    const label = normalizeOptional(values.purposeLabel);
    if (!label || label.length < 2 || label.length > 120) {
      throw new Error('Укажите назначение от 2 до 120 символов.');
    }
  }
  if (values.purposeType === 'appointment' && !normalizeOptional(values.appointmentId)) {
    throw new Error('Выберите запись для депозита.');
  }
  if (values.purposeType === 'treatment_plan' && !normalizeOptional(values.treatmentPlanId)) {
    throw new Error('Выберите план лечения для депозита.');
  }
  if (values.expiresAt) {
    const expiry = new Date(values.expiresAt);
    if (Number.isNaN(expiry.getTime()) || expiry.getTime() < Date.now()) {
      throw new Error('Дата окончания не может быть в прошлом.');
    }
  }
}

export function safeFundReservationError(error: unknown) {
  const lower = error instanceof Error ? error.message.toLowerCase() : '';
  if (lower.includes('недостаточно доступного кредита') || lower.includes('exceeds payment capacity')) {
    return 'Недостаточно доступного кредита для создания депозита.';
  }
  if (lower.includes('платёж недоступен') || lower.includes('payment is not available')) {
    return 'Платёж недоступен для резервирования.';
  }
  if (lower.includes('terminal') || lower.includes('fully used') || lower.includes('cannot be released') || lower.includes('больше нельзя')) {
    return 'Этот депозит больше нельзя изменить.';
  }
  if (lower.includes('already') || lower.includes('idempotency') || lower.includes('ключ операции')) {
    return 'Операция уже была выполнена или параметры изменились.';
  }
  if (lower.includes('invoice') || lower.includes('счёт') || lower.includes('not available')) {
    return 'Выбранный счёт недоступен для использования депозита.';
  }
  if (lower.includes('permission') || lower.includes('denied') || lower.includes('insufficient') || lower.includes('прав')) {
    return 'Недостаточно прав для этой операции.';
  }
  if (lower.includes('зарезервирована как депозит')) {
    return 'Часть средств зарезервирована как депозит.';
  }
  return GENERIC_SAFE_FAILURE;
}

function findReservation(reservations: PatientFundReservation[], id: string) {
  return reservations.find((reservation) => reservation.id === id) ?? null;
}

function createSignature(values: CreateFundReservationValues) {
  return JSON.stringify([
    values.paymentId,
    values.amount,
    values.purposeType,
    normalizeOptional(values.purposeLabel),
    normalizeOptional(values.appointmentId),
    normalizeOptional(values.treatmentPlanId),
    values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
    normalizeOptional(values.notes),
  ]);
}

export function usePatientFundReservationFlow({
  tenantId,
  patientId,
  role,
  repository,
  rpcClient,
  reservations = [],
  invoices = [],
  onChanged,
  refreshReservations,
}: UsePatientFundReservationFlowOptions) {
  const capabilities = useMemo(() => getFundReservationCapabilities(role), [role]);
  const financeRepository = useMemo(() => {
    if (repository) return repository;
    if (!isSupabaseConfigured) return null;
    return createFinanceRepository({ backend: 'supabase' });
  }, [repository]);
  const client = useMemo(() => {
    if (rpcClient) return rpcClient;
    if (!isSupabaseConfigured) return null;
    return createFinanceRpcClient({ backend: 'supabase' });
  }, [rpcClient]);

  const contextKey = tenantId && patientId ? `${tenantId}:${patientId}:${role ?? ''}` : null;
  const contextRef = useRef(contextKey);
  const reservationsRef = useRef(reservations);
  const invoicesRef = useRef(invoices);
  const keyRefs = useRef<Record<FundReservationActionName, OperationKeyRecord | null>>({
    create: null,
    release: null,
    consume: null,
  });
  const inFlightRef = useRef<Record<FundReservationActionName, Promise<unknown> | null>>({
    create: null,
    release: null,
    consume: null,
  });
  const [actionState, setActionState] = useState<FundReservationActionState>('idle');
  const [actionName, setActionName] = useState<FundReservationActionName | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  useLayoutEffect(() => {
    contextRef.current = contextKey;
    reservationsRef.current = reservations;
    invoicesRef.current = invoices;
  }, [contextKey, invoices, reservations]);

  useEffect(() => {
    setActionState('idle');
    setActionName(null);
    setActionMessage(null);
    keyRefs.current = { create: null, release: null, consume: null };
    inFlightRef.current = { create: null, release: null, consume: null };
  }, [contextKey]);

  const refreshAll = useCallback(async () => {
    await refreshReservations?.();
    await onChanged?.();
  }, [onChanged, refreshReservations]);

  const fetchFacts = useCallback(async (paymentId?: string): Promise<ReconciledFacts> => {
    if (!tenantId || !patientId || !financeRepository) {
      return { reservations: [], allocations: [], capacity: null };
    }
    const [latestReservations, allocations, capacity] = await Promise.all([
      financeRepository.getPatientFundReservations({ tenantId, patientId }),
      financeRepository.listPaymentAllocations({ tenantId, patientId, includeVoided: true, limit: 200 }),
      paymentId
        ? financeRepository.getPaymentFundCapacity({ tenantId, patientId, paymentId })
        : Promise.resolve(null),
    ]);
    return { reservations: latestReservations, allocations, capacity };
  }, [financeRepository, patientId, tenantId]);

  const ensureKey = useCallback((action: FundReservationActionName, signature: string, entityId: string) => {
    if (!tenantId || !patientId) return '';
    const current = keyRefs.current[action];
    if (!current || current.signature !== signature) {
      keyRefs.current[action] = {
        signature,
        key: operationKey(`fund-${action}`, tenantId, patientId, entityId),
      };
    }
    return keyRefs.current[action]?.key ?? '';
  }, [patientId, tenantId]);

  const run = useCallback(async <T extends PatientFundReservationOperationResult>(
    action: FundReservationActionName,
    mutation: () => Promise<T>,
    reconcile: () => Promise<T | null>,
    successMessage: (result: T) => string,
  ): Promise<T | undefined> => {
    if (!contextKey || !client) {
      setActionState('failed');
      setActionMessage(GENERIC_SAFE_FAILURE);
      return undefined;
    }
    const existing = inFlightRef.current[action];
    if (existing) return existing as Promise<T>;
    const capturedContext = contextKey;
    setActionName(action);
    setActionState('submitting');
    setActionMessage(null);
    const promise = mutation();
    inFlightRef.current[action] = promise;
    try {
      const result = await promise;
      if (contextRef.current !== capturedContext) return result;
      await refreshAll();
      if (contextRef.current === capturedContext) {
        keyRefs.current[action] = null;
        setActionState('succeeded');
        setActionMessage(successMessage(result));
      }
      return result;
    } catch (error) {
      if (contextRef.current !== capturedContext) return undefined;
      setActionState('reconciling');
      setActionMessage(RECONCILING_MESSAGE);
      let reconciled: T | null;
      try {
        reconciled = await reconcile();
        await refreshAll();
      } catch {
        reconciled = null;
      }
      if (contextRef.current !== capturedContext) return reconciled ?? undefined;
      if (reconciled) {
        keyRefs.current[action] = null;
        setActionState('succeeded');
        setActionMessage(successMessage(reconciled));
        return reconciled;
      }
      setActionState('failed');
      setActionMessage(safeFundReservationError(error));
      return undefined;
    } finally {
      if (inFlightRef.current[action] === promise) inFlightRef.current[action] = null;
      if (contextRef.current === capturedContext) setActionName(null);
    }
  }, [client, contextKey, refreshAll]);

  const createReservation = useCallback(async (values: CreateFundReservationValues) => {
    if (!tenantId || !patientId || !client || !financeRepository || !capabilities.canCreate) {
      setActionState('failed');
      setActionMessage('Недостаточно прав для этой операции.');
      return undefined;
    }
    if (!Number.isFinite(values.amount) || values.amount <= 0) {
      setActionState('failed');
      setActionMessage('Сумма должна быть больше 0.');
      return undefined;
    }
    try {
      validatePurpose(values);
    } catch (error) {
      setActionState('failed');
      setActionMessage(error instanceof Error ? error.message : GENERIC_SAFE_FAILURE);
      return undefined;
    }
    let capacity: PaymentFundCapacity | null;
    try {
      capacity = await financeRepository.getPaymentFundCapacity({
        tenantId,
        patientId,
        paymentId: values.paymentId,
      });
    } catch {
      setActionState('failed');
      setActionMessage(GENERIC_SAFE_FAILURE);
      return undefined;
    }
    if (!capacity || capacity.patientId !== patientId || values.amount > capacity.availableCreditAmount) {
      setActionState('failed');
      setActionMessage('Недостаточно доступного кредита для создания депозита.');
      return undefined;
    }
    const signature = createSignature(values);
    const idempotencyKey = ensureKey('create', signature, values.paymentId);
    const beforeIds = new Set(reservationsRef.current.map((reservation) => reservation.id));
    const normalizedLabel = normalizeOptional(values.purposeLabel);
    const normalizedNotes = normalizeOptional(values.notes);
    return run(
      'create',
      () => client.createPatientFundReservation({
        tenantId,
        patientId,
        paymentId: values.paymentId,
        amount: values.amount,
        purposeType: values.purposeType,
        purposeLabel: normalizedLabel,
        appointmentId: normalizeOptional(values.appointmentId),
        treatmentPlanId: normalizeOptional(values.treatmentPlanId),
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : null,
        notes: normalizedNotes,
        metadata: { source: 'patient_finance_ui' },
        idempotencyKey,
      }),
      async () => {
        const facts = await fetchFacts(values.paymentId);
        const reservation = facts.reservations.find((candidate) => (
          !beforeIds.has(candidate.id)
          && candidate.paymentId === values.paymentId
          && candidate.originalAmount === values.amount
          && candidate.purposeType === values.purposeType
          && (candidate.purposeLabel ?? null) === normalizedLabel
          && (candidate.notes ?? null) === normalizedNotes
        ));
        if (!reservation || !facts.capacity) return null;
        return { status: 'already_completed', reservation, allocation: null, capacity: facts.capacity };
      },
      () => 'Депозит создан.',
    );
  }, [capabilities.canCreate, client, ensureKey, fetchFacts, financeRepository, patientId, run, tenantId]);

  const releaseReservation = useCallback(async ({ reservationId, reason }: ReleaseFundReservationValues) => {
    if (!tenantId || !patientId || !client || !capabilities.canRelease) {
      setActionState('failed');
      setActionMessage('Недостаточно прав для этой операции.');
      return undefined;
    }
    const current = findReservation(reservationsRef.current, reservationId);
    if (!current || !['active', 'partially_used'].includes(current.status) || current.remainingAmount <= 0) {
      setActionState('failed');
      setActionMessage('Этот депозит больше нельзя изменить.');
      return undefined;
    }
    const normalizedReason = reason.trim();
    if (!normalizedReason) {
      setActionState('failed');
      setActionMessage('Укажите причину освобождения резерва.');
      return undefined;
    }
    const signature = JSON.stringify([reservationId, current.remainingAmount, normalizedReason]);
    const idempotencyKey = ensureKey('release', signature, reservationId);
    return run(
      'release',
      () => client.releasePatientFundReservation({
        tenantId,
        reservationId,
        amount: null,
        reason: normalizedReason,
        idempotencyKey,
      }),
      async () => {
        const facts = await fetchFacts(current.paymentId);
        const reservation = findReservation(facts.reservations, reservationId);
        if (!reservation || reservation.status !== 'released' || reservation.remainingAmount !== 0 || !facts.capacity) return null;
        return { status: 'already_completed', reservation, allocation: null, capacity: facts.capacity };
      },
      () => 'Резерв освобождён.',
    );
  }, [capabilities.canRelease, client, ensureKey, fetchFacts, patientId, run, tenantId]);

  const useReservedCredit = useCallback(async ({ reservationId, invoiceId, amount }: UseReservedCreditValues) => {
    if (!tenantId || !patientId || !client || !capabilities.canUse) {
      setActionState('failed');
      setActionMessage('Недостаточно прав для этой операции.');
      return undefined;
    }
    const current = findReservation(reservationsRef.current, reservationId);
    const invoice = invoicesRef.current.find((candidate) => candidate.id === invoiceId) ?? null;
    if (!current || !['active', 'partially_used'].includes(current.status) || current.remainingAmount <= 0) {
      setActionState('failed');
      setActionMessage('Этот депозит больше нельзя изменить.');
      return undefined;
    }
    if (!invoice || invoice.patientId !== patientId || invoice.tenantId !== tenantId || !['issued', 'partially_paid'].includes(invoice.status) || invoice.balanceAmount <= 0 || invoice.currency !== current.currency) {
      setActionState('failed');
      setActionMessage('Выбранный счёт недоступен для использования депозита.');
      return undefined;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > current.remainingAmount || amount > invoice.balanceAmount) {
      setActionState('failed');
      setActionMessage('Сумма превышает доступный остаток депозита или долг по счёту.');
      return undefined;
    }
    const signature = JSON.stringify([reservationId, invoiceId, amount]);
    const idempotencyKey = ensureKey('consume', signature, reservationId);
    const beforeConsumed = current.consumedAmount;
    const beforeAllocationIds = new Set<string>();
    if (financeRepository) {
      try {
        const beforeAllocations = await financeRepository.listPaymentAllocations({ tenantId, patientId, includeVoided: true, limit: 200 });
        beforeAllocations.forEach((allocation) => beforeAllocationIds.add(allocation.id));
      } catch {
        setActionState('failed');
        setActionMessage(GENERIC_SAFE_FAILURE);
        return undefined;
      }
    }
    return run(
      'consume',
      () => client.allocateReservedCredit({
        tenantId,
        patientId,
        reservationId,
        invoiceId,
        amount,
        idempotencyKey,
      }),
      async () => {
        const facts = await fetchFacts(current.paymentId);
        const reservation = findReservation(facts.reservations, reservationId);
        const allocation = facts.allocations.find((candidate) => (
          !beforeAllocationIds.has(candidate.id)
          && candidate.patientFundReservationId === reservationId
          && candidate.invoiceId === invoiceId
          && candidate.amount === amount
          && candidate.status === 'active'
        )) ?? null;
        if (!reservation || reservation.consumedAmount < beforeConsumed + amount || !allocation || !facts.capacity) return null;
        return { status: 'already_completed', reservation, allocation, capacity: facts.capacity };
      },
      (result) => result.reservation.status === 'fully_used'
        ? 'Депозит использован полностью.'
        : 'Часть депозита использована.',
    );
  }, [capabilities.canUse, client, ensureKey, fetchFacts, financeRepository, patientId, run, tenantId]);

  const clearActionFeedback = useCallback(() => {
    setActionState('idle');
    setActionMessage(null);
    setActionName(null);
  }, []);

  return {
    createReservation,
    releaseReservation,
    useReservedCredit,
    actionState,
    actionName,
    actionMessage,
    actionLoading: actionState === 'submitting' || actionState === 'reconciling',
    capabilities,
    clearActionFeedback,
  };
}

// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FinanceRepository, PatientFundReservation, Payment, PaymentFundCapacity } from '../repositories/FinanceRepository';
import { usePatientFundReservations } from './usePatientFundReservations';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantA = 'tenant-a';
const patientA = 'patient-a';
const patientB = 'patient-b';
const paymentA = { id: 'payment-a', tenantId: tenantA, patientId: patientA, status: 'received', paymentMethod: 'cash', amount: 1000, currency: 'KZT', receivedAt: '2026-07-11T00:00:00Z', updatedAt: '2026-07-11T00:00:00Z' } as Payment;
const reservationA = { id: 'reservation-a', tenantId: tenantA, patientId: patientA, paymentId: paymentA.id, currency: 'KZT', purposeType: 'general', purposeLabel: null, appointmentId: null, treatmentPlanId: null, originalAmount: 300, consumedAmount: 0, releasedAmount: 0, remainingAmount: 300, status: 'active', expiresAt: null, notes: null, createdAt: '2026-07-11T00:00:00Z', updatedAt: null, releasedAt: null, archivedAt: null } as PatientFundReservation;
const capacityA = { paymentId: paymentA.id, patientId: patientA, currency: 'KZT', paymentAmount: 1000, activeAllocatedAmount: 0, completedRefundAmount: 0, refundReservedAmount: 0, reservedDepositAmount: 300, grossUnallocatedAmount: 1000, availableCreditAmount: 700 } as PaymentFundCapacity;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function repository(): FinanceRepository {
  return {
    getPatientFundReservations: vi.fn().mockResolvedValue([reservationA]),
    getPaymentFundCapacity: vi.fn().mockResolvedValue(capacityA),
  } as unknown as FinanceRepository;
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe('usePatientFundReservations', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof usePatientFundReservations> | null;

  function Harness(props: { tenantId?: string | null; patientId?: string | null; role?: string; payments?: Payment[]; repo: FinanceRepository }) {
    latest = usePatientFundReservations({ tenantId: props.tenantId, patientId: props.patientId, role: props.role, payments: props.payments, repository: props.repo });
    return null;
  }

  beforeEach(() => {
    latest = null;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('does not fetch without tenant or patient', async () => {
    const repo = repository();
    await act(async () => { root.render(<Harness tenantId={null} patientId={patientA} role="clinic_admin" payments={[paymentA]} repo={repo} />); });
    await flush();
    expect(repo.getPatientFundReservations).not.toHaveBeenCalled();
    await act(async () => { root.render(<Harness tenantId={tenantA} patientId={null} role="clinic_admin" payments={[paymentA]} repo={repo} />); });
    await flush();
    expect(repo.getPatientFundReservations).not.toHaveBeenCalled();
  });

  it('loads reservations and authoritative payment capacity', async () => {
    const repo = repository();
    await act(async () => { root.render(<Harness tenantId={tenantA} patientId={patientA} role="clinic_admin" payments={[paymentA]} repo={repo} />); });
    await flush();
    expect(repo.getPatientFundReservations).toHaveBeenCalledWith({ tenantId: tenantA, patientId: patientA });
    expect(repo.getPaymentFundCapacity).toHaveBeenCalledWith({ tenantId: tenantA, patientId: patientA, paymentId: paymentA.id });
    expect(latest?.reservations).toEqual([reservationA]);
    expect(latest?.capacities[paymentA.id]).toEqual(capacityA);
  });

  it('doctor and registrar do not fetch reservation details', async () => {
    const repo = repository();
    await act(async () => { root.render(<Harness tenantId={tenantA} patientId={patientA} role="doctor" payments={[paymentA]} repo={repo} />); });
    await flush();
    expect(repo.getPatientFundReservations).not.toHaveBeenCalled();
    expect(latest?.capabilities.canViewSummary).toBe(true);
    expect(latest?.capabilities.canViewReservations).toBe(false);
  });

  it('clears old patient data immediately and ignores stale list response', async () => {
    const repo = repository();
    const old = deferred<PatientFundReservation[]>();
    const current = deferred<PatientFundReservation[]>();
    vi.mocked(repo.getPatientFundReservations)
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(current.promise);
    vi.mocked(repo.getPaymentFundCapacity).mockResolvedValue(null);

    await act(async () => { root.render(<Harness tenantId={tenantA} patientId={patientA} role="clinic_admin" payments={[]} repo={repo} />); });
    await act(async () => { root.render(<Harness tenantId={tenantA} patientId={patientB} role="clinic_admin" payments={[]} repo={repo} />); });
    expect(latest?.reservations).toEqual([]);
    current.resolve([{ ...reservationA, id: 'reservation-b', patientId: patientB }]);
    await flush();
    expect(latest?.reservations[0]?.patientId).toBe(patientB);
    old.resolve([reservationA]);
    await flush();
    expect(latest?.reservations[0]?.patientId).toBe(patientB);
  });

  it('ignores stale capacity response after payment context changes', async () => {
    const repo = repository();
    const oldCapacity = deferred<PaymentFundCapacity | null>();
    const paymentB = { ...paymentA, id: 'payment-b' };
    vi.mocked(repo.getPatientFundReservations).mockResolvedValue([]);
    vi.mocked(repo.getPaymentFundCapacity)
      .mockReturnValueOnce(oldCapacity.promise)
      .mockResolvedValueOnce({ ...capacityA, paymentId: paymentB.id, availableCreditAmount: 900 });

    await act(async () => { root.render(<Harness tenantId={tenantA} patientId={patientA} role="clinic_admin" payments={[paymentA]} repo={repo} />); });
    await act(async () => { root.render(<Harness tenantId={tenantA} patientId={patientA} role="clinic_admin" payments={[paymentB]} repo={repo} />); });
    await flush();
    expect(latest?.capacities[paymentB.id]?.availableCreditAmount).toBe(900);
    oldCapacity.resolve(capacityA);
    await flush();
    expect(latest?.capacities[paymentA.id]).toBeUndefined();
  });

  it('returns only safe load errors', async () => {
    const repo = repository();
    vi.mocked(repo.getPatientFundReservations).mockRejectedValue({ code: 'XX000', message: 'trigger secret_table failed' });
    await act(async () => { root.render(<Harness tenantId={tenantA} patientId={patientA} role="clinic_admin" payments={[]} repo={repo} />); });
    await flush();
    expect(latest?.error?.message).toBe('Не удалось загрузить кредит и депозиты пациента.');
    expect(latest?.error?.message).not.toContain('trigger');
  });
});

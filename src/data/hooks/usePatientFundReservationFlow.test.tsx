// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  FinanceRepository,
  Invoice,
  PatientFundReservation,
  PaymentAllocation,
  PaymentFundCapacity,
} from '../repositories/FinanceRepository';
import type { FinanceRpcClient, PatientFundReservationOperationResult } from '../repositories/FinanceRpcClient';
import { usePatientFundReservationFlow } from './usePatientFundReservationFlow';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const patientId = 'patient-1';
const paymentId = 'payment-1';
const invoice = {
  id: 'invoice-1', tenantId, patientId, invoiceNumber: 'INV-1', status: 'issued', currency: 'KZT', balanceAmount: 500,
} as Invoice;
const capacity = {
  paymentId, patientId, currency: 'KZT', paymentAmount: 1000, activeAllocatedAmount: 0,
  completedRefundAmount: 0, refundReservedAmount: 0, reservedDepositAmount: 300,
  grossUnallocatedAmount: 1000, availableCreditAmount: 700,
} as PaymentFundCapacity;
const activeReservation = {
  id: 'reservation-1', tenantId, patientId, paymentId, currency: 'KZT', purposeType: 'general', purposeLabel: null,
  appointmentId: null, treatmentPlanId: null, originalAmount: 300, consumedAmount: 0, releasedAmount: 0,
  remainingAmount: 300, status: 'active', expiresAt: null, notes: null, createdAt: '2026-07-11T00:00:00Z',
  updatedAt: null, releasedAt: null, archivedAt: null,
} as PatientFundReservation;
const allocation = {
  id: 'allocation-1', tenantId, patientId, paymentId, invoiceId: invoice.id, invoiceItemId: null,
  amount: 100, currency: 'KZT', status: 'active', allocatedAt: '2026-07-11T00:00:00Z', metadata: {},
  createdBy: null, voidedBy: null, voidReason: null, voidedAt: null, createdAt: '2026-07-11T00:00:00Z',
  updatedAt: '2026-07-11T00:00:00Z', patientFundReservationId: activeReservation.id,
  reservationOperationKey: null, reservationOperationFingerprint: null,
} as PaymentAllocation;

function result(reservation = activeReservation, allocationValue: PaymentAllocation | null = null): PatientFundReservationOperationResult {
  return { status: 'completed', reservation, allocation: allocationValue, capacity };
}

function repository(): FinanceRepository {
  return {
    getPaymentFundCapacity: vi.fn().mockResolvedValue(capacity),
    getPatientFundReservations: vi.fn().mockResolvedValue([activeReservation]),
    listPaymentAllocations: vi.fn().mockResolvedValue([]),
  } as unknown as FinanceRepository;
}

function rpcClient(): FinanceRpcClient {
  return {
    createPatientFundReservation: vi.fn().mockResolvedValue(result()),
    releasePatientFundReservation: vi.fn().mockResolvedValue(result({ ...activeReservation, status: 'released', releasedAmount: 300, remainingAmount: 0 })),
    allocateReservedCredit: vi.fn().mockResolvedValue(result({ ...activeReservation, status: 'partially_used', consumedAmount: 100, remainingAmount: 200 }, allocation)),
  } as unknown as FinanceRpcClient;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('usePatientFundReservationFlow', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: ReturnType<typeof usePatientFundReservationFlow> | null;

  function Harness(props: {
    tenant?: string | null;
    patient?: string | null;
    role?: string;
    repo: FinanceRepository;
    client: FinanceRpcClient;
    reservations?: PatientFundReservation[];
    invoices?: Invoice[];
    onChanged?: () => Promise<void> | void;
    refreshReservations?: () => Promise<void> | void;
  }) {
    latest = usePatientFundReservationFlow({
      tenantId: props.tenant,
      patientId: props.patient,
      role: props.role,
      repository: props.repo,
      rpcClient: props.client,
      reservations: props.reservations,
      invoices: props.invoices,
      onChanged: props.onChanged,
      refreshReservations: props.refreshReservations,
    });
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

  async function renderFlow(overrides: Partial<Parameters<typeof Harness>[0]> = {}) {
    const repo = overrides.repo ?? repository();
    const client = overrides.client ?? rpcClient();
    await act(async () => {
      root.render(<Harness tenant={tenantId} patient={patientId} role="clinic_admin" repo={repo} client={client} reservations={[activeReservation]} invoices={[invoice]} {...overrides} />);
    });
    return { repo, client };
  }

  it('maps create parameters and refreshes list and summary', async () => {
    const onChanged = vi.fn();
    const refreshReservations = vi.fn();
    const { client } = await renderFlow({ onChanged, refreshReservations, reservations: [] });
    await act(async () => {
      await latest?.createReservation({ paymentId, amount: 300, purposeType: 'other', purposeLabel: '  Имплантация  ', notes: '  note  ' });
    });
    expect(client.createPatientFundReservation).toHaveBeenCalledWith(expect.objectContaining({
      tenantId, patientId, paymentId, amount: 300, purposeType: 'other', purposeLabel: 'Имплантация', notes: 'note',
      idempotencyKey: expect.stringContaining('fund-create:'),
    }));
    expect(refreshReservations).toHaveBeenCalledTimes(1);
    expect(onChanged).toHaveBeenCalledTimes(1);
    expect(latest?.actionMessage).toBe('Депозит создан.');
  });

  it('retains the same create idempotency key after ambiguous unconfirmed response', async () => {
    const repo = repository();
    vi.mocked(repo.getPatientFundReservations).mockResolvedValue([]);
    const client = rpcClient();
    vi.mocked(client.createPatientFundReservation).mockRejectedValue({ code: 'PGRST', message: 'network response lost' });
    await renderFlow({ repo, client, reservations: [] });
    const values = { paymentId, amount: 300, purposeType: 'general' as const };
    await act(async () => { await latest?.createReservation(values); });
    await act(async () => { await latest?.createReservation(values); });
    const first = vi.mocked(client.createPatientFundReservation).mock.calls[0][0].idempotencyKey;
    const second = vi.mocked(client.createPatientFundReservation).mock.calls[1][0].idempotencyKey;
    expect(second).toBe(first);
    expect(latest?.actionMessage).toBe('Не удалось выполнить операцию. Данные обновлены, повторите попытку.');
  });

  it('treats committed create with lost response as success after reconciliation', async () => {
    const repo = repository();
    const committed = { ...activeReservation, id: 'reservation-created', originalAmount: 250, remainingAmount: 250, notes: 'lost' };
    vi.mocked(repo.getPatientFundReservations).mockResolvedValue([committed]);
    const client = rpcClient();
    vi.mocked(client.createPatientFundReservation).mockRejectedValue(new Error('network timeout'));
    await renderFlow({ repo, client, reservations: [] });
    let operationResult: unknown;
    await act(async () => {
      operationResult = await latest?.createReservation({ paymentId, amount: 250, purposeType: 'general', notes: 'lost' });
    });
    expect(operationResult).toEqual(expect.objectContaining({ status: 'already_completed', reservation: committed }));
    expect(latest?.actionState).toBe('succeeded');
    expect(latest?.actionMessage).toBe('Депозит создан.');
  });

  it('reconciles a release after an uncertain response and keeps release full-only', async () => {
    const repo = repository();
    const released = { ...activeReservation, status: 'released' as const, releasedAmount: 300, remainingAmount: 0, releasedAt: '2026-07-11T01:00:00Z' };
    vi.mocked(repo.getPatientFundReservations).mockResolvedValue([released]);
    const client = rpcClient();
    vi.mocked(client.releasePatientFundReservation).mockRejectedValue(new Error('response lost'));
    await renderFlow({ repo, client });
    await act(async () => { await latest?.releaseReservation({ reservationId: activeReservation.id, reason: '  По просьбе пациента  ' }); });
    expect(client.releasePatientFundReservation).toHaveBeenCalledWith(expect.objectContaining({
      reservationId: activeReservation.id, amount: null, reason: 'По просьбе пациента', idempotencyKey: expect.stringContaining('fund-release:'),
    }));
    expect(latest?.actionMessage).toBe('Резерв освобождён.');
  });

  it('reconciles a reserved-credit allocation and never calls recordPayment', async () => {
    const repo = repository();
    const consumed = { ...activeReservation, status: 'partially_used' as const, consumedAmount: 100, remainingAmount: 200 };
    vi.mocked(repo.getPatientFundReservations).mockResolvedValue([consumed]);
    vi.mocked(repo.listPaymentAllocations)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([allocation]);
    const client = rpcClient();
    vi.mocked(client.allocateReservedCredit).mockRejectedValue(new Error('response lost'));
    await renderFlow({ repo, client });
    await act(async () => { await latest?.useReservedCredit({ reservationId: activeReservation.id, invoiceId: invoice.id, amount: 100 }); });
    expect(client.allocateReservedCredit).toHaveBeenCalledWith(expect.objectContaining({ amount: 100, invoiceId: invoice.id, idempotencyKey: expect.stringContaining('fund-consume:') }));
    expect((client as unknown as { recordPayment?: unknown }).recordPayment).toBeUndefined();
    expect(latest?.actionMessage).toBe('Часть депозита использована.');
  });

  it('blocks release for cashier and mutations for doctor', async () => {
    const { client } = await renderFlow({ role: 'cashier' });
    await act(async () => { await latest?.releaseReservation({ reservationId: activeReservation.id, reason: 'reason' }); });
    expect(client.releasePatientFundReservation).not.toHaveBeenCalled();
    expect(latest?.actionMessage).toBe('Недостаточно прав для этой операции.');

    await act(async () => {
      root.render(<Harness tenant={tenantId} patient={patientId} role="doctor" repo={repository()} client={client} reservations={[activeReservation]} invoices={[invoice]} />);
    });
    await act(async () => { await latest?.createReservation({ paymentId, amount: 100, purposeType: 'general' }); });
    expect(client.createPatientFundReservation).not.toHaveBeenCalled();
  });

  it('blocks invalid amount, other purpose and unavailable invoice before RPC', async () => {
    const { client } = await renderFlow();
    await act(async () => { await latest?.createReservation({ paymentId, amount: 0, purposeType: 'general' }); });
    expect(latest?.actionMessage).toBe('Сумма должна быть больше 0.');
    await act(async () => { await latest?.createReservation({ paymentId, amount: 10, purposeType: 'other', purposeLabel: 'x' }); });
    expect(latest?.actionMessage).toBe('Укажите назначение от 2 до 120 символов.');
    await act(async () => { await latest?.useReservedCredit({ reservationId: activeReservation.id, invoiceId: 'missing', amount: 10 }); });
    expect(latest?.actionMessage).toBe('Выбранный счёт недоступен для использования депозита.');
    expect(client.allocateReservedCredit).not.toHaveBeenCalled();
  });

  it('blocks duplicate submit while the same action is in flight', async () => {
    const client = rpcClient();
    const pending = deferred<PatientFundReservationOperationResult>();
    vi.mocked(client.createPatientFundReservation).mockReturnValue(pending.promise);
    await renderFlow({ client, reservations: [] });
    let first!: Promise<unknown>;
    let second!: Promise<unknown>;
    await act(async () => {
      first = latest!.createReservation({ paymentId, amount: 100, purposeType: 'general' });
      second = latest!.createReservation({ paymentId, amount: 100, purposeType: 'general' });
      await Promise.resolve();
    });
    expect(client.createPatientFundReservation).toHaveBeenCalledTimes(1);
    pending.resolve(result({ ...activeReservation, originalAmount: 100, remainingAmount: 100 }));
    await act(async () => { await Promise.all([first, second]); });
  });

  it('ignores stale mutation completion after patient switch and clears dialog state', async () => {
    const client = rpcClient();
    const pending = deferred<PatientFundReservationOperationResult>();
    vi.mocked(client.createPatientFundReservation).mockReturnValue(pending.promise);
    const repo = repository();
    await renderFlow({ client, repo, reservations: [] });
    let call!: Promise<unknown>;
    await act(async () => { call = latest!.createReservation({ paymentId, amount: 100, purposeType: 'general' }); await Promise.resolve(); });
    await act(async () => {
      root.render(<Harness tenant={tenantId} patient="patient-2" role="clinic_admin" repo={repo} client={client} reservations={[]} invoices={[]} />);
    });
    expect(latest?.actionState).toBe('idle');
    pending.resolve(result({ ...activeReservation, originalAmount: 100, remainingAmount: 100 }));
    await act(async () => { await call; });
    expect(latest?.actionState).toBe('idle');
    expect(latest?.actionMessage).toBeNull();
  });

  it('hides raw PostgREST details behind a safe failure', async () => {
    const repo = repository();
    vi.mocked(repo.getPatientFundReservations).mockResolvedValue([]);
    const client = rpcClient();
    vi.mocked(client.createPatientFundReservation).mockRejectedValue({ code: '23514', message: 'trigger private_finance.secret constraint failed' });
    await renderFlow({ repo, client, reservations: [] });
    await act(async () => { await latest?.createReservation({ paymentId, amount: 100, purposeType: 'general' }); });
    expect(latest?.actionMessage).toBe('Не удалось выполнить операцию. Данные обновлены, повторите попытку.');
    expect(latest?.actionMessage).not.toContain('trigger');
    expect(latest?.actionMessage).not.toContain('23514');
  });
});

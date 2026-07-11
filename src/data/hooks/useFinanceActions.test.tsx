// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFinanceActions, type UseFinanceActionsResult } from './useFinanceActions';
import { FinanceRpcClientError, type FinanceRpcClient, type PatientCreditPaymentOperationResult } from '../repositories/FinanceRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const patientId = 'patient-1';

function completedPatientCreditOperation(operationId = 'patient-credit-operation-1', nextPatientId = patientId, nextTenantId = tenantId): PatientCreditPaymentOperationResult {
  return {
    status: 'completed',
    operationId,
    tenantId: nextTenantId,
    patientId: nextPatientId,
    payment: { id: 'payment-1' } as PatientCreditPaymentOperationResult['payment'],
    capacity: { availableCreditAmount: 1000 } as PatientCreditPaymentOperationResult['capacity'],
  };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolver, rejecter) => { resolve = resolver; reject = rejecter; });
  return { promise, resolve, reject };
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

function createRpcClient(): FinanceRpcClient {
  return {
    createInvoice: vi.fn().mockResolvedValue({ id: 'invoice-1' }),
    addInvoiceItem: vi.fn().mockResolvedValue({ id: 'item-1' }),
    issueInvoice: vi.fn().mockResolvedValue({ id: 'invoice-1' }),
    voidInvoice: vi.fn().mockResolvedValue({ id: 'invoice-1' }),
    recordPayment: vi.fn().mockImplementation(async (input: { idempotencyKey: string }) => completedPatientCreditOperation(input.idempotencyKey)),
    getPatientCreditPaymentOperation: vi.fn().mockResolvedValue(completedPatientCreditOperation()),
    allocatePayment: vi.fn().mockResolvedValue({ id: 'allocation-1' }),
    voidPaymentAllocation: vi.fn().mockResolvedValue({ id: 'allocation-1' }),
    voidPayment: vi.fn().mockResolvedValue({ id: 'payment-1' }),
  } as unknown as FinanceRpcClient;
}

describe('useFinanceActions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseFinanceActionsResult | null;
  let refresh: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
    refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  function Probe({ rpcClient, tenant = tenantId, patient = patientId }: { rpcClient: FinanceRpcClient; tenant?: string | null; patient?: string | null }) {
    latest = useFinanceActions({ tenantId: tenant, patientId: patient, refresh, rpcClient });
    return null;
  }

  async function renderHook(rpcClient = createRpcClient()) {
    await act(async () => { root.render(<Probe rpcClient={rpcClient} />); });
    return rpcClient;
  }

  it('calls FinanceRpcClient.createInvoice and refreshes', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.createInvoice({ notes: 'Draft' }); });
    expect(rpcClient.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ tenantId, patientId, notes: 'Draft' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('calls addInvoiceItem', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.addInvoiceItem({ invoiceId: 'invoice-1', serviceName: 'Service', quantity: 1, unitPrice: 1000 }); });
    expect(rpcClient.addInvoiceItem).toHaveBeenCalledWith(expect.objectContaining({ tenantId, invoiceId: 'invoice-1', serviceName: 'Service', quantity: 1, unitPrice: 1000 }));
  });

  it('refreshes and shows the safe race message after a completed-service duplicate', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.addInvoiceItem).mockRejectedValueOnce(new Error('Эта выполненная услуга уже включена в другой счёт.'));
    await renderHook(rpcClient);
    let thrown: unknown;
    await act(async () => {
      try { await latest?.addInvoiceItem({ invoiceId: 'invoice-1', serviceName: 'Service', quantity: 1, unitPrice: 1000, completedServiceId: 'service-1' }); } catch (error) { thrown = error; }
    });
    expect((thrown as Error).message).toBe('Услуга уже была включена в другой счёт. Данные обновлены.');
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('calls issueInvoice', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.issueInvoice('invoice-1'); });
    expect(rpcClient.issueInvoice).toHaveBeenCalledWith({ tenantId, invoiceId: 'invoice-1' });
  });

  it('calls hardened recordPayment with a stable patient-credit operation key', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); });
    expect(rpcClient.recordPayment).toHaveBeenCalledWith(expect.objectContaining({
      tenantId,
      patientId,
      amount: 1000,
      paymentMethod: 'cash',
      idempotencyKey: expect.stringMatching(/^patient-credit:tenant-1:patient-1:/),
    }));
    expect(rpcClient.getPatientCreditPaymentOperation).not.toHaveBeenCalled();
  });

  it('recovers an uncertain response with the same operation key without creating a new request', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.recordPayment).mockRejectedValueOnce(new FinanceRpcClientError({
      operation: 'recordPayment',
      category: 'operation_uncertain',
      message: 'network',
    }));
    vi.mocked(rpcClient.getPatientCreditPaymentOperation).mockImplementationOnce(async (input) => completedPatientCreditOperation(input.idempotencyKey));
    await renderHook(rpcClient);

    await act(async () => { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); });

    const writeKey = vi.mocked(rpcClient.recordPayment).mock.calls[0][0].idempotencyKey;
    expect(rpcClient.getPatientCreditPaymentOperation).toHaveBeenCalledWith({ tenantId, patientId, idempotencyKey: writeKey });
    expect(rpcClient.recordPayment).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('retries a confirmed not_found operation exactly once with the same operation key', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.recordPayment)
      .mockRejectedValueOnce(new FinanceRpcClientError({ operation: 'recordPayment', category: 'operation_uncertain', message: 'network' }))
      .mockImplementationOnce(async (input) => completedPatientCreditOperation(input.idempotencyKey));
    vi.mocked(rpcClient.getPatientCreditPaymentOperation).mockImplementationOnce(async (input) => ({
      status: 'not_found', operationId: input.idempotencyKey, tenantId, patientId, payment: null, capacity: null,
    }));
    await renderHook(rpcClient);

    await act(async () => { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); });

    expect(rpcClient.recordPayment).toHaveBeenCalledTimes(2);
    const firstKey = vi.mocked(rpcClient.recordPayment).mock.calls[0][0].idempotencyKey;
    const retryKey = vi.mocked(rpcClient.recordPayment).mock.calls[1][0].idempotencyKey;
    expect(retryKey).toBe(firstKey);
  });

  it('retains an unresolved key and blocks a changed payload until reconciliation succeeds', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.recordPayment).mockRejectedValue(new FinanceRpcClientError({ operation: 'recordPayment', category: 'operation_uncertain', message: 'network' }));
    vi.mocked(rpcClient.getPatientCreditPaymentOperation).mockRejectedValue(new FinanceRpcClientError({ operation: 'getPatientCreditPaymentOperation', category: 'operation_uncertain', message: 'network' }));
    await renderHook(rpcClient);

    let firstError: unknown;
    await act(async () => {
      try { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); } catch (error) { firstError = error; }
    });
    expect(firstError).toBeInstanceOf(Error);

    let changedError: unknown;
    await act(async () => {
      try { await latest?.recordPayment({ amount: 2000, paymentMethod: 'cash' }); } catch (error) { changedError = error; }
    });
    expect((changedError as Error).message).toBe('Не удалось подтвердить результат операции. Повторите попытку с теми же данными.');
    expect(rpcClient.recordPayment).toHaveBeenCalledOnce();
  });

  it('keeps unresolved operation keys scoped to the correct patient', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.recordPayment).mockRejectedValue(new FinanceRpcClientError({ operation: 'recordPayment', category: 'operation_uncertain', message: 'network' }));
    vi.mocked(rpcClient.getPatientCreditPaymentOperation).mockRejectedValue(new FinanceRpcClientError({ operation: 'getPatientCreditPaymentOperation', category: 'operation_uncertain', message: 'network' }));
    await renderHook(rpcClient);

    await act(async () => {
      try { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); } catch { /* unresolved for patient 1 */ }
    });
    await act(async () => { root.render(<Probe rpcClient={rpcClient} patient="patient-2" />); });
    await act(async () => {
      try { await latest?.recordPayment({ amount: 2000, paymentMethod: 'cash' }); } catch { /* unresolved for patient 2 */ }
    });

    expect(rpcClient.recordPayment).toHaveBeenCalledTimes(2);
    const first = vi.mocked(rpcClient.recordPayment).mock.calls[0][0];
    const second = vi.mocked(rpcClient.recordPayment).mock.calls[1][0];
    expect(first.patientId).toBe(patientId);
    expect(second.patientId).toBe('patient-2');
    expect(first.idempotencyKey).not.toBe(second.idempotencyKey);
  });

  it('shows submitting, reconciling and succeeded states for one operation', async () => {
    const rpcClient = createRpcClient();
    const write = deferred<PatientCreditPaymentOperationResult>();
    const recovery = deferred<PatientCreditPaymentOperationResult>();
    vi.mocked(rpcClient.recordPayment).mockReturnValueOnce(write.promise);
    vi.mocked(rpcClient.getPatientCreditPaymentOperation).mockReturnValueOnce(recovery.promise);
    await renderHook(rpcClient);

    let operationPromise!: Promise<PatientCreditPaymentOperationResult>;
    act(() => { operationPromise = latest!.recordPayment({ amount: 1000, paymentMethod: 'cash' }); });
    expect(latest?.patientCreditOperationStatus).toBe('submitting');

    write.reject(new FinanceRpcClientError({ operation: 'recordPayment', category: 'operation_uncertain', message: 'network' }));
    await flush();
    expect(latest?.patientCreditOperationStatus).toBe('reconciling');

    recovery.resolve(completedPatientCreditOperation());
    await act(async () => { await operationPromise; });
    expect(latest?.patientCreditOperationStatus).toBe('succeeded');
    expect(latest?.patientCreditOperationResult?.payment?.id).toBe('payment-1');
  });

  it('clears a completed operation so a new payload gets a new key', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); });
    await act(async () => { await latest?.recordPayment({ amount: 2000, paymentMethod: 'cash' }); });
    const first = vi.mocked(rpcClient.recordPayment).mock.calls[0][0].idempotencyKey;
    const second = vi.mocked(rpcClient.recordPayment).mock.calls[1][0].idempotencyKey;
    expect(second).not.toBe(first);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('clears pending identity after a permission failure', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.recordPayment)
      .mockRejectedValueOnce(new FinanceRpcClientError({ operation: 'recordPayment', category: 'permission', message: 'denied' }))
      .mockImplementationOnce(async (input) => completedPatientCreditOperation(input.idempotencyKey));
    await renderHook(rpcClient);
    await act(async () => { try { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); } catch { /* expected */ } });
    await act(async () => { await latest?.recordPayment({ amount: 2000, paymentMethod: 'cash' }); });
    expect(rpcClient.recordPayment).toHaveBeenCalledTimes(2);
  });

  it('clears pending identity after a validation failure', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.recordPayment)
      .mockRejectedValueOnce(new FinanceRpcClientError({ operation: 'recordPayment', category: 'validation', message: 'invalid amount' }))
      .mockImplementationOnce(async (input) => completedPatientCreditOperation(input.idempotencyKey));
    await renderHook(rpcClient);
    await act(async () => { try { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); } catch { /* expected */ } });
    await act(async () => { await latest?.recordPayment({ amount: 2000, paymentMethod: 'cash' }); });
    expect(rpcClient.recordPayment).toHaveBeenCalledTimes(2);
  });

  it('ignores a late success after patient context changes', async () => {
    const rpcClient = createRpcClient();
    const write = deferred<PatientCreditPaymentOperationResult>();
    vi.mocked(rpcClient.recordPayment).mockReturnValueOnce(write.promise);
    await renderHook(rpcClient);
    let operationPromise!: Promise<PatientCreditPaymentOperationResult>;
    act(() => { operationPromise = latest!.recordPayment({ amount: 1000, paymentMethod: 'cash' }); });
    await act(async () => { root.render(<Probe rpcClient={rpcClient} patient="patient-2" />); });
    write.resolve(completedPatientCreditOperation('operation-a'));
    await act(async () => { await operationPromise; });
    expect(latest?.patientCreditOperationStatus).toBe('idle');
    expect(latest?.patientCreditOperationResult).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('ignores a late success after tenant context changes', async () => {
    const rpcClient = createRpcClient();
    const write = deferred<PatientCreditPaymentOperationResult>();
    vi.mocked(rpcClient.recordPayment).mockReturnValueOnce(write.promise);
    await renderHook(rpcClient);
    let operationPromise!: Promise<PatientCreditPaymentOperationResult>;
    act(() => { operationPromise = latest!.recordPayment({ amount: 1000, paymentMethod: 'cash' }); });
    await act(async () => { root.render(<Probe rpcClient={rpcClient} tenant="tenant-2" />); });
    write.resolve(completedPatientCreditOperation('operation-a'));
    await act(async () => { await operationPromise; });
    expect(latest?.patientCreditOperationStatus).toBe('idle');
    expect(latest?.patientCreditOperationResult).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('does not refresh after an unresolved failure', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.recordPayment).mockRejectedValue(new FinanceRpcClientError({ operation: 'recordPayment', category: 'operation_uncertain', message: 'network' }));
    vi.mocked(rpcClient.getPatientCreditPaymentOperation).mockRejectedValue(new FinanceRpcClientError({ operation: 'getPatientCreditPaymentOperation', category: 'operation_uncertain', message: 'network' }));
    await renderHook(rpcClient);
    await act(async () => { try { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); } catch { /* expected */ } });
    expect(latest?.patientCreditOperationStatus).toBe('uncertain');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('deduplicates rapid concurrent submits inside the hook', async () => {
    const rpcClient = createRpcClient();
    const write = deferred<PatientCreditPaymentOperationResult>();
    vi.mocked(rpcClient.recordPayment).mockReturnValueOnce(write.promise);
    await renderHook(rpcClient);
    let first!: Promise<PatientCreditPaymentOperationResult>;
    let second!: Promise<PatientCreditPaymentOperationResult>;
    act(() => {
      first = latest!.recordPayment({ amount: 1000, paymentMethod: 'cash' });
      second = latest!.recordPayment({ amount: 1000, paymentMethod: 'cash' });
    });
    expect(first).toBe(second);
    expect(rpcClient.recordPayment).toHaveBeenCalledOnce();
    write.resolve(completedPatientCreditOperation());
    await act(async () => { await Promise.all([first, second]); });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it('calls allocatePayment', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.allocatePayment({ paymentId: 'payment-1', invoiceId: 'invoice-1', amount: 1000 }); });
    expect(rpcClient.allocatePayment).toHaveBeenCalledWith(expect.objectContaining({ tenantId, paymentId: 'payment-1', invoiceId: 'invoice-1', amount: 1000 }));
  });

  it('calls void methods', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.voidInvoice('invoice-1', 'reason'); });
    await act(async () => { await latest?.voidPaymentAllocation('allocation-1', 'reason'); });
    await act(async () => { await latest?.voidPayment('payment-1', 'reason'); });
    expect(rpcClient.voidInvoice).toHaveBeenCalledWith({ tenantId, invoiceId: 'invoice-1', reason: 'reason' });
    expect(rpcClient.voidPaymentAllocation).toHaveBeenCalledWith({ tenantId, allocationId: 'allocation-1', reason: 'reason' });
    expect(rpcClient.voidPayment).toHaveBeenCalledWith({ tenantId, paymentId: 'payment-1', reason: 'reason' });
  });

  it('failed actions surface safe error', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.createInvoice).mockRejectedValueOnce(new Error('Access denied: secret stack'));
    await renderHook(rpcClient);
    let thrown: unknown;
    await act(async () => {
      try { await latest?.createInvoice(); } catch (error) { thrown = error; }
    });
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('Недостаточно прав для финансовой операции.');
    expect(latest?.actionError?.message).toBe('Недостаточно прав для финансовой операции.');
  });

  it('does not call RPC without tenantId', async () => {
    const rpcClient = createRpcClient();
    await act(async () => { root.render(<Probe tenant={null} rpcClient={rpcClient} />); });
    await expect(latest?.createInvoice()).rejects.toThrow('Не выбрана клиника.');
    expect(rpcClient.createInvoice).not.toHaveBeenCalled();
  });
});

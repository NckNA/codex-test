// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useFinanceActions, type UseFinanceActionsResult } from './useFinanceActions';
import type { FinanceRpcClient } from '../repositories/FinanceRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const tenantId = 'tenant-1';
const patientId = 'patient-1';

function createRpcClient(): FinanceRpcClient {
  return {
    createInvoice: vi.fn().mockResolvedValue({ id: 'invoice-1' }),
    addInvoiceItem: vi.fn().mockResolvedValue({ id: 'item-1' }),
    issueInvoice: vi.fn().mockResolvedValue({ id: 'invoice-1' }),
    voidInvoice: vi.fn().mockResolvedValue({ id: 'invoice-1' }),
    recordPayment: vi.fn().mockResolvedValue({ id: 'payment-1' }),
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

  it('calls issueInvoice', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.issueInvoice('invoice-1'); });
    expect(rpcClient.issueInvoice).toHaveBeenCalledWith({ tenantId, invoiceId: 'invoice-1' });
  });

  it('calls recordPayment', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.recordPayment({ amount: 1000, paymentMethod: 'cash' }); });
    expect(rpcClient.recordPayment).toHaveBeenCalledWith(expect.objectContaining({ tenantId, patientId, amount: 1000, paymentMethod: 'cash' }));
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

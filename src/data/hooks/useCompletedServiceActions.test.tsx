// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCompletedServiceActions, type UseCompletedServiceActionsResult } from './useCompletedServiceActions';
import type { CompletedService } from '../repositories/EncounterVisitRepository';
import type { EncounterVisitRpcClient } from '../repositories/EncounterVisitRpcClient';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const baseService: CompletedService = {
  id: 'service-1', tenantId: 'tenant-1', patientId: 'patient-1', visitId: null, encounterId: null, appointmentId: null,
  findingId: null, treatmentPlanId: null, treatmentStageId: null, clinicalDictionaryItemId: null, serviceCode: null,
  serviceName: 'Smoke completed service', toothNumber: null, toothSurface: null, quantity: 1, unitPrice: 1000,
  totalAmount: 1000, currency: 'KZT', performedBy: 'doctor-1', performedAt: '2026-06-20T08:00:00.000Z',
  status: 'completed', correctionOfId: null, correctionReason: null, voidedAt: null, voidedBy: null, archivedAt: null,
  archivedBy: null, createdBy: null, updatedBy: null, metadata: {}, createdAt: '2026-06-20T08:00:00.000Z', updatedAt: '2026-06-20T08:00:00.000Z',
};

function createRpcClient(): EncounterVisitRpcClient {
  return {
    recordCompletedService: vi.fn().mockResolvedValue(baseService),
    voidCompletedService: vi.fn().mockResolvedValue({ ...baseService, status: 'voided' }),
  } as unknown as EncounterVisitRpcClient;
}

describe('useCompletedServiceActions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseCompletedServiceActionsResult | null;
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

  function Probe({ tenantId = 'tenant-1', patientId = 'patient-1', rpcClient }: { tenantId?: string | null; patientId?: string | null; rpcClient: EncounterVisitRpcClient }) {
    latest = useCompletedServiceActions({ tenantId, patientId, refresh, rpcClient });
    return null;
  }

  async function renderHook(rpcClient = createRpcClient()) {
    await act(async () => { root.render(<Probe rpcClient={rpcClient} />); });
    return rpcClient;
  }

  async function expectActionFailure(action: () => Promise<void>, message: string) {
    let thrown: unknown;
    await act(async () => {
      try { await action(); } catch (err) { thrown = err; }
    });
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain(message);
  }

  it('recordService calls EncounterVisitRpcClient.recordCompletedService', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.recordService({ serviceName: 'Smoke completed service', quantity: 1, unitPrice: 1000, totalAmount: 1000 }); });
    expect(rpcClient.recordCompletedService).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', patientId: 'patient-1', serviceName: 'Smoke completed service', quantity: 1, currency: 'KZT' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('voidService calls EncounterVisitRpcClient.voidCompletedService', async () => {
    const rpcClient = await renderHook();
    await act(async () => { await latest?.voidService('service-1', 'Smoke void reason'); });
    expect(rpcClient.voidCompletedService).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', completedServiceId: 'service-1', reason: 'Smoke void reason' }));
    expect(refresh).toHaveBeenCalled();
  });

  it('validates serviceName', async () => {
    const rpcClient = await renderHook();
    await expectActionFailure(() => latest!.recordService({ serviceName: '   ', quantity: 1 }), 'Service name is required');
    expect(rpcClient.recordCompletedService).not.toHaveBeenCalled();
  });

  it('validates quantity', async () => {
    const rpcClient = await renderHook();
    await expectActionFailure(() => latest!.recordService({ serviceName: 'A', quantity: 0 }), 'Quantity must be greater than zero');
    expect(rpcClient.recordCompletedService).not.toHaveBeenCalled();
  });

  it('validates negative amounts', async () => {
    const rpcClient = await renderHook();
    await expectActionFailure(() => latest!.recordService({ serviceName: 'A', quantity: 1, unitPrice: -1 }), 'Amount cannot be negative');
    expect(rpcClient.recordCompletedService).not.toHaveBeenCalled();
  });

  it('validates void reason', async () => {
    const rpcClient = await renderHook();
    await expectActionFailure(() => latest!.voidService('service-1', '   '), 'Reason is required');
    expect(rpcClient.voidCompletedService).not.toHaveBeenCalled();
  });

  it('failed actions show safe error', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.voidCompletedService).mockRejectedValueOnce(new Error('permission denied'));
    await renderHook(rpcClient);
    await expectActionFailure(() => latest!.voidService('service-1', 'reason'), 'Permission denied');
    expect(latest?.error?.message).toBe('Permission denied.');
  });
});

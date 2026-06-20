// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVisitLifecycleActions, type UseVisitLifecycleActionsResult } from './useVisitLifecycleActions';
import type { EncounterVisitRpcClient } from '../repositories/EncounterVisitRpcClient';
import type { PatientVisit } from '../repositories/EncounterVisitRepository';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
  isSupabaseConfigured: true,
}));

const visit: PatientVisit = {
  id: 'visit-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  appointmentId: null,
  status: 'checked_in',
  visitType: 'regular',
  arrivedAt: '2026-06-20T08:00:00.000Z',
  checkedInAt: '2026-06-20T08:00:00.000Z',
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  archivedAt: null,
  createdBy: null,
  updatedBy: null,
  archivedBy: null,
  notes: null,
  metadata: {},
  createdAt: '2026-06-20T08:00:00.000Z',
  updatedAt: '2026-06-20T08:00:00.000Z',
};

function createRpcClient(overrides: Partial<EncounterVisitRpcClient> = {}): EncounterVisitRpcClient {
  return {
    checkInPatientVisit: vi.fn().mockResolvedValue(visit),
    startPatientVisit: vi.fn().mockResolvedValue({ ...visit, status: 'in_progress' }),
    completePatientVisit: vi.fn().mockResolvedValue({ ...visit, status: 'completed' }),
    cancelPatientVisit: vi.fn().mockResolvedValue({ ...visit, status: 'cancelled' }),
    createClinicalEncounter: vi.fn(),
    startClinicalEncounter: vi.fn(),
    completeClinicalEncounter: vi.fn(),
    recordCompletedService: vi.fn(),
    voidCompletedService: vi.fn(),
    ...overrides,
  } as EncounterVisitRpcClient;
}

describe('useVisitLifecycleActions', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  async function renderHook(hook: () => UseVisitLifecycleActionsResult) {
    let latest: UseVisitLifecycleActionsResult | undefined;
    const Probe = () => {
      const result = hook();
      useEffect(() => {
        latest = result;
      }, [result]);
      return null;
    };

    await act(async () => {
      root.render(<Probe />);
    });
    return () => latest!;
  }

  it('checkInVisit calls EncounterVisitRpcClient.checkInPatientVisit and refreshes', async () => {
    const rpcClient = createRpcClient();
    const refresh = vi.fn().mockResolvedValue(undefined);
    const getResult = await renderHook(() => useVisitLifecycleActions({ tenantId: 'tenant-1', patientId: 'patient-1', rpcClient, refresh }));

    await act(async () => {
      await getResult().checkInVisit({ visitType: 'consultation', notes: 'note' });
    });

    expect(rpcClient.checkInPatientVisit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      visitType: 'consultation',
      notes: 'note',
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it('startVisit calls startPatientVisit', async () => {
    const rpcClient = createRpcClient();
    const getResult = await renderHook(() => useVisitLifecycleActions({ tenantId: 'tenant-1', patientId: 'patient-1', rpcClient }));

    await act(async () => {
      await getResult().startVisit('visit-1');
    });

    expect(rpcClient.startPatientVisit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', visitId: 'visit-1' }));
  });

  it('completeVisit calls completePatientVisit', async () => {
    const rpcClient = createRpcClient();
    const getResult = await renderHook(() => useVisitLifecycleActions({ tenantId: 'tenant-1', patientId: 'patient-1', rpcClient }));

    await act(async () => {
      await getResult().completeVisit('visit-1');
    });

    expect(rpcClient.completePatientVisit).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', visitId: 'visit-1' }));
  });

  it('cancelVisit calls cancelPatientVisit and requires reason', async () => {
    const rpcClient = createRpcClient();
    const getResult = await renderHook(() => useVisitLifecycleActions({ tenantId: 'tenant-1', patientId: 'patient-1', rpcClient }));

    await expect(getResult().cancelVisit({ visitId: 'visit-1', reason: '' })).rejects.toThrow('Укажите причину отмены визита.');

    await act(async () => {
      await getResult().cancelVisit({ visitId: 'visit-1', reason: 'Пациент ушёл' });
    });

    expect(rpcClient.cancelPatientVisit).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      visitId: 'visit-1',
      reason: 'Пациент ушёл',
    }));
  });

  it('failed action surfaces a safe error', async () => {
    const rpcClient = createRpcClient({
      startPatientVisit: vi.fn().mockRejectedValue(new Error('permission denied for rpc')),
    });
    const getResult = await renderHook(() => useVisitLifecycleActions({ tenantId: 'tenant-1', patientId: 'patient-1', rpcClient }));

    await act(async () => {
      await expect(getResult().startVisit('visit-1')).rejects.toThrow('Недостаточно прав для действия.');
    });

    expect(getResult().error?.message).toBe('Недостаточно прав для действия.');
  });

  it('does not call clinical encounter or completed service RPCs from visit lifecycle actions', async () => {
    const rpcClient = createRpcClient();
    const getResult = await renderHook(() => useVisitLifecycleActions({ tenantId: 'tenant-1', patientId: 'patient-1', rpcClient }));

    await act(async () => {
      await getResult().startVisit('visit-1');
    });

    expect(rpcClient.createClinicalEncounter).not.toHaveBeenCalled();
    expect(rpcClient.recordCompletedService).not.toHaveBeenCalled();
  });
});

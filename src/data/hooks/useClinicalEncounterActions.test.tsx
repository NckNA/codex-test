// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClinicalEncounterActions, type UseClinicalEncounterActionsResult } from './useClinicalEncounterActions';
import type { ClinicalEncounter } from '../repositories/EncounterVisitRepository';
import type { EncounterVisitRpcClient } from '../repositories/EncounterVisitRpcClient';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
  isSupabaseConfigured: true,
}));

const baseEncounter: ClinicalEncounter = {
  id: 'encounter-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  visitId: null,
  appointmentId: null,
  doctorUserId: 'doctor-1',
  status: 'draft',
  encounterType: 'consultation',
  startedAt: null,
  completedAt: null,
  lockedAt: null,
  archivedAt: null,
  createdBy: null,
  updatedBy: null,
  lockedBy: null,
  archivedBy: null,
  chiefComplaintSnapshot: 'Pain',
  clinicalSummary: null,
  correctionReason: null,
  metadata: {},
  createdAt: '2026-06-20T08:00:00.000Z',
  updatedAt: '2026-06-20T08:00:00.000Z',
};

function createRpcClient(): EncounterVisitRpcClient {
  return {
    createClinicalEncounter: vi.fn().mockResolvedValue(baseEncounter),
    startClinicalEncounter: vi.fn().mockResolvedValue({ ...baseEncounter, status: 'in_progress' }),
    completeClinicalEncounter: vi.fn().mockResolvedValue({ ...baseEncounter, status: 'completed' }),
  } as unknown as EncounterVisitRpcClient;
}

describe('useClinicalEncounterActions', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseClinicalEncounterActionsResult | null;
  let refresh: ReturnType<typeof vi.fn<() => Promise<void>>>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
    refresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  });

  afterEach(() => {
    root.unmount();
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  function Probe({
    tenantId = 'tenant-1',
    patientId = 'patient-1',
    rpcClient,
  }: {
    tenantId?: string | null;
    patientId?: string | null;
    rpcClient: EncounterVisitRpcClient;
  }) {
    latest = useClinicalEncounterActions({ tenantId, patientId, refresh, rpcClient });
    return null;
  }

  async function renderHook(rpcClient = createRpcClient()) {
    await act(async () => {
      root.render(<Probe rpcClient={rpcClient} />);
    });
    return rpcClient;
  }

  it('createEncounter calls EncounterVisitRpcClient.createClinicalEncounter', async () => {
    const rpcClient = await renderHook();

    await act(async () => {
      await latest?.createEncounter({ encounterType: 'consultation', chiefComplaintSnapshot: 'Pain' });
    });

    expect(rpcClient.createClinicalEncounter).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterType: 'consultation',
      chiefComplaintSnapshot: 'Pain',
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it('startEncounter calls startClinicalEncounter', async () => {
    const rpcClient = await renderHook();

    await act(async () => {
      await latest?.startEncounter('encounter-1');
    });

    expect(rpcClient.startClinicalEncounter).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      encounterId: 'encounter-1',
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it('completeEncounter calls completeClinicalEncounter', async () => {
    const rpcClient = await renderHook();

    await act(async () => {
      await latest?.completeEncounter({ encounterId: 'encounter-1', clinicalSummary: 'Completed safely' });
    });

    expect(rpcClient.completeClinicalEncounter).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      encounterId: 'encounter-1',
      clinicalSummary: 'Completed safely',
    }));
    expect(refresh).toHaveBeenCalled();
  });

  it('failed actions surface safe error', async () => {
    const rpcClient = createRpcClient();
    vi.mocked(rpcClient.startClinicalEncounter).mockRejectedValueOnce(new Error('permission denied'));
    await renderHook(rpcClient);

    let thrown: unknown;
    await act(async () => {
      try {
        await latest?.startEncounter('encounter-1');
      } catch (err) {
        thrown = err;
      }
    });

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('Permission denied for clinical encounter action.');
    expect(latest?.error?.message).toBe('Permission denied for clinical encounter action.');
  });

  it('completeEncounter requires summary', async () => {
    const rpcClient = await renderHook();

    await expect(latest?.completeEncounter({ encounterId: 'encounter-1', clinicalSummary: '   ' })).rejects.toThrow('Clinical summary is required');
    expect(rpcClient.completeClinicalEncounter).not.toHaveBeenCalled();
  });
});

// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClinicalEncounters, type UseClinicalEncountersResult } from './useClinicalEncounters';
import type { ClinicalEncounter, EncounterVisitRepository } from '../repositories/EncounterVisitRepository';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {},
  isSupabaseConfigured: true,
}));

const baseEncounter: ClinicalEncounter = {
  id: 'encounter-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  visitId: 'visit-1',
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
  chiefComplaintSnapshot: 'Pain on bite',
  clinicalSummary: null,
  correctionReason: null,
  metadata: {},
  createdAt: '2026-06-20T08:00:00.000Z',
  updatedAt: '2026-06-20T08:00:00.000Z',
};

function createRepository(encounters: ClinicalEncounter[] = [baseEncounter]): EncounterVisitRepository {
  return {
    listClinicalEncounters: vi.fn().mockResolvedValue(encounters),
  } as unknown as EncounterVisitRepository;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('useClinicalEncounters', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseClinicalEncountersResult | null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    root.unmount();
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  function Probe({
    tenantId = 'tenant-1',
    patientId = 'patient-1',
    repository,
  }: {
    tenantId?: string | null;
    patientId?: string | null;
    repository: EncounterVisitRepository;
  }) {
    latest = useClinicalEncounters({ tenantId, patientId, repository });
    return null;
  }

  it('does not fetch without tenantId', async () => {
    const repository = createRepository();
    await act(async () => {
      root.render(<Probe tenantId={null} repository={repository} />);
    });
    await flush();

    expect(repository.listClinicalEncounters).not.toHaveBeenCalled();
    expect(latest?.encounters).toEqual([]);
  });

  it('does not fetch without patientId', async () => {
    const repository = createRepository();
    await act(async () => {
      root.render(<Probe patientId={null} repository={repository} />);
    });
    await flush();

    expect(repository.listClinicalEncounters).not.toHaveBeenCalled();
  });

  it('fetches through EncounterVisitRepository', async () => {
    const repository = createRepository();
    await act(async () => {
      root.render(<Probe repository={repository} />);
    });
    await flush();

    expect(repository.listClinicalEncounters).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      includeArchived: false,
    }));
    expect(latest?.encounters).toEqual([baseEncounter]);
  });

  it('surfaces repository errors', async () => {
    const repository = createRepository();
    vi.mocked(repository.listClinicalEncounters).mockRejectedValueOnce(new Error('repository failed'));

    await act(async () => {
      root.render(<Probe repository={repository} />);
    });
    await flush();

    expect(latest?.isError).toBe(true);
    expect(latest?.error?.message).toBe('repository failed');
  });

  it('refresh reloads encounters', async () => {
    const repository = createRepository();
    await act(async () => {
      root.render(<Probe repository={repository} />);
    });
    await flush();

    await act(async () => {
      await latest?.refresh();
    });

    expect(repository.listClinicalEncounters).toHaveBeenCalledTimes(2);
  });
});

// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientVisits, type UsePatientVisitsResult } from './usePatientVisits';
import type { EncounterVisitRepository, PatientVisit } from '../repositories/EncounterVisitRepository';

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

function createRepository(overrides: Partial<EncounterVisitRepository> = {}): EncounterVisitRepository {
  return {
    listPatientVisits: vi.fn().mockResolvedValue([visit]),
    getPatientVisitById: vi.fn(),
    listClinicalEncounters: vi.fn(),
    getClinicalEncounterById: vi.fn(),
    listCompletedServices: vi.fn(),
    getCompletedServiceById: vi.fn(),
    listPatientClinicalWorkflow: vi.fn(),
    ...overrides,
  } as EncounterVisitRepository;
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('usePatientVisits', () => {
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

  async function renderHook(hook: () => UsePatientVisitsResult) {
    let latest: UsePatientVisitsResult | undefined;
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
    await flush();
    return () => latest!;
  }

  it('does not fetch without tenantId', async () => {
    const repository = createRepository();

    await renderHook(() => usePatientVisits({ tenantId: null, patientId: 'patient-1', repository }));

    expect(repository.listPatientVisits).not.toHaveBeenCalled();
  });

  it('does not fetch without patientId', async () => {
    const repository = createRepository();

    await renderHook(() => usePatientVisits({ tenantId: 'tenant-1', patientId: null, repository }));

    expect(repository.listPatientVisits).not.toHaveBeenCalled();
  });

  it('fetches patient visits through EncounterVisitRepository', async () => {
    const repository = createRepository();
    const getResult = await renderHook(() => usePatientVisits({ tenantId: 'tenant-1', patientId: 'patient-1', repository }));

    expect(repository.listPatientVisits).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      includeArchived: false,
    }));
    expect(getResult().visits).toEqual([visit]);
  });

  it('surfaces repository errors', async () => {
    const repositoryError = new Error('Repository exploded');
    const repository = createRepository({
      listPatientVisits: vi.fn().mockRejectedValue(repositoryError),
    });

    const getResult = await renderHook(() => usePatientVisits({ tenantId: 'tenant-1', patientId: 'patient-1', repository }));

    expect(getResult().isError).toBe(true);
    expect(getResult().error).toBe(repositoryError);
  });

  it('refresh reloads visits', async () => {
    const repository = createRepository();
    const getResult = await renderHook(() => usePatientVisits({ tenantId: 'tenant-1', patientId: 'patient-1', repository }));

    await act(async () => {
      await getResult().refresh();
    });

    expect(repository.listPatientVisits).toHaveBeenCalledTimes(2);
  });
});

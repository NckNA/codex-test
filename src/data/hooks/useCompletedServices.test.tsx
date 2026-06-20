// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCompletedServices, type UseCompletedServicesResult } from './useCompletedServices';
import type { CompletedService, EncounterVisitRepository } from '../repositories/EncounterVisitRepository';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const baseService: CompletedService = {
  id: 'service-1',
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  visitId: 'visit-1',
  encounterId: 'encounter-1',
  appointmentId: null,
  findingId: null,
  treatmentPlanId: null,
  treatmentStageId: null,
  clinicalDictionaryItemId: null,
  serviceCode: 'SRV-1',
  serviceName: 'Smoke completed service',
  toothNumber: '16',
  toothSurface: 'O',
  quantity: 1,
  unitPrice: 1000,
  totalAmount: 1000,
  currency: 'KZT',
  performedBy: 'doctor-1',
  performedAt: '2026-06-20T08:00:00.000Z',
  status: 'completed',
  correctionOfId: null,
  correctionReason: null,
  voidedAt: null,
  voidedBy: null,
  archivedAt: null,
  archivedBy: null,
  createdBy: null,
  updatedBy: null,
  metadata: {},
  createdAt: '2026-06-20T08:00:00.000Z',
  updatedAt: '2026-06-20T08:00:00.000Z',
};

function createRepository(services: CompletedService[] = [baseService]): EncounterVisitRepository {
  return { listCompletedServices: vi.fn().mockResolvedValue(services) } as unknown as EncounterVisitRepository;
}

async function flush() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
}

describe('useCompletedServices', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseCompletedServicesResult | null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.removeChild(container);
    vi.restoreAllMocks();
  });

  function Probe({ tenantId = 'tenant-1', patientId = 'patient-1', repository }: { tenantId?: string | null; patientId?: string | null; repository: EncounterVisitRepository }) {
    latest = useCompletedServices({ tenantId, patientId, repository });
    return null;
  }

  it('does not fetch without tenantId', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Probe tenantId={null} repository={repository} />); });
    await flush();
    expect(repository.listCompletedServices).not.toHaveBeenCalled();
    expect(latest?.services).toEqual([]);
  });

  it('does not fetch without patientId', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Probe patientId={null} repository={repository} />); });
    await flush();
    expect(repository.listCompletedServices).not.toHaveBeenCalled();
  });

  it('fetches through EncounterVisitRepository', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Probe repository={repository} />); });
    await flush();
    expect(repository.listCompletedServices).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-1', patientId: 'patient-1', includeVoided: true }));
    expect(latest?.services).toEqual([baseService]);
  });

  it('surfaces repository errors', async () => {
    const repository = createRepository();
    vi.mocked(repository.listCompletedServices).mockRejectedValueOnce(new Error('repository failed'));
    await act(async () => { root.render(<Probe repository={repository} />); });
    await flush();
    expect(latest?.isError).toBe(true);
    expect(latest?.error?.message).toBe('repository failed');
  });

  it('refresh reloads services', async () => {
    const repository = createRepository();
    await act(async () => { root.render(<Probe repository={repository} />); });
    await flush();
    await act(async () => { await latest?.refresh(); });
    expect(repository.listCompletedServices).toHaveBeenCalledTimes(2);
  });
});


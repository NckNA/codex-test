// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLaboratoryMutationOptions, type UseLaboratoryMutationOptionsResult } from './useLaboratoryMutationOptions';
import { useLaboratoryWorkRepository, type UseLaboratoryWorkRepositoryResult } from './useLaboratoryWorkRepository';
import type { ILaboratoryWorkRepository } from '../repositories/LaboratoryWorkRepository';
import type { IDoctorRepository } from '../repositories/DoctorRepository';

vi.mock('./useLaboratoryWorkRepository', () => ({ useLaboratoryWorkRepository: vi.fn() }));
const mockedSelection = vi.mocked(useLaboratoryWorkRepository);

function repository(): ILaboratoryWorkRepository {
  return {
    listLaboratories: vi.fn().mockResolvedValue([{ id: 'lab-1', tenantId: 'tenant-1', name: 'Lab', active: true, notes: null, createdAt: 'x', updatedAt: 'x' }]),
    listWorkTypes: vi.fn().mockResolvedValue([{ id: 'type-1', tenantId: 'tenant-1', name: 'Crown', code: 'CR', active: false, sortOrder: 1, createdAt: 'x', updatedAt: 'x' }]),
    listOrderWorkTypeIds: vi.fn().mockResolvedValue(['type-1']),
  } as unknown as ILaboratoryWorkRepository;
}

function doctors(): IDoctorRepository {
  return {
    listDoctors: vi.fn().mockResolvedValue([{ id: 'doctor-1', fullName: 'Doctor A', specialization: '', cabinet: '', color: '', active: false }]),
    listActiveDoctors: vi.fn(),
  };
}

describe('useLaboratoryMutationOptions', () => {
  let root: Root;
  let container: HTMLDivElement;
  let latest: UseLaboratoryMutationOptionsResult | null;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  function Probe({ orderId, doctorRepositoryFactory }: { orderId?: string; doctorRepositoryFactory?: () => IDoctorRepository }) {
    latest = useLaboratoryMutationOptions(orderId, { doctorRepositoryFactory });
    return null;
  }

  it('fails closed outside a ready Supabase tenant/user context', async () => {
    mockedSelection.mockReturnValue({ backend: 'local', tenantId: 'tenant-1', userId: 'user-1', ready: true, repository: repository() } as UseLaboratoryWorkRepositoryResult);
    await act(async () => root.render(<Probe />));
    expect(latest?.ready).toBe(false);
    expect(latest?.doctors).toEqual([]);
  });

  it('loads all references and exact selected work types for one edit order', async () => {
    const repo = repository();
    const doctorRepo = doctors();
    mockedSelection.mockReturnValue({ backend: 'supabase', tenantId: 'tenant-1', userId: 'user-1', ready: true, repository: repo } as UseLaboratoryWorkRepositoryResult);
    await act(async () => {
      root.render(<Probe orderId="order-1" doctorRepositoryFactory={() => doctorRepo} />);
      await Promise.resolve();
    });
    await act(async () => { await Promise.resolve(); });
    expect(latest?.ready).toBe(true);
    expect(latest?.doctors).toEqual([{ id: 'doctor-1', name: 'Doctor A', active: false }]);
    expect(latest?.selectedWorkTypeIds).toEqual(['type-1']);
    expect(repo.listLaboratories).toHaveBeenCalledWith(true);
    expect(repo.listWorkTypes).toHaveBeenCalledWith(true);
    expect(repo.listOrderWorkTypeIds).toHaveBeenCalledWith('order-1');
  });

  it('returns a bounded safe error when reference loading fails', async () => {
    const repo = repository();
    vi.mocked(repo.listLaboratories).mockRejectedValueOnce(new Error('raw backend detail'));
    mockedSelection.mockReturnValue({ backend: 'supabase', tenantId: 'tenant-1', userId: 'user-1', ready: true, repository: repo } as UseLaboratoryWorkRepositoryResult);
    await act(async () => {
      root.render(<Probe doctorRepositoryFactory={() => doctors()} />);
      await Promise.resolve();
    });
    await act(async () => { await Promise.resolve(); });
    expect(latest?.ready).toBe(false);
    expect(latest?.error?.message).toBe('Не удалось загрузить варианты для лабораторной работы.');
  });
});

// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLaboratoryPatientLookup, type UseLaboratoryPatientLookupResult } from './useLaboratoryPatientLookup';
import { useLaboratoryWorkRepository, type UseLaboratoryWorkRepositoryResult } from './useLaboratoryWorkRepository';
import type { PatientLookupRecord, PatientLookupRepository } from '../repositories/PatientRepository';

vi.mock('./useLaboratoryWorkRepository', () => ({ useLaboratoryWorkRepository: vi.fn() }));
const mockedSelection = vi.mocked(useLaboratoryWorkRepository);

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function lookupRepository(result: PatientLookupRecord[] = []): PatientLookupRepository {
  return { searchPatientLookup: vi.fn().mockResolvedValue(result) };
}

function selection(overrides: Partial<UseLaboratoryWorkRepositoryResult> = {}): UseLaboratoryWorkRepositoryResult {
  return {
    backend: 'supabase',
    tenantId: 'tenant-a',
    userId: 'user-a',
    ready: true,
    repository: {} as UseLaboratoryWorkRepositoryResult['repository'],
    ...overrides,
  };
}

describe('useLaboratoryPatientLookup', () => {
  let container: HTMLDivElement;
  let root: Root;
  let latest: UseLaboratoryPatientLookupResult | null;
  let currentSelection: UseLaboratoryWorkRepositoryResult;

  beforeEach(() => {
    vi.clearAllMocks();
    currentSelection = selection();
    mockedSelection.mockImplementation(() => currentSelection);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    latest = null;
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function Probe({ repository }: { repository?: PatientLookupRepository }) {
    latest = useLaboratoryPatientLookup({ repository });
    return null;
  }

  async function render(repository?: PatientLookupRepository) {
    await act(async () => root.render(<Probe repository={repository} />));
  }

  it('fails closed outside an active Supabase tenant/user context', async () => {
    const repository = lookupRepository();
    currentSelection = selection({ backend: 'local', ready: true });
    await render(repository);
    expect(latest?.ready).toBe(false);
    await act(async () => latest?.search('Alice'));
    expect(repository.searchPatientLookup).not.toHaveBeenCalled();
    expect(latest?.error?.message).toBe('Не удалось найти пациента.');
  });

  it('does not call the repository before the minimum query length', async () => {
    const repository = lookupRepository();
    await render(repository);
    await act(async () => latest?.search(' a '));
    expect(repository.searchPatientLookup).not.toHaveBeenCalled();
    expect(latest?.results).toEqual([]);
    expect(latest?.error).toBeNull();
  });

  it('returns only bounded lookup results and exposes no patient writes', async () => {
    const result = [{ id: 'patient-1', fullName: 'Alice', phone: '+7700', status: 'active' }];
    const repository = lookupRepository(result);
    await render(repository);
    await act(async () => latest?.search(' Alice '));
    expect(repository.searchPatientLookup).toHaveBeenCalledWith({ query: 'Alice', limit: 20 });
    expect(latest?.results).toEqual(result);
    expect(latest?.query).toBe(' Alice ');
    expect('createPatient' in (latest ?? {})).toBe(false);
    expect('updatePatient' in (latest ?? {})).toBe(false);
  });

  it('maps repository failures to one bounded error', async () => {
    const repository = lookupRepository();
    vi.mocked(repository.searchPatientLookup).mockRejectedValueOnce(new Error('raw backend detail'));
    await render(repository);
    await act(async () => latest?.search('Alice'));
    expect(latest?.results).toEqual([]);
    expect(latest?.error?.message).toBe('Не удалось найти пациента.');
    expect(latest?.error?.message).not.toContain('raw backend');
  });

  it('drops a slow prior-tenant result after the tenant context changes', async () => {
    const pending = deferred<PatientLookupRecord[]>();
    const repository = lookupRepository();
    vi.mocked(repository.searchPatientLookup).mockReturnValueOnce(pending.promise);
    await render(repository);

    let searchPromise!: Promise<void>;
    await act(async () => {
      searchPromise = latest!.search('Alice');
      await Promise.resolve();
    });

    currentSelection = selection({ tenantId: 'tenant-b', userId: 'user-b' });
    await act(async () => root.render(<Probe repository={repository} />));
    pending.resolve([{ id: 'patient-a', fullName: 'Alice A', phone: '+7001', status: 'active' }]);
    await act(async () => searchPromise);

    expect(latest?.ready).toBe(true);
    expect(latest?.results).toEqual([]);
    expect(latest?.query).toBe('');
    expect(latest?.error).toBeNull();
  });

  it('clear invalidates an in-flight request and removes visible search state', async () => {
    const pending = deferred<PatientLookupRecord[]>();
    const repository = lookupRepository();
    vi.mocked(repository.searchPatientLookup).mockReturnValueOnce(pending.promise);
    await render(repository);

    let searchPromise!: Promise<void>;
    await act(async () => {
      searchPromise = latest!.search('Alice');
      await Promise.resolve();
      latest!.clear();
    });
    pending.resolve([{ id: 'patient-1', fullName: 'Alice', phone: '+7001', status: 'active' }]);
    await act(async () => searchPromise);

    expect(latest?.query).toBe('');
    expect(latest?.results).toEqual([]);
    expect(latest?.loading).toBe(false);
  });
});

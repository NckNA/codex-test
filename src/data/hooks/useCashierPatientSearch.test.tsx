// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createRoot, type Root } from 'react-dom/client';
import { act, useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCashierPatientSearch } from './useCashierPatientSearch';
import type { PatientRepository } from '../repositories/PatientRepository';
import type { Patient } from '../../types';

vi.mock('../../lib/supabaseClient', () => ({ supabase: {}, isSupabaseConfigured: true }));

const patient = { id: 'patient-1', fullName: 'Smoke Cashier Patient', phone: '+7001', source: 'phone', status: 'active', createdAt: '2026-06-27T00:00:00Z' } as Patient;
const archivedPatient = { ...patient, id: 'patient-archived', fullName: 'Archived Smoke Cashier Patient', status: 'archived' } as Patient;

function createRepository(patients: Patient[] = [patient]): PatientRepository {
  return {
    listPatients: vi.fn().mockResolvedValue(patients),
    getPatientById: vi.fn(),
    updatePatient: vi.fn(),
    createPatient: vi.fn(),
  } as unknown as PatientRepository;
}

interface HookSnapshot { patients: Patient[]; loading: boolean; error: Error | null; query: string; search: (query: string) => Promise<void>; clear: () => void; }
let snapshot: HookSnapshot;
function Harness({ tenantId, repository }: { tenantId?: string | null; repository?: PatientRepository }) {
  const current = useCashierPatientSearch({ tenantId, repository });
  useEffect(() => { snapshot = current; }, [current]);
  return null;
}

async function flush() { await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); }); }
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; }); return { promise, resolve, reject }; }

describe('useCashierPatientSearch', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => { container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container); });
  afterEach(() => { act(() => root.unmount()); document.body.removeChild(container); vi.restoreAllMocks(); });

  async function renderHook(tenantId: string | null = 'tenant-1', repository = createRepository()) {
    await act(async () => { root.render(<Harness tenantId={tenantId} repository={repository} />); });
    await flush();
    return { repository };
  }

  it('does not search without tenantId', async () => {
    const repository = createRepository();
    await renderHook(null, repository);
    await act(async () => { await snapshot.search('Smoke'); });
    expect(repository.listPatients).not.toHaveBeenCalled();
    expect(snapshot.patients).toEqual([]);
  });

  it('searches only with tenantId and filters by name or phone', async () => {
    const repository = createRepository([patient, { ...patient, id: 'patient-2', fullName: 'Other', phone: '+7999' } as Patient]);
    await renderHook('tenant-1', repository);
    await act(async () => { await snapshot.search('+7001'); });
    expect(repository.listPatients).toHaveBeenCalledTimes(1);
    expect(snapshot.patients.map((p) => p.id)).toEqual(['patient-1']);
  });

  it('returns empty state safely for short or empty search', async () => {
    const repository = createRepository();
    await renderHook('tenant-1', repository);
    await act(async () => { await snapshot.search('S'); });
    expect(repository.listPatients).not.toHaveBeenCalled();
    expect(snapshot.patients).toEqual([]);
  });

  it('hides archived patients from cashier search', async () => {
    const repository = createRepository([patient, archivedPatient]);
    await renderHook('tenant-1', repository);
    await act(async () => { await snapshot.search('Smoke'); });
    expect(snapshot.patients.map((p) => p.id)).toEqual(['patient-1']);
  });

  it('surfaces repository/search errors safely', async () => {
    const repository = createRepository();
    vi.mocked(repository.listPatients).mockRejectedValueOnce(new Error('{"raw":"secret"}'));
    await renderHook('tenant-1', repository);
    await act(async () => { await snapshot.search('Smoke'); });
    expect(snapshot.error?.message).toBe('Не удалось найти пациента.');
  });

  it('clear resets query, patients and error', async () => {
    const repository = createRepository();
    await renderHook('tenant-1', repository);
    await act(async () => { await snapshot.search('Smoke'); });
    expect(snapshot.patients.length).toBe(1);
    act(() => snapshot.clear());
    expect(snapshot.patients).toEqual([]);
    expect(snapshot.query).toBe('');
  });

  it('keeps only the newest search results when Ali is slower than Alisa', async () => {
    const slowAli = deferred<Patient[]>();
    const fastAlisa = deferred<Patient[]>();
    const alisa = { ...patient, id: 'patient-alisa', fullName: 'Alisa' } as Patient;
    const repository = createRepository();
    vi.mocked(repository.listPatients)
      .mockReturnValueOnce(slowAli.promise)
      .mockReturnValueOnce(fastAlisa.promise);
    await renderHook('tenant-1', repository);
    let aliSearch!: Promise<void>;
    let alisaSearch!: Promise<void>;
    act(() => { aliSearch = snapshot.search('Ali'); });
    act(() => { alisaSearch = snapshot.search('Alisa'); });
    fastAlisa.resolve([alisa]);
    await act(async () => { await alisaSearch; });
    expect(snapshot.query).toBe('Alisa');
    expect(snapshot.patients.map((row) => row.id)).toEqual(['patient-alisa']);
    slowAli.resolve([patient]);
    await act(async () => { await aliSearch; });
    expect(snapshot.query).toBe('Alisa');
    expect(snapshot.patients.map((row) => row.id)).toEqual(['patient-alisa']);
  });

  it('ignores a stale search error after a newer success', async () => {
    const slowAli = deferred<Patient[]>();
    const alisa = { ...patient, id: 'patient-alisa', fullName: 'Alisa' } as Patient;
    const repository = createRepository();
    vi.mocked(repository.listPatients)
      .mockReturnValueOnce(slowAli.promise)
      .mockResolvedValueOnce([alisa]);
    await renderHook('tenant-1', repository);
    let aliSearch!: Promise<void>;
    act(() => { aliSearch = snapshot.search('Ali'); });
    await act(async () => { await snapshot.search('Alisa'); });
    slowAli.reject(new Error('raw stale database error'));
    await act(async () => { await aliSearch; });
    expect(snapshot.error).toBeNull();
    expect(snapshot.patients.map((row) => row.id)).toEqual(['patient-alisa']);
  });

  it('hook implementation does not expose localStorage or service_role references', () => {
    const source = String(useCashierPatientSearch);
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('service_role');
  });
});

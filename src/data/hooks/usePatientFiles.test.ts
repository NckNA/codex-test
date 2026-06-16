// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientFiles } from './usePatientFiles';
import { createPatientFilesRepository } from '../repositories/PatientFilesRepository';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';

vi.mock('../../lib/supabaseClient', () => ({ isSupabaseConfigured: true }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../repositories/PatientFilesRepository', async () => {
  const actual = await vi.importActual<typeof import('../repositories/PatientFilesRepository')>('../repositories/PatientFilesRepository');
  return { ...actual, createPatientFilesRepository: vi.fn() };
});

function renderHookProbe(onValue: (value: ReturnType<typeof usePatientFiles>) => void) {
  function Probe() {
    onValue(usePatientFiles('patient-1'));
    return null;
  }
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<Probe />));
  return root;
}

describe('usePatientFiles', () => {
  const repo = {
    listPatientFiles: vi.fn(),
    uploadPatientFile: vi.fn(),
    archivePatientFile: vi.fn(),
    createSignedUrl: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ authMode: 'supabase-active', user: { id: 'user-1' } });
    (useTenant as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ activeTenant: { tenantId: 'tenant-1', role: 'doctor' } });
    (createPatientFilesRepository as unknown as ReturnType<typeof vi.fn>).mockReturnValue(repo);
    repo.listPatientFiles.mockResolvedValue([]);
    repo.uploadPatientFile.mockResolvedValue({ id: 'file-1' });
    repo.archivePatientFile.mockResolvedValue(undefined);
  });

  it('loads patient files with active tenant repository', async () => {
    let latest: ReturnType<typeof usePatientFiles> | undefined;
    const root = renderHookProbe((value) => { latest = value; });
    await act(async () => { await Promise.resolve(); });
    expect(createPatientFilesRepository).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'tenant-1', userId: 'user-1' });
    expect(repo.listPatientFiles).toHaveBeenCalledWith('patient-1');
    expect(latest?.files).toEqual([]);
    act(() => root.unmount());
  });

  it('upload refreshes list', async () => {
    let latest: ReturnType<typeof usePatientFiles> | undefined;
    const root = renderHookProbe((value) => { latest = value; });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await latest!.uploadFile(new File(['x'], 'x.png', { type: 'image/png' })); });
    expect(repo.uploadPatientFile).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'patient-1' }));
    expect(repo.listPatientFiles).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });

  it('archive refreshes list', async () => {
    let latest: ReturnType<typeof usePatientFiles> | undefined;
    const root = renderHookProbe((value) => { latest = value; });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await latest!.archiveFile('file-1'); });
    expect(repo.archivePatientFile).toHaveBeenCalledWith('file-1');
    expect(repo.listPatientFiles).toHaveBeenCalledTimes(2);
    act(() => root.unmount());
  });

  it('blocks writes without active Supabase tenant', async () => {
    (useTenant as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ activeTenant: null });
    let latest: ReturnType<typeof usePatientFiles> | undefined;
    const root = renderHookProbe((value) => { latest = value; });
    await act(async () => { await Promise.resolve(); });
    await expect(latest!.uploadFile(new File(['x'], 'x.png', { type: 'image/png' }))).rejects.toThrow('Active clinic is required');
    expect(repo.uploadPatientFile).not.toHaveBeenCalled();
    act(() => root.unmount());
  });
});

// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DentalPhotosPanel } from './DentalPhotosPanel';
import { usePatientFiles } from '../../data/hooks/usePatientFiles';
import { useTenant } from '../../contexts/TenantContext';

vi.mock('../../data/hooks/usePatientFiles', () => ({ usePatientFiles: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));

function renderPanel() {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<DentalPhotosPanel patientId="patient-1" />));
  return { container, root };
}

describe('DentalPhotosPanel', () => {
  const hookValue = {
    files: [],
    isLoading: false,
    isUploading: false,
    isArchiving: false,
    error: null,
    uploadFile: vi.fn(),
    archiveFile: vi.fn(),
    refresh: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useTenant as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ activeTenant: { tenantId: 'tenant-1', role: 'clinic_admin' } });
    (usePatientFiles as unknown as ReturnType<typeof vi.fn>).mockReturnValue(hookValue);
  });

  it('renders empty state and upload control for clinic admin', () => {
    const { container, root } = renderPanel();
    expect(container.textContent).toContain('Фото / снимки пациента');
    expect(container.textContent).toContain('Файлы ещё не загружены.');
    expect(container.textContent).toContain('Загрузить фото');
    act(() => root.unmount());
  });

  it('renders file thumbnail, filename, and archive wording', () => {
    (usePatientFiles as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...hookValue,
      files: [{ id: 'file-1', originalFilename: 'photo.png', previewUrl: 'signed', createdAt: '2026-01-01T00:00:00Z', sizeBytes: 1024 }],
    });
    const { container, root } = renderPanel();
    expect(container.textContent).toContain('photo.png');
    expect(container.querySelector('img')?.getAttribute('src')).toBe('signed');
    expect(container.textContent).toContain('Архивировать');
    act(() => root.unmount());
  });

  it('hides upload and archive controls for cashier', () => {
    (useTenant as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ activeTenant: { tenantId: 'tenant-1', role: 'cashier' } });
    (usePatientFiles as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...hookValue,
      files: [{ id: 'file-1', originalFilename: 'photo.png', previewUrl: 'signed', createdAt: '2026-01-01T00:00:00Z', sizeBytes: 1024 }],
    });
    const { container, root } = renderPanel();
    expect(container.textContent).not.toContain('Загрузить фото');
    expect(container.textContent).not.toContain('Архивировать');
    expect(container.textContent).toContain('просматривать файлы');
    act(() => root.unmount());
  });

  it('shows safe no-tenant message and no upload control', () => {
    (useTenant as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ activeTenant: null });
    const { container, root } = renderPanel();
    expect(container.textContent).toContain('Выберите активную клинику');
    expect(container.textContent).not.toContain('Загрузить фото');
    act(() => root.unmount());
  });

  it('archive action uses archive wording and calls hook', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    (usePatientFiles as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      ...hookValue,
      files: [{ id: 'file-1', originalFilename: 'photo.png', previewUrl: 'signed', createdAt: '2026-01-01T00:00:00Z', sizeBytes: 1024 }],
    });
    const { container, root } = renderPanel();
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent?.includes('Архивировать')) as HTMLButtonElement;
    await act(async () => { button.click(); });
    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('Архивировать файл'));
    expect(hookValue.archiveFile).toHaveBeenCalledWith('file-1');
    confirmSpy.mockRestore();
    act(() => root.unmount());
  });
});

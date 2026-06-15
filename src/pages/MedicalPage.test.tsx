// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { MedicalPage } from './MedicalPage';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { useDictionaries } from '../data/hooks/useDictionaries';
import type { ClinicalDiagnosis, ClinicalWork } from '../config/clinicalDictionaries';

vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../data/hooks/useDictionaries', () => ({ useDictionaries: vi.fn() }));

const mockDiagnoses: ClinicalDiagnosis[] = [
  { id: 'dx_1', type: 'diagnosis', name: 'Кариес эмали', allowedPresenceStatuses: ['natural', 'deciduous'], allowedZones: ['crown'], isActive: true },
  { id: 'dx_2', type: 'diagnosis', name: 'Периодонтит', allowedPresenceStatuses: ['natural', 'root_remnant'], allowedZones: ['root', 'periodontium'], isActive: false },
];

const mockWorks: ClinicalWork[] = [
  { id: 'wk_1', type: 'work', name: 'Лечение кариеса', price: 15000, allowedPresenceStatuses: ['natural'], allowedZones: ['crown'], allowedDiagnosisIds: ['dx_1'], workAccessType: 'requires_diagnosis', isActive: true },
];

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

describe('MedicalPage dictionary bootstrap and restored editor behavior', () => {
  let saveDiagnosisMock: ReturnType<typeof vi.fn>;
  let saveWorkMock: ReturnType<typeof vi.fn>;
  let refreshMock: ReturnType<typeof vi.fn>;
  let bootstrapDefaultsMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    saveDiagnosisMock = vi.fn().mockResolvedValue(undefined);
    saveWorkMock = vi.fn().mockResolvedValue(undefined);
    refreshMock = vi.fn().mockResolvedValue(undefined);
    bootstrapDefaultsMock = vi.fn().mockResolvedValue({ insertedCount: 43, skippedExistingCount: 0, templateKey: 'default_dental_v1' });

    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);
    vi.mocked(useDictionaries).mockReturnValue({
      diagnoses: mockDiagnoses,
      works: mockWorks,
      loading: false,
      error: null,
      isBootstrappingDefaults: false,
      saveDiagnosis: saveDiagnosisMock as unknown as (diagnosis: ClinicalDiagnosis) => Promise<void>,
      saveWork: saveWorkMock as unknown as (work: ClinicalWork) => Promise<void>,
      bootstrapDefaults: bootstrapDefaultsMock as unknown as () => Promise<{ insertedCount: number; skippedExistingCount: number; templateKey: string }>,
      refresh: refreshMock as unknown as () => Promise<void>,
    });
  });

  const renderComponent = async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<MedicalPage />);
    });
    return {
      container,
      unmount: async () => act(async () => { root.unmount(); }),
    };
  };

  it('keeps admin create/edit actions available', async () => {
    const { container, unmount } = await renderComponent();

    expect(container.textContent).toContain('+ Диагноз');
    expect(container.textContent).toContain('+ Работа');
    expect(Array.from(container.querySelectorAll('button')).some((button) => button.textContent === 'Редактировать')).toBe(true);
    await unmount();
  });

  it('opens diagnosis editor and saves through saveDiagnosis', async () => {
    const { container, unmount } = await renderComponent();
    const editButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Редактировать');

    await act(async () => editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Редактирование диагноза');
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Сохранить');

    await act(async () => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(saveDiagnosisMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'dx_1', name: 'Кариес эмали' }));
    await unmount();
  });

  it('opens work editor and saves through saveWork', async () => {
    const { container, unmount } = await renderComponent();
    const editButtons = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === 'Редактировать');

    await act(async () => editButtons[editButtons.length - 1]?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Редактирование работы');
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Сохранить изменения');

    await act(async () => saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(saveWorkMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'wk_1', name: 'Лечение кариеса' }));
    await unmount();
  });

  it('keeps disable and restore wired to save handlers', async () => {
    const { container, unmount } = await renderComponent();
    const disableButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Отключить');
    const restoreButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Восстановить');

    await act(async () => {
      disableButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      restoreButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(saveDiagnosisMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'dx_1', isActive: false }));
    expect(saveDiagnosisMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'dx_2', isActive: true }));
    await unmount();
  });

  it('keeps search compatible with zone/status labels', async () => {
    const { container, unmount } = await renderComponent();
    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;

    await act(async () => setInputValue(searchInput, 'Остаток корня'));

    expect(container.textContent).toContain('Периодонтит');
    expect(container.textContent).not.toContain('Кариес эмали');
    await unmount();
  });

  it('keeps StatusZoneSelector status-to-zone UI in editor forms', async () => {
    const { container, unmount } = await renderComponent();
    const addDiagnosisButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '+ Диагноз');

    await act(async () => addDiagnosisButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.textContent).toContain('Клинические зоны (доступно по статусам)');
    expect(container.textContent).toContain('Коронковая часть');
    await unmount();
  });

  it('shows explicit import button for admin/owner empty dictionaries only', async () => {
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_owner' } } as unknown as ReturnType<typeof useTenant>);
    vi.mocked(useDictionaries).mockReturnValue({
      diagnoses: [],
      works: [],
      loading: false,
      error: null,
      isBootstrappingDefaults: false,
      saveDiagnosis: saveDiagnosisMock as unknown as (diagnosis: ClinicalDiagnosis) => Promise<void>,
      saveWork: saveWorkMock as unknown as (work: ClinicalWork) => Promise<void>,
      bootstrapDefaults: bootstrapDefaultsMock as unknown as () => Promise<{ insertedCount: number; skippedExistingCount: number; templateKey: string }>,
      refresh: refreshMock as unknown as () => Promise<void>,
    });

    const { container, unmount } = await renderComponent();
    const importButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Загрузить базовый справочник');

    expect(importButton).toBeDefined();
    await act(async () => importButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(bootstrapDefaultsMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('does not show import/edit actions for doctor or no-tenant state', async () => {
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'doctor' } } as unknown as ReturnType<typeof useTenant>);
    vi.mocked(useDictionaries).mockReturnValue({
      diagnoses: [],
      works: [],
      loading: false,
      error: null,
      isBootstrappingDefaults: false,
      saveDiagnosis: saveDiagnosisMock as unknown as (diagnosis: ClinicalDiagnosis) => Promise<void>,
      saveWork: saveWorkMock as unknown as (work: ClinicalWork) => Promise<void>,
      bootstrapDefaults: bootstrapDefaultsMock as unknown as () => Promise<{ insertedCount: number; skippedExistingCount: number; templateKey: string }>,
      refresh: refreshMock as unknown as () => Promise<void>,
    });

    const first = await renderComponent();
    expect(first.container.textContent).toContain('Справочник клиники пока не настроен. Обратитесь к администратору клиники.');
    expect(first.container.textContent).not.toContain('Загрузить базовый справочник');
    expect(bootstrapDefaultsMock).not.toHaveBeenCalled();
    await first.unmount();

    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);
    vi.mocked(useDictionaries).mockReturnValue({
      diagnoses: mockDiagnoses,
      works: mockWorks,
      loading: false,
      error: null,
      isBootstrappingDefaults: false,
      saveDiagnosis: saveDiagnosisMock as unknown as (diagnosis: ClinicalDiagnosis) => Promise<void>,
      saveWork: saveWorkMock as unknown as (work: ClinicalWork) => Promise<void>,
      bootstrapDefaults: bootstrapDefaultsMock as unknown as () => Promise<{ insertedCount: number; skippedExistingCount: number; templateKey: string }>,
      refresh: refreshMock as unknown as () => Promise<void>,
    });

    const second = await renderComponent();
    expect(second.container.textContent).toContain('Выберите активную клинику для работы со справочниками.');
    expect(second.container.textContent).not.toContain('Загрузить базовый справочник');
    expect(Array.from(second.container.querySelectorAll('button')).some((button) => button.textContent === 'Редактировать')).toBe(false);
    await second.unmount();
  });

  it('does not auto-trigger import for existing dictionary', async () => {
    const { container, unmount } = await renderComponent();

    expect(container.textContent).not.toContain('Загрузить базовый справочник');
    expect(bootstrapDefaultsMock).not.toHaveBeenCalled();
    await unmount();
  });
});

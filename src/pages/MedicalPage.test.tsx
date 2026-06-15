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

vi.mock('../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../contexts/TenantContext', () => ({
  useTenant: vi.fn(),
}));

vi.mock('../data/hooks/useDictionaries', () => ({
  useDictionaries: vi.fn(),
}));

const mockDiagnoses: ClinicalDiagnosis[] = [
  {
    id: 'dx_1',
    type: 'diagnosis',
    name: 'Кариес эмали',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    isActive: true,
  },
  {
    id: 'dx_2',
    type: 'diagnosis',
    name: 'Периодонтит',
    allowedPresenceStatuses: ['natural', 'root_remnant'],
    allowedZones: ['root', 'periodontium'],
    isActive: false,
  }
];

const mockWorks: ClinicalWork[] = [
  {
    id: 'wk_1',
    type: 'work',
    name: 'Лечение кариеса',
    price: 15000,
    allowedPresenceStatuses: ['natural'],
    allowedZones: ['crown'],
    allowedDiagnosisIds: ['dx_1'],
    workAccessType: 'requires_diagnosis',
    isActive: true,
  }
];

describe('MedicalPage dictionary permissions, editing, filtering and bootstrap UX', () => {
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
      unmount: async () => {
        await act(async () => {
          root.unmount();
        });
      }
    };
  };

  it('A. Dev/local mode: dictionary management actions remain available', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'dev' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Dev Clinic', role: 'admin' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).toContain('+ Диагноз');
    expect(container.textContent).toContain('+ Работа');
    expect(Array.from(container.querySelectorAll('button')).some(b => b.textContent === 'Редактировать')).toBe(true);
    expect(container.textContent).not.toContain('Справочники доступны только для просмотра');

    await unmount();
  });

  it('B. Supabase clinic_admin: create/edit/disable actions are visible/enabled', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).toContain('+ Диагноз');
    expect(container.textContent).toContain('+ Работа');
    expect(Array.from(container.querySelectorAll('button')).some(b => b.textContent === 'Редактировать')).toBe(true);
    expect(container.textContent).not.toContain('Справочники доступны только для просмотра');

    await unmount();
  });

  it('C. restored diagnosis edit flow opens editor and saves through saveDiagnosis', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();
    const editButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Редактировать');

    await act(async () => {
      editButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Редактирование диагноза');
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Сохранить');

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(saveDiagnosisMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'dx_1', name: 'Кариес эмали' }));
    await unmount();
  });

  it('D. restored work edit flow opens editor and saves through saveWork', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();
    const editButtons = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent === 'Редактировать');

    await act(async () => {
      editButtons[editButtons.length - 1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Редактирование работы');
    const saveButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Сохранить изменения');

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(saveWorkMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'wk_1', name: 'Лечение кариеса' }));
    await unmount();
  });

  it('E. disable and restore buttons still call save handlers', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);

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

  it('F. search still matches zone/status labels', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();
    const searchInput = container.querySelector('input[type="text"]') as HTMLInputElement;

    await act(async () => {
      searchInput.value = 'Остаток корня';
      searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    });

    expect(container.textContent).toContain('Периодонтит');
    expect(container.textContent).not.toContain('Кариес эмали');
    await unmount();
  });

  it('G. StatusZoneSelector restricts zones to selected statuses', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();
    const addDiagnosisButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === '+ Диагноз');

    await act(async () => {
      addDiagnosisButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Клинические зоны (доступно по статусам)');
    expect(container.textContent).toContain('Коронковая часть');
    expect(container.textContent).not.toContain('Планирование');
    await unmount();
  });

  it('H. Supabase clinic_owner with empty dictionary sees explicit import button', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
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

    expect(container.textContent).toContain('У этой клиники пока нет справочника.');
    expect(container.textContent).toContain('Загрузить базовый справочник');

    const importButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent === 'Загрузить базовый справочник');
    expect(importButton).toBeDefined();

    await act(async () => {
      importButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(bootstrapDefaultsMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('I. Supabase doctor with empty dictionary does not see import button', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
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

    const { container, unmount } = await renderComponent();

    expect(container.textContent).toContain('Справочник клиники пока не настроен. Обратитесь к администратору клиники.');
    expect(container.textContent).not.toContain('Загрузить базовый справочник');
    expect(bootstrapDefaultsMock).not.toHaveBeenCalled();
    await unmount();
  });

  it('J. Supabase doctor: dictionaries are readable, create/edit/disable are hidden', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'doctor' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).toContain('Кариес эмали');
    expect(container.textContent).toContain('Лечение кариеса');
    expect(container.textContent).not.toContain('+ Диагноз');
    expect(container.textContent).not.toContain('+ Работа');
    expect(container.textContent).not.toContain('Загрузить базовый справочник');

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => b.textContent === 'Редактировать')).toBe(false);
    expect(buttons.some(b => b.textContent === 'Отключить')).toBe(false);
    expect(buttons.some(b => b.textContent === 'Восстановить')).toBe(false);
    expect(container.textContent).toContain('Справочники доступны только для просмотра. Редактирование доступно администратору клиники.');
    await unmount();
  });

  it('K. Supabase no-tenant: no import button and no edit actions', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).not.toContain('+ Диагноз');
    expect(container.textContent).not.toContain('+ Работа');
    expect(container.textContent).not.toContain('Загрузить базовый справочник');
    expect(Array.from(container.querySelectorAll('button')).some(b => b.textContent === 'Редактировать')).toBe(false);
    expect(container.textContent).toContain('Выберите активную клинику для работы со справочниками.');
    await unmount();
  });

  it('L. Existing dictionary does not auto-trigger import', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).not.toContain('Загрузить базовый справочник');
    expect(bootstrapDefaultsMock).not.toHaveBeenCalled();
    await unmount();
  });
});

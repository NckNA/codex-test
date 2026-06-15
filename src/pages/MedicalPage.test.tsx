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

describe('MedicalPage Permissions UX', () => {
  let saveDiagnosisMock: ReturnType<typeof vi.fn>;
  let saveWorkMock: ReturnType<typeof vi.fn>;
  let refreshMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.restoreAllMocks();
    saveDiagnosisMock = vi.fn();
    saveWorkMock = vi.fn();
    refreshMock = vi.fn();

    vi.mocked(useDictionaries).mockReturnValue({
      diagnoses: mockDiagnoses,
      works: mockWorks,
      loading: false,
      error: null,
      saveDiagnosis: saveDiagnosisMock as unknown as (diagnosis: ClinicalDiagnosis) => Promise<void>,
      saveWork: saveWorkMock as unknown as (work: ClinicalWork) => Promise<void>,
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
    
    const buttons = Array.from(container.querySelectorAll('button'));
    const editButtons = buttons.filter(b => b.textContent === 'Редактировать');
    expect(editButtons.length).toBeGreaterThan(0);

    const toggleButtons = buttons.filter(b => b.textContent === 'Отключить' || b.textContent === 'Восстановить');
    expect(toggleButtons.length).toBeGreaterThan(0);

    expect(container.textContent).not.toContain('Справочники доступны только для просмотра');

    await unmount();
  });

  it('B. Supabase clinic_admin: create/edit/disable actions are visible/enabled', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).toContain('+ Диагноз');
    expect(container.textContent).toContain('+ Работа');

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => b.textContent === 'Редактировать')).toBe(true);

    expect(container.textContent).not.toContain('Справочники доступны только для просмотра');

    await unmount();
  });

  it('C. Supabase clinic_owner: create/edit/disable actions are visible/enabled', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'clinic_owner' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).toContain('+ Диагноз');
    expect(container.textContent).toContain('+ Работа');

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => b.textContent === 'Редактировать')).toBe(true);

    expect(container.textContent).not.toContain('Справочники доступны только для просмотра');

    await unmount();
  });

  it('D. Supabase doctor: dictionaries are readable, create/edit/disable are hidden', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'doctor' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).toContain('Кариес эмали');
    expect(container.textContent).toContain('Лечение кариеса');

    expect(container.textContent).not.toContain('+ Диагноз');
    expect(container.textContent).not.toContain('+ Работа');

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => b.textContent === 'Редактировать')).toBe(false);
    expect(buttons.some(b => b.textContent === 'Отключить')).toBe(false);
    expect(buttons.some(b => b.textContent === 'Восстановить')).toBe(false);

    expect(container.textContent).toContain('Справочники доступны только для просмотра. Редактирование доступно администратору клиники.');

    await unmount();
  });

  it('E. Supabase unknown/registrar role: actions hidden/disabled', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 't1', tenantName: 'Clinic A', role: 'receptionist' } } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).not.toContain('+ Диагноз');
    expect(container.textContent).not.toContain('+ Работа');

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => b.textContent === 'Редактировать')).toBe(false);

    expect(container.textContent).toContain('Справочники доступны только для просмотра. Редактирование доступно администратору клиники.');

    await unmount();
  });

  it('F. Supabase no-tenant: no edit actions, read-only view shown', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);

    const { container, unmount } = await renderComponent();

    expect(container.textContent).not.toContain('+ Диагноз');
    expect(container.textContent).not.toContain('+ Работа');

    const buttons = Array.from(container.querySelectorAll('button'));
    expect(buttons.some(b => b.textContent === 'Редактировать')).toBe(false);

    expect(container.textContent).toContain('Справочники доступны только для просмотра. Редактирование доступно администратору клиники.');

    await unmount();
  });
});

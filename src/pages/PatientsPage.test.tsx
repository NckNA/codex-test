// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientsPage } from './PatientsPage';
import { usePatientsCollection } from '../data/hooks/usePatientsCollection';
import { usePatientListVisitSummary } from '../data/hooks/usePatientListVisitSummary';
import { useTenant } from '../contexts/TenantContext';

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../data/hooks/usePatientsCollection', () => ({ usePatientsCollection: vi.fn() }));
vi.mock('../data/hooks/usePatientListVisitSummary', () => ({ usePatientListVisitSummary: vi.fn() }));
vi.mock('../contexts/TenantContext', () => ({ useTenant: vi.fn(), LEGACY_TENANT_TIMEZONE: 'Asia/Almaty' }));
vi.mock('../components/patients/PatientModal', () => ({ PatientModal: () => null }));

const patient = {
  id: 'patient-1',
  fullName: 'Authoritative Patient',
  phone: '+7 700 000 00 00',
  birthDate: '1990-01-01',
  source: 'phone',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderPage() {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<PatientsPage />));
  return { container, root };
}

describe('PatientsPage appointment summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'tenant-a', tenantName: 'Clinic', timezone: 'Asia/Almaty' } } as unknown as ReturnType<typeof useTenant>);
    vi.mocked(usePatientsCollection).mockReturnValue({
      patients: [patient],
      isLoading: false,
      isError: false,
      createPatient: vi.fn(),
      updatePatient: vi.fn(),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePatientsCollection>);
  });

  it('renders authoritative previous and next appointment dates for one patient row', () => {
    vi.mocked(usePatientListVisitSummary).mockReturnValue({
      visitSummaryByPatientId: {
        'patient-1': {
          lastVisit: new Date('2026-07-10T10:00:00.000Z'),
          nextVisit: new Date('2026-07-15T10:00:00.000Z'),
        },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePatientListVisitSummary>);

    const { container, root } = renderPage();

    expect(container.textContent).toContain('Предыдущая запись');
    expect(container.textContent).toContain('Следующая запись');
    expect(container.textContent).toContain('10.07.2026');
    expect(container.textContent).toContain('15.07.2026');
    expect(container.textContent).not.toContain('Недоступно');

    act(() => root.unmount());
  });

  it('shows a neutral unavailable state instead of stale appointment dates after summary failure', () => {
    vi.mocked(usePatientListVisitSummary).mockReturnValue({
      visitSummaryByPatientId: {},
      isLoading: false,
      isError: true,
      error: new Error('Не удалось загрузить сводку по записям.'),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePatientListVisitSummary>);

    const { container, root } = renderPage();

    expect(container.textContent?.match(/Недоступно/g)).toHaveLength(2);
    expect(container.textContent).not.toContain('10.07.2026');
    expect(container.textContent).not.toContain('15.07.2026');

    act(() => root.unmount());
  });
});

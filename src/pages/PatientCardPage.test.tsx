// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PatientCardPage } from './PatientCardPage';
import { usePatientProfile } from '../data/hooks/usePatientProfile';
import { usePatientMedicalSummary } from '../data/hooks/usePatientMedicalSummary';
import { usePatientTimeline } from '../data/hooks/usePatientTimeline';
import { useTenant } from '../contexts/TenantContext';

vi.mock('react-router-dom', () => ({
  useParams: () => ({ patientId: 'patient-1' }),
  useNavigate: () => vi.fn(),
}));

vi.mock('../data/hooks/usePatientProfile', () => ({ usePatientProfile: vi.fn() }));
vi.mock('../data/hooks/usePatientMedicalSummary', () => ({ usePatientMedicalSummary: vi.fn() }));
vi.mock('../data/hooks/usePatientTimeline', () => ({ usePatientTimeline: vi.fn() }));
vi.mock('../contexts/TenantContext', () => ({ useTenant: vi.fn() }));

vi.mock('../components/patients/PatientModal', () => ({ PatientModal: () => null }));
vi.mock('../components/patients/patient-card/PatientOverviewTab', () => ({ PatientOverviewTab: () => <div>Overview tab mock</div> }));
vi.mock('../components/patients/patient-card/PatientHistoryTab', () => ({ PatientHistoryTab: () => <div>Appointments history mock</div> }));
vi.mock('../components/patients/patient-card/PatientLaboratoryWorkTab', () => ({
  PatientLaboratoryWorkTab: ({ patientId, timezone, role }: { patientId: string; timezone: string; role?: string | null }) => (
    <div>Laboratory mock {patientId} {timezone} {role ?? 'no-role'}</div>
  ),
}));
vi.mock('../components/dental/DentalChartTab', () => ({ DentalChartTab: () => <div>Dental chart mock</div> }));
vi.mock('../components/dental/FindingsRisksTab', () => ({ FindingsRisksTab: () => <div>Findings mock</div> }));
vi.mock('../components/treatment/TreatmentPlansTab', () => ({ TreatmentPlansTab: () => <div>Treatment plans mock</div> }));
vi.mock('../components/dental/DentalPhotosPanel', () => ({ DentalPhotosPanel: () => <div>Files mock</div> }));
vi.mock('../components/patient/PatientTimelineTab', () => ({
  PatientTimelineTab: ({ events }: { events: Array<{ title: string }> }) => (
    <div>
      Timeline tab mock
      {events.map((event) => <span key={event.title}>{event.title}</span>)}
    </div>
  ),
}));

function renderPage() {
  const container = document.createElement('div');
  const root = createRoot(container);
  act(() => root.render(<PatientCardPage />));
  return { container, root };
}

describe('PatientCardPage timeline tab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'tenant-1', tenantName: 'Clinic', timezone: 'Asia/Almaty', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);
    vi.mocked(usePatientProfile).mockReturnValue({
      patient: {
        id: 'patient-1',
        fullName: 'Test Patient',
        phone: '+7 700 000 00 00',
        status: 'active',
        source: 'phone',
        createdAt: '2026-01-01T00:00:00.000Z',
      },
      isLoading: false,
      isError: false,
      savePatient: vi.fn(),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePatientProfile>);
    vi.mocked(usePatientMedicalSummary).mockReturnValue({
      data: { dentalSummary: { needsTreatment: 0, missing: 0, activePlans: 0, totalAmount: 0, chiefComplaintText: '', highUrgentFindings: 0, notIncludedFindings: 0, monitoringFindings: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof usePatientMedicalSummary>);
    vi.mocked(usePatientTimeline).mockReturnValue({
      events: [{ id: 'finding-1', title: 'Выявлена находка' }],
      isLoading: false,
      isError: false,
      error: null,
      refresh: vi.fn(),
    } as unknown as ReturnType<typeof usePatientTimeline>);
  });

  it('shows the new История tab in addition to История приёмов', () => {
    const { container, root } = renderPage();
    const buttons = Array.from(container.querySelectorAll('button')).map((button) => button.textContent?.trim());
    expect(buttons).toContain('История');
    expect(buttons).toContain('История приёмов');
    act(() => root.unmount());
  });

  it('renders the clinical encounters tab label without encoding damage', () => {
    const { container, root } = renderPage();
    expect(container.querySelector('[data-testid="patient-tab-encounters"]')?.textContent?.trim()).toBe('Приёмы');
    act(() => root.unmount());
  });

  it('renders timeline content after clicking История', async () => {
    const { container, root } = renderPage();
    const timelineButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'История') as HTMLButtonElement;
    await act(async () => { timelineButton.click(); });
    expect(container.textContent).toContain('Timeline tab mock');
    expect(container.textContent).toContain('Выявлена находка');
    expect(usePatientTimeline).toHaveBeenCalledWith(expect.objectContaining({ includeArchived: false }));
    act(() => root.unmount());
  });

  it('shows the Лаборатория tab and renders it for the current patient', async () => {
    const { container, root } = renderPage();
    const laboratoryButton = container.querySelector('[data-testid="patient-tab-laboratory"]') as HTMLButtonElement;

    expect(laboratoryButton?.textContent?.trim()).toBe('Лаборатория');
    await act(async () => { laboratoryButton.click(); });

    expect(container.textContent).toContain('Laboratory mock patient-1 Asia/Almaty clinic_admin');
    act(() => root.unmount());
  });
});

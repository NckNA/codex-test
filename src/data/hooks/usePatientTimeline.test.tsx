// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Patient } from '../../types';
import { usePatientTimeline } from './usePatientTimeline';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { buildPatientTimeline } from '../aggregators/PatientTimelineAggregator';

const mocks = vi.hoisted(() => {
  const getChiefComplaint = vi.fn();
  const listFindingsByPatient = vi.fn();
  const listTreatmentPlansByPatient = vi.fn();
  const listAppointmentsByPatient = vi.fn();
  const listPatientFiles = vi.fn();
  const getDentalChart = vi.fn();
  const listPatientActivityEvents = vi.fn();
  const listAuditEvents = vi.fn();

  return {
    getChiefComplaint,
    listFindingsByPatient,
    listTreatmentPlansByPatient,
    listAppointmentsByPatient,
    listPatientFiles,
    getDentalChart,
    listPatientActivityEvents,
    listAuditEvents,
    createChiefComplaintRepository: vi.fn(() => ({ getChiefComplaint })),
    createFindingsRepository: vi.fn(() => ({ listFindingsByPatient })),
    createTreatmentPlansRepository: vi.fn(() => ({ listTreatmentPlansByPatient })),
    createAppointmentRepository: vi.fn(() => ({ listAppointmentsByPatient })),
    createPatientFilesRepository: vi.fn(() => ({ listPatientFiles })),
    createDentalChartRepository: vi.fn(() => ({ getDentalChart })),
    createAuditActivityRepository: vi.fn(() => ({ listPatientActivityEvents, listAuditEvents })),
    buildPatientTimeline: vi.fn(),
  };
});

vi.mock('../../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../repositories/ChiefComplaintRepository', () => ({ createChiefComplaintRepository: mocks.createChiefComplaintRepository }));
vi.mock('../repositories/FindingsRepository', () => ({ createFindingsRepository: mocks.createFindingsRepository }));
vi.mock('../repositories/TreatmentPlansRepository', () => ({ createTreatmentPlansRepository: mocks.createTreatmentPlansRepository }));
vi.mock('../repositories/AppointmentRepository', () => ({ createAppointmentRepository: mocks.createAppointmentRepository }));
vi.mock('../repositories/PatientFilesRepository', () => ({ createPatientFilesRepository: mocks.createPatientFilesRepository }));
vi.mock('../repositories/DentalChartRepository', () => ({ createDentalChartRepository: mocks.createDentalChartRepository }));
vi.mock('../repositories/AuditActivityRepository', () => ({ createAuditActivityRepository: mocks.createAuditActivityRepository }));
vi.mock('../aggregators/PatientTimelineAggregator', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../aggregators/PatientTimelineAggregator')>();
  return {
    ...actual,
    buildPatientTimeline: mocks.buildPatientTimeline,
  };
});

const patient: Patient = {
  id: 'patient-1',
  fullName: 'Test Patient',
  phone: '+7 700 000 00 00',
  source: 'phone',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderHook(patientValue: Patient | null = patient, includeArchived = false) {
  let latest: ReturnType<typeof usePatientTimeline> | undefined;
  const TestComponent = () => {
    latest = usePatientTimeline({ patient: patientValue, includeArchived });
    return <div>{latest.events.map((event) => event.title).join(',')}</div>;
  };

  const container = document.createElement('div');
  const root = createRoot(container);
  return { container, root, render: async () => {
    await act(async () => {
      root.render(<TestComponent />);
      await Promise.resolve();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    return latest;
  } };
}

describe('usePatientTimeline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ authMode: 'supabase-active' } as unknown as ReturnType<typeof useAuth>);
    vi.mocked(useTenant).mockReturnValue({ activeTenant: { tenantId: 'tenant-1', tenantName: 'Clinic', role: 'clinic_admin' } } as unknown as ReturnType<typeof useTenant>);
    mocks.getChiefComplaint.mockResolvedValue(null);
    mocks.listFindingsByPatient.mockResolvedValue([]);
    mocks.listTreatmentPlansByPatient.mockResolvedValue([]);
    mocks.listAppointmentsByPatient.mockResolvedValue([]);
    mocks.listPatientFiles.mockResolvedValue([]);
    mocks.getDentalChart.mockResolvedValue(null);
    mocks.listPatientActivityEvents.mockResolvedValue([]);
    mocks.listAuditEvents.mockResolvedValue([]);
    mocks.buildPatientTimeline.mockReturnValue([
      {
        id: 'event-1',
        tenantId: 'tenant-1',
        patientId: 'patient-1',
        occurredAt: '2026-01-01T00:00:00.000Z',
        category: 'finding',
        type: 'finding_discovered',
        title: 'Finding discovered',
        sourceType: 'finding',
        sourceId: 'finding-1',
        visibility: 'clinical',
      },
    ]);
  });

  it('loads existing patient sources and activity events before building role-visible timeline events', async () => {
    const { container, root, render } = renderHook(patient, true);
    const latest = await render();

    expect(mocks.createChiefComplaintRepository).toHaveBeenCalledWith({ backend: 'supabase', tenantId: 'tenant-1' });
    expect(mocks.listFindingsByPatient).toHaveBeenCalledWith('patient-1');
    expect(mocks.listTreatmentPlansByPatient).toHaveBeenCalledWith('patient-1');
    expect(mocks.listAppointmentsByPatient).toHaveBeenCalledWith('patient-1');
    expect(mocks.listPatientFiles).toHaveBeenCalledWith('patient-1', true);
    expect(mocks.getDentalChart).toHaveBeenCalledWith('patient-1');
    expect(mocks.createAuditActivityRepository).toHaveBeenCalledWith({ backend: 'supabase' });
    expect(mocks.listPatientActivityEvents).toHaveBeenCalledWith({ tenantId: 'tenant-1', patientId: 'patient-1', includeArchived: true });
    expect(mocks.listAuditEvents).not.toHaveBeenCalled();
    expect(buildPatientTimeline).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      patient,
      activityEvents: [],
      includeArchived: true,
    }));
    expect(latest?.events).toHaveLength(1);
    expect(container.textContent).toContain('Finding discovered');
    act(() => root.unmount());
  });

  it('does not load repositories or build timeline in Supabase-active no-tenant state', async () => {
    vi.mocked(useTenant).mockReturnValue({ activeTenant: null } as unknown as ReturnType<typeof useTenant>);
    const { root, render } = renderHook(patient);
    const latest = await render();

    expect(latest?.events).toEqual([]);
    expect(mocks.createChiefComplaintRepository).not.toHaveBeenCalled();
    expect(mocks.createAuditActivityRepository).not.toHaveBeenCalled();
    expect(buildPatientTimeline).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('returns empty events when patient is missing', async () => {
    const { root, render } = renderHook(null);
    const latest = await render();

    expect(latest?.events).toEqual([]);
    expect(mocks.createChiefComplaintRepository).not.toHaveBeenCalled();
    expect(mocks.createAuditActivityRepository).not.toHaveBeenCalled();
    expect(buildPatientTimeline).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('surfaces activity repository errors instead of silently hiding them', async () => {
    mocks.listPatientActivityEvents.mockRejectedValue(new Error('activity load failed'));
    const { root, render } = renderHook(patient);
    const latest = await render();

    expect(mocks.listPatientActivityEvents).toHaveBeenCalledWith({ tenantId: 'tenant-1', patientId: 'patient-1', includeArchived: false });
    expect(latest?.isError).toBe(true);
    expect(latest?.error?.message).toBe('activity load failed');
    act(() => root.unmount());
  });

  it('does not query activity repository in non-Supabase local mode and does not create a local fallback', async () => {
    vi.mocked(useAuth).mockReturnValue({ authMode: 'local' } as unknown as ReturnType<typeof useAuth>);
    const { root, render } = renderHook(patient);
    await render();

    expect(mocks.createAuditActivityRepository).not.toHaveBeenCalled();
    expect(mocks.listPatientActivityEvents).not.toHaveBeenCalled();
    expect(buildPatientTimeline).toHaveBeenCalledWith(expect.objectContaining({ activityEvents: [] }));
    act(() => root.unmount());
  });
});

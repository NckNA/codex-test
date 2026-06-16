import { useCallback, useMemo } from 'react';
import type { Patient } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useAsyncQuery } from './useAsyncQuery';
import { createChiefComplaintRepository } from '../repositories/ChiefComplaintRepository';
import { createFindingsRepository } from '../repositories/FindingsRepository';
import { createTreatmentPlansRepository } from '../repositories/TreatmentPlansRepository';
import { createAppointmentRepository } from '../repositories/AppointmentRepository';
import { createPatientFilesRepository } from '../repositories/PatientFilesRepository';
import { createDentalChartRepository } from '../repositories/DentalChartRepository';
import {
  buildPatientTimeline,
  canRoleSeePatientTimelineEvent,
  type PatientTimelineEvent,
} from '../aggregators/PatientTimelineAggregator';

interface UsePatientTimelineOptions {
  patient: Patient | null;
  includeArchived?: boolean;
}

export function usePatientTimeline({ patient, includeArchived = false }: UsePatientTimelineOptions) {
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const isNoTenantSupabase = authMode === 'supabase-active' && isSupabaseConfigured && !activeTenant?.tenantId;

  const repositoryConfig = useMemo(() => {
    const backend = authMode === 'supabase-active' && isSupabaseConfigured && activeTenant?.tenantId
      ? 'supabase'
      : 'local';

    return {
      backend,
      tenantId: activeTenant?.tenantId,
    } as const;
  }, [authMode, activeTenant?.tenantId]);

  const queryFn = useCallback(async (): Promise<PatientTimelineEvent[]> => {
    if (!patient?.id) return [];
    if (isNoTenantSupabase || !activeTenant?.tenantId) return [];

    const chiefComplaintRepository = createChiefComplaintRepository(repositoryConfig);
    const findingsRepository = createFindingsRepository(repositoryConfig);
    const treatmentPlansRepository = createTreatmentPlansRepository(repositoryConfig);
    const appointmentRepository = createAppointmentRepository(repositoryConfig);
    const patientFilesRepository = createPatientFilesRepository(repositoryConfig);
    const dentalChartRepository = createDentalChartRepository(repositoryConfig);

    const [chiefComplaint, findings, treatmentPlans, appointments, patientFiles, dentalChart] = await Promise.all([
      chiefComplaintRepository.getChiefComplaint(patient.id),
      findingsRepository.listFindingsByPatient(patient.id),
      treatmentPlansRepository.listTreatmentPlansByPatient(patient.id),
      appointmentRepository.listAppointmentsByPatient(patient.id),
      patientFilesRepository.listPatientFiles(patient.id, includeArchived),
      dentalChartRepository.getDentalChart(patient.id),
    ]);

    const events = buildPatientTimeline({
      tenantId: activeTenant.tenantId,
      patientId: patient.id,
      patient,
      chiefComplaint,
      findings,
      treatmentPlans,
      appointments,
      patientFiles,
      dentalChart,
      includeArchived,
    });

    return events.filter((event) => canRoleSeePatientTimelineEvent(activeTenant.role, event));
  }, [activeTenant, includeArchived, isNoTenantSupabase, patient, repositoryConfig]);

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<PatientTimelineEvent[]>({
    queryFn,
    initialData: [],
    enabled: Boolean(patient?.id),
  });

  return {
    events: isNoTenantSupabase ? [] : data,
    isLoading: isNoTenantSupabase ? false : isLoading,
    isError,
    error,
    refresh: refetch,
  };
}

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
import { createAuditActivityRepository } from '../repositories/AuditActivityRepository';
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
  const { authMode, user } = useAuth();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
  const isSupabaseMode = authMode === 'supabase-active' && isSupabaseConfigured;

  const repositoryConfig = useMemo(() => {
    if (authMode === 'dev') {
      return { backend: 'local' as const, tenantId };
    }
    if (isSupabaseMode && user?.id && tenantId) {
      return { backend: 'supabase' as const, tenantId };
    }
    return null;
  }, [authMode, isSupabaseMode, tenantId, user?.id]);

  const queryFn = useCallback(async (): Promise<PatientTimelineEvent[]> => {
    if (!patient?.id || !repositoryConfig) return [];

    const timelineTenantId = repositoryConfig.tenantId || '11111111-1111-1111-1111-111111111111';
    const chiefComplaintRepository = createChiefComplaintRepository(repositoryConfig);
    const findingsRepository = createFindingsRepository(repositoryConfig);
    const treatmentPlansRepository = createTreatmentPlansRepository(repositoryConfig);
    const appointmentRepository = createAppointmentRepository(repositoryConfig);
    const patientFilesRepository = createPatientFilesRepository(repositoryConfig);
    const dentalChartRepository = createDentalChartRepository(repositoryConfig);
    const activityRepository = repositoryConfig.backend === 'supabase'
      ? createAuditActivityRepository({ backend: 'supabase' })
      : null;

    const [chiefComplaint, findings, treatmentPlans, appointments, patientFiles, dentalChart, activityEvents] = await Promise.all([
      chiefComplaintRepository.getChiefComplaint(patient.id),
      findingsRepository.listFindingsByPatient(patient.id),
      treatmentPlansRepository.listTreatmentPlansByPatient(patient.id),
      appointmentRepository.listAppointmentsByPatient(patient.id),
      patientFilesRepository.listPatientFiles(patient.id, includeArchived),
      dentalChartRepository.getDentalChart(patient.id),
      activityRepository
        ? activityRepository.listPatientActivityEvents({
          tenantId: timelineTenantId,
          patientId: patient.id,
          includeArchived,
        })
        : Promise.resolve([]),
    ]);

    const events = buildPatientTimeline({
      tenantId: timelineTenantId,
      patientId: patient.id,
      patient,
      chiefComplaint,
      findings,
      treatmentPlans,
      appointments,
      patientFiles,
      activityEvents,
      dentalChart,
      includeArchived,
    });

    return events.filter((event) => canRoleSeePatientTimelineEvent(activeTenant?.role, event));
  }, [activeTenant?.role, includeArchived, patient, repositoryConfig]);

  const enabled = Boolean(patient?.id) && (
    authMode === 'dev'
    || (isSupabaseMode && Boolean(user?.id) && Boolean(tenantId))
  );
  const queryKey = `${authMode}:${user?.id || 'no-user'}:${tenantId || 'no-tenant'}:${patient?.id || 'no-patient'}:${includeArchived ? 'archived' : 'active'}:timeline`;

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<PatientTimelineEvent[]>({
    queryFn,
    initialData: [],
    enabled,
    queryKey,
    resetOnDisable: true,
  });

  return {
    events: enabled ? data : [],
    isLoading: enabled ? isLoading : false,
    isError: enabled ? isError : false,
    error: enabled ? error : null,
    refresh: refetch,
  };
}

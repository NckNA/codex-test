import { useCallback, useMemo } from 'react';
import {
  createPatientRepository,
  type PatientRepository,
} from '../repositories/PatientRepository';
import type {
  LaboratoryWorkOrderFilters,
  LaboratoryWorkOrderRecord,
} from '../repositories/LaboratoryWorkRepository';
import { useAsyncQuery } from './useAsyncQuery';
import { useLaboratoryWorkRepository } from './useLaboratoryWorkRepository';

const LABORATORY_QUEUE_ERROR = 'Не удалось загрузить очередь лабораторных работ.';
const LABORATORY_QUEUE_PATIENTS_ERROR = 'Не удалось загрузить имена пациентов для лабораторной очереди.';

export type LaboratoryWorkQueuePatientNamesById = Record<string, string>;

export interface UseLaboratoryWorkQueueResult {
  orders: LaboratoryWorkOrderRecord[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  patientNamesById: LaboratoryWorkQueuePatientNamesById;
  arePatientNamesLoading: boolean;
  arePatientNamesError: boolean;
  patientNamesError: Error | null;
  refetchPatientNames: () => Promise<void>;
}

type PatientRepositoryFactory = (config: {
  backend: 'supabase';
  tenantId: string;
}) => PatientRepository;

interface UseLaboratoryWorkQueueOptions {
  patientRepositoryFactory?: PatientRepositoryFactory;
}

const EMPTY_PATIENT_NAMES: LaboratoryWorkQueuePatientNamesById = {};
const defaultPatientRepositoryFactory: PatientRepositoryFactory = (config) => createPatientRepository(config);

function normalizeOptionalId(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeFilters(filters: LaboratoryWorkOrderFilters): LaboratoryWorkOrderFilters {
  return {
    patientId: normalizeOptionalId(filters.patientId),
    status: filters.status,
    laboratoryId: normalizeOptionalId(filters.laboratoryId),
    responsibleDoctorId: normalizeOptionalId(filters.responsibleDoctorId),
  };
}

function filterIdentity(filters: LaboratoryWorkOrderFilters): string {
  return [
    filters.patientId ?? '',
    filters.status ?? '',
    filters.laboratoryId ?? '',
    filters.responsibleDoctorId ?? '',
  ].join(':');
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export function useLaboratoryWorkQueue(
  filters: LaboratoryWorkOrderFilters = {},
  options: UseLaboratoryWorkQueueOptions = {},
): UseLaboratoryWorkQueueResult {
  const {
    repository,
    ready,
    backend,
    tenantId,
    userId,
  } = useLaboratoryWorkRepository();

  const {
    patientId: filterPatientId,
    status: filterStatus,
    laboratoryId: filterLaboratoryId,
    responsibleDoctorId: filterResponsibleDoctorId,
  } = filters;
  const normalizedFilters = useMemo(() => normalizeFilters({
    patientId: filterPatientId,
    status: filterStatus,
    laboratoryId: filterLaboratoryId,
    responsibleDoctorId: filterResponsibleDoctorId,
  }), [filterLaboratoryId, filterPatientId, filterResponsibleDoctorId, filterStatus]);
  const ordersEnabled = Boolean(ready && repository && backend !== 'unavailable');
  const ordersQueryKey = `${backend}:${tenantId ?? 'no-tenant'}:${userId ?? 'no-user'}:${filterIdentity(normalizedFilters)}`;

  const ordersQueryFn = useCallback(async (): Promise<LaboratoryWorkOrderRecord[]> => {
    if (!ordersEnabled || !repository) return [];
    try {
      return await repository.listOrders(normalizedFilters);
    } catch {
      throw new Error(LABORATORY_QUEUE_ERROR);
    }
  }, [normalizedFilters, ordersEnabled, repository]);

  const {
    data: orders,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<LaboratoryWorkOrderRecord[]>({
    queryFn: ordersQueryFn,
    initialData: [],
    enabled: ordersEnabled,
    queryKey: ordersQueryKey,
    resetOnDisable: true,
  });

  const patientIds = useMemo(() => uniqueSorted(orders.map((order) => order.patientId)), [orders]);
  const patientRepositoryFactory = options.patientRepositoryFactory ?? defaultPatientRepositoryFactory;

  const patientRepository = useMemo(() => {
    if (backend !== 'supabase' || !ready || !tenantId || patientIds.length === 0) return null;
    return patientRepositoryFactory({ backend: 'supabase', tenantId });
  }, [backend, patientIds.length, patientRepositoryFactory, ready, tenantId]);

  const patientNamesEnabled = Boolean(patientRepository && patientIds.length > 0);
  const patientNamesQueryKey = `${backend}:${tenantId ?? 'no-tenant'}:${userId ?? 'no-user'}:${patientIds.join(',') || 'no-patients'}`;

  const patientNamesQueryFn = useCallback(async (): Promise<LaboratoryWorkQueuePatientNamesById> => {
    if (!patientNamesEnabled || !patientRepository) return {};
    try {
      const patients = await patientRepository.listPatients();
      const requestedPatientIds = new Set(patientIds);
      return Object.fromEntries(
        patients
          .filter((patient) => requestedPatientIds.has(patient.id))
          .map((patient) => [patient.id, patient.fullName]),
      );
    } catch {
      throw new Error(LABORATORY_QUEUE_PATIENTS_ERROR);
    }
  }, [patientIds, patientNamesEnabled, patientRepository]);

  const {
    data: patientNamesById,
    isLoading: arePatientNamesLoading,
    isError: arePatientNamesError,
    error: patientNamesError,
    refetch: refetchPatientNames,
  } = useAsyncQuery<LaboratoryWorkQueuePatientNamesById>({
    queryFn: patientNamesQueryFn,
    initialData: EMPTY_PATIENT_NAMES,
    enabled: patientNamesEnabled,
    queryKey: patientNamesQueryKey,
    resetOnDisable: true,
  });

  return {
    orders: ordersEnabled ? orders : [],
    isLoading: ordersEnabled ? isLoading : false,
    isError: ordersEnabled ? isError : false,
    error: ordersEnabled ? error : null,
    refetch,
    patientNamesById: patientNamesEnabled ? patientNamesById : EMPTY_PATIENT_NAMES,
    arePatientNamesLoading: patientNamesEnabled ? arePatientNamesLoading : false,
    arePatientNamesError: patientNamesEnabled ? arePatientNamesError : false,
    patientNamesError: patientNamesEnabled ? patientNamesError : null,
    refetchPatientNames,
  };
}

import { useCallback, useMemo } from 'react';
import type { IDoctorRepository } from '../repositories/DoctorRepository';
import { createDoctorRepository } from '../repositories/DoctorRepository';
import type {
  LaboratoryWorkOrderRecord,
  LaboratoryWorkOrderTypeLinkRecord,
  LaboratoryWorkTypeRecord,
} from '../repositories/LaboratoryWorkRepository';
import { useAsyncQuery } from './useAsyncQuery';
import { useLaboratoryWorkRepository } from './useLaboratoryWorkRepository';

const LABORATORY_WORK_REFERENCES_ERROR = 'Не удалось загрузить справочные данные лабораторных работ пациента.';

export interface PatientLaboratoryWorkOrderReferences {
  responsibleDoctorName: string | null;
  laboratoryName: string | null;
  workTypeNames: string[];
}

export type PatientLaboratoryWorkReferencesByOrderId = Record<string, PatientLaboratoryWorkOrderReferences>;

export interface UsePatientLaboratoryWorkReferencesResult {
  referencesByOrderId: PatientLaboratoryWorkReferencesByOrderId;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

type DoctorRepositoryFactory = (config: {
  backend: 'local' | 'supabase';
  tenantId?: string | null;
}) => IDoctorRepository;

interface UsePatientLaboratoryWorkReferencesOptions {
  doctorRepositoryFactory?: DoctorRepositoryFactory;
}

const defaultDoctorRepositoryFactory: DoctorRepositoryFactory = (config) => createDoctorRepository(config);
const EMPTY_REFERENCES: PatientLaboratoryWorkReferencesByOrderId = {};

function uniqueSorted(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))].sort();
}

function buildWorkTypeIdsByOrderId(links: LaboratoryWorkOrderTypeLinkRecord[]): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  for (const link of links) {
    const workTypeIds = result.get(link.orderId) ?? new Set<string>();
    workTypeIds.add(link.workTypeId);
    result.set(link.orderId, workTypeIds);
  }
  return result;
}

function sortWorkTypes(workTypes: LaboratoryWorkTypeRecord[]): LaboratoryWorkTypeRecord[] {
  return [...workTypes].sort((left, right) => (
    left.sortOrder - right.sortOrder
    || left.name.localeCompare(right.name, 'ru')
    || left.id.localeCompare(right.id)
  ));
}

export function usePatientLaboratoryWorkReferences(
  orders: LaboratoryWorkOrderRecord[],
  options: UsePatientLaboratoryWorkReferencesOptions = {},
): UsePatientLaboratoryWorkReferencesResult {
  const {
    repository,
    ready,
    backend,
    tenantId,
    userId,
  } = useLaboratoryWorkRepository();

  const orderIds = useMemo(() => uniqueSorted(orders.map((order) => order.id)), [orders]);
  const doctorIds = useMemo(() => uniqueSorted(orders.map((order) => order.responsibleDoctorId)), [orders]);
  const enabled = Boolean(ready && repository && backend !== 'unavailable' && orderIds.length > 0);
  const doctorRepositoryFactory = options.doctorRepositoryFactory ?? defaultDoctorRepositoryFactory;

  const doctorRepository = useMemo(() => {
    if (!enabled || backend !== 'supabase' || !tenantId) return null;
    return doctorRepositoryFactory({
      backend,
      tenantId,
    });
  }, [backend, doctorRepositoryFactory, enabled, tenantId]);

  const queryFn = useCallback(async (): Promise<PatientLaboratoryWorkReferencesByOrderId> => {
    if (!enabled || !repository) return {};

    try {
      const [laboratories, workTypes, links, doctors] = await Promise.all([
        repository.listLaboratories(true),
        repository.listWorkTypes(true),
        repository.listOrderWorkTypeLinks(orderIds),
        doctorIds.length > 0 && doctorRepository ? doctorRepository.listDoctors() : Promise.resolve([]),
      ]);

      const laboratoryNames = new Map(laboratories.map((laboratory) => [laboratory.id, laboratory.name]));
      const doctorNames = new Map(doctors.map((doctor) => [doctor.id, doctor.fullName]));
      const workTypeIdsByOrderId = buildWorkTypeIdsByOrderId(links);
      const orderedWorkTypes = sortWorkTypes(workTypes);
      const referencesByOrderId: PatientLaboratoryWorkReferencesByOrderId = {};

      for (const order of orders) {
        const selectedWorkTypeIds = workTypeIdsByOrderId.get(order.id) ?? new Set<string>();
        referencesByOrderId[order.id] = {
          responsibleDoctorName: order.responsibleDoctorId
            ? doctorNames.get(order.responsibleDoctorId) ?? null
            : null,
          laboratoryName: order.laboratoryId
            ? laboratoryNames.get(order.laboratoryId) ?? null
            : null,
          workTypeNames: orderedWorkTypes
            .filter((workType) => selectedWorkTypeIds.has(workType.id))
            .map((workType) => workType.name),
        };
      }

      return referencesByOrderId;
    } catch {
      throw new Error(LABORATORY_WORK_REFERENCES_ERROR);
    }
  }, [doctorIds, doctorRepository, enabled, orderIds, orders, repository]);

  const orderIdentity = useMemo(() => orders
    .map((order) => `${order.id}:${order.responsibleDoctorId ?? ''}:${order.laboratoryId ?? ''}:${order.updatedAt}`)
    .sort()
    .join('|'), [orders]);
  const queryKey = `${backend}:${tenantId ?? 'no-tenant'}:${userId ?? 'no-user'}:${orderIdentity || 'no-orders'}`;

  const {
    data: referencesByOrderId,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<PatientLaboratoryWorkReferencesByOrderId>({
    queryFn,
    initialData: EMPTY_REFERENCES,
    enabled,
    queryKey,
    resetOnDisable: true,
  });

  return {
    referencesByOrderId: enabled ? referencesByOrderId : EMPTY_REFERENCES,
    isLoading: enabled ? isLoading : false,
    isError: enabled ? isError : false,
    error: enabled ? error : null,
    refetch,
  };
}

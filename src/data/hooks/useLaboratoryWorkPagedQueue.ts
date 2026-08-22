import { useCallback, useMemo } from 'react';
import {
  createPatientRepository,
  type PatientRepository,
} from '../repositories/PatientRepository';
import {
  createLaboratoryWorkQueueReadClient,
  type LaboratoryWorkQueueDueFilter,
  type LaboratoryWorkQueueFilterOptions,
  type LaboratoryWorkQueuePageResult,
  type LaboratoryWorkQueueReadClient,
  type LaboratoryWorkQueueReferencesByOrderId,
  type LaboratoryWorkQueueSummary,
} from '../repositories/LaboratoryWorkQueueReadClient';
import type { LaboratoryWorkOrderStatus } from '../repositories/LaboratoryWorkRepository';
import { useAsyncQuery } from './useAsyncQuery';
import { useLaboratoryWorkRepository } from './useLaboratoryWorkRepository';

const QUEUE_PAGE_ERROR = 'Не удалось загрузить страницу очереди лабораторных работ.';
const QUEUE_SUMMARY_ERROR = 'Не удалось загрузить сводку лабораторных работ.';
const QUEUE_PATIENTS_ERROR = 'Не удалось загрузить имена пациентов для лабораторной очереди.';
const QUEUE_REFERENCES_ERROR = 'Не удалось загрузить справочные данные текущей страницы лабораторной очереди.';
const QUEUE_FILTER_OPTIONS_ERROR = 'Не удалось загрузить фильтры лабораторной очереди.';

const DEFAULT_LIMIT = 50;

export interface LaboratoryWorkPagedQueueInput {
  status?: LaboratoryWorkOrderStatus;
  responsibleDoctorId?: string;
  laboratoryId?: string;
  dueFilter?: LaboratoryWorkQueueDueFilter;
  search?: string;
  limit?: number;
  offset?: number;
}

export type LaboratoryWorkQueuePatientNamesById = Record<string, string>;

export interface UseLaboratoryWorkPagedQueueResult {
  orders: LaboratoryWorkQueuePageResult['items'];
  totalFiltered: number;
  limit: number;
  offset: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => Promise<void>;

  summary: LaboratoryWorkQueueSummary;
  isSummaryLoading: boolean;
  isSummaryError: boolean;
  summaryError: Error | null;
  refetchSummary: () => Promise<void>;

  patientNamesById: LaboratoryWorkQueuePatientNamesById;
  arePatientNamesLoading: boolean;
  arePatientNamesError: boolean;
  patientNamesError: Error | null;
  refetchPatientNames: () => Promise<void>;

  referencesByOrderId: LaboratoryWorkQueueReferencesByOrderId;
  areReferencesLoading: boolean;
  areReferencesError: boolean;
  referencesError: Error | null;
  refetchReferences: () => Promise<void>;

  filterOptions: LaboratoryWorkQueueFilterOptions;
  areFilterOptionsLoading: boolean;
  areFilterOptionsError: boolean;
  filterOptionsError: Error | null;
  refetchFilterOptions: () => Promise<void>;
}

type ReadClientFactory = (config: { backend: 'supabase' }) => LaboratoryWorkQueueReadClient;
type PatientRepositoryFactory = (config: { backend: 'supabase'; tenantId: string }) => PatientRepository;

interface UseLaboratoryWorkPagedQueueOptions {
  readClientFactory?: ReadClientFactory;
  patientRepositoryFactory?: PatientRepositoryFactory;
}

const EMPTY_SUMMARY: LaboratoryWorkQueueSummary = { inProgress: 0, overdue: 0, completed: 0 };
const EMPTY_PATIENT_NAMES: LaboratoryWorkQueuePatientNamesById = {};
const EMPTY_REFERENCES: LaboratoryWorkQueueReferencesByOrderId = {};
const EMPTY_FILTER_OPTIONS: LaboratoryWorkQueueFilterOptions = { doctors: [], laboratories: [] };

const defaultReadClientFactory: ReadClientFactory = () => createLaboratoryWorkQueueReadClient({ backend: 'supabase' });
const defaultPatientRepositoryFactory: PatientRepositoryFactory = (config) => createPatientRepository(config);

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized || undefined;
}

function normalizeInput(input: LaboratoryWorkPagedQueueInput): Required<Pick<LaboratoryWorkPagedQueueInput, 'limit' | 'offset'>> & LaboratoryWorkPagedQueueInput {
  return {
    status: input.status,
    responsibleDoctorId: normalizeOptional(input.responsibleDoctorId),
    laboratoryId: normalizeOptional(input.laboratoryId),
    dueFilter: input.dueFilter ?? 'all',
    search: normalizeOptional(input.search),
    limit: input.limit ?? DEFAULT_LIMIT,
    offset: input.offset ?? 0,
  };
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function useLaboratoryWorkPagedQueue(
  input: LaboratoryWorkPagedQueueInput = {},
  options: UseLaboratoryWorkPagedQueueOptions = {},
): UseLaboratoryWorkPagedQueueResult {
  const {
    ready,
    backend,
    tenantId,
    userId,
  } = useLaboratoryWorkRepository();

  const {
    status: inputStatus,
    responsibleDoctorId: inputResponsibleDoctorId,
    laboratoryId: inputLaboratoryId,
    dueFilter: inputDueFilter,
    search: inputSearch,
    limit: inputLimit,
    offset: inputOffset,
  } = input;
  const normalized = useMemo(() => normalizeInput({
    status: inputStatus,
    responsibleDoctorId: inputResponsibleDoctorId,
    laboratoryId: inputLaboratoryId,
    dueFilter: inputDueFilter,
    search: inputSearch,
    limit: inputLimit,
    offset: inputOffset,
  }), [
    inputStatus,
    inputResponsibleDoctorId,
    inputLaboratoryId,
    inputDueFilter,
    inputSearch,
    inputLimit,
    inputOffset,
  ]);
  const readClientFactory = options.readClientFactory ?? defaultReadClientFactory;
  const patientRepositoryFactory = options.patientRepositoryFactory ?? defaultPatientRepositoryFactory;
  const enabled = Boolean(ready && backend === 'supabase' && tenantId && userId);

  const readClient = useMemo(() => {
    if (!enabled) return null;
    return readClientFactory({ backend: 'supabase' });
  }, [enabled, readClientFactory]);

  const initialPage = useMemo<LaboratoryWorkQueuePageResult>(() => ({
    items: [],
    totalFiltered: 0,
    limit: normalized.limit,
    offset: normalized.offset,
  }), [normalized.limit, normalized.offset]);

  const pageIdentity = [
    backend,
    tenantId ?? 'no-tenant',
    userId ?? 'no-user',
    normalized.status ?? '',
    normalized.responsibleDoctorId ?? '',
    normalized.laboratoryId ?? '',
    normalized.dueFilter ?? 'all',
    normalized.search ?? '',
    String(normalized.limit),
    String(normalized.offset),
  ].join(':');

  const pageQueryFn = useCallback(async (): Promise<LaboratoryWorkQueuePageResult> => {
    if (!enabled || !readClient || !tenantId) return initialPage;
    try {
      return await readClient.listPage({
        tenantId,
        status: normalized.status,
        responsibleDoctorId: normalized.responsibleDoctorId,
        laboratoryId: normalized.laboratoryId,
        dueFilter: normalized.dueFilter,
        search: normalized.search,
        limit: normalized.limit,
        offset: normalized.offset,
      });
    } catch {
      throw new Error(QUEUE_PAGE_ERROR);
    }
  }, [enabled, initialPage, normalized, readClient, tenantId]);

  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
  } = useAsyncQuery<LaboratoryWorkQueuePageResult>({
    queryFn: pageQueryFn,
    initialData: initialPage,
    enabled,
    queryKey: pageIdentity,
    resetOnDisable: true,
  });

  const summaryQueryFn = useCallback(async (): Promise<LaboratoryWorkQueueSummary> => {
    if (!enabled || !readClient || !tenantId) return EMPTY_SUMMARY;
    try {
      return await readClient.getSummary(tenantId);
    } catch {
      throw new Error(QUEUE_SUMMARY_ERROR);
    }
  }, [enabled, readClient, tenantId]);

  const summaryIdentity = `${backend}:${tenantId ?? 'no-tenant'}:${userId ?? 'no-user'}:summary`;
  const {
    data: summary,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    error: summaryError,
    refetch: refetchSummary,
  } = useAsyncQuery<LaboratoryWorkQueueSummary>({
    queryFn: summaryQueryFn,
    initialData: EMPTY_SUMMARY,
    enabled,
    queryKey: summaryIdentity,
    resetOnDisable: true,
  });

  const patientIds = useMemo(() => uniqueSorted(page.items.map((order) => order.patientId)), [page.items]);
  const patientRepository = useMemo(() => {
    if (!enabled || !tenantId || patientIds.length === 0) return null;
    return patientRepositoryFactory({ backend: 'supabase', tenantId });
  }, [enabled, patientIds.length, patientRepositoryFactory, tenantId]);
  const patientNamesEnabled = Boolean(patientRepository && patientIds.length > 0);
  const patientNamesIdentity = `${backend}:${tenantId ?? 'no-tenant'}:${userId ?? 'no-user'}:${patientIds.join(',') || 'no-patients'}`;

  const patientNamesQueryFn = useCallback(async (): Promise<LaboratoryWorkQueuePatientNamesById> => {
    if (!patientNamesEnabled || !patientRepository) return {};
    try {
      if (typeof patientRepository.listPatientLabelsByIds !== 'function') {
        throw new Error('patient label capability unavailable');
      }
      const labels = await patientRepository.listPatientLabelsByIds(patientIds);
      const requested = new Set(patientIds);
      return Object.fromEntries(
        labels
          .filter((label) => requested.has(label.id))
          .map((label) => [label.id, label.fullName]),
      );
    } catch {
      throw new Error(QUEUE_PATIENTS_ERROR);
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
    queryKey: patientNamesIdentity,
    resetOnDisable: true,
  });

  const orderIdentity = useMemo(() => page.items
    .map((order) => `${order.id}:${order.responsibleDoctorId ?? ''}:${order.laboratoryId ?? ''}:${order.updatedAt}`)
    .sort()
    .join('|'), [page.items]);
  const referencesEnabled = Boolean(enabled && readClient && tenantId && page.items.length > 0);
  const referencesIdentity = `${backend}:${tenantId ?? 'no-tenant'}:${userId ?? 'no-user'}:${orderIdentity || 'no-orders'}`;

  const referencesQueryFn = useCallback(async (): Promise<LaboratoryWorkQueueReferencesByOrderId> => {
    if (!referencesEnabled || !readClient || !tenantId) return {};
    try {
      return await readClient.listPageReferences(tenantId, page.items);
    } catch {
      throw new Error(QUEUE_REFERENCES_ERROR);
    }
  }, [page.items, readClient, referencesEnabled, tenantId]);

  const {
    data: referencesByOrderId,
    isLoading: areReferencesLoading,
    isError: areReferencesError,
    error: referencesError,
    refetch: refetchReferences,
  } = useAsyncQuery<LaboratoryWorkQueueReferencesByOrderId>({
    queryFn: referencesQueryFn,
    initialData: EMPTY_REFERENCES,
    enabled: referencesEnabled,
    queryKey: referencesIdentity,
    resetOnDisable: true,
  });

  const filterOptionsQueryFn = useCallback(async (): Promise<LaboratoryWorkQueueFilterOptions> => {
    if (!enabled || !readClient || !tenantId) return EMPTY_FILTER_OPTIONS;
    try {
      return await readClient.listFilterOptions(tenantId);
    } catch {
      throw new Error(QUEUE_FILTER_OPTIONS_ERROR);
    }
  }, [enabled, readClient, tenantId]);
  const filterOptionsIdentity = `${backend}:${tenantId ?? 'no-tenant'}:${userId ?? 'no-user'}:filter-options`;

  const {
    data: filterOptions,
    isLoading: areFilterOptionsLoading,
    isError: areFilterOptionsError,
    error: filterOptionsError,
    refetch: refetchFilterOptions,
  } = useAsyncQuery<LaboratoryWorkQueueFilterOptions>({
    queryFn: filterOptionsQueryFn,
    initialData: EMPTY_FILTER_OPTIONS,
    enabled,
    queryKey: filterOptionsIdentity,
    resetOnDisable: true,
  });

  return {
    orders: enabled ? page.items : [],
    totalFiltered: enabled ? page.totalFiltered : 0,
    limit: enabled ? page.limit : normalized.limit,
    offset: enabled ? page.offset : normalized.offset,
    isLoading: enabled ? isLoading : false,
    isError: enabled ? isError : false,
    error: enabled ? error : null,
    refetch,

    summary: enabled ? summary : EMPTY_SUMMARY,
    isSummaryLoading: enabled ? isSummaryLoading : false,
    isSummaryError: enabled ? isSummaryError : false,
    summaryError: enabled ? summaryError : null,
    refetchSummary,

    patientNamesById: patientNamesEnabled ? patientNamesById : EMPTY_PATIENT_NAMES,
    arePatientNamesLoading: patientNamesEnabled ? arePatientNamesLoading : false,
    arePatientNamesError: patientNamesEnabled ? arePatientNamesError : false,
    patientNamesError: patientNamesEnabled ? patientNamesError : null,
    refetchPatientNames,

    referencesByOrderId: referencesEnabled ? referencesByOrderId : EMPTY_REFERENCES,
    areReferencesLoading: referencesEnabled ? areReferencesLoading : false,
    areReferencesError: referencesEnabled ? areReferencesError : false,
    referencesError: referencesEnabled ? referencesError : null,
    refetchReferences,

    filterOptions: enabled ? filterOptions : EMPTY_FILTER_OPTIONS,
    areFilterOptionsLoading: enabled ? areFilterOptionsLoading : false,
    areFilterOptionsError: enabled ? areFilterOptionsError : false,
    filterOptionsError: enabled ? filterOptionsError : null,
    refetchFilterOptions,
  };
}

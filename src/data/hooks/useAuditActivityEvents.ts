import { useCallback, useMemo } from 'react';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { useAsyncQuery } from './useAsyncQuery';
import {
  createAuditActivityRepository,
  DEFAULT_AUDIT_ACTIVITY_LIMIT,
  type ActivityEvent,
  type ActivityEventCategory,
  type ActivityEventVisibility,
  type AuditEvent,
  type AuditEventCategory,
  type AuditEventSeverity,
} from '../repositories/AuditActivityRepository';

export type AuditActivityViewerTab = 'activity' | 'audit';

export const ADMIN_AUDIT_ALLOWED_ROLES = ['clinic_owner', 'clinic_admin'] as const;

export function canViewAdminAudit(role: string | null | undefined): boolean {
  return role === 'clinic_owner' || role === 'clinic_admin';
}

export interface AuditActivityViewerFilters {
  category?: string;
  severity?: AuditEventSeverity | 'all';
  dateFrom?: string;
  dateTo?: string;
  visibility?: ActivityEventVisibility | 'all';
  includeArchived?: boolean;
  targetType?: string;
  patientId?: string;
  actorUserId?: string;
  limit?: number;
  offset?: number;
}

const EMPTY_AUDIT_ACTIVITY_FILTERS: AuditActivityViewerFilters = {};

interface UseAuditActivityEventsOptions {
  tenantId?: string | null;
  role?: string | null;
  activeTab: AuditActivityViewerTab;
  filters?: AuditActivityViewerFilters;
  backendAvailable?: boolean;
}

export interface UseAuditActivityEventsResult {
  activityEvents: ActivityEvent[];
  auditEvents: AuditEvent[];
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  isEnabled: boolean;
}

interface AuditActivityQueryResult {
  activityEvents: ActivityEvent[];
  auditEvents: AuditEvent[];
}

function normalizeTextFilter(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function dateStart(value?: string): string | undefined {
  return value ? `${value}T00:00:00.000Z` : undefined;
}

function dateEnd(value?: string): string | undefined {
  return value ? `${value}T23:59:59.999Z` : undefined;
}

function singleValueArray<T extends string>(value?: T | 'all' | string): T[] | undefined {
  if (!value || value === 'all') return undefined;
  return [value as T];
}

export function useAuditActivityEvents({
  tenantId,
  role,
  activeTab,
  filters = EMPTY_AUDIT_ACTIVITY_FILTERS,
  backendAvailable = isSupabaseConfigured,
}: UseAuditActivityEventsOptions): UseAuditActivityEventsResult {
  const isEnabled = Boolean(backendAvailable && tenantId && canViewAdminAudit(role));
  const limit = filters.limit ?? DEFAULT_AUDIT_ACTIVITY_LIMIT;
  const offset = filters.offset ?? 0;

  const queryFn = useCallback(async (): Promise<AuditActivityQueryResult> => {
    if (!isEnabled || !tenantId) {
      return { activityEvents: [], auditEvents: [] };
    }

    const repository = createAuditActivityRepository({ backend: 'supabase' });

    if (activeTab === 'activity') {
      const activityEvents = await repository.listActivityEvents({
        tenantId,
        categories: singleValueArray<ActivityEventCategory>(filters.category),
        visibility: singleValueArray<ActivityEventVisibility>(filters.visibility),
        occurredFrom: dateStart(filters.dateFrom),
        occurredTo: dateEnd(filters.dateTo),
        includeArchived: filters.includeArchived,
        limit,
        offset,
      });
      return { activityEvents, auditEvents: [] };
    }

    const auditEvents = await repository.listAuditEvents({
      tenantId,
      categories: singleValueArray<AuditEventCategory>(filters.category),
      severities: singleValueArray<AuditEventSeverity>(filters.severity),
      targetType: normalizeTextFilter(filters.targetType),
      patientId: normalizeTextFilter(filters.patientId),
      actorUserId: normalizeTextFilter(filters.actorUserId),
      createdFrom: dateStart(filters.dateFrom),
      createdTo: dateEnd(filters.dateTo),
      limit,
      offset,
    });
    return { activityEvents: [], auditEvents };
  }, [activeTab, filters, isEnabled, limit, offset, tenantId]);

  const initialData = useMemo<AuditActivityQueryResult>(() => ({ activityEvents: [], auditEvents: [] }), []);

  const { data, isLoading, isError, error, refetch } = useAsyncQuery<AuditActivityQueryResult>({
    queryFn,
    initialData,
    enabled: isEnabled,
  });

  return {
    activityEvents: isEnabled ? data.activityEvents : [],
    auditEvents: isEnabled ? data.auditEvents : [],
    isLoading: isEnabled ? isLoading : false,
    isError,
    error,
    refresh: refetch,
    isEnabled,
  };
}

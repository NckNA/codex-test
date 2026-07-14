import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { isValidIanaTimezone } from '../domain/timezone';
import { useAuth } from './AuthContext';
import { mapPlatformAdminStatus, type PlatformAdminStatusResult } from '../domain/platform/PlatformAdmin';
import { parseTenantLifecycleStatus, type TenantAccessReason, type TenantLifecycleStatus } from '../domain/platform/TenantLifecycle';

export const LEGACY_TENANT_TIMEZONE = 'Asia/Almaty';

export interface ActiveTenant {
  tenantId: string;
  tenantName: string;
  timezone: string;
  role?: string;
  storedStatus?: TenantLifecycleStatus;
  effectiveStatus?: TenantLifecycleStatus;
  operationalAccessAllowed?: boolean;
  reasonCode?: TenantAccessReason;
  actionRequired?: string;
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  graceExpiresAt?: string;
  suspendedUntil?: string;
}

interface TenantContextType {
  activeTenant: ActiveTenant | null;
  availableTenants: ActiveTenant[];
  setActiveTenant: (tenantId: string) => void;
  refreshTenants?: () => Promise<void>;
  platformAdminStatus?: PlatformAdminStatusResult | null;
  isPlatformSuperadmin?: boolean;
  isLoading: boolean;
  error: Error | null;
}

interface LoadedTenantState {
  userId: string | null;
  tenants: ActiveTenant[];
  selectedTenantId: string | null;
  platformAdminStatus: PlatformAdminStatusResult | null;
  error: Error | null;
}

const devTenant: ActiveTenant = {
  tenantId: '11111111-1111-1111-1111-111111111111', tenantName: 'Demo Clinic', timezone: LEGACY_TENANT_TIMEZONE,
  role: 'clinic_admin', storedStatus: 'active', effectiveStatus: 'active', operationalAccessAllowed: true,
  reasonCode: 'none', actionRequired: 'none', subscriptionStartedAt: '2020-01-01T00:00:00Z', subscriptionExpiresAt: '2099-12-31T00:00:00Z',
};

const emptyState: LoadedTenantState = { userId: null, tenants: [], selectedTenantId: null, platformAdminStatus: null, error: null };
const TenantContext = createContext<TenantContextType | undefined>(undefined);
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const optional = (value: unknown): string | undefined => value == null || value === '' ? undefined : String(value);

function mapTenantRows(rows: unknown[]): ActiveTenant[] {
  return rows.map((value) => {
    const row = record(value);
    const timezone = String(row.timezone ?? LEGACY_TENANT_TIMEZONE);
    if (!isValidIanaTimezone(timezone)) throw new Error('Не удалось определить часовой пояс клиники.');
    return {
      tenantId: String(row.tenant_id ?? row.tenantId ?? ''), tenantName: String(row.tenant_name ?? row.tenantName ?? ''), timezone,
      role: optional(row.role), storedStatus: parseTenantLifecycleStatus(row.stored_status ?? row.storedStatus),
      effectiveStatus: parseTenantLifecycleStatus(row.effective_status ?? row.effectiveStatus),
      operationalAccessAllowed: Boolean(row.operational_access_allowed ?? row.operationalAccessAllowed),
      reasonCode: String(row.reason_code ?? row.reasonCode ?? 'tenant_unavailable') as TenantAccessReason,
      actionRequired: String(row.action_required ?? row.actionRequired ?? 'contact_support'),
      subscriptionStartedAt: optional(row.subscription_started_at ?? row.subscriptionStartedAt),
      subscriptionExpiresAt: optional(row.subscription_expires_at ?? row.subscriptionExpiresAt),
      graceExpiresAt: optional(row.grace_expires_at ?? row.graceExpiresAt), suspendedUntil: optional(row.suspended_until ?? row.suspendedUntil),
    };
  }).filter((tenant) => tenant.tenantId && tenant.tenantName);
}

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authMode, isLoading: authLoading, user } = useAuth();
  const [state, setState] = useState<LoadedTenantState>(emptyState);

  const refreshTenants = useCallback(async () => {
    if (authMode !== 'supabase-active' || authLoading || !user || !supabase) return;
    const userId = user.id;
    try {
      const [adminResponse, tenantResponse] = await Promise.all([
        supabase.rpc('get_platform_admin_status'),
        supabase.rpc('list_my_tenant_access'),
      ]);
      if (adminResponse.error) throw adminResponse.error;
      if (tenantResponse.error) throw tenantResponse.error;
      const tenants = mapTenantRows(Array.isArray(tenantResponse.data) ? tenantResponse.data : []);
      const platformAdminStatus = mapPlatformAdminStatus(adminResponse.data);
      setState((current) => {
        const preferred = tenants.some((tenant) => tenant.tenantId === current.selectedTenantId)
          ? current.selectedTenantId
          : tenants.find((tenant) => tenant.operationalAccessAllowed)?.tenantId ?? tenants[0]?.tenantId ?? null;
        return { userId, tenants, selectedTenantId: preferred, platformAdminStatus, error: null };
      });
    } catch (cause) {
      setState({ userId, tenants: [], selectedTenantId: null, platformAdminStatus: null, error: cause instanceof Error ? cause : new Error('Не удалось загрузить доступ к клиникам.') });
    }
  }, [authLoading, authMode, user]);

  useEffect(() => {
    if (authMode !== 'supabase-active' || authLoading || !user || !supabase) return;
    let active = true;
    queueMicrotask(() => { if (active) void refreshTenants(); });
    return () => { active = false; };
  }, [authLoading, authMode, refreshTenants, user]);

  const setActiveTenant = (tenantId: string) => {
    if (authMode === 'dev') return;
    setState((current) => current.tenants.some((tenant) => tenant.tenantId === tenantId)
      ? { ...current, selectedTenantId: tenantId, error: null }
      : current);
  };

  if (authMode === 'dev') return <TenantContext.Provider value={{ activeTenant: devTenant, availableTenants: [devTenant], setActiveTenant, refreshTenants: async () => undefined, platformAdminStatus: null, isPlatformSuperadmin: false, isLoading: false, error: null }}>{children}</TenantContext.Provider>;
  if (authLoading) return <TenantContext.Provider value={{ activeTenant: null, availableTenants: [], setActiveTenant, refreshTenants, platformAdminStatus: null, isPlatformSuperadmin: false, isLoading: true, error: null }}>{children}</TenantContext.Provider>;
  if (!user) return <TenantContext.Provider value={{ activeTenant: null, availableTenants: [], setActiveTenant, refreshTenants, platformAdminStatus: null, isPlatformSuperadmin: false, isLoading: false, error: null }}>{children}</TenantContext.Provider>;

  const isLoading = state.userId !== user.id;
  const activeTenant = isLoading ? null : state.tenants.find((tenant) => tenant.tenantId === state.selectedTenantId) ?? null;
  return <TenantContext.Provider value={{
    activeTenant, availableTenants: isLoading ? [] : state.tenants, setActiveTenant, refreshTenants,
    platformAdminStatus: isLoading ? null : state.platformAdminStatus,
    isPlatformSuperadmin: Boolean(!isLoading && state.platformAdminStatus?.isPlatformSuperadmin),
    isLoading, error: isLoading ? null : state.error,
  }}>{children}</TenantContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTenant = () => {
  const context = useContext(TenantContext);
  if (!context) throw new Error('useTenant must be used within a TenantProvider');
  return context;
};

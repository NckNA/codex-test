import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

export interface ActiveTenant {
  tenantId: string;
  tenantName: string;
  role?: string;
}

interface TenantContextType {
  activeTenant: ActiveTenant | null;
  availableTenants: ActiveTenant[];
  setActiveTenant: (tenantId: string) => void;
  isLoading: boolean;
  error: Error | null;
}

interface TenantRelation {
  id?: string | null;
  name?: string | null;
  status?: string | null;
}

interface TenantUserRow {
  tenant_id?: string | null;
  role?: string | null;
  tenants?: TenantRelation | TenantRelation[] | null;
}

const devTenant: ActiveTenant = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  tenantName: 'Demo Clinic',
  role: 'admin',
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const normalizeTenantRelation = (relation: TenantUserRow['tenants']) => {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation ?? null;
};

const mapTenantRows = (rows: TenantUserRow[]): ActiveTenant[] => {
  return rows.flatMap((row) => {
    const tenant = normalizeTenantRelation(row.tenants);
    const tenantId = tenant?.id ?? row.tenant_id;

    if (!tenantId || !tenant?.name) {
      return [];
    }

    return [{
      tenantId,
      tenantName: tenant.name,
      role: row.role ?? undefined,
    }];
  });
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authMode, isLoading: authLoading, user } = useAuth();

  const [availableTenants, setAvailableTenants] = useState<ActiveTenant[]>(
    authMode === 'dev' ? [devTenant] : []
  );
  const [activeTenantState, setActiveTenantState] = useState<ActiveTenant | null>(
    authMode === 'dev' ? devTenant : null
  );
  const [isLoading, setIsLoading] = useState<boolean>(authMode !== 'dev');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const resetTenants = (loading: boolean) => {
      setAvailableTenants([]);
      setActiveTenantState(null);
      setIsLoading(loading);
      setError(null);
    };

    if (authMode === 'dev') {
      setAvailableTenants([devTenant]);
      setActiveTenantState(devTenant);
      setIsLoading(false);
      setError(null);
      return;
    }

    if (authLoading) {
      resetTenants(true);
      return;
    }

    if (!user) {
      resetTenants(false);
      return;
    }

    if (!supabase) {
      setAvailableTenants([]);
      setActiveTenantState(null);
      setIsLoading(false);
      setError(new Error('Supabase client is not configured'));
      return;
    }

    async function loadTenants() {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: tenantError } = await supabase!
          .from('tenant_users')
          .select('role, tenant_id, tenants(id, name, status)')
          .eq('user_id', user.id);

        if (tenantError) {
          throw tenantError;
        }

        const tenants = mapTenantRows((data ?? []) as TenantUserRow[]);

        if (!mounted) {
          return;
        }

        setAvailableTenants(tenants);
        setActiveTenantState(tenants[0] ?? null);
        setIsLoading(false);
      } catch (err) {
        if (!mounted) {
          return;
        }

        console.error('Error loading tenant access:', err);
        setAvailableTenants([]);
        setActiveTenantState(null);
        setError(err instanceof Error ? err : new Error('Failed to load tenants'));
        setIsLoading(false);
      }
    }

    loadTenants();

    return () => {
      mounted = false;
    };
  }, [authMode, authLoading, user]);

  const setActiveTenant = (tenantId: string) => {
    const tenant = availableTenants.find((candidate) => candidate.tenantId === tenantId);

    if (tenant) {
      setActiveTenantState(tenant);
    }
  };

  // FUTURE SUPABASE REPOSITORIES MUST OBTAIN tenant_id FROM THIS CONTEXT OR AN ADAPTER
  // Do NOT hardcode production tenant IDs.

  return (
    <TenantContext.Provider value={{ activeTenant: activeTenantState, availableTenants, setActiveTenant, isLoading, error }}>
      {children}
    </TenantContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTenant = () => {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
};

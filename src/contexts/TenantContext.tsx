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
}

interface TenantUserRow {
  tenant_id?: string | null;
  role?: string | null;
  tenants?: TenantRelation | TenantRelation[] | null;
}

interface LoadedTenantState {
  userId: string | null;
  tenants: ActiveTenant[];
  selectedTenantId: string | null;
  error: Error | null;
}

const devTenant: ActiveTenant = {
  tenantId: '11111111-1111-1111-1111-111111111111',
  tenantName: 'Demo Clinic',
  role: 'admin',
};

const emptyLoadedTenantState: LoadedTenantState = {
  userId: null,
  tenants: [],
  selectedTenantId: null,
  error: null,
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

    return [{ tenantId, tenantName: tenant.name, role: row.role ?? undefined }];
  });
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authMode, isLoading: authLoading, user } = useAuth();
  const [loadedTenantState, setLoadedTenantState] = useState<LoadedTenantState>(emptyLoadedTenantState);

  useEffect(() => {
    if (authMode !== 'supabase-active' || authLoading || !user || !supabase) {
      return;
    }

    let mounted = true;
    const currentUserId = user.id;

    async function loadTenants() {
      try {
        const { data, error } = await supabase!
          .from('tenant_users')
          .select('role, tenant_id, tenants(id, name, status)')
          .eq('user_id', currentUserId);

        if (error) {
          throw error;
        }

        const tenants = mapTenantRows((data ?? []) as TenantUserRow[]);

        if (!mounted) {
          return;
        }

        setLoadedTenantState((current) => {
          const selectedTenantId = tenants.some((tenant) => tenant.tenantId === current.selectedTenantId)
            ? current.selectedTenantId
            : tenants[0]?.tenantId ?? null;

          return { userId: currentUserId, tenants, selectedTenantId, error: null };
        });
      } catch (err) {
        if (!mounted) {
          return;
        }

        setLoadedTenantState({
          userId: currentUserId,
          tenants: [],
          selectedTenantId: null,
          error: err instanceof Error ? err : new Error('Failed to load tenants'),
        });
      }
    }

    loadTenants();

    return () => {
      mounted = false;
    };
  }, [authMode, authLoading, user]);

  const setActiveTenant = (tenantId: string) => {
    if (authMode === 'dev') {
      return;
    }

    setLoadedTenantState((current) => {
      const tenantExists = current.tenants.some((tenant) => tenant.tenantId === tenantId);

      if (!tenantExists) {
        return current;
      }

      return { ...current, selectedTenantId: tenantId };
    });
  };

  if (authMode === 'dev') {
    return (
      <TenantContext.Provider value={{ activeTenant: devTenant, availableTenants: [devTenant], setActiveTenant, isLoading: false, error: null }}>
        {children}
      </TenantContext.Provider>
    );
  }

  if (authLoading) {
    return (
      <TenantContext.Provider value={{ activeTenant: null, availableTenants: [], setActiveTenant, isLoading: true, error: null }}>
        {children}
      </TenantContext.Provider>
    );
  }

  if (!user) {
    return (
      <TenantContext.Provider value={{ activeTenant: null, availableTenants: [], setActiveTenant, isLoading: false, error: null }}>
        {children}
      </TenantContext.Provider>
    );
  }

  const isLoading = loadedTenantState.userId !== user.id;
  const activeTenant = loadedTenantState.tenants.find((tenant) => tenant.tenantId === loadedTenantState.selectedTenantId) ?? null;

  return (
    <TenantContext.Provider value={{
      activeTenant,
      availableTenants: loadedTenantState.tenants,
      setActiveTenant,
      isLoading,
      error: loadedTenantState.error,
    }}>
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

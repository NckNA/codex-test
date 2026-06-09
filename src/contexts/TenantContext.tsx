import React, { createContext, useContext, useState } from 'react';
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

const TenantContext = createContext<TenantContextType | undefined>(undefined);

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authMode } = useAuth();

  const devTenant: ActiveTenant = {
    tenantId: "11111111-1111-1111-1111-111111111111",
    tenantName: "Demo Clinic",
    role: "admin",
  };

  const availableTenants = authMode === 'dev' ? [devTenant] : [];
  
  const [activeTenantState, setActiveTenantState] = useState<ActiveTenant | null>(
    authMode === 'dev' ? devTenant : null
  );

  const isLoading = authMode !== 'dev';
  const error = null;

  const setActiveTenant = (tenantId: string) => {
    // TODO: implement real tenant switching
    console.warn('Tenant switching not yet implemented. Requested ID:', tenantId);
    
    if (authMode === 'dev') {
       const tenant = availableTenants.find(t => t.tenantId === tenantId);
       if (tenant) {
         setActiveTenantState(tenant);
       }
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

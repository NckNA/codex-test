import React, { createContext, useContext, useState } from 'react';

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
  // Skeleton state. Does not connect to real Supabase yet.
  const [activeTenant] = useState<ActiveTenant | null>(null);
  const [availableTenants] = useState<ActiveTenant[]>([]);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  const setActiveTenant = (tenantId: string) => {
    // TODO: implement real tenant switching
    console.warn('Tenant switching not yet implemented. Requested ID:', tenantId);
  };

  // FUTURE SUPABASE REPOSITORIES MUST OBTAIN tenant_id FROM THIS CONTEXT OR AN ADAPTER
  // Do NOT hardcode production tenant IDs.

  return (
    <TenantContext.Provider value={{ activeTenant, availableTenants, setActiveTenant, isLoading, error }}>
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

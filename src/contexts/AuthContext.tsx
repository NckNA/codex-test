import React, { createContext, useContext } from 'react';
import { isSupabaseConfigured } from '../lib/supabaseClient';

// TODO: Replace with real Supabase User type once implemented
export interface AppUser {
  id: string;
  email?: string;
  // Add other profile fields when ready
}

interface AuthContextType {
  user: AppUser | null;
  isLoading: boolean;
  error: Error | null;
  authMode: 'dev' | 'supabase-unwired';
  // TODO: Add login/logout methods when implementing real auth
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authMode: 'dev' | 'supabase-unwired' = isSupabaseConfigured ? 'supabase-unwired' : 'dev';

  const user = authMode === 'dev' ? { id: 'dev-user-000000000000', email: 'dev@example.com' } : null;
  const isLoading = authMode !== 'dev';
  const error = null;

  return (
    <AuthContext.Provider value={{ user, isLoading, error, authMode }}>
      {children}
    </AuthContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

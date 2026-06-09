import React, { createContext, useContext, useState } from 'react';

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
  // TODO: Add login/logout methods when implementing real auth
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Skeleton state. Currently does not connect to real Supabase.
  const [user] = useState<AppUser | null>(null);
  const [isLoading] = useState(false);
  const [error] = useState<Error | null>(null);

  // TODO: Implement Supabase onAuthStateChange listener here

  return (
    <AuthContext.Provider value={{ user, isLoading, error }}>
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

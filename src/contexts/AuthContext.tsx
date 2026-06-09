import React, { createContext, useContext, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';

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
  authMode: 'dev' | 'supabase-active';
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const authMode: 'dev' | 'supabase-active' = isSupabaseConfigured ? 'supabase-active' : 'dev';

  const [user, setUser] = useState<AppUser | null>(
    authMode === 'dev' ? { id: 'dev-user-000000000000', email: 'dev@example.com' } : null
  );
  const [isLoading, setIsLoading] = useState<boolean>(authMode !== 'dev');
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (authMode === 'dev' || !supabase) {
      return;
    }

    let mounted = true;

    async function initializeSession() {
      try {
        const { data, error: sessionError } = await supabase!.auth.getSession();
        if (sessionError) {
          throw sessionError;
        }
        
        if (mounted) {
          if (data.session?.user) {
            setUser({
              id: data.session.user.id,
              email: data.session.user.email ?? undefined
            });
          } else {
            setUser(null);
          }
          setIsLoading(false);
        }
      } catch (err) {
        if (mounted) {
          console.error('Error fetching Supabase session:', err);
          setError(err instanceof Error ? err : new Error('Failed to fetch session'));
          setIsLoading(false);
        }
      }
    }

    initializeSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        if (session?.user) {
          setUser({
            id: session.user.id,
            email: session.user.email ?? undefined
          });
        } else {
          setUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [authMode]);

  const signIn = async (email: string, password: string) => {
    if (authMode === 'dev' || !supabase) {
      return Promise.resolve();
    }

    setError(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      
      if (data.session?.user) {
        setUser({
          id: data.session.user.id,
          email: data.session.user.email ?? undefined
        });
      }
    } catch (err) {
      console.error('Sign in error:', err);
      setError(err instanceof Error ? err : new Error('Failed to sign in'));
      throw err;
    }
  };

  const signOut = async () => {
    if (authMode === 'dev' || !supabase) {
      return Promise.resolve();
    }
    
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setUser(null);
    } catch (err) {
      console.error('Sign out error:', err);
      setError(err instanceof Error ? err : new Error('Failed to sign out'));
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, error, authMode, signIn, signOut }}>
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

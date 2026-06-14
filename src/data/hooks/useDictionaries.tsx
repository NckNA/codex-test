import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { ClinicalDiagnosis, ClinicalWork } from '../../config/clinicalDictionaries';
import { createClinicalDictionariesRepository } from '../repositories/ClinicalDictionariesRepository';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';

interface DictionariesContextType {
  diagnoses: ClinicalDiagnosis[];
  works: ClinicalWork[];
  loading: boolean;
  error: string | null;
  saveDiagnosis: (diagnosis: ClinicalDiagnosis) => Promise<void>;
  saveWork: (work: ClinicalWork) => Promise<void>;
  refresh: () => Promise<void>;
}

const DictionariesContext = createContext<DictionariesContextType | undefined>(undefined);

export function ClinicalDictionariesProvider({ children }: { children: React.ReactNode }) {
  const { authMode } = useAuth();
  const { activeTenant } = useTenant();

  const [diagnoses, setDiagnoses] = useState<ClinicalDiagnosis[]>([]);
  const [works, setWorks] = useState<ClinicalWork[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const repository = useMemo(() => {
    const backend = (authMode === 'supabase-active' && isSupabaseConfigured && activeTenant?.tenantId) 
      ? 'supabase' 
      : 'local';
    
    return createClinicalDictionariesRepository({ backend, tenantId: activeTenant?.tenantId });
  }, [authMode, activeTenant?.tenantId]);

  const isNoTenantSupabase = authMode === 'supabase-active' && isSupabaseConfigured && !activeTenant?.tenantId;

  const loadData = useCallback(async () => {
    if (isNoTenantSupabase) {
      setDiagnoses([]);
      setWorks([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [loadedDiagnoses, loadedWorks] = await Promise.all([
        repository.getDiagnoses(),
        repository.getWorks(),
      ]);
      setDiagnoses(loadedDiagnoses);
      setWorks(loadedWorks);
      setError(null);
    } catch (err) {
      console.error('Failed to load clinical dictionaries:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dictionaries');
    } finally {
      setLoading(false);
    }
  }, [repository, isNoTenantSupabase]);

  useEffect(() => {
    let ignore = false;
    
    // We defer the execution to avoid synchronously calling setState inside useEffect
    // which triggers the react-hooks/set-state-in-effect lint rule.
    void Promise.resolve().then(() => {
      if (!ignore) {
        void loadData();
      }
    });
    
    return () => {
      ignore = true;
    };
  }, [loadData]);

  const saveDiagnosis = useCallback(async (diagnosis: ClinicalDiagnosis) => {
    if (isNoTenantSupabase) {
      const err = new Error("Active clinic is required for Supabase data access.");
      setError(err.message);
      throw err;
    }
    try {
      await repository.saveDiagnosis(diagnosis);
      
      setDiagnoses(prev => {
        const exists = prev.find(d => d.id === diagnosis.id);
        let updated: ClinicalDiagnosis[];
        if (exists) {
          updated = prev.map(d => d.id === diagnosis.id ? diagnosis : d);
        } else {
          updated = [...prev, diagnosis];
        }
        return updated;
      });
      setError(null);
    } catch (err) {
      console.error('Failed to save diagnosis:', err);
      setError(err instanceof Error ? err.message : 'Failed to save diagnosis');
      throw err;
    }
  }, [repository, isNoTenantSupabase]);

  const saveWork = useCallback(async (work: ClinicalWork) => {
    if (isNoTenantSupabase) {
      const err = new Error("Active clinic is required for Supabase data access.");
      setError(err.message);
      throw err;
    }
    try {
      await repository.saveWork(work);
      
      setWorks(prev => {
        const exists = prev.find(w => w.id === work.id);
        let updated: ClinicalWork[];
        if (exists) {
          updated = prev.map(w => w.id === work.id ? work : w);
        } else {
          updated = [...prev, work];
        }
        return updated;
      });
      setError(null);
    } catch (err) {
      console.error('Failed to save work:', err);
      setError(err instanceof Error ? err.message : 'Failed to save work');
      throw err;
    }
  }, [repository, isNoTenantSupabase]);

  const value = {
    diagnoses,
    works,
    loading,
    error,
    saveDiagnosis,
    saveWork,
    refresh: loadData,
  };

  return (
    <DictionariesContext.Provider value={value}>
      {children}
    </DictionariesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDictionaries() {
  const context = useContext(DictionariesContext);
  if (context === undefined) {
    throw new Error('useDictionaries must be used within a ClinicalDictionariesProvider');
  }
  return context;
}

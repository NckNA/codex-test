import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ClinicalDiagnosis, ClinicalWork } from '../../config/clinicalDictionaries';
import { ClinicalDictionariesRepository } from '../repositories/ClinicalDictionariesRepository';

interface DictionariesContextType {
  diagnoses: ClinicalDiagnosis[];
  works: ClinicalWork[];
  loading: boolean;
  saveDiagnosis: (diagnosis: ClinicalDiagnosis) => void;
  saveWork: (work: ClinicalWork) => void;
  refresh: () => void;
}

const DictionariesContext = createContext<DictionariesContextType | undefined>(undefined);

export function ClinicalDictionariesProvider({ children }: { children: React.ReactNode }) {
  const [diagnoses, setDiagnoses] = useState<ClinicalDiagnosis[]>(() => ClinicalDictionariesRepository.getDiagnoses());
  const [works, setWorks] = useState<ClinicalWork[]>(() => ClinicalDictionariesRepository.getWorks());
  const [loading, setLoading] = useState(false);



  const loadData = useCallback(() => {
    setLoading(true);
    const loadedDiagnoses = ClinicalDictionariesRepository.getDiagnoses();
    const loadedWorks = ClinicalDictionariesRepository.getWorks();
    setDiagnoses(loadedDiagnoses);
    setWorks(loadedWorks);
    setLoading(false);
  }, []);



  const saveDiagnosis = useCallback((diagnosis: ClinicalDiagnosis) => {
    setDiagnoses(prev => {
      const exists = prev.find(d => d.id === diagnosis.id);
      let updated: ClinicalDiagnosis[];
      if (exists) {
        updated = prev.map(d => d.id === diagnosis.id ? diagnosis : d);
      } else {
        updated = [...prev, diagnosis];
      }
      ClinicalDictionariesRepository.saveDiagnoses(updated);
      return updated;
    });
  }, []);

  const saveWork = useCallback((work: ClinicalWork) => {
    setWorks(prev => {
      const exists = prev.find(w => w.id === work.id);
      let updated: ClinicalWork[];
      if (exists) {
        updated = prev.map(w => w.id === work.id ? work : w);
      } else {
        updated = [...prev, work];
      }
      ClinicalDictionariesRepository.saveWorks(updated);
      return updated;
    });
  }, []);

  const value = {
    diagnoses,
    works,
    loading,
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

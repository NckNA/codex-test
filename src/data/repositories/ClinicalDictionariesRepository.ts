import { defaultDiagnoses, defaultClinicalWorks } from '../../config/clinicalDictionaries';
import type { ClinicalDiagnosis, ClinicalWork } from '../../config/clinicalDictionaries';

const STORAGE_KEY_DIAGNOSES = 'codex_clinical_diagnoses';
const STORAGE_KEY_WORKS = 'codex_clinical_works';

export const ClinicalDictionariesRepository = {
  getDiagnoses(): ClinicalDiagnosis[] {
    const data = localStorage.getItem(STORAGE_KEY_DIAGNOSES);
    if (!data) {
      this.saveDiagnoses(defaultDiagnoses);
      return defaultDiagnoses;
    }
    try {
      return JSON.parse(data);
    } catch {
      return defaultDiagnoses;
    }
  },

  saveDiagnoses(diagnoses: ClinicalDiagnosis[]): void {
    localStorage.setItem(STORAGE_KEY_DIAGNOSES, JSON.stringify(diagnoses));
  },

  getWorks(): ClinicalWork[] {
    const data = localStorage.getItem(STORAGE_KEY_WORKS);
    if (!data) {
      this.saveWorks(defaultClinicalWorks);
      return defaultClinicalWorks;
    }
    try {
      return JSON.parse(data);
    } catch {
      return defaultClinicalWorks;
    }
  },

  saveWorks(works: ClinicalWork[]): void {
    localStorage.setItem(STORAGE_KEY_WORKS, JSON.stringify(works));
  },
};

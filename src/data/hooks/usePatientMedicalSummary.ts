import { useCallback } from 'react';
import { useAsyncQuery } from './useAsyncQuery';
import {
  getPatientMedicalSummary,
  EMPTY_PATIENT_MEDICAL_SUMMARY,
  type PatientMedicalSummaryData
} from '../aggregators/ClinicalSummaryAggregator';

export function usePatientMedicalSummary(patientId: string) {
  const queryFn = useCallback(() => getPatientMedicalSummary(patientId), [patientId]);

  return useAsyncQuery<PatientMedicalSummaryData>({
    queryFn,
    initialData: EMPTY_PATIENT_MEDICAL_SUMMARY,
    enabled: Boolean(patientId),
  });
}

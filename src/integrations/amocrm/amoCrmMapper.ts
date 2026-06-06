import type { Patient, TreatmentPlan } from '../../types';
import type { AmoCrmContactDraft, AmoCrmLeadDraft, AmoCrmSyncPreview } from './amoCrmTypes';

/**
 * Maps a DentalFlow Patient to an amoCRM Contact draft.
 * Extracts only generic commercial/administrative data.
 */
export function mapPatientToAmoContactDraft(patient: Patient): AmoCrmContactDraft {
  return {
    name: patient.fullName,
    phone: patient.phone,
    // Email is not currently in the basic Patient model, but kept for future-proofing
    email: undefined,
  };
}

/**
 * Maps a DentalFlow TreatmentPlan to an amoCRM Lead draft.
 * Strict Rule: Do not include detailed medical data (findings, tooth numbers, diagnoses).
 */
export function mapTreatmentPlanToAmoLeadDraft(patient: Patient, plan: TreatmentPlan): AmoCrmLeadDraft {
  const safeSource = patient.integration?.source || 'manual';

  return {
    name: `План лечения: ${plan.title || 'Новый план'} (${patient.fullName})`,
    price: plan.totalPrice,
    status: patient.integration?.leadStatus || 'new_lead',
    source: safeSource,
  };
}

/**
 * Builds a preview object for what would be sent to amoCRM during a sync.
 */
export function buildAmoSyncPreview(patient: Patient, plan?: TreatmentPlan): AmoCrmSyncPreview {
  const warnings: string[] = [];

  if (!patient.phone) {
    warnings.push('У пациента нет номера телефона, создание контакта в CRM может быть неуспешным.');
  }

  if (plan && plan.totalPrice === 0) {
    warnings.push('У плана лечения нулевая стоимость.');
  }

  return {
    contact: mapPatientToAmoContactDraft(patient),
    lead: plan ? mapTreatmentPlanToAmoLeadDraft(patient, plan) : undefined,
    warnings,
  };
}

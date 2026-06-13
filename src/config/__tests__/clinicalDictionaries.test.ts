import { describe, expect, it } from 'vitest';
import type { ClinicalDiagnosis, ClinicalWork } from '../clinicalDictionaries';
import {
  defaultClinicalWorks,
  defaultDiagnoses,
  getAvailableZonesForPresence,
  getBaseWorksByPresenceAndZone,
  getDiagnosesByPresenceAndZone,
  getWorksByDiagnoses,
  getWorksByPresenceAndZone,
} from '../clinicalDictionaries';

describe('clinical dictionaries', () => {
  it('contains only unique diagnosis and work ids', () => {
    const diagnosisIds = defaultDiagnoses.map((diagnosis) => diagnosis.id);
    const workIds = defaultClinicalWorks.map((work) => work.id);

    expect(new Set(diagnosisIds).size).toBe(diagnosisIds.length);
    expect(new Set(workIds).size).toBe(workIds.length);
  });

  it('filters diagnoses by tooth presence status and clinical zone', () => {
    const crownDiagnoses = getDiagnosesByPresenceAndZone('natural', 'crown');
    const missingPlanningDiagnoses = getDiagnosesByPresenceAndZone('missing', 'planning');

    expect(crownDiagnoses.map((diagnosis) => diagnosis.id)).toContain('dx_caries_enamel');
    expect(crownDiagnoses.every((diagnosis) => diagnosis.allowedPresenceStatuses.includes('natural'))).toBe(true);
    expect(crownDiagnoses.every((diagnosis) => diagnosis.allowedZones.includes('crown'))).toBe(true);
    expect(missingPlanningDiagnoses.map((diagnosis) => diagnosis.id)).toContain('dx_missing_tooth');
    expect(missingPlanningDiagnoses.map((diagnosis) => diagnosis.id)).not.toContain('dx_caries_enamel');
  });

  it('filters works by tooth presence status and clinical zone', () => {
    const crownWorks = getWorksByPresenceAndZone('natural', 'crown');
    const implantOrthoWorks = getWorksByPresenceAndZone('implant', 'orthopedics');

    expect(crownWorks.map((work) => work.id)).toContain('work_filling_1_surface');
    expect(crownWorks.map((work) => work.id)).not.toContain('work_implant_crown');
    expect(implantOrthoWorks.map((work) => work.id)).toContain('work_implant_crown');
    expect(implantOrthoWorks.map((work) => work.id)).toContain('work_implant_maintenance');
  });

  it('returns base and status available works without selected diagnoses', () => {
    const endodonticBaseWorks = getBaseWorksByPresenceAndZone('natural', 'endodontics');
    const implantStatusWorks = getBaseWorksByPresenceAndZone('implant', 'orthopedics');

    expect(endodonticBaseWorks.map((work) => work.id)).toContain('work_temporary_filling');
    expect(endodonticBaseWorks.map((work) => work.id)).not.toContain('work_root_canal_treatment');
    expect(implantStatusWorks.map((work) => work.id)).toContain('work_implant_maintenance');
  });

  it('returns diagnosis-dependent works for selected diagnoses', () => {
    const works = getWorksByDiagnoses('natural', 'crown', [
      'dx_caries_initial',
      'dx_caries_enamel',
    ]);

    expect(works.map((work) => work.id)).toContain('work_fissure_sealing');
    expect(works.map((work) => work.id)).toContain('work_remineralization');
    expect(works.map((work) => work.id)).toContain('work_filling_1_surface');
    expect(works.map((work) => work.id)).toContain('work_temporary_filling');
    expect(works.map((work) => work.id)).not.toContain('work_root_canal_treatment');
  });

  it('does not return diagnosis-dependent works when diagnosis is not selected', () => {
    const works = getWorksByDiagnoses('missing', 'bone', ['dx_missing_tooth']);

    expect(works.map((work) => work.id)).toContain('work_implant_installation');
    expect(works.map((work) => work.id)).not.toContain('work_bone_grafting');
  });

  it('lists zones available for a presence status from diagnoses and works', () => {
    expect(getAvailableZonesForPresence('natural')).toEqual(expect.arrayContaining([
      'crown',
      'endodontics',
      'root',
      'periodontium',
    ]));

    expect(getAvailableZonesForPresence('missing')).toEqual(expect.arrayContaining([
      'periodontium',
      'bone',
      'orthopedics',
    ]));

    expect(getAvailableZonesForPresence('implant')).toEqual(expect.arrayContaining([
      'orthopedics',
      'periodontium',
      'bone',
    ]));
  });

  it('supports custom dictionary sources for future clinic-managed dictionaries', () => {
    const customDiagnoses: ClinicalDiagnosis[] = [{
      id: 'dx_custom',
      type: 'diagnosis',
      name: 'Пользовательский диагноз',
      allowedPresenceStatuses: ['natural'],
      allowedZones: ['planning'],
    }];

    const customWorks: ClinicalWork[] = [{
      id: 'work_custom',
      type: 'work',
      name: 'Пользовательская работа',
      allowedPresenceStatuses: ['natural'],
      allowedZones: ['planning'],
      allowedDiagnosisIds: ['dx_custom'],
      workAccessType: 'requires_diagnosis',
    }];

    expect(getDiagnosesByPresenceAndZone('natural', 'planning', customDiagnoses)).toEqual(customDiagnoses);
    expect(getWorksByDiagnoses('natural', 'planning', ['dx_custom'], customWorks)).toEqual(customWorks);
  });
});

import type { ClinicalZone, ToothPresenceStatus } from '../types';

export type ClinicalDictionaryItemType = 'diagnosis' | 'work';
export type WorkAccessType = 'base_available' | 'status_available' | 'requires_diagnosis';

export interface ClinicalDictionaryBaseItem {
  id: string;
  name: string;
  allowedPresenceStatuses: ToothPresenceStatus[];
  allowedZones: ClinicalZone[];
  description?: string;
  isActive?: boolean;
}

export interface ClinicalDiagnosis extends ClinicalDictionaryBaseItem {
  type: 'diagnosis';
  visualPriority?: number;
}

export interface ClinicalWork extends ClinicalDictionaryBaseItem {
  type: 'work';
  workAccessType: WorkAccessType;
  allowedDiagnosisIds: string[];
  price?: number;
}

export const defaultDiagnoses: ClinicalDiagnosis[] = [
  {
    id: 'dx_caries_initial',
    type: 'diagnosis',
    name: 'Начальный кариес / white spot',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    visualPriority: 20,
  },
  {
    id: 'dx_caries_enamel',
    type: 'diagnosis',
    name: 'Кариес эмали',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    visualPriority: 30,
  },
  {
    id: 'dx_caries_dentin',
    type: 'diagnosis',
    name: 'Кариес дентина',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    visualPriority: 40,
  },
  {
    id: 'dx_deep_caries',
    type: 'diagnosis',
    name: 'Глубокий кариес',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    visualPriority: 50,
  },
  {
    id: 'dx_filling_defect',
    type: 'diagnosis',
    name: 'Нарушение краевого прилегания пломбы',
    allowedPresenceStatuses: ['natural'],
    allowedZones: ['crown'],
    visualPriority: 25,
  },
  {
    id: 'dx_crown_fracture',
    type: 'diagnosis',
    name: 'Перелом коронки',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    visualPriority: 45,
  },
  {
    id: 'dx_reversible_pulpitis',
    type: 'diagnosis',
    name: 'Обратимый пульпит',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['endodontics'],
    visualPriority: 60,
  },
  {
    id: 'dx_irreversible_pulpitis',
    type: 'diagnosis',
    name: 'Необратимый пульпит',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['endodontics'],
    visualPriority: 70,
  },
  {
    id: 'dx_pulp_necrosis',
    type: 'diagnosis',
    name: 'Некроз пульпы',
    allowedPresenceStatuses: ['natural'],
    allowedZones: ['endodontics'],
    visualPriority: 80,
  },
  {
    id: 'dx_previously_treated_canals',
    type: 'diagnosis',
    name: 'Ранее леченые каналы',
    allowedPresenceStatuses: ['natural'],
    allowedZones: ['endodontics'],
    visualPriority: 35,
  },
  {
    id: 'dx_apical_periodontitis',
    type: 'diagnosis',
    name: 'Апикальный периодонтит',
    allowedPresenceStatuses: ['natural', 'root_remnant'],
    allowedZones: ['root'],
    visualPriority: 75,
  },
  {
    id: 'dx_radicular_cyst',
    type: 'diagnosis',
    name: 'Радикулярная киста',
    allowedPresenceStatuses: ['natural', 'root_remnant'],
    allowedZones: ['root'],
    visualPriority: 85,
  },
  {
    id: 'dx_root_remnant',
    type: 'diagnosis',
    name: 'Остаток корня',
    allowedPresenceStatuses: ['root_remnant'],
    allowedZones: ['root'],
    visualPriority: 65,
  },
  {
    id: 'dx_root_caries',
    type: 'diagnosis',
    name: 'Кариес корня',
    allowedPresenceStatuses: ['natural', 'root_remnant'],
    allowedZones: ['root'],
    visualPriority: 55,
  },
  {
    id: 'dx_gingivitis',
    type: 'diagnosis',
    name: 'Гингивит',
    allowedPresenceStatuses: ['natural', 'implant', 'deciduous'],
    allowedZones: ['periodontium'],
    visualPriority: 25,
  },
  {
    id: 'dx_periodontal_pocket',
    type: 'diagnosis',
    name: 'Пародонтальный карман',
    allowedPresenceStatuses: ['natural', 'implant'],
    allowedZones: ['periodontium'],
    visualPriority: 45,
  },
  {
    id: 'dx_recession',
    type: 'diagnosis',
    name: 'Рецессия десны',
    allowedPresenceStatuses: ['natural', 'implant'],
    allowedZones: ['periodontium'],
    visualPriority: 35,
  },
  {
    id: 'dx_missing_tooth',
    type: 'diagnosis',
    name: 'Отсутствие зуба',
    allowedPresenceStatuses: ['missing'],
    allowedZones: ['planning'],
    visualPriority: 50,
  },
  {
    id: 'dx_partial_adentia',
    type: 'diagnosis',
    name: 'Частичная адентия',
    allowedPresenceStatuses: ['missing'],
    allowedZones: ['planning'],
    visualPriority: 55,
  },
  {
    id: 'dx_bone_atrophy_height',
    type: 'diagnosis',
    name: 'Атрофия костной ткани по высоте',
    allowedPresenceStatuses: ['missing'],
    allowedZones: ['bone'],
    visualPriority: 60,
  },
  {
    id: 'dx_bone_atrophy_width',
    type: 'diagnosis',
    name: 'Атрофия костной ткани по ширине',
    allowedPresenceStatuses: ['missing'],
    allowedZones: ['bone'],
    visualPriority: 60,
  },
  {
    id: 'dx_implant_installed',
    type: 'diagnosis',
    name: 'Установлен имплант',
    allowedPresenceStatuses: ['implant'],
    allowedZones: ['orthopedics', 'bone'],
    visualPriority: 30,
  },
  {
    id: 'dx_peri_implantitis',
    type: 'diagnosis',
    name: 'Периимплантит',
    allowedPresenceStatuses: ['implant'],
    allowedZones: ['periodontium', 'bone'],
    visualPriority: 85,
  },
  {
    id: 'dx_implant_crown_defect',
    type: 'diagnosis',
    name: 'Дефект коронки на импланте',
    allowedPresenceStatuses: ['implant'],
    allowedZones: ['orthopedics'],
    visualPriority: 40,
  },
  {
    id: 'dx_impacted_tooth',
    type: 'diagnosis',
    name: 'Ретинированный / дистопированный зуб',
    allowedPresenceStatuses: ['impacted'],
    allowedZones: ['planning', 'bone'],
    visualPriority: 70,
  },
];

export const defaultClinicalWorks: ClinicalWork[] = [
  {
    id: 'work_fissure_sealing',
    type: 'work',
    name: 'Герметизация фиссур',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    allowedDiagnosisIds: ['dx_caries_initial'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_remineralization',
    type: 'work',
    name: 'Реминерализующая терапия',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    allowedDiagnosisIds: ['dx_caries_initial'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_filling_1_surface',
    type: 'work',
    name: 'Пломба 1 поверхность',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    allowedDiagnosisIds: ['dx_caries_enamel', 'dx_caries_dentin', 'dx_filling_defect'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_filling_2_surfaces',
    type: 'work',
    name: 'Пломба 2 поверхности',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown'],
    allowedDiagnosisIds: ['dx_caries_dentin', 'dx_deep_caries', 'dx_crown_fracture'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_temporary_filling',
    type: 'work',
    name: 'Временная пломба',
    allowedPresenceStatuses: ['natural', 'deciduous'],
    allowedZones: ['crown', 'endodontics'],
    allowedDiagnosisIds: [],
    workAccessType: 'base_available',
  },
  {
    id: 'work_root_canal_treatment',
    type: 'work',
    name: 'Лечение корневых каналов',
    allowedPresenceStatuses: ['natural'],
    allowedZones: ['endodontics'],
    allowedDiagnosisIds: ['dx_irreversible_pulpitis', 'dx_pulp_necrosis'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_root_canal_retreatment',
    type: 'work',
    name: 'Перелечивание каналов',
    allowedPresenceStatuses: ['natural'],
    allowedZones: ['endodontics'],
    allowedDiagnosisIds: ['dx_previously_treated_canals', 'dx_apical_periodontitis'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_root_remnant_extraction',
    type: 'work',
    name: 'Удаление остатка корня',
    allowedPresenceStatuses: ['root_remnant'],
    allowedZones: ['root'],
    allowedDiagnosisIds: ['dx_root_remnant', 'dx_root_caries'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_periodontal_cleaning',
    type: 'work',
    name: 'Пародонтологическая чистка',
    allowedPresenceStatuses: ['natural', 'implant', 'deciduous'],
    allowedZones: ['periodontium'],
    allowedDiagnosisIds: ['dx_gingivitis', 'dx_periodontal_pocket'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_curettage',
    type: 'work',
    name: 'Кюретаж пародонтального кармана',
    allowedPresenceStatuses: ['natural'],
    allowedZones: ['periodontium'],
    allowedDiagnosisIds: ['dx_periodontal_pocket'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_implant_planning',
    type: 'work',
    name: 'Планирование имплантации',
    allowedPresenceStatuses: ['missing'],
    allowedZones: ['planning'],
    allowedDiagnosisIds: ['dx_missing_tooth', 'dx_partial_adentia'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_implant_installation',
    type: 'work',
    name: 'Установка импланта',
    allowedPresenceStatuses: ['missing'],
    allowedZones: ['planning', 'bone'],
    allowedDiagnosisIds: ['dx_missing_tooth', 'dx_bone_atrophy_height', 'dx_bone_atrophy_width'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_bone_grafting',
    type: 'work',
    name: 'Костная пластика',
    allowedPresenceStatuses: ['missing'],
    allowedZones: ['bone'],
    allowedDiagnosisIds: ['dx_bone_atrophy_height', 'dx_bone_atrophy_width'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_implant_crown',
    type: 'work',
    name: 'Коронка на импланте',
    allowedPresenceStatuses: ['implant'],
    allowedZones: ['orthopedics'],
    allowedDiagnosisIds: ['dx_implant_installed', 'dx_implant_crown_defect'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_implant_maintenance',
    type: 'work',
    name: 'Обслуживание импланта',
    allowedPresenceStatuses: ['implant'],
    allowedZones: ['periodontium', 'orthopedics'],
    allowedDiagnosisIds: [],
    workAccessType: 'status_available',
  },
  {
    id: 'work_peri_implantitis_treatment',
    type: 'work',
    name: 'Лечение периимплантита',
    allowedPresenceStatuses: ['implant'],
    allowedZones: ['periodontium', 'bone'],
    allowedDiagnosisIds: ['dx_peri_implantitis'],
    workAccessType: 'requires_diagnosis',
  },
  {
    id: 'work_impacted_tooth_diagnostics',
    type: 'work',
    name: 'Диагностика ретинированного зуба',
    allowedPresenceStatuses: ['impacted'],
    allowedZones: ['planning'],
    allowedDiagnosisIds: [],
    workAccessType: 'status_available',
  },
  {
    id: 'work_impacted_tooth_extraction',
    type: 'work',
    name: 'Удаление ретинированного зуба',
    allowedPresenceStatuses: ['impacted'],
    allowedZones: ['planning', 'bone'],
    allowedDiagnosisIds: ['dx_impacted_tooth'],
    workAccessType: 'requires_diagnosis',
  },
];

function isAllowedForPresenceAndZone(
  item: ClinicalDictionaryBaseItem,
  presenceStatus: ToothPresenceStatus,
  zone: ClinicalZone,
): boolean {
  if (item.isActive === false) return false;
  return item.allowedPresenceStatuses.includes(presenceStatus) && item.allowedZones.includes(zone);
}

export function getDiagnosesByPresenceAndZone(
  presenceStatus: ToothPresenceStatus,
  zone: ClinicalZone,
  diagnoses: ClinicalDiagnosis[] = defaultDiagnoses,
): ClinicalDiagnosis[] {
  return diagnoses.filter((diagnosis) => isAllowedForPresenceAndZone(diagnosis, presenceStatus, zone));
}

export function getWorksByPresenceAndZone(
  presenceStatus: ToothPresenceStatus,
  zone: ClinicalZone,
  works: ClinicalWork[] = defaultClinicalWorks,
): ClinicalWork[] {
  return works.filter((work) => isAllowedForPresenceAndZone(work, presenceStatus, zone));
}

export function getBaseWorksByPresenceAndZone(
  presenceStatus: ToothPresenceStatus,
  zone: ClinicalZone,
  works: ClinicalWork[] = defaultClinicalWorks,
): ClinicalWork[] {
  return getWorksByPresenceAndZone(presenceStatus, zone, works).filter((work) => (
    work.workAccessType === 'base_available' || work.workAccessType === 'status_available'
  ));
}

export function getWorksByDiagnoses(
  presenceStatus: ToothPresenceStatus,
  zone: ClinicalZone,
  diagnosisIds: string[],
  works: ClinicalWork[] = defaultClinicalWorks,
): ClinicalWork[] {
  const selectedDiagnosisIds = new Set(diagnosisIds);

  return getWorksByPresenceAndZone(presenceStatus, zone, works).filter((work) => {
    if (work.workAccessType === 'base_available' || work.workAccessType === 'status_available') {
      return true;
    }

    return work.allowedDiagnosisIds.some((diagnosisId) => selectedDiagnosisIds.has(diagnosisId));
  });
}

export function getAvailableZonesForPresence(
  presenceStatus: ToothPresenceStatus,
  diagnoses: ClinicalDiagnosis[] = defaultDiagnoses,
  works: ClinicalWork[] = defaultClinicalWorks,
): ClinicalZone[] {
  const zones = new Set<ClinicalZone>();

  for (const diagnosis of diagnoses) {
    if (diagnosis.allowedPresenceStatuses.includes(presenceStatus)) {
      diagnosis.allowedZones.forEach((zone) => zones.add(zone));
    }
  }

  for (const work of works) {
    if (work.allowedPresenceStatuses.includes(presenceStatus)) {
      work.allowedZones.forEach((zone) => zones.add(zone));
    }
  }

  return Array.from(zones);
}

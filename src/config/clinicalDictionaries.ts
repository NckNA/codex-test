import type { ToothPresenceStatus, ClinicalZone } from '../types';

export type DentalTabId = ClinicalZone;

export type WorkAccessType = 'requires_diagnosis' | 'base_available' | 'status_available';

export interface Diagnosis {
  id: string;
  name: string;
  allowedPresenceStatuses: ToothPresenceStatus[];
  allowedZones: ClinicalZone[];
  visualPriority?: number;
}

export interface ClinicalWork {
  id: string;
  name: string;
  allowedPresenceStatuses: ToothPresenceStatus[];
  allowedZones: ClinicalZone[];
  allowedDiagnosisIds: string[];
  workAccessType: WorkAccessType;
  price?: number;
}

// TODO: Справочники диагнозов и работ сохранены как стартовый шаблон (seed data). 
// Редактирование будет вынесено в административную часть, чтобы клиника могла настраивать цены и связи.
export const defaultDiagnoses: Diagnosis[] = [
  // Natural - Crown
  { id: 'd_caries_init', name: 'Начальный кариес / white spot', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_caries_enamel', name: 'Кариес эмали', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_caries_dentin', name: 'Кариес дентина', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_caries_deep', name: 'Глубокий кариес', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_caries_sec', name: 'Вторичный кариес', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_filling_defect', name: 'Нарушение краевого прилегания пломбы', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_filling_chip', name: 'Скол пломбы', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_cusp_chip', name: 'Скол бугра', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_crack', name: 'Трещина зуба', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_fracture', name: 'Перелом коронки', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_erosion', name: 'Эрозия эмали', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_wedge', name: 'Клиновидный дефект', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_hypoplasia', name: 'Гипоплазия эмали', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_fluorosis', name: 'Флюороз', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },
  { id: 'd_hyperesthesia', name: 'Гиперестезия', allowedPresenceStatuses: ['natural'], allowedZones: ['crown'] },

  // Natural - Endo
  { id: 'd_pulp_rev', name: 'Обратимый пульпит', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },
  { id: 'd_pulp_irrev', name: 'Необратимый пульпит', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },
  { id: 'd_pulp_acute', name: 'Острый пульпит', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },
  { id: 'd_pulp_chronic', name: 'Хронический пульпит', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },
  { id: 'd_pulp_necrosis', name: 'Некроз пульпы', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },
  { id: 'd_endo_prev', name: 'Ранее леченые каналы', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },
  { id: 'd_endo_poor', name: 'Некачественная обтурация канала', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },
  { id: 'd_endo_empty', name: 'Пустой канал', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },
  { id: 'd_endo_missed', name: 'Пропущенный канал', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },
  { id: 'd_endo_broken', name: 'Сломанный инструмент', allowedPresenceStatuses: ['natural'], allowedZones: ['endo'] },

  // Natural - Root
  { id: 'd_apical_acute', name: 'Острый апикальный периодонтит', allowedPresenceStatuses: ['natural', 'root_remnant'], allowedZones: ['root'] },
  { id: 'd_apical_chronic', name: 'Хронический апикальный периодонтит', allowedPresenceStatuses: ['natural', 'root_remnant'], allowedZones: ['root'] },
  { id: 'd_cyst', name: 'Радикулярная киста', allowedPresenceStatuses: ['natural', 'root_remnant'], allowedZones: ['root'] },
  { id: 'd_granuloma', name: 'Гранулёма', allowedPresenceStatuses: ['natural', 'root_remnant'], allowedZones: ['root'] },

  // Natural - Perio
  { id: 'd_gingivitis', name: 'Гингивит', allowedPresenceStatuses: ['natural'], allowedZones: ['perio'] },
  { id: 'd_periodontitis_loc', name: 'Пародонтит локализованный', allowedPresenceStatuses: ['natural'], allowedZones: ['perio'] },
  { id: 'd_periodontitis_gen', name: 'Пародонтит генерализованный', allowedPresenceStatuses: ['natural'], allowedZones: ['perio'] },
  { id: 'd_pocket_4_5', name: 'Пародонтальный карман 4–5 мм', allowedPresenceStatuses: ['natural'], allowedZones: ['perio'] },
  { id: 'd_pocket_6', name: 'Пародонтальный карман 6+ мм', allowedPresenceStatuses: ['natural'], allowedZones: ['perio'] },
  { id: 'd_recession', name: 'Рецессия десны', allowedPresenceStatuses: ['natural'], allowedZones: ['perio'] },
  { id: 'd_calculus', name: 'Зубной камень', allowedPresenceStatuses: ['natural'], allowedZones: ['perio'] },
  { id: 'd_mobility_1', name: 'Подвижность I степени', allowedPresenceStatuses: ['natural'], allowedZones: ['perio'] },

  // Natural - Ortho
  { id: 'd_ortho_defect', name: 'Дефект старой ортопедической конструкции', allowedPresenceStatuses: ['natural', 'implant'], allowedZones: ['ortho', 'supra'] },
  { id: 'd_ortho_fixation', name: 'Нарушение фиксации', allowedPresenceStatuses: ['natural', 'implant'], allowedZones: ['ortho', 'supra'] },

  // Implant
  { id: 'd_impl_screw_loose', name: 'Ослабление винта', allowedPresenceStatuses: ['implant'], allowedZones: ['supra'] },
  { id: 'd_impl_screw_break', name: 'Перелом винта', allowedPresenceStatuses: ['implant'], allowedZones: ['supra'] },
  { id: 'd_impl_chip', name: 'Скол керамики', allowedPresenceStatuses: ['implant'], allowedZones: ['supra'] },
  { id: 'd_peri_implantitis', name: 'Периимплантит', allowedPresenceStatuses: ['implant'], allowedZones: ['implant_body'] },
  { id: 'd_impl_bone_loss', name: 'Убыль кости вокруг импланта', allowedPresenceStatuses: ['implant'], allowedZones: ['implant_body'] },
  { id: 'd_impl_mucositis', name: 'Периимплантный мукозит', allowedPresenceStatuses: ['implant'], allowedZones: ['implant_gum'] },

  // Missing - Planning
  { id: 'd_mis_absence', name: 'Отсутствие зуба', allowedPresenceStatuses: ['missing'], allowedZones: ['planning'] },
  { id: 'd_mis_defect', name: 'Дефект зубного ряда', allowedPresenceStatuses: ['missing'], allowedZones: ['planning'] },
  { id: 'd_mis_partial', name: 'Частичная адентия', allowedPresenceStatuses: ['missing'], allowedZones: ['planning'] },
  { id: 'd_mis_req_res', name: 'Требуется восстановление дефекта', allowedPresenceStatuses: ['missing'], allowedZones: ['planning'] },
  { id: 'd_mis_req_imp', name: 'Требуется имплантация', allowedPresenceStatuses: ['missing'], allowedZones: ['planning'] },
  { id: 'd_mis_req_ort', name: 'Требуется ортопедическое восстановление', allowedPresenceStatuses: ['missing'], allowedZones: ['planning'] },

  // Missing - Bone
  { id: 'd_bone_atrophy_v', name: 'Атрофия костной ткани по высоте', allowedPresenceStatuses: ['missing'], allowedZones: ['bone'] },
  { id: 'd_bone_atrophy_h', name: 'Атрофия костной ткани по ширине', allowedPresenceStatuses: ['missing'], allowedZones: ['bone'] },
  { id: 'd_bone_defect', name: 'Дефект альвеолярного гребня', allowedPresenceStatuses: ['missing'], allowedZones: ['bone'] },
  { id: 'd_bone_narrow', name: 'Узкий альвеолярный гребень', allowedPresenceStatuses: ['missing'], allowedZones: ['bone'] },
  { id: 'd_bone_low', name: 'Недостаточная высота кости', allowedPresenceStatuses: ['missing'], allowedZones: ['bone'] },
  { id: 'd_bone_sinus', name: 'Близость гайморовой пазухи', allowedPresenceStatuses: ['missing'], allowedZones: ['bone'] },
  { id: 'd_bone_canal', name: 'Близость нижнечелюстного канала', allowedPresenceStatuses: ['missing'], allowedZones: ['bone'] },

  // Missing - Gum
  { id: 'd_gum_lack', name: 'Недостаток прикреплённой десны', allowedPresenceStatuses: ['missing'], allowedZones: ['bone_gum'] },
  { id: 'd_gum_def', name: 'Дефицит мягких тканей', allowedPresenceStatuses: ['missing'], allowedZones: ['bone_gum'] },
  { id: 'd_gum_thin', name: 'Тонкий биотип', allowedPresenceStatuses: ['missing'], allowedZones: ['bone_gum'] },
  { id: 'd_gum_scar', name: 'Рубцовые изменения', allowedPresenceStatuses: ['missing'], allowedZones: ['bone_gum'] },
  { id: 'd_gum_defect', name: 'Дефект мягких тканей', allowedPresenceStatuses: ['missing'], allowedZones: ['bone_gum'] },
  
  // Extracted
  { id: 'd_alveolitis', name: 'Альвеолит', allowedPresenceStatuses: ['extracted_recent'], allowedZones: ['surgery'] },
  { id: 'd_bleeding', name: 'Кровотечение из лунки', allowedPresenceStatuses: ['extracted_recent'], allowedZones: ['surgery'] },

  // Root remnant
  { id: 'd_root_remnant', name: 'Остаток корня', allowedPresenceStatuses: ['root_remnant'], allowedZones: ['root'] },
  { id: 'd_root_caries', name: 'Кариес корня', allowedPresenceStatuses: ['root_remnant'], allowedZones: ['root'] },
  { id: 'd_root_fracture', name: 'Перелом корня', allowedPresenceStatuses: ['root_remnant'], allowedZones: ['root'] },
  
  // Primary
  { id: 'd_prim_resorption', name: 'Физиологическая резорбция корня', allowedPresenceStatuses: ['primary'], allowedZones: ['primary_crown', 'primary_endo'] },
  { id: 'd_prim_caries', name: 'Кариес молочного зуба', allowedPresenceStatuses: ['primary'], allowedZones: ['primary_crown'] },
  { id: 'd_prim_pulpitis', name: 'Пульпит молочного зуба', allowedPresenceStatuses: ['primary'], allowedZones: ['primary_endo'] },

  // Supernumerary
  { id: 'd_sup_supernumerary', name: 'Сверхкомплектный зуб', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['diagnostics'] },
  { id: 'd_sup_mesiodens', name: 'Мезиоденс', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['diagnostics'] },
  { id: 'd_sup_paramolar', name: 'Парамоляр', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['diagnostics'] },
  { id: 'd_sup_distomolar', name: 'Дистомоляр', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['diagnostics'] },
  { id: 'd_sup_erupted', name: 'Прорезавшийся сверхкомплектный зуб', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['diagnostics', 'surgery'] },
  { id: 'd_sup_unerupted', name: 'Непрорезавшийся сверхкомплектный зуб', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['diagnostics', 'surgery'] },
  { id: 'd_sup_dystopia', name: 'Дистопия сверхкомплектного зуба', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['diagnostics', 'orthodontics'] },
  { id: 'd_sup_crowding', name: 'Скученность зубов', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['orthodontics'] },
  { id: 'd_sup_delay', name: 'Задержка прорезывания соседнего зуба', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['orthodontics'] },
  { id: 'd_sup_shift', name: 'Смещение соседнего зуба', allowedPresenceStatuses: ['supernumerary'], allowedZones: ['orthodontics'] },
  { id: 'd_sup_resorption', name: 'Резорбция корня соседнего зуба', allowedPresenceStatuses: ['supernumerary', 'impacted'], allowedZones: ['diagnostics', 'bone_gum', 'bone'] },
  { id: 'd_sup_cyst', name: 'Фолликулярная киста', allowedPresenceStatuses: ['supernumerary', 'impacted', 'unerupted'], allowedZones: ['diagnostics', 'surgery', 'bone_gum', 'bone'] },

  // Impacted
  { id: 'd_imp_impacted', name: 'Ретинированный зуб', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics'] },
  { id: 'd_imp_dystopic', name: 'Дистопированный зуб', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics'] },
  { id: 'd_imp_semi', name: 'Полуретинированный зуб', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics'] },
  { id: 'd_imp_horiz', name: 'Горизонтальное положение', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics'] },
  { id: 'd_imp_vert', name: 'Вертикальное положение', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics'] },
  { id: 'd_imp_mesial', name: 'Мезиальный наклон', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics'] },
  { id: 'd_imp_distal', name: 'Дистальный наклон', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics'] },
  { id: 'd_imp_buccal', name: 'Щёчное положение', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics'] },
  { id: 'd_imp_lingual', name: 'Нёбное / язычное положение', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics'] },
  { id: 'd_imp_pericoronitis', name: 'Перикоронит', allowedPresenceStatuses: ['impacted'], allowedZones: ['surgery', 'perio'] },
  { id: 'd_imp_canal', name: 'Близость к нижнечелюстному каналу', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics', 'surgery'] },
  { id: 'd_imp_sinus', name: 'Близость к гайморовой пазухе', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics', 'surgery'] },
  { id: 'd_imp_space', name: 'Недостаток места в зубном ряду', allowedPresenceStatuses: ['impacted', 'unerupted'], allowedZones: ['orthodontics'] },
  { id: 'd_imp_pain', name: 'Боль / воспаление вокруг ретинированного зуба', allowedPresenceStatuses: ['impacted'], allowedZones: ['diagnostics', 'surgery'] },

  // Unerupted
  { id: 'd_une_unerupted', name: 'Непрорезавшийся зуб', allowedPresenceStatuses: ['unerupted'], allowedZones: ['diagnostics'] },
  { id: 'd_une_delay', name: 'Задержка прорезывания', allowedPresenceStatuses: ['unerupted'], allowedZones: ['diagnostics', 'orthodontics'] },
  { id: 'd_une_ectopic', name: 'Эктопическое положение зачатка', allowedPresenceStatuses: ['unerupted'], allowedZones: ['diagnostics', 'orthodontics'] },
  { id: 'd_une_timing', name: 'Нарушение сроков прорезывания', allowedPresenceStatuses: ['unerupted'], allowedZones: ['diagnostics', 'orthodontics'] },
  { id: 'd_une_obstacle', name: 'Препятствие прорезыванию', allowedPresenceStatuses: ['unerupted'], allowedZones: ['diagnostics', 'surgery'] },
  { id: 'd_une_sup_obstacle', name: 'Сверхкомплектный зуб препятствует прорезыванию', allowedPresenceStatuses: ['unerupted'], allowedZones: ['diagnostics', 'surgery'] },
  { id: 'd_une_adentia', name: 'Адентия под вопросом', allowedPresenceStatuses: ['unerupted'], allowedZones: ['diagnostics'] },
  { id: 'd_une_not_visible', name: 'Зачаток зуба не визуализируется', allowedPresenceStatuses: ['unerupted'], allowedZones: ['diagnostics'] },
  { id: 'd_une_visible', name: 'Зачаток зуба визуализируется', allowedPresenceStatuses: ['unerupted'], allowedZones: ['diagnostics'] },
];


export const defaultWorks: ClinicalWork[] = [
  {
      "id": "w_consult",
      "name": "Консультация",
      "allowedPresenceStatuses": [
        "natural",
        "implant",
        "missing",
        "extracted_recent",
        "root_remnant",
        "primary",
        "unerupted",
        "impacted",
        "supernumerary"
      ],
      "allowedZones": [
        "crown",
        "perio",
        "planning",
        "diagnostics"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "base_available",
      "price": 1500
    },
  {
      "id": "w_optg",
      "name": "ОПТГ",
      "allowedPresenceStatuses": [
        "natural",
        "implant",
        "missing",
        "extracted_recent",
        "root_remnant",
        "primary",
        "unerupted",
        "impacted",
        "supernumerary"
      ],
      "allowedZones": [
        "crown",
        "planning",
        "diagnostics"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "base_available",
      "price": 1200
    },
  {
      "id": "w_cbct",
      "name": "КЛКТ",
      "allowedPresenceStatuses": [
        "natural",
        "implant",
        "missing",
        "extracted_recent",
        "root_remnant",
        "primary",
        "unerupted",
        "impacted",
        "supernumerary"
      ],
      "allowedZones": [
        "root",
        "bone",
        "planning",
        "diagnostics"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "base_available",
      "price": 3500
    },
  {
      "id": "w_photo",
      "name": "Фотопротокол",
      "allowedPresenceStatuses": [
        "natural",
        "implant",
        "missing",
        "extracted_recent",
        "root_remnant",
        "primary",
        "unerupted",
        "impacted",
        "supernumerary"
      ],
      "allowedZones": [
        "crown",
        "planning",
        "diagnostics"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "base_available",
      "price": 1000
    },
  {
      "id": "w_hygiene",
      "name": "Плановая профессиональная гигиена",
      "allowedPresenceStatuses": [
        "natural",
        "implant",
        "primary"
      ],
      "allowedZones": [
        "perio"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "base_available",
      "price": 5000
    },
  {
      "id": "w_checkup",
      "name": "Контрольный осмотр",
      "allowedPresenceStatuses": [
        "natural",
        "implant",
        "missing",
        "extracted_recent",
        "root_remnant",
        "primary",
        "unerupted",
        "impacted",
        "supernumerary"
      ],
      "allowedZones": [
        "crown",
        "perio",
        "planning",
        "diagnostics",
        "surgery"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "base_available",
      "price": 500
    },
  {
      "id": "w_scaling_supra",
      "name": "Снятие наддесневых зубных отложений",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "perio"
      ],
      "allowedDiagnosisIds": [
        "d_calculus",
        "d_gingivitis"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 2000
    },
  {
      "id": "w_scaling_us",
      "name": "Ультразвуковой скейлинг",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "perio"
      ],
      "allowedDiagnosisIds": [
        "d_calculus",
        "d_gingivitis"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 2500
    },
  {
      "id": "w_airflow",
      "name": "Air Flow",
      "allowedPresenceStatuses": [
        "natural",
        "implant"
      ],
      "allowedZones": [
        "perio",
        "implant_gum"
      ],
      "allowedDiagnosisIds": [
        "d_calculus",
        "d_gingivitis",
        "d_impl_mucositis"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 3000
    },
  {
      "id": "w_polish",
      "name": "Полировка",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "perio"
      ],
      "allowedDiagnosisIds": [
        "d_calculus",
        "d_gingivitis"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 1000
    },
  {
      "id": "w_pro_hygiene",
      "name": "Профессиональная гигиена полости рта",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "perio"
      ],
      "allowedDiagnosisIds": [
        "d_calculus",
        "d_gingivitis"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 5000
    },
  {
      "id": "w_srp",
      "name": "SRP (Scaling and Root Planing)",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "perio"
      ],
      "allowedDiagnosisIds": [
        "d_periodontitis_loc",
        "d_periodontitis_gen",
        "d_pocket_4_5",
        "d_pocket_6"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 5000
    },
  {
      "id": "w_curettage_closed",
      "name": "Закрытый кюретаж",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "perio"
      ],
      "allowedDiagnosisIds": [
        "d_periodontitis_loc",
        "d_periodontitis_gen",
        "d_pocket_4_5",
        "d_pocket_6"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 8000
    },
  {
      "id": "w_fill_comp",
      "name": "Композитная реставрация",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_caries_dentin",
        "d_caries_deep",
        "d_caries_sec",
        "d_filling_defect",
        "d_filling_chip",
        "d_cusp_chip",
        "d_fracture",
        "d_pulp_rev"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 6000
    },
  {
      "id": "w_caries_treatment",
      "name": "Лечение кариеса",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_caries_enamel",
        "d_caries_dentin",
        "d_caries_deep",
        "d_caries_sec",
        "d_pulp_rev"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 5500
    },
  {
      "id": "w_icon",
      "name": "Лечение Icon (без препарирования)",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_caries_init",
        "d_caries_enamel",
        "d_fluorosis",
        "d_hypoplasia"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 4000
    },
  {
      "id": "w_med_pad",
      "name": "Лечебная прокладка",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "endo",
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_caries_deep",
        "d_pulp_rev"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 1500
    },
  {
      "id": "w_obs_endo",
      "name": "Наблюдение",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "endo"
      ],
      "allowedDiagnosisIds": [
        "d_pulp_rev",
        "d_crack",
        "d_hyperesthesia"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 500
    },
  {
      "id": "w_desensitizer",
      "name": "Покрытие десенситайзером",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_hyperesthesia",
        "d_erosion",
        "d_wedge"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 1500
    },
  {
      "id": "w_fluoride",
      "name": "Покрытие фторлаком",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_hyperesthesia",
        "d_caries_init"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 1000
    },
  {
      "id": "w_remin",
      "name": "Реминерализующая терапия",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_hyperesthesia",
        "d_caries_init",
        "d_fluorosis",
        "d_hypoplasia",
        "d_pulp_rev"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 3000
    },
  {
      "id": "w_seal_sens",
      "name": "Герметизация чувствительной зоны",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_hyperesthesia",
        "d_wedge",
        "d_erosion"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 2500
    },
  {
      "id": "w_diag_crack",
      "name": "Диагностика трещины (микроскоп/краситель)",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown",
        "endo"
      ],
      "allowedDiagnosisIds": [
        "d_crack"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 3000
    },
  {
      "id": "w_temp_stab",
      "name": "Временная стабилизация (бандажное кольцо/временная коронка)",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_crack"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 4500
    },
  {
      "id": "w_extirpation",
      "name": "Экстирпация пульпы",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "endo"
      ],
      "allowedDiagnosisIds": [
        "d_pulp_irrev",
        "d_pulp_acute",
        "d_pulp_chronic",
        "d_pulp_necrosis",
        "d_crack"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 3500
    },
  {
      "id": "w_endo_prep",
      "name": "Инструментальная и медикаментозная обработка",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "endo"
      ],
      "allowedDiagnosisIds": [
        "d_pulp_irrev",
        "d_pulp_acute",
        "d_pulp_chronic",
        "d_pulp_necrosis",
        "d_endo_prev",
        "d_endo_poor",
        "d_endo_empty",
        "d_endo_missed",
        "d_apical_acute",
        "d_apical_chronic",
        "d_cyst",
        "d_granuloma",
        "d_crack"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 4000
    },
  {
      "id": "w_temp_fill",
      "name": "Временное пломбирование канала (Ca(OH)2)",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "endo"
      ],
      "allowedDiagnosisIds": [
        "d_pulp_irrev",
        "d_pulp_acute",
        "d_pulp_chronic",
        "d_pulp_necrosis",
        "d_endo_prev",
        "d_endo_poor",
        "d_endo_empty",
        "d_endo_missed",
        "d_apical_acute",
        "d_apical_chronic",
        "d_cyst",
        "d_granuloma",
        "d_crack"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 2000
    },
  {
      "id": "w_obturation",
      "name": "Обтурация канала (гуттаперча)",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "endo"
      ],
      "allowedDiagnosisIds": [
        "d_pulp_irrev",
        "d_pulp_acute",
        "d_pulp_chronic",
        "d_pulp_necrosis",
        "d_endo_prev",
        "d_endo_poor",
        "d_endo_empty",
        "d_endo_missed",
        "d_apical_acute",
        "d_apical_chronic",
        "d_cyst",
        "d_granuloma",
        "d_crack"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 4500
    },
  {
      "id": "w_post_core",
      "name": "Восстановление под коронку (Build-up / Post&Core)",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "crown"
      ],
      "allowedDiagnosisIds": [
        "d_pulp_irrev",
        "d_pulp_acute",
        "d_pulp_chronic",
        "d_pulp_necrosis",
        "d_endo_prev",
        "d_crack",
        "d_fracture"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 7000
    },
  {
      "id": "w_crown_cer",
      "name": "Безметалловая коронка (E.max/Zr)",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "ortho"
      ],
      "allowedDiagnosisIds": [
        "d_caries_deep",
        "d_fracture",
        "d_crack",
        "d_ortho_defect",
        "d_ortho_fixation",
        "d_pulp_irrev",
        "d_endo_prev"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 25000
    },
  {
      "id": "w_inlay",
      "name": "Керамическая вкладка (Inlay/Onlay/Overlay)",
      "allowedPresenceStatuses": [
        "natural"
      ],
      "allowedZones": [
        "ortho"
      ],
      "allowedDiagnosisIds": [
        "d_caries_deep",
        "d_filling_defect",
        "d_cusp_chip",
        "d_crack"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 22000
    },
  {
      "id": "w_implant_install",
      "name": "Установка импланта",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "planning"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "status_available",
      "price": 40000
    },
  {
      "id": "w_implant_abutment",
      "name": "Формирователь десны",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "planning"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "status_available",
      "price": 5000
    },
  {
      "id": "w_bridge",
      "name": "Мостовидный протез",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "planning"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "status_available",
      "price": 50000
    },
  {
      "id": "w_removable",
      "name": "Съёмный протез",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "planning"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "status_available",
      "price": 30000
    },
  {
      "id": "w_adhesive_bridge",
      "name": "Адгезивный мост",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "planning"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "status_available",
      "price": 20000
    },
  {
      "id": "w_immediate",
      "name": "Временный иммедиат-протез",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "planning"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "status_available",
      "price": 10000
    },
  {
      "id": "w_crown_imp",
      "name": "Коронка на импланте",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "planning"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "status_available",
      "price": 35000
    },
  {
      "id": "w_consult_ortho",
      "name": "Консультация ортопеда",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "planning"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "base_available",
      "price": 1500
    },
  {
      "id": "w_consult_surg",
      "name": "Консультация хирурга / имплантолога",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "planning"
      ],
      "allowedDiagnosisIds": [],
      "workAccessType": "base_available",
      "price": 1500
    },
  {
      "id": "w_gbr",
      "name": "Направленная костная регенерация",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone"
      ],
      "allowedDiagnosisIds": [
        "d_bone_atrophy_v",
        "d_bone_atrophy_h",
        "d_bone_defect",
        "d_bone_narrow",
        "d_bone_low"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 40000
    },
  {
      "id": "w_bone_graft",
      "name": "Костная пластика",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone"
      ],
      "allowedDiagnosisIds": [
        "d_bone_atrophy_v",
        "d_bone_atrophy_h",
        "d_bone_defect",
        "d_bone_narrow",
        "d_bone_low"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 35000
    },
  {
      "id": "w_ridge_split",
      "name": "Расщепление гребня",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone"
      ],
      "allowedDiagnosisIds": [
        "d_bone_narrow"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 30000
    },
  {
      "id": "w_bone_block",
      "name": "Костный блок",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone"
      ],
      "allowedDiagnosisIds": [
        "d_bone_atrophy_v",
        "d_bone_atrophy_h",
        "d_bone_defect"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 50000
    },
  {
      "id": "w_sinus_closed",
      "name": "Синус-лифтинг закрытый",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone"
      ],
      "allowedDiagnosisIds": [
        "d_bone_low",
        "d_bone_sinus"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 25000
    },
  {
      "id": "w_sinus_open",
      "name": "Синус-лифтинг открытый",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone"
      ],
      "allowedDiagnosisIds": [
        "d_bone_low",
        "d_bone_sinus"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 45000
    },
  {
      "id": "w_gum_plastic",
      "name": "Пластика мягких тканей",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone_gum"
      ],
      "allowedDiagnosisIds": [
        "d_gum_lack",
        "d_gum_def",
        "d_gum_thin",
        "d_gum_scar",
        "d_gum_defect"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 20000
    },
  {
      "id": "w_fgg",
      "name": "Свободный десневой трансплантат",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone_gum"
      ],
      "allowedDiagnosisIds": [
        "d_gum_lack",
        "d_gum_def",
        "d_gum_thin",
        "d_gum_defect"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 25000
    },
  {
      "id": "w_ctg",
      "name": "Соединительнотканный трансплантат",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone_gum"
      ],
      "allowedDiagnosisIds": [
        "d_gum_def",
        "d_gum_thin",
        "d_gum_defect"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 30000
    },
  {
      "id": "w_gum_contour",
      "name": "Формирование десневого контура",
      "allowedPresenceStatuses": [
        "missing"
      ],
      "allowedZones": [
        "bone_gum"
      ],
      "allowedDiagnosisIds": [
        "d_gum_lack",
        "d_gum_def",
        "d_gum_scar"
      ],
      "workAccessType": "requires_diagnosis",
      "price": 15000
    }
];

export interface TabConfig {
  id: DentalTabId;
  label: string;
}

export const tabsByPresenceStatus: Record<ToothPresenceStatus, TabConfig[]> = {
  natural: [
    { id: 'crown', label: 'Коронка' },
    { id: 'endo', label: 'Каналы' },
    { id: 'root', label: 'Корень' },
    { id: 'perio', label: 'Десна' },
    { id: 'ortho', label: 'Ортопедия' },
  ],
  missing: [
    { id: 'planning', label: 'Планирование' },
    { id: 'bone', label: 'Кость' },
    { id: 'bone_gum', label: 'Десна / мягкие ткани' },
    { id: 'ortho', label: 'Ортопедия' },
  ],
  extracted_recent: [
    { id: 'socket', label: 'Лунка' },
    { id: 'healing', label: 'Заживление' },
    { id: 'complications', label: 'Осложнения' },
    { id: 'sutures', label: 'Швы' },
  ],
  implant: [
    { id: 'supra', label: 'Супраструктура' },
    { id: 'implant_body', label: 'Тело импланта' },
    { id: 'implant_gum', label: 'Десна' },
    { id: 'bone', label: 'Кость' },
    { id: 'maintenance', label: 'Обслуживание' },
  ],
  root_remnant: [
    { id: 'root', label: 'Корень' },
    { id: 'endo', label: 'Каналы' },
    { id: 'perio', label: 'Десна' },
    { id: 'bone', label: 'Кость' },
    { id: 'surgery', label: 'Хирургия / Ортопедия' },
  ],
  impacted: [
    { id: 'diagnostics', label: 'Диагностика' },
    { id: 'surgery', label: 'Хирургия' },
    { id: 'orthodontics', label: 'Ортодонтия' },
    { id: 'bone', label: 'Кость' },
  ],
  unerupted: [
    { id: 'diagnostics', label: 'Диагностика' },
    { id: 'orthodontics', label: 'Ортодонтия' },
    { id: 'surgery', label: 'Хирургия' },
  ],
  supernumerary: [
    { id: 'diagnostics', label: 'Диагностика' },
    { id: 'surgery', label: 'Хирургия' },
    { id: 'orthodontics', label: 'Ортодонтия' },
  ],
  primary: [
    { id: 'primary_crown', label: 'Коронка' },
    { id: 'primary_endo', label: 'Каналы' },
    { id: 'root', label: 'Корень' },
    { id: 'perio', label: 'Десна' },
    { id: 'shift', label: 'Смена зубов' },
  ]
};

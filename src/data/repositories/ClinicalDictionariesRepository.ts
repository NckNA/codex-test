import { supabase as _supabase } from '../../lib/supabaseClient';
import { defaultDiagnoses, defaultClinicalWorks } from '../../config/clinicalDictionaries';
import type { ClinicalDiagnosis, ClinicalWork } from '../../config/clinicalDictionaries';

const STORAGE_KEY_DIAGNOSES = 'codex_clinical_diagnoses';
const STORAGE_KEY_WORKS = 'codex_clinical_works';

export interface ClinicalDictionaryBootstrapResult {
  insertedCount: number;
  skippedExistingCount: number;
  templateKey: string;
  tenantId?: string;
}

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

export interface IClinicalDictionariesRepository {
  getDiagnoses(): Promise<ClinicalDiagnosis[]>;
  getWorks(): Promise<ClinicalWork[]>;
  saveDiagnosis(diagnosis: ClinicalDiagnosis): Promise<void>;
  saveWork(work: ClinicalWork): Promise<void>;
  bootstrapFromTemplate(templateKey?: string): Promise<ClinicalDictionaryBootstrapResult>;
}

function countMissingDefaults<T extends { id: string }>(existing: T[], defaults: T[]): number {
  const existingIds = new Set(existing.map((item) => item.id));
  return defaults.filter((item) => !existingIds.has(item.id)).length;
}

export class LocalStorageClinicalDictionariesRepository implements IClinicalDictionariesRepository {
  async getDiagnoses(): Promise<ClinicalDiagnosis[]> {
    return ClinicalDictionariesRepository.getDiagnoses();
  }

  async getWorks(): Promise<ClinicalWork[]> {
    return ClinicalDictionariesRepository.getWorks();
  }

  async saveDiagnosis(diagnosis: ClinicalDiagnosis): Promise<void> {
    const all = [...ClinicalDictionariesRepository.getDiagnoses()];
    const idx = all.findIndex(d => d.id === diagnosis.id);
    if (idx >= 0) {
      all[idx] = diagnosis;
    } else {
      all.push(diagnosis);
    }
    ClinicalDictionariesRepository.saveDiagnoses(all);
  }

  async saveWork(work: ClinicalWork): Promise<void> {
    const all = [...ClinicalDictionariesRepository.getWorks()];
    const idx = all.findIndex(w => w.id === work.id);
    if (idx >= 0) {
      all[idx] = work;
    } else {
      all.push(work);
    }
    ClinicalDictionariesRepository.saveWorks(all);
  }

  async bootstrapFromTemplate(templateKey = 'default_dental_v1'): Promise<ClinicalDictionaryBootstrapResult> {
    const diagnoses = ClinicalDictionariesRepository.getDiagnoses();
    const works = ClinicalDictionariesRepository.getWorks();

    const missingDiagnoses = countMissingDefaults(diagnoses, defaultDiagnoses);
    const missingWorks = countMissingDefaults(works, defaultClinicalWorks);

    const diagnosisById = new Map(diagnoses.map((diagnosis) => [diagnosis.id, diagnosis]));
    const workById = new Map(works.map((work) => [work.id, work]));

    for (const diagnosis of defaultDiagnoses) {
      if (!diagnosisById.has(diagnosis.id)) {
        diagnosisById.set(diagnosis.id, diagnosis);
      }
    }

    for (const work of defaultClinicalWorks) {
      if (!workById.has(work.id)) {
        workById.set(work.id, work);
      }
    }

    ClinicalDictionariesRepository.saveDiagnoses(Array.from(diagnosisById.values()));
    ClinicalDictionariesRepository.saveWorks(Array.from(workById.values()));

    const insertedCount = missingDiagnoses + missingWorks;
    const skippedExistingCount = defaultDiagnoses.length + defaultClinicalWorks.length - insertedCount;

    return {
      insertedCount,
      skippedExistingCount,
      templateKey,
    };
  }
}

function mapBootstrapResult(data: unknown, fallbackTemplateKey: string): ClinicalDictionaryBootstrapResult {
  const row = Array.isArray(data) ? data[0] : data;
  const result = (row ?? {}) as {
    inserted_count?: number | string;
    insertedCount?: number | string;
    skipped_existing_count?: number | string;
    skippedExistingCount?: number | string;
    template_key?: string;
    templateKey?: string;
    tenant_id?: string;
    tenantId?: string;
  };

  return {
    insertedCount: Number(result.inserted_count ?? result.insertedCount ?? 0),
    skippedExistingCount: Number(result.skipped_existing_count ?? result.skippedExistingCount ?? 0),
    templateKey: result.template_key ?? result.templateKey ?? fallbackTemplateKey,
    tenantId: result.tenant_id ?? result.tenantId,
  };
}

export class SupabaseClinicalDictionariesRepository implements IClinicalDictionariesRepository {
  private tenantId: string;

  constructor(tenantId?: string) {
    if (!tenantId) {
      throw new Error('SupabaseClinicalDictionariesRepository requires a tenantId');
    }
    this.tenantId = tenantId;
  }

  private get supabase() {
    if (!_supabase) throw new Error('Supabase client is not configured');
    return _supabase;
  }

  async getDiagnoses(): Promise<ClinicalDiagnosis[]> {
    const { data, error } = await this.supabase
      .from('clinical_dictionary_items')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('type', 'diagnosis')
      .order('visual_priority', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return data.map(row => ({
      id: row.id,
      type: 'diagnosis',
      name: row.name,
      description: row.description || undefined,
      allowedPresenceStatuses: row.allowed_presence_statuses || [],
      allowedZones: row.allowed_zones || [],
      visualPriority: row.visual_priority ?? undefined,
      isActive: row.is_active ?? true,
    } as ClinicalDiagnosis));
  }

  async getWorks(): Promise<ClinicalWork[]> {
    const { data, error } = await this.supabase
      .from('clinical_dictionary_items')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('type', 'work')
      .order('name', { ascending: true })
      .order('id', { ascending: true });

    if (error) throw error;
    if (!data) return [];

    return data.map(row => ({
      id: row.id,
      type: 'work',
      name: row.name,
      description: row.description || undefined,
      allowedPresenceStatuses: row.allowed_presence_statuses || [],
      allowedZones: row.allowed_zones || [],
      workAccessType: row.work_access_type as ClinicalWork['workAccessType'],
      allowedDiagnosisIds: row.allowed_diagnosis_ids || [],
      price: row.price != null ? Number(row.price) : undefined,
      isActive: row.is_active ?? true,
    } as ClinicalWork));
  }

  async saveDiagnosis(diagnosis: ClinicalDiagnosis): Promise<void> {
    const payload = {
      tenant_id: this.tenantId,
      id: diagnosis.id,
      type: 'diagnosis',
      name: diagnosis.name,
      description: diagnosis.description || null,
      allowed_presence_statuses: diagnosis.allowedPresenceStatuses,
      allowed_zones: diagnosis.allowedZones,
      work_access_type: null,
      allowed_diagnosis_ids: [],
      price: null,
      visual_priority: diagnosis.visualPriority ?? null,
      is_active: diagnosis.isActive !== false,
    };

    const { error } = await this.supabase
      .from('clinical_dictionary_items')
      .upsert(payload, { onConflict: 'tenant_id,id' });

    if (error) throw error;
  }

  async saveWork(work: ClinicalWork): Promise<void> {
    const payload = {
      tenant_id: this.tenantId,
      id: work.id,
      type: 'work',
      name: work.name,
      description: work.description || null,
      allowed_presence_statuses: work.allowedPresenceStatuses,
      allowed_zones: work.allowedZones,
      work_access_type: work.workAccessType,
      allowed_diagnosis_ids: work.allowedDiagnosisIds || [],
      price: work.price != null ? work.price : null,
      visual_priority: null,
      is_active: work.isActive !== false,
    };

    const { error } = await this.supabase
      .from('clinical_dictionary_items')
      .upsert(payload, { onConflict: 'tenant_id,id' });

    if (error) throw error;
  }

  async bootstrapFromTemplate(templateKey = 'default_dental_v1'): Promise<ClinicalDictionaryBootstrapResult> {
    const { data, error } = await this.supabase.rpc(
      'bootstrap_clinical_dictionary_from_template',
      {
        target_tenant_id: this.tenantId,
        template_key: templateKey,
      }
    );

    if (error) throw error;

    return mapBootstrapResult(data, templateKey);
  }
}

interface RepositoryConfig {
  backend: 'local' | 'supabase';
  tenantId?: string;
}

export function createClinicalDictionariesRepository(config: RepositoryConfig): IClinicalDictionariesRepository {
  if (config.backend === 'local') {
    return new LocalStorageClinicalDictionariesRepository();
  }

  if (config.backend === 'supabase') {
    return new SupabaseClinicalDictionariesRepository(config.tenantId);
  }

  throw new Error(`Unsupported backend: ${String(config.backend)}`);
}

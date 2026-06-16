import { supabase as _supabase } from '../../lib/supabaseClient';

export type PatientFileKind = 'dental_photo' | 'xray' | 'scan' | 'document';
export type PatientFileSourceContext = 'dental_chart' | 'patient_card' | 'finding' | 'treatment_plan' | 'appointment';

export interface PatientFileRecord {
  id: string;
  tenantId: string;
  patientId: string;
  storageBucket: 'patient-files';
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  fileKind: PatientFileKind;
  sourceContext: PatientFileSourceContext;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  toothId?: string | null;
  uploadedBy?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  caption?: string | null;
  notes?: string | null;
  previewUrl?: string | null;
}

export interface UploadPatientFileInput {
  patientId: string;
  file: File;
  fileKind?: PatientFileKind;
  sourceContext?: PatientFileSourceContext;
  toothId?: string | null;
  caption?: string | null;
  notes?: string | null;
}

export interface IPatientFilesRepository {
  listPatientFiles(patientId: string, includeArchived?: boolean): Promise<PatientFileRecord[]>;
  uploadPatientFile(input: UploadPatientFileInput): Promise<PatientFileRecord>;
  archivePatientFile(fileId: string): Promise<void>;
  createSignedUrl(record: PatientFileRecord): Promise<string>;
}

export const PATIENT_FILES_BUCKET = 'patient-files' as const;
export const MAX_PATIENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const ACTIVE_CLINIC_REQUIRED_ERROR = 'Active clinic is required for Supabase file access.';

const localPatientFiles = new Map<string, PatientFileRecord[]>();

function generateId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function safeFilename(fileName: string) {
  return fileName.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
}

export function validatePatientImageFile(file: File) {
  if (file.size <= 0) throw new Error('Файл пустой. Выберите изображение для загрузки.');
  if (!file.type.startsWith('image/')) throw new Error('Можно загружать только изображения.');
  if (file.size > MAX_PATIENT_FILE_SIZE_BYTES) throw new Error('Размер изображения не должен превышать 10 МБ.');
}

function mapRow(row: Record<string, unknown>): PatientFileRecord {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    patientId: String(row.patient_id),
    storageBucket: PATIENT_FILES_BUCKET,
    storagePath: String(row.storage_path),
    originalFilename: String(row.original_filename),
    mimeType: String(row.mime_type),
    sizeBytes: Number(row.size_bytes ?? 0),
    fileKind: (row.file_kind ?? 'dental_photo') as PatientFileKind,
    sourceContext: (row.source_context ?? 'dental_chart') as PatientFileSourceContext,
    toothId: row.tooth_id as string | null | undefined,
    uploadedBy: row.uploaded_by as string | null | undefined,
    caption: row.caption as string | null | undefined,
    notes: row.notes as string | null | undefined,
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at as string | null | undefined,
    archivedBy: row.archived_by as string | null | undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export class SupabasePatientFilesRepository implements IPatientFilesRepository {
  private tenantId: string;
  private userId?: string;

  constructor(tenantId?: string, userId?: string) {
    if (!tenantId) throw new Error(ACTIVE_CLINIC_REQUIRED_ERROR);
    this.tenantId = tenantId;
    this.userId = userId;
  }

  private get supabase() {
    if (!_supabase) throw new Error('Supabase client is not configured');
    return _supabase;
  }

  async listPatientFiles(patientId: string, includeArchived = false): Promise<PatientFileRecord[]> {
    let query = this.supabase.from('patient_files').select('*').eq('tenant_id', this.tenantId).eq('patient_id', patientId);
    if (!includeArchived) query = query.eq('is_archived', false);
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return Promise.all(((data ?? []) as Record<string, unknown>[]).map(async row => {
      const record = mapRow(row);
      return { ...record, previewUrl: await this.createSignedUrl(record) };
    }));
  }

  async uploadPatientFile(input: UploadPatientFileInput): Promise<PatientFileRecord> {
    validatePatientImageFile(input.file);
    const id = generateId();
    const storagePath = `${this.tenantId}/patients/${input.patientId}/dental-photos/${id}-${safeFilename(input.file.name)}`;
    const storage = this.supabase.storage.from(PATIENT_FILES_BUCKET);
    const { error: uploadError } = await storage.upload(storagePath, input.file, { contentType: input.file.type, upsert: false });
    if (uploadError) throw uploadError;

    const payload = {
      id,
      tenant_id: this.tenantId,
      patient_id: input.patientId,
      storage_bucket: PATIENT_FILES_BUCKET,
      storage_path: storagePath,
      original_filename: input.file.name,
      mime_type: input.file.type,
      size_bytes: input.file.size,
      file_kind: input.fileKind ?? 'dental_photo',
      source_context: input.sourceContext ?? 'dental_chart',
      tooth_id: input.toothId ?? null,
      uploaded_by: this.userId ?? null,
      caption: input.caption ?? null,
      notes: input.notes ?? null,
    };

    const { data, error } = await this.supabase.from('patient_files').insert(payload).select('*').single();
    if (error) {
      await storage.remove([storagePath]);
      throw error;
    }
    const record = mapRow(data as Record<string, unknown>);
    return { ...record, previewUrl: await this.createSignedUrl(record) };
  }

  async archivePatientFile(fileId: string): Promise<void> {
    const { error } = await this.supabase
      .from('patient_files')
      .update({ is_archived: true, archived_at: new Date().toISOString(), archived_by: this.userId ?? null })
      .eq('tenant_id', this.tenantId)
      .eq('id', fileId);
    if (error) throw error;
  }

  async createSignedUrl(record: PatientFileRecord): Promise<string> {
    const { data, error } = await this.supabase.storage.from(record.storageBucket).createSignedUrl(record.storagePath, 600);
    if (error) throw error;
    return data.signedUrl;
  }
}

export class LocalPatientFilesRepository implements IPatientFilesRepository {
  async listPatientFiles(patientId: string, includeArchived = false): Promise<PatientFileRecord[]> {
    return (localPatientFiles.get(patientId) ?? []).filter(file => includeArchived || !file.isArchived);
  }

  async uploadPatientFile(input: UploadPatientFileInput): Promise<PatientFileRecord> {
    validatePatientImageFile(input.file);
    const now = new Date().toISOString();
    const id = generateId();
    const record: PatientFileRecord = {
      id,
      tenantId: 'local-dev-tenant',
      patientId: input.patientId,
      storageBucket: PATIENT_FILES_BUCKET,
      storagePath: `local-dev-tenant/local/${input.patientId}/${id}-${safeFilename(input.file.name)}`,
      originalFilename: input.file.name,
      mimeType: input.file.type,
      sizeBytes: input.file.size,
      fileKind: input.fileKind ?? 'dental_photo',
      sourceContext: input.sourceContext ?? 'dental_chart',
      toothId: input.toothId ?? null,
      uploadedBy: 'local-dev-user',
      caption: input.caption ?? null,
      notes: input.notes ?? null,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      previewUrl: typeof URL !== 'undefined' && 'createObjectURL' in URL ? URL.createObjectURL(input.file) : null,
    };
    localPatientFiles.set(input.patientId, [record, ...(localPatientFiles.get(input.patientId) ?? [])]);
    return record;
  }

  async archivePatientFile(fileId: string): Promise<void> {
    for (const [patientId, records] of localPatientFiles.entries()) {
      localPatientFiles.set(patientId, records.map(file => file.id === fileId ? { ...file, isArchived: true, archivedAt: new Date().toISOString() } : file));
    }
  }

  async createSignedUrl(record: PatientFileRecord): Promise<string> {
    return record.previewUrl ?? record.storagePath;
  }
}

export function createPatientFilesRepository(config: { backend: 'local' | 'supabase'; tenantId?: string; userId?: string }): IPatientFilesRepository {
  return config.backend === 'supabase'
    ? new SupabasePatientFilesRepository(config.tenantId, config.userId)
    : new LocalPatientFilesRepository();
}

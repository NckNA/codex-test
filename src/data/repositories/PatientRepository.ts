import { storage } from '../../utils/storage';
import type { Patient, Source, PatientIntegrationMeta } from '../../types';
import { supabase } from '../../lib/supabaseClient';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PatientLookupRecord {
  id: string;
  fullName: string;
  phone: string;
  status: string;
}

export interface SearchPatientLookupInput {
  query: string;
  limit?: number;
}

export interface PatientLookupRepository {
  searchPatientLookup(input: SearchPatientLookupInput): Promise<PatientLookupRecord[]>;
}

export interface PatientLabelRecord {
  id: string;
  fullName: string;
}

export interface PatientLabelRepository {
  listPatientLabelsByIds(patientIds: string[]): Promise<PatientLabelRecord[]>;
}

export interface PatientRepository {
  getPatientById(patientId: string): Promise<Patient | null>;
  updatePatient(patient: Patient): Promise<void>;
  listPatients(): Promise<Patient[]>;
  createPatient(patient: Patient): Promise<void>;
  searchPatientLookup?: PatientLookupRepository['searchPatientLookup'];
  listPatientLabelsByIds?: PatientLabelRepository['listPatientLabelsByIds'];
}

export type PatientRepositoryBackend = 'local' | 'supabase';

const PATIENT_LOOKUP_MIN_QUERY_LENGTH = 2;
const PATIENT_LOOKUP_MAX_LIMIT = 20;
const PATIENT_LABEL_BATCH_SIZE = 100;
const PHONE_LIKE_QUERY = /^[+\d\s().-]+$/;

function normalizePatientIds(patientIds: string[]) {
  return [...new Set(patientIds.map((id) => id.trim()).filter(Boolean))].sort();
}

function chunkPatientIds(patientIds: string[]) {
  const chunks: string[][] = [];
  for (let index = 0; index < patientIds.length; index += PATIENT_LABEL_BATCH_SIZE) {
    chunks.push(patientIds.slice(index, index + PATIENT_LABEL_BATCH_SIZE));
  }
  return chunks;
}

function mapPatientLabel(row: Record<string, unknown>): PatientLabelRecord {
  return { id: String(row.id), fullName: String(row.full_name ?? '') };
}

function normalizeLookupLimit(value?: number) {
  if (value === undefined || !Number.isFinite(value)) return PATIENT_LOOKUP_MAX_LIMIT;
  return Math.min(PATIENT_LOOKUP_MAX_LIMIT, Math.max(1, Math.floor(value)));
}

function normalizedPhone(value: string) {
  return value.replace(/[^\d+]/g, '');
}

function isPhoneLookup(value: string) {
  return PHONE_LIKE_QUERY.test(value) && value.replace(/\D/g, '').length >= 2;
}

function escapeIlikeTerm(value: string) {
  return [...value]
    .map((character) => ['\\', '%', '_'].includes(character) ? `\\${character}` : character)
    .join('');
}

function mapPatientLookup(row: Record<string, unknown>): PatientLookupRecord {
  return {
    id: String(row.id),
    fullName: String(row.full_name ?? ''),
    phone: String(row.phone ?? ''),
    status: String(row.status ?? 'active'),
  };
}

export function normalizePatientLookupQuery(query: string) {
  return query.trim();
}

export interface CreatePatientRepositoryOptions {
  tenantId?: string | null;
  backend: PatientRepositoryBackend;
}

export const LocalStoragePatientRepository: PatientRepository = {
  async getPatientById(patientId: string): Promise<Patient | null> {
    const patients = storage.getPatients();
    const patient = patients.find((p) => p.id === patientId);
    return patient || null;
  },

  async updatePatient(patient: Patient): Promise<void> {
    storage.updatePatient(patient);
  },

  async listPatients(): Promise<Patient[]> {
    return storage.getPatients();
  },

  async createPatient(patient: Patient): Promise<void> {
    storage.addPatient(patient);
  },

  async listPatientLabelsByIds(patientIds: string[]): Promise<PatientLabelRecord[]> {
    const normalizedIds = normalizePatientIds(patientIds);
    if (normalizedIds.length === 0) return [];
    const requestedIds = new Set(normalizedIds);
    return storage.getPatients()
      .filter((patient) => requestedIds.has(patient.id))
      .map((patient) => ({ id: patient.id, fullName: patient.fullName ?? '' }))
      .sort((left, right) => left.id.localeCompare(right.id));
  },

  async searchPatientLookup(input: SearchPatientLookupInput): Promise<PatientLookupRecord[]> {
    const query = normalizePatientLookupQuery(input.query);
    if (query.length < PATIENT_LOOKUP_MIN_QUERY_LENGTH) return [];
    const limit = normalizeLookupLimit(input.limit);
    const phoneLookup = isPhoneLookup(query);
    const lookupTerm = phoneLookup ? normalizedPhone(query).toLowerCase() : query.toLowerCase();

    return storage.getPatients()
      .filter((patient) => patient.status !== 'archived')
      .filter((patient) => {
        const candidate = phoneLookup ? normalizedPhone(patient.phone ?? '') : (patient.fullName ?? '').toLowerCase();
        return candidate.includes(lookupTerm);
      })
      .sort((left, right) => (left.fullName ?? '').localeCompare(right.fullName ?? '', 'ru') || left.id.localeCompare(right.id))
      .slice(0, limit)
      .map((patient) => ({
        id: patient.id,
        fullName: patient.fullName ?? '',
        phone: patient.phone ?? '',
        status: patient.status ?? 'active',
      }));
  },
};

export class SupabasePatientRepository implements PatientRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async getPatientById(patientId: string): Promise<Patient | null> {
    const { data, error } = await this.client
      .from('patients')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('id', patientId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return this.mapToPatient(data);
  }

  async updatePatient(patient: Patient): Promise<void> {
    const { error } = await this.client
      .from('patients')
      .update(this.mapToRow(patient))
      .eq('tenant_id', this.tenantId)
      .eq('id', patient.id);

    if (error) throw error;
  }

  async listPatients(): Promise<Patient[]> {
    const { data, error } = await this.client
      .from('patients')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data || []).map(this.mapToPatient);
  }

  async createPatient(patient: Patient): Promise<void> {
    const { error } = await this.client
      .from('patients')
      .insert({
        ...this.mapToRow(patient),
        tenant_id: this.tenantId
      });

    if (error) throw error;
  }

  async listPatientLabelsByIds(patientIds: string[]): Promise<PatientLabelRecord[]> {
    const normalizedIds = normalizePatientIds(patientIds);
    if (normalizedIds.length === 0) return [];

    const labels: PatientLabelRecord[] = [];
    for (const chunk of chunkPatientIds(normalizedIds)) {
      const { data, error } = await this.client
        .from('patients')
        .select('id,full_name')
        .eq('tenant_id', this.tenantId)
        .in('id', chunk)
        .order('id', { ascending: true });
      if (error) throw error;
      labels.push(...((data ?? []) as Record<string, unknown>[]).map(mapPatientLabel));
    }

    return labels.sort((left, right) => left.id.localeCompare(right.id));
  }

  async searchPatientLookup(input: SearchPatientLookupInput): Promise<PatientLookupRecord[]> {
    const query = normalizePatientLookupQuery(input.query);
    if (query.length < PATIENT_LOOKUP_MIN_QUERY_LENGTH) return [];

    const limit = normalizeLookupLimit(input.limit);
    const phoneLookup = isPhoneLookup(query);
    const lookupTerm = phoneLookup ? normalizedPhone(query) : query;
    const pattern = `%${escapeIlikeTerm(lookupTerm)}%`;
    const field = phoneLookup ? 'phone' : 'full_name';

    const { data, error } = await this.client
      .from('patients')
      .select('id,full_name,phone,status')
      .eq('tenant_id', this.tenantId)
      .neq('status', 'archived')
      .ilike(field, pattern)
      .order('full_name', { ascending: true })
      .limit(limit);

    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapPatientLookup);
  }

  private mapToPatient(row: Record<string, unknown>): Patient {
    return {
      id: row.id as string,
      fullName: row.full_name as string,
      phone: row.phone as string,
      birthDate: (row.birth_date as string) || undefined,
      source: row.source as Source,
      status: row.status as string,
      notes: (row.notes as string) || undefined,
      allergies: (row.allergies as string) || undefined,
      balance: (row.balance as number) || 0,
      bonusBalance: (row.bonus_balance as number) || 0,
      integration: (row.integration as PatientIntegrationMeta) || undefined,
      createdAt: row.created_at as string,
    };
  }

  private mapToRow(patient: Patient): Record<string, unknown> {
    return {
      id: patient.id,
      full_name: patient.fullName,
      phone: patient.phone,
      birth_date: patient.birthDate || null,
      source: patient.source,
      status: patient.status,
      notes: patient.notes || null,
      allergies: patient.allergies || null,
      balance: patient.balance || 0,
      bonus_balance: patient.bonusBalance || 0,
      integration: patient.integration || null,
    };
  }
}

export function createPatientRepository(options?: CreatePatientRepositoryOptions): PatientRepository {
  if (options?.backend === 'supabase' && typeof options.tenantId === 'string' && supabase) {
    return new SupabasePatientRepository(options.tenantId, supabase);
  }
  return LocalStoragePatientRepository;
}

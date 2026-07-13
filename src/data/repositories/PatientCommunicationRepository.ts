import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type {
  PatientAutomatedCommunicationChannel,
  PatientCommunicationChannel,
  PatientCommunicationConsentEvent,
  PatientCommunicationConsentSource,
  PatientCommunicationConsentState,
  PatientCommunicationContact,
  PatientCommunicationContactType,
  PatientCommunicationEligibility,
  PatientCommunicationEligibilityStatus,
  PatientCommunicationEligibilitySummary,
  PatientCommunicationLanguage,
  PatientCommunicationOwnerType,
  PatientCommunicationPreferences,
  PatientCommunicationProfile,
  PatientCommunicationSuppressionReason,
  PatientPreferredCommunicationChannel,
  PatientRepresentativeRelation,
} from '../../types';

type Row = Record<string, unknown>;

export type PatientCommunicationRepositoryBackend = 'local' | 'supabase';
export type PatientCommunicationErrorCode =
  | 'read_failed'
  | 'invalid_phone'
  | 'invalid_email'
  | 'permission'
  | 'stale'
  | 'consent_missing'
  | 'reason_required'
  | 'idempotency_conflict'
  | 'operation_failed';

export class PatientCommunicationRepositoryError extends Error {
  readonly code: PatientCommunicationErrorCode;

  constructor(code: PatientCommunicationErrorCode, message: string) {
    super(message);
    this.name = 'PatientCommunicationRepositoryError';
    this.code = code;
  }
}

const SAFE_MESSAGES: Record<PatientCommunicationErrorCode, string> = {
  read_failed: 'Не удалось загрузить настройки связи.',
  invalid_phone: 'Укажите корректный номер телефона.',
  invalid_email: 'Укажите корректный адрес электронной почты.',
  permission: 'Недостаточно прав для изменения настроек связи.',
  stale: 'Контакт был изменён другим пользователем. Обновите данные.',
  consent_missing: 'Статус согласия не указан.',
  reason_required: 'Укажите причину.',
  idempotency_conflict: 'Эта операция уже выполнена с другими параметрами.',
  operation_failed: 'Не удалось сохранить настройки связи.',
};

const value = (row: Row, camel: string, snake: string): unknown => row[camel] ?? row[snake];
const optionalString = (raw: unknown): string | undefined => {
  const text = typeof raw === 'string' ? raw : '';
  return text ? text : undefined;
};

export const toSafePatientCommunicationError = (
  error: unknown,
  context: 'read' | 'write' = 'write',
): PatientCommunicationRepositoryError => {
  if (error instanceof PatientCommunicationRepositoryError) return error;
  const record = typeof error === 'object' && error !== null ? error as Row : {};
  const normalized = [record.message, record.code, record.hint, record.details, error]
    .map((item) => String(item ?? ''))
    .join(' ')
    .toLowerCase();

  if (normalized.includes('корректный номер телефона') || normalized.includes('communication_invalid_phone')) {
    return new PatientCommunicationRepositoryError('invalid_phone', SAFE_MESSAGES.invalid_phone);
  }
  if (normalized.includes('корректный адрес электронной почты') || normalized.includes('communication_invalid_email')) {
    return new PatientCommunicationRepositoryError('invalid_email', SAFE_MESSAGES.invalid_email);
  }
  if (normalized.includes('недостаточно прав') || normalized.includes('permission denied') || normalized.includes('42501')) {
    return new PatientCommunicationRepositoryError('permission', SAFE_MESSAGES.permission);
  }
  if (normalized.includes('communication_stale') || normalized.includes('изменён другим пользователем')) {
    return new PatientCommunicationRepositoryError('stale', SAFE_MESSAGES.stale);
  }
  if (normalized.includes('статус согласия не указан')) {
    return new PatientCommunicationRepositoryError('consent_missing', SAFE_MESSAGES.consent_missing);
  }
  if (normalized.includes('укажите причину')) {
    return new PatientCommunicationRepositoryError('reason_required', SAFE_MESSAGES.reason_required);
  }
  if (normalized.includes('другими параметрами') || normalized.includes('23505')) {
    return new PatientCommunicationRepositoryError('idempotency_conflict', SAFE_MESSAGES.idempotency_conflict);
  }
  return new PatientCommunicationRepositoryError(
    context === 'read' ? 'read_failed' : 'operation_failed',
    context === 'read' ? SAFE_MESSAGES.read_failed : SAFE_MESSAGES.operation_failed,
  );
};

const mapContact = (row: Row): PatientCommunicationContact => ({
  id: String(value(row, 'id', 'id')),
  tenantId: String(value(row, 'tenantId', 'tenant_id')),
  patientId: String(value(row, 'patientId', 'patient_id')),
  contactType: value(row, 'contactType', 'contact_type') as PatientCommunicationContactType,
  contactValueRaw: String(value(row, 'contactValueRaw', 'contact_value_raw') ?? ''),
  contactValueNormalized: optionalString(value(row, 'contactValueNormalized', 'contact_value_normalized')),
  countryCode: optionalString(value(row, 'countryCode', 'country_code')),
  isPrimary: Boolean(value(row, 'isPrimary', 'is_primary')),
  isVerified: Boolean(value(row, 'isVerified', 'is_verified')),
  verificationSource: optionalString(value(row, 'verificationSource', 'verification_source')),
  ownerType: value(row, 'ownerType', 'owner_type') as PatientCommunicationOwnerType,
  representativeName: optionalString(value(row, 'representativeName', 'representative_name')),
  representativeRelation: optionalString(value(row, 'representativeRelation', 'representative_relation')) as PatientRepresentativeRelation | undefined,
  language: optionalString(value(row, 'language', 'language')) as PatientCommunicationLanguage | undefined,
  possibleDuplicate: Boolean(value(row, 'possibleDuplicate', 'possible_duplicate')),
  createdBy: optionalString(value(row, 'createdBy', 'created_by')),
  updatedBy: optionalString(value(row, 'updatedBy', 'updated_by')),
  createdAt: String(value(row, 'createdAt', 'created_at') ?? ''),
  updatedAt: String(value(row, 'updatedAt', 'updated_at') ?? ''),
  archivedAt: optionalString(value(row, 'archivedAt', 'archived_at')),
});

export const defaultPatientCommunicationPreferences = (
  tenantId: string,
  patientId: string,
): PatientCommunicationPreferences => ({
  tenantId,
  patientId,
  preferredLanguage: 'ru',
  preferredChannel: 'none',
  allowManualPhone: true,
  smsConsentState: 'unknown',
  whatsappConsentState: 'unknown',
  emailConsentState: 'unknown',
  phoneSuppressed: false,
  smsSuppressed: false,
  whatsappSuppressed: false,
  emailSuppressed: false,
  globalSuppression: false,
  createdAt: '',
  updatedAt: '',
});

const mapPreferences = (row: Row, tenantId: string, patientId: string): PatientCommunicationPreferences => ({
  tenantId: String(value(row, 'tenantId', 'tenant_id') ?? tenantId),
  patientId: String(value(row, 'patientId', 'patient_id') ?? patientId),
  preferredLanguage: (value(row, 'preferredLanguage', 'preferred_language') ?? 'ru') as PatientCommunicationLanguage,
  preferredChannel: (value(row, 'preferredChannel', 'preferred_channel') ?? 'none') as PatientPreferredCommunicationChannel,
  allowManualPhone: value(row, 'allowManualPhone', 'allow_manual_phone') !== false,
  smsConsentState: (value(row, 'smsConsentState', 'sms_consent_state') ?? 'unknown') as PatientCommunicationConsentState,
  whatsappConsentState: (value(row, 'whatsappConsentState', 'whatsapp_consent_state') ?? 'unknown') as PatientCommunicationConsentState,
  emailConsentState: (value(row, 'emailConsentState', 'email_consent_state') ?? 'unknown') as PatientCommunicationConsentState,
  phoneSuppressed: Boolean(value(row, 'phoneSuppressed', 'phone_suppressed')),
  phoneSuppressionReason: optionalString(value(row, 'phoneSuppressionReason', 'phone_suppression_reason')) as PatientCommunicationSuppressionReason | undefined,
  smsSuppressed: Boolean(value(row, 'smsSuppressed', 'sms_suppressed')),
  smsSuppressionReason: optionalString(value(row, 'smsSuppressionReason', 'sms_suppression_reason')) as PatientCommunicationSuppressionReason | undefined,
  whatsappSuppressed: Boolean(value(row, 'whatsappSuppressed', 'whatsapp_suppressed')),
  whatsappSuppressionReason: optionalString(value(row, 'whatsappSuppressionReason', 'whatsapp_suppression_reason')) as PatientCommunicationSuppressionReason | undefined,
  emailSuppressed: Boolean(value(row, 'emailSuppressed', 'email_suppressed')),
  emailSuppressionReason: optionalString(value(row, 'emailSuppressionReason', 'email_suppression_reason')) as PatientCommunicationSuppressionReason | undefined,
  globalSuppression: Boolean(value(row, 'globalSuppression', 'global_suppression')),
  globalSuppressionReason: optionalString(value(row, 'globalSuppressionReason', 'global_suppression_reason')) as PatientCommunicationSuppressionReason | undefined,
  createdAt: String(value(row, 'createdAt', 'created_at') ?? ''),
  updatedAt: String(value(row, 'updatedAt', 'updated_at') ?? ''),
  updatedBy: optionalString(value(row, 'updatedBy', 'updated_by')),
});

const mapConsentEvent = (row: Row): PatientCommunicationConsentEvent => ({
  id: String(value(row, 'id', 'id')),
  tenantId: String(value(row, 'tenantId', 'tenant_id')),
  patientId: String(value(row, 'patientId', 'patient_id')),
  channel: value(row, 'channel', 'channel') as PatientAutomatedCommunicationChannel,
  previousState: value(row, 'previousState', 'previous_state') as PatientCommunicationConsentState,
  newState: value(row, 'newState', 'new_state') as PatientCommunicationConsentState,
  source: value(row, 'source', 'source') as PatientCommunicationConsentSource,
  actorUserId: optionalString(value(row, 'actorUserId', 'actor_user_id')),
  reason: optionalString(value(row, 'reason', 'reason')),
  occurredAt: String(value(row, 'occurredAt', 'occurred_at') ?? ''),
  metadata: (value(row, 'metadata', 'metadata') ?? {}) as Record<string, unknown>,
});

const mapEligibility = (row: unknown, channel: PatientCommunicationChannel): PatientCommunicationEligibility => {
  const source = (row ?? {}) as Row;
  const suppression = (value(source, 'suppressionState', 'suppression_state') ?? {}) as Row;
  return {
    eligible: Boolean(value(source, 'eligible', 'eligible')),
    automatedEligible: Boolean(value(source, 'automatedEligible', 'automated_eligible')),
    manualEligible: Boolean(value(source, 'manualEligible', 'manual_eligible')),
    status: (value(source, 'status', 'status') ?? 'blocked') as PatientCommunicationEligibilityStatus,
    channel: (value(source, 'channel', 'channel') ?? channel) as PatientCommunicationChannel,
    selectedContactId: optionalString(value(source, 'selectedContactId', 'selected_contact_id')),
    normalizedDestination: optionalString(value(source, 'normalizedDestination', 'normalized_destination')),
    language: (value(source, 'language', 'language') ?? 'ru') as PatientCommunicationLanguage,
    blockedReasons: ((value(source, 'blockedReasons', 'blocked_reasons') ?? []) as PatientCommunicationEligibility['blockedReasons']),
    consentState: (value(source, 'consentState', 'consent_state') ?? (channel === 'phone' ? 'not_required' : 'unknown')) as PatientCommunicationEligibility['consentState'],
    suppressionState: {
      global: Boolean(value(suppression, 'global', 'global')),
      channel: Boolean(value(suppression, 'channel', 'channel')),
    },
    representative: Boolean(value(source, 'representative', 'representative')),
    requiresManualReview: Boolean(value(source, 'requiresManualReview', 'requires_manual_review')),
  };
};

const summaryStatus = (items: PatientCommunicationEligibility[]): PatientCommunicationEligibilityStatus => {
  if (items.some((item) => item.automatedEligible)) return 'available';
  if (items[0]?.manualEligible) return 'manual_only';
  if (items.some((item) => item.status === 'suppressed')) return 'suppressed';
  if (items.some((item) => item.status === 'consent_unknown')) return 'consent_unknown';
  if (items.some((item) => item.status === 'invalid_contact')) return 'invalid_contact';
  return 'blocked';
};

export interface UpsertPatientCommunicationContactInput {
  patientId: string;
  contactId?: string;
  contactType: PatientCommunicationContactType;
  contactValueRaw: string;
  isPrimary: boolean;
  isVerified: boolean;
  verificationSource?: string;
  ownerType: PatientCommunicationOwnerType;
  representativeName?: string;
  representativeRelation?: PatientRepresentativeRelation;
  language?: PatientCommunicationLanguage;
  expectedUpdatedAt?: string;
  operationKey: string;
}

export interface PatientCommunicationMutationResult {
  contact?: PatientCommunicationContact;
  preferences?: PatientCommunicationPreferences;
  duplicateWarning?: boolean;
  changed?: boolean;
  consentEventId?: string;
  replayed: boolean;
}

export interface PatientCommunicationRepository {
  listPatientContacts(patientId: string): Promise<PatientCommunicationContact[]>;
  getPatientCommunicationProfile(patientId: string): Promise<PatientCommunicationProfile>;
  upsertContact(input: UpsertPatientCommunicationContactInput): Promise<PatientCommunicationMutationResult>;
  archiveContact(patientId: string, contactId: string, expectedUpdatedAt: string, operationKey: string): Promise<PatientCommunicationMutationResult>;
  setPrimaryContact(patientId: string, contactId: string, expectedUpdatedAt: string, operationKey: string): Promise<PatientCommunicationMutationResult>;
  updatePreferences(patientId: string, preferredLanguage: PatientCommunicationLanguage, preferredChannel: PatientPreferredCommunicationChannel, allowManualPhone: boolean, operationKey: string): Promise<PatientCommunicationMutationResult>;
  setConsent(patientId: string, channel: PatientAutomatedCommunicationChannel, state: PatientCommunicationConsentState, source: PatientCommunicationConsentSource, reason: string | undefined, operationKey: string): Promise<PatientCommunicationMutationResult>;
  setSuppression(patientId: string, channel: 'global' | PatientCommunicationChannel, suppressed: boolean, reason: PatientCommunicationSuppressionReason | undefined, operationKey: string): Promise<PatientCommunicationMutationResult>;
  getEligibility(patientId: string, channel: PatientCommunicationChannel): Promise<PatientCommunicationEligibility>;
  getEligibilitySummary(patientId: string): Promise<PatientCommunicationEligibilitySummary>;
}

export class SupabasePatientCommunicationRepository implements PatientCommunicationRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async listPatientContacts(patientId: string): Promise<PatientCommunicationContact[]> {
    try {
      const { data, error } = await this.client
        .from('patient_communication_contacts')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('patient_id', patientId)
        .is('archived_at', null)
        .order('contact_type', { ascending: true })
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as Row[]).map(mapContact);
    } catch (error) {
      throw toSafePatientCommunicationError(error, 'read');
    }
  }

  async getPatientCommunicationProfile(patientId: string): Promise<PatientCommunicationProfile> {
    try {
      const contactsPromise = this.listPatientContacts(patientId);
      const preferencesPromise = this.client
        .from('patient_communication_preferences')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('patient_id', patientId)
        .maybeSingle();
      const eventsPromise = this.client
        .from('patient_communication_consent_events')
        .select('*')
        .eq('tenant_id', this.tenantId)
        .eq('patient_id', patientId)
        .order('occurred_at', { ascending: false })
        .order('id', { ascending: true })
        .limit(100);
      const [contacts, preferencesResponse, eventsResponse, eligibility] = await Promise.all([
        contactsPromise,
        preferencesPromise,
        eventsPromise,
        this.getEligibilitySummary(patientId),
      ]);
      if (preferencesResponse.error) throw preferencesResponse.error;
      if (eventsResponse.error) throw eventsResponse.error;
      return {
        contacts,
        preferences: preferencesResponse.data
          ? mapPreferences(preferencesResponse.data as Row, this.tenantId, patientId)
          : defaultPatientCommunicationPreferences(this.tenantId, patientId),
        consentEvents: ((eventsResponse.data ?? []) as Row[]).map(mapConsentEvent),
        eligibility,
      };
    } catch (error) {
      throw toSafePatientCommunicationError(error, 'read');
    }
  }

  async getEligibility(patientId: string, channel: PatientCommunicationChannel): Promise<PatientCommunicationEligibility> {
    try {
      const { data, error } = await this.client.rpc('get_patient_communication_eligibility', {
        p_tenant_id: this.tenantId,
        p_patient_id: patientId,
        p_channel: channel,
      });
      if (error) throw error;
      return mapEligibility(data, channel);
    } catch (error) {
      throw toSafePatientCommunicationError(error, 'read');
    }
  }

  async getEligibilitySummary(patientId: string): Promise<PatientCommunicationEligibilitySummary> {
    const [phone, sms, whatsapp, email] = await Promise.all(
      (['phone', 'sms', 'whatsapp', 'email'] as const).map((channel) => this.getEligibility(patientId, channel)),
    );
    return { phone, sms, whatsapp, email, status: summaryStatus([phone, sms, whatsapp, email]) };
  }

  async upsertContact(input: UpsertPatientCommunicationContactInput): Promise<PatientCommunicationMutationResult> {
    return this.mutate('upsert_patient_communication_contact', {
      p_tenant_id: this.tenantId,
      p_patient_id: input.patientId,
      p_contact_id: input.contactId ?? null,
      p_contact_type: input.contactType,
      p_contact_value_raw: input.contactValueRaw,
      p_is_primary: input.isPrimary,
      p_is_verified: input.isVerified,
      p_verification_source: input.verificationSource ?? null,
      p_owner_type: input.ownerType,
      p_representative_name: input.representativeName ?? null,
      p_representative_relation: input.representativeRelation ?? null,
      p_language: input.language ?? null,
      p_expected_updated_at: input.expectedUpdatedAt ?? null,
      p_operation_key: input.operationKey,
    });
  }

  async archiveContact(patientId: string, contactId: string, expectedUpdatedAt: string, operationKey: string) {
    return this.mutate('archive_patient_communication_contact', {
      p_tenant_id: this.tenantId,
      p_patient_id: patientId,
      p_contact_id: contactId,
      p_expected_updated_at: expectedUpdatedAt,
      p_operation_key: operationKey,
    });
  }

  async setPrimaryContact(patientId: string, contactId: string, expectedUpdatedAt: string, operationKey: string) {
    return this.mutate('set_primary_patient_communication_contact', {
      p_tenant_id: this.tenantId,
      p_patient_id: patientId,
      p_contact_id: contactId,
      p_expected_updated_at: expectedUpdatedAt,
      p_operation_key: operationKey,
    });
  }

  async updatePreferences(
    patientId: string,
    preferredLanguage: PatientCommunicationLanguage,
    preferredChannel: PatientPreferredCommunicationChannel,
    allowManualPhone: boolean,
    operationKey: string,
  ) {
    return this.mutate('set_patient_communication_preferences', {
      p_tenant_id: this.tenantId,
      p_patient_id: patientId,
      p_preferred_language: preferredLanguage,
      p_preferred_channel: preferredChannel,
      p_allow_manual_phone: allowManualPhone,
      p_operation_key: operationKey,
    });
  }

  async setConsent(
    patientId: string,
    channel: PatientAutomatedCommunicationChannel,
    state: PatientCommunicationConsentState,
    source: PatientCommunicationConsentSource,
    reason: string | undefined,
    operationKey: string,
  ) {
    return this.mutate('set_patient_communication_consent', {
      p_tenant_id: this.tenantId,
      p_patient_id: patientId,
      p_channel: channel,
      p_new_state: state,
      p_source: source,
      p_reason: reason?.trim() || null,
      p_operation_key: operationKey,
    });
  }

  async setSuppression(
    patientId: string,
    channel: 'global' | PatientCommunicationChannel,
    suppressed: boolean,
    reason: PatientCommunicationSuppressionReason | undefined,
    operationKey: string,
  ) {
    return this.mutate('set_patient_communication_suppression', {
      p_tenant_id: this.tenantId,
      p_patient_id: patientId,
      p_channel: channel,
      p_suppressed: suppressed,
      p_reason: reason ?? null,
      p_operation_key: operationKey,
    });
  }

  private async mutate(rpcName: string, args: Row): Promise<PatientCommunicationMutationResult> {
    try {
      const { data, error } = await this.client.rpc(rpcName, args);
      if (error) throw error;
      const result = (data ?? {}) as Row;
      return {
        contact: result.contact ? mapContact(result.contact as Row) : undefined,
        preferences: result.preferences ? mapPreferences(result.preferences as Row, this.tenantId, String(args.p_patient_id ?? '')) : undefined,
        duplicateWarning: Boolean(result.duplicateWarning),
        changed: result.changed === undefined ? undefined : Boolean(result.changed),
        consentEventId: optionalString(result.consentEventId),
        replayed: Boolean(result.replayed),
      };
    } catch (error) {
      throw toSafePatientCommunicationError(error, 'write');
    }
  }
}

const blockedEligibility = (channel: PatientCommunicationChannel): PatientCommunicationEligibility => ({
  eligible: false,
  automatedEligible: false,
  manualEligible: false,
  status: 'blocked',
  channel,
  language: 'ru',
  blockedReasons: ['no_contact'],
  consentState: channel === 'phone' ? 'not_required' : 'unknown',
  suppressionState: { global: false, channel: false },
  representative: false,
  requiresManualReview: false,
});

export const LocalPatientCommunicationRepository: PatientCommunicationRepository = {
  async listPatientContacts() { return []; },
  async getPatientCommunicationProfile(patientId) {
    const phone = blockedEligibility('phone');
    const sms = blockedEligibility('sms');
    const whatsapp = blockedEligibility('whatsapp');
    const email = blockedEligibility('email');
    return {
      contacts: [],
      preferences: defaultPatientCommunicationPreferences('local', patientId),
      consentEvents: [],
      eligibility: { phone, sms, whatsapp, email, status: 'blocked' },
    };
  },
  async upsertContact() { throw new PatientCommunicationRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed); },
  async archiveContact() { throw new PatientCommunicationRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed); },
  async setPrimaryContact() { throw new PatientCommunicationRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed); },
  async updatePreferences() { throw new PatientCommunicationRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed); },
  async setConsent() { throw new PatientCommunicationRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed); },
  async setSuppression() { throw new PatientCommunicationRepositoryError('operation_failed', SAFE_MESSAGES.operation_failed); },
  async getEligibility(_patientId, channel) { return blockedEligibility(channel); },
  async getEligibilitySummary(patientId) { return (await this.getPatientCommunicationProfile(patientId)).eligibility; },
};

export function createPatientCommunicationRepository(options: {
  backend: PatientCommunicationRepositoryBackend;
  tenantId?: string | null;
}): PatientCommunicationRepository {
  if (options.backend === 'local') return LocalPatientCommunicationRepository;
  if (!options.tenantId) throw new PatientCommunicationRepositoryError('permission', 'Клиника не выбрана.');
  if (!supabase) throw new PatientCommunicationRepositoryError('read_failed', SAFE_MESSAGES.read_failed);
  return new SupabasePatientCommunicationRepository(options.tenantId, supabase);
}

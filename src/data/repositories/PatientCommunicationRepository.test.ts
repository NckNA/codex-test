import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import repositorySource from './PatientCommunicationRepository.ts?raw';
import {
  SupabasePatientCommunicationRepository,
  PatientCommunicationRepositoryError,
  createPatientCommunicationRepository,
  defaultPatientCommunicationPreferences,
  toSafePatientCommunicationError,
} from './PatientCommunicationRepository';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() },
}));

const tenantId = '11111111-1111-4111-8111-111111111111';
const patientId = '22222222-2222-4222-8222-222222222222';
const contactId = '33333333-3333-4333-8333-333333333333';

const contactRow = (overrides: Record<string, unknown> = {}) => ({
  id: contactId,
  tenant_id: tenantId,
  patient_id: patientId,
  contact_type: 'phone',
  contact_value_raw: '+7 (700) 123-45-67',
  contact_value_normalized: '+77001234567',
  country_code: '7',
  is_primary: true,
  is_verified: false,
  verification_source: 'import_legacy',
  owner_type: 'patient',
  representative_name: null,
  representative_relation: null,
  language: 'ru',
  possible_duplicate: false,
  created_by: null,
  updated_by: null,
  created_at: '2026-07-13T00:00:00+00:00',
  updated_at: '2026-07-13T00:00:00.123456+00:00',
  archived_at: null,
  ...overrides,
});

const preferencesRow = (overrides: Record<string, unknown> = {}) => ({
  tenant_id: tenantId,
  patient_id: patientId,
  preferred_language: 'kk',
  preferred_channel: 'sms',
  allow_manual_phone: true,
  sms_consent_state: 'granted',
  whatsapp_consent_state: 'unknown',
  email_consent_state: 'denied',
  phone_suppressed: false,
  sms_suppressed: false,
  whatsapp_suppressed: true,
  whatsapp_suppression_reason: 'patient_request',
  email_suppressed: false,
  global_suppression: false,
  created_at: '2026-07-13T00:00:00+00:00',
  updated_at: '2026-07-13T01:00:00+00:00',
  updated_by: null,
  ...overrides,
});

const eligibility = (channel: string, overrides: Record<string, unknown> = {}) => ({
  eligible: channel === 'phone' || channel === 'sms',
  automatedEligible: channel === 'sms',
  manualEligible: channel === 'phone',
  status: channel === 'sms' ? 'available' : channel === 'phone' ? 'manual_only' : 'consent_unknown',
  channel,
  selectedContactId: contactId,
  normalizedDestination: '+77001234567',
  language: 'kk',
  blockedReasons: channel === 'whatsapp' ? ['consent_unknown'] : [],
  consentState: channel === 'phone' ? 'not_required' : channel === 'sms' ? 'granted' : 'unknown',
  suppressionState: { global: false, channel: false },
  representative: false,
  requiresManualReview: false,
  ...overrides,
});

const query = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> & PromiseLike<typeof result> = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    is: vi.fn(() => builder),
    order: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(() => builder),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return builder;
};

describe('PatientCommunicationRepository', () => {
  it('does not silently fall back when Supabase tenant is missing', () => {
    expect(() => createPatientCommunicationRepository({ backend: 'supabase', tenantId: null }))
      .toThrow('Клиника не выбрана.');
  });

  it('maps legacy unverified contact and applies tenant/patient filters', async () => {
    const contactQuery = query({ data: [contactRow()], error: null });
    const from = vi.fn(() => contactQuery);
    const repository = new SupabasePatientCommunicationRepository(tenantId, { from, rpc: vi.fn() } as unknown as SupabaseClient);
    const contacts = await repository.listPatientContacts(patientId);

    expect(from).toHaveBeenCalledWith('patient_communication_contacts');
    expect(contactQuery.eq).toHaveBeenCalledWith('tenant_id', tenantId);
    expect(contactQuery.eq).toHaveBeenCalledWith('patient_id', patientId);
    expect(contacts[0]).toMatchObject({
      contactValueRaw: '+7 (700) 123-45-67',
      contactValueNormalized: '+77001234567',
      isVerified: false,
      verificationSource: 'import_legacy',
      isPrimary: true,
    });
  });

  it('maps preferences and consent history in a complete profile', async () => {
    const events = [{
      id: 'event-1', tenant_id: tenantId, patient_id: patientId, channel: 'sms',
      previous_state: 'unknown', new_state: 'granted', source: 'patient_verbal',
      actor_user_id: 'user-1', reason: 'Устно', occurred_at: '2026-07-13T02:00:00Z', metadata: {},
    }];
    const queries = [
      query({ data: [contactRow()], error: null }),
      query({ data: preferencesRow(), error: null }),
      query({ data: events, error: null }),
    ];
    const from = vi.fn(() => queries.shift()!);
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: eligibility('phone'), error: null })
      .mockResolvedValueOnce({ data: eligibility('sms'), error: null })
      .mockResolvedValueOnce({ data: eligibility('whatsapp'), error: null })
      .mockResolvedValueOnce({ data: eligibility('email'), error: null });
    const repository = new SupabasePatientCommunicationRepository(tenantId, { from, rpc } as unknown as SupabaseClient);

    const profile = await repository.getPatientCommunicationProfile(patientId);
    expect(profile.preferences).toMatchObject({ preferredLanguage: 'kk', preferredChannel: 'sms', smsConsentState: 'granted' });
    expect(profile.consentEvents[0]).toMatchObject({ previousState: 'unknown', newState: 'granted', source: 'patient_verbal' });
    expect(profile.eligibility.status).toBe('available');
  });

  it('uses unknown consent defaults when preferences do not exist', () => {
    expect(defaultPatientCommunicationPreferences(tenantId, patientId)).toMatchObject({
      smsConsentState: 'unknown', whatsappConsentState: 'unknown', emailConsentState: 'unknown', preferredChannel: 'none',
    });
  });

  it('maps provider-neutral eligibility fields', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: eligibility('whatsapp', { representative: true, requiresManualReview: true }), error: null });
    const repository = new SupabasePatientCommunicationRepository(tenantId, { rpc, from: vi.fn() } as unknown as SupabaseClient);
    await expect(repository.getEligibility(patientId, 'whatsapp')).resolves.toMatchObject({
      channel: 'whatsapp', status: 'consent_unknown', blockedReasons: ['consent_unknown'], representative: true,
    });
    expect(rpc).toHaveBeenCalledWith('get_patient_communication_eligibility', {
      p_tenant_id: tenantId, p_patient_id: patientId, p_channel: 'whatsapp',
    });
  });

  it('calls contact upsert RPC with tenant scope and operation key', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { contact: contactRow(), duplicateWarning: true, replayed: false }, error: null });
    const repository = new SupabasePatientCommunicationRepository(tenantId, { rpc, from: vi.fn() } as unknown as SupabaseClient);
    const result = await repository.upsertContact({
      patientId, contactType: 'phone', contactValueRaw: '+77001234567', isPrimary: true,
      isVerified: true, verificationSource: 'patient_confirmed', ownerType: 'patient', language: 'ru', operationKey: 'contact-upsert-001',
    });
    expect(rpc).toHaveBeenCalledWith('upsert_patient_communication_contact', expect.objectContaining({
      p_tenant_id: tenantId, p_patient_id: patientId, p_operation_key: 'contact-upsert-001',
    }));
    expect(result).toMatchObject({ duplicateWarning: true, replayed: false });
  });

  it('calls archive and primary RPCs with exact versions', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { contact: contactRow(), replayed: false }, error: null });
    const repository = new SupabasePatientCommunicationRepository(tenantId, { rpc, from: vi.fn() } as unknown as SupabaseClient);
    await repository.archiveContact(patientId, contactId, '2026-07-13T00:00:00.123456+00:00', 'archive-001');
    await repository.setPrimaryContact(patientId, contactId, '2026-07-13T00:00:00.123456+00:00', 'primary-001');
    expect(rpc).toHaveBeenNthCalledWith(1, 'archive_patient_communication_contact', expect.objectContaining({ p_expected_updated_at: '2026-07-13T00:00:00.123456+00:00' }));
    expect(rpc).toHaveBeenNthCalledWith(2, 'set_primary_patient_communication_contact', expect.objectContaining({ p_operation_key: 'primary-001' }));
  });

  it('calls preferences RPC without inferring consent', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { preferences: preferencesRow(), replayed: false }, error: null });
    const repository = new SupabasePatientCommunicationRepository(tenantId, { rpc, from: vi.fn() } as unknown as SupabaseClient);
    await repository.updatePreferences(patientId, 'kk', 'whatsapp', true, 'preferences-001');
    expect(rpc).toHaveBeenCalledWith('set_patient_communication_preferences', {
      p_tenant_id: tenantId, p_patient_id: patientId, p_preferred_language: 'kk',
      p_preferred_channel: 'whatsapp', p_allow_manual_phone: true, p_operation_key: 'preferences-001',
    });
  });

  it('calls consent RPC with channel-specific state and source', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { preferences: preferencesRow(), consentEventId: 'event-1', changed: true, replayed: false }, error: null });
    const repository = new SupabasePatientCommunicationRepository(tenantId, { rpc, from: vi.fn() } as unknown as SupabaseClient);
    const result = await repository.setConsent(patientId, 'sms', 'granted', 'patient_verbal', 'Устно', 'consent-001');
    expect(rpc).toHaveBeenCalledWith('set_patient_communication_consent', expect.objectContaining({
      p_channel: 'sms', p_new_state: 'granted', p_source: 'patient_verbal', p_operation_key: 'consent-001',
    }));
    expect(result).toMatchObject({ changed: true, consentEventId: 'event-1' });
  });

  it('calls suppression RPC without provider or delivery state', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { preferences: preferencesRow(), replayed: false }, error: null });
    const repository = new SupabasePatientCommunicationRepository(tenantId, { rpc, from: vi.fn() } as unknown as SupabaseClient);
    await repository.setSuppression(patientId, 'whatsapp', true, 'patient_request', 'suppression-001');
    expect(rpc).toHaveBeenCalledWith('set_patient_communication_suppression', expect.objectContaining({
      p_channel: 'whatsapp', p_suppressed: true, p_reason: 'patient_request',
    }));
  });

  it('maps safe phone, email, permission, stale and generic failures', () => {
    expect(toSafePatientCommunicationError({ message: 'Укажите корректный номер телефона.' })).toMatchObject({ code: 'invalid_phone' });
    expect(toSafePatientCommunicationError({ message: 'Укажите корректный адрес электронной почты.' })).toMatchObject({ code: 'invalid_email' });
    expect(toSafePatientCommunicationError({ message: 'permission denied 42501' })).toMatchObject({ code: 'permission' });
    expect(toSafePatientCommunicationError({ hint: 'communication_stale' })).toMatchObject({ code: 'stale' });
    expect(toSafePatientCommunicationError({ message: 'secret_constraint failed' }))
      .toEqual(new PatientCommunicationRepositoryError('operation_failed', 'Не удалось сохранить настройки связи.'));
  });

  it('keeps reads tenant-scoped and contains no direct mutation or provider path', () => {
    expect(repositorySource).not.toMatch(/\.insert\s*\(/);
    expect(repositorySource).not.toMatch(/\.update\s*\(/);
    expect(repositorySource).not.toMatch(/\.delete\s*\(/);
    expect(repositorySource).not.toMatch(/service[_-]?role/i);
    expect(repositorySource).not.toMatch(/sendSms|sendWhatsApp|sendEmail|providerMessageId|deliveryAttempt/i);
  });

  it('does not expose raw SQL details through read failures', async () => {
    const broken = query({ data: null, error: { message: 'relation patient_communication_contacts secret failed' } });
    const repository = new SupabasePatientCommunicationRepository(tenantId, { from: vi.fn(() => broken), rpc: vi.fn() } as unknown as SupabaseClient);
    await expect(repository.listPatientContacts(patientId)).rejects.toEqual(
      new PatientCommunicationRepositoryError('read_failed', 'Не удалось загрузить настройки связи.'),
    );
  });
});

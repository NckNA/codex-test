/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import type { PatientCommunicationProfile } from '../../types';
import { createPatientCommunicationRepository } from '../repositories/PatientCommunicationRepository';
import { usePatientCommunicationProfile } from './usePatientCommunicationProfile';

vi.mock('../../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../repositories/PatientCommunicationRepository', async () => {
  const actual = await vi.importActual('../repositories/PatientCommunicationRepository');
  return { ...actual as object, createPatientCommunicationRepository: vi.fn() };
});

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const patientA = '33333333-3333-4333-8333-333333333333';
const patientB = '44444444-4444-4444-8444-444444444444';

const profile = (tenantId = tenantA, patientId = patientA): PatientCommunicationProfile => ({
  contacts: [{
    id: 'contact-1', tenantId, patientId, contactType: 'phone', contactValueRaw: '+77001234567',
    contactValueNormalized: '+77001234567', isPrimary: true, isVerified: false,
    verificationSource: 'import_legacy', ownerType: 'patient', possibleDuplicate: false,
    createdAt: '2026-07-13T00:00:00Z', updatedAt: '2026-07-13T00:00:00Z',
  }],
  preferences: {
    tenantId, patientId, preferredLanguage: 'ru', preferredChannel: 'none', allowManualPhone: true,
    smsConsentState: 'unknown', whatsappConsentState: 'unknown', emailConsentState: 'unknown',
    phoneSuppressed: false, smsSuppressed: false, whatsappSuppressed: false, emailSuppressed: false,
    globalSuppression: false, createdAt: '', updatedAt: '',
  },
  consentEvents: [],
  eligibility: {
    phone: { eligible: true, automatedEligible: false, manualEligible: true, status: 'manual_only', channel: 'phone', language: 'ru', blockedReasons: [], consentState: 'not_required', suppressionState: { global: false, channel: false }, representative: false, requiresManualReview: true },
    sms: { eligible: false, automatedEligible: false, manualEligible: false, status: 'consent_unknown', channel: 'sms', language: 'ru', blockedReasons: ['consent_unknown', 'unverified_contact'], consentState: 'unknown', suppressionState: { global: false, channel: false }, representative: false, requiresManualReview: false },
    whatsapp: { eligible: false, automatedEligible: false, manualEligible: false, status: 'consent_unknown', channel: 'whatsapp', language: 'ru', blockedReasons: ['consent_unknown', 'unverified_contact'], consentState: 'unknown', suppressionState: { global: false, channel: false }, representative: false, requiresManualReview: false },
    email: { eligible: false, automatedEligible: false, manualEligible: false, status: 'blocked', channel: 'email', language: 'ru', blockedReasons: ['no_contact', 'consent_unknown'], consentState: 'unknown', suppressionState: { global: false, channel: false }, representative: false, requiresManualReview: false },
    status: 'manual_only',
  },
});

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
};

const makeRepository = () => ({
  listPatientContacts: vi.fn().mockResolvedValue(profile().contacts),
  getPatientCommunicationProfile: vi.fn().mockResolvedValue(profile()),
  upsertContact: vi.fn().mockResolvedValue({ replayed: false }),
  archiveContact: vi.fn().mockResolvedValue({ replayed: false }),
  setPrimaryContact: vi.fn().mockResolvedValue({ replayed: false }),
  updatePreferences: vi.fn().mockResolvedValue({ replayed: false }),
  setConsent: vi.fn().mockResolvedValue({ replayed: false, changed: true }),
  setSuppression: vi.fn().mockResolvedValue({ replayed: false }),
  getEligibility: vi.fn(),
  getEligibilitySummary: vi.fn().mockResolvedValue(profile().eligibility),
});

describe('usePatientCommunicationProfile', () => {
  let authState: any;
  let tenantState: any;
  let repository: ReturnType<typeof makeRepository>;
  let current: ReturnType<typeof usePatientCommunicationProfile> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    authState = { authMode: 'supabase-active', user: { id: 'user-a' } };
    tenantState = { activeTenant: { tenantId: tenantA, role: 'clinic_admin', timezone: 'Asia/Almaty' } };
    repository = makeRepository();
    vi.mocked(useAuth).mockImplementation(() => authState);
    vi.mocked(useTenant).mockImplementation(() => tenantState);
    vi.mocked(createPatientCommunicationRepository).mockReturnValue(repository as any);
  });

  const mount = async (initialPatientId?: string | null) => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const Harness = ({ patientId = initialPatientId, tick = 0 }: { patientId?: string | null; tick?: number }) => {
      void tick;
      current = usePatientCommunicationProfile(patientId);
      return null;
    };
    await act(async () => { root.render(<Harness />); await Promise.resolve(); });
    return { root, Harness };
  };

  it('does not fetch without a tenant', async () => {
    tenantState = { activeTenant: null };
    const { root } = await mount(patientA);
    expect(createPatientCommunicationRepository).not.toHaveBeenCalled();
    expect(repository.getPatientCommunicationProfile).not.toHaveBeenCalled();
    expect(current?.profile).toBeNull();
    await act(async () => root.unmount());
  });

  it('does not fetch without a patient', async () => {
    const { root } = await mount(null);
    expect(repository.getPatientCommunicationProfile).not.toHaveBeenCalled();
    expect(current?.contacts).toEqual([]);
    await act(async () => root.unmount());
  });

  it('loads a tenant-scoped profile', async () => {
    const { root } = await mount(patientA);
    expect(createPatientCommunicationRepository).toHaveBeenCalledWith({ backend: 'supabase', tenantId: tenantA });
    expect(repository.getPatientCommunicationProfile).toHaveBeenCalledWith(patientA);
    expect(current?.contacts[0].verificationSource).toBe('import_legacy');
    await act(async () => root.unmount());
  });

  it('clears old tenant data and ignores stale tenant response', async () => {
    const a = deferred<PatientCommunicationProfile>();
    const b = deferred<PatientCommunicationProfile>();
    const repoA = { ...makeRepository(), getPatientCommunicationProfile: vi.fn(() => a.promise) };
    const repoB = { ...makeRepository(), getPatientCommunicationProfile: vi.fn(() => b.promise) };
    vi.mocked(createPatientCommunicationRepository).mockImplementation(({ tenantId }) => (tenantId === tenantA ? repoA : repoB) as any);
    const { root, Harness } = await mount(patientA);
    tenantState = { activeTenant: { tenantId: tenantB, role: 'clinic_admin', timezone: 'Europe/Berlin' } };
    await act(async () => { root.render(<Harness patientId={patientA} tick={1} />); await Promise.resolve(); });
    expect(current?.profile).toBeNull();
    await act(async () => { a.resolve(profile(tenantA, patientA)); await Promise.resolve(); });
    expect(current?.profile).toBeNull();
    await act(async () => { b.resolve(profile(tenantB, patientA)); await Promise.resolve(); });
    expect(current?.profile?.preferences.tenantId).toBe(tenantB);
    await act(async () => root.unmount());
  });

  it('clears old patient data and ignores stale patient response', async () => {
    const a = deferred<PatientCommunicationProfile>();
    const b = deferred<PatientCommunicationProfile>();
    repository.getPatientCommunicationProfile.mockImplementation((id) => id === patientA ? a.promise : b.promise);
    const { root, Harness } = await mount(patientA);
    await act(async () => { root.render(<Harness patientId={patientB} tick={1} />); await Promise.resolve(); });
    expect(current?.profile).toBeNull();
    await act(async () => { a.resolve(profile(tenantA, patientA)); await Promise.resolve(); });
    expect(current?.profile).toBeNull();
    await act(async () => { b.resolve(profile(tenantA, patientB)); await Promise.resolve(); });
    expect(current?.profile?.preferences.patientId).toBe(patientB);
    await act(async () => root.unmount());
  });

  it('blocks duplicate contact saves', async () => {
    const pending = deferred<{ replayed: boolean }>();
    repository.upsertContact.mockImplementation(() => pending.promise);
    const { root } = await mount(patientA);
    let first!: Promise<unknown>;
    await act(async () => { first = current!.saveContact({ contactType: 'phone', contactValueRaw: '+77001234567', isPrimary: true, isVerified: false, ownerType: 'patient' }); });
    await expect(current!.saveContact({ contactType: 'phone', contactValueRaw: '+77001234567', isPrimary: true, isVerified: false, ownerType: 'patient' }))
      .rejects.toMatchObject({ code: 'operation_failed' });
    expect(repository.upsertContact).toHaveBeenCalledTimes(1);
    await act(async () => { pending.resolve({ replayed: false }); await first; });
    await act(async () => root.unmount());
  });

  it('refreshes exactly once after successful consent mutation', async () => {
    repository.getPatientCommunicationProfile.mockResolvedValue(profile());
    const { root } = await mount(patientA);
    await act(async () => { await current!.recordConsent('sms', 'granted', 'patient_verbal', 'Устно'); });
    expect(repository.setConsent).toHaveBeenCalledTimes(1);
    expect(repository.getPatientCommunicationProfile).toHaveBeenCalledTimes(2);
    await act(async () => root.unmount());
  });

  it('keeps safe errors visible after a failed mutation', async () => {
    repository.setSuppression.mockRejectedValue(new Error('Недостаточно прав для изменения настроек связи.'));
    const { root } = await mount(patientA);
    await act(async () => {
      await expect(current!.changeSuppression('sms', true, 'patient_request')).rejects.toThrow();
    });
    expect(current?.error).toBe('Недостаточно прав для изменения настроек связи.');
    expect(current?.profile).not.toBeNull();
    await act(async () => root.unmount());
  });

  it('makes doctor view read-only and blocks mutations before RPC', async () => {
    tenantState.activeTenant.role = 'doctor';
    const { root } = await mount(patientA);
    expect(current?.canMutate).toBe(false);
    await expect(current!.recordConsent('sms', 'granted', 'patient_verbal')).rejects.toMatchObject({ code: 'permission' });
    expect(repository.setConsent).not.toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});

// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePatientCommunicationProfile } from '../../../data/hooks/usePatientCommunicationProfile';
import type { PatientCommunicationProfile } from '../../../types';
import { PatientCommunicationSection } from './PatientCommunicationSection';

vi.mock('../../../data/hooks/usePatientCommunicationProfile', () => ({ usePatientCommunicationProfile: vi.fn() }));

const patientId = '22222222-2222-4222-8222-222222222222';
const legacyContact = {
  id: 'contact-legacy', tenantId: 'tenant-a', patientId, contactType: 'phone' as const,
  contactValueRaw: '+7 (700) 123-45-67', contactValueNormalized: '+77001234567', countryCode: '7',
  isPrimary: true, isVerified: false, verificationSource: 'import_legacy', ownerType: 'patient' as const,
  possibleDuplicate: false, language: 'ru' as const,
  createdAt: '2026-07-13T00:00:00Z', updatedAt: '2026-07-13T00:00:00Z',
};

const profile: PatientCommunicationProfile = {
  contacts: [legacyContact],
  preferences: {
    tenantId: 'tenant-a', patientId, preferredLanguage: 'ru', preferredChannel: 'none', allowManualPhone: true,
    smsConsentState: 'unknown', whatsappConsentState: 'unknown', emailConsentState: 'denied',
    phoneSuppressed: false, smsSuppressed: false, whatsappSuppressed: true,
    whatsappSuppressionReason: 'patient_request', emailSuppressed: false, globalSuppression: false,
    createdAt: '', updatedAt: '',
  },
  consentEvents: [{
    id: 'event-1', tenantId: 'tenant-a', patientId, channel: 'email', previousState: 'unknown',
    newState: 'denied', source: 'patient_verbal', occurredAt: '2026-07-13T01:00:00Z', metadata: {},
  }],
  eligibility: {
    phone: { eligible: true, automatedEligible: false, manualEligible: true, status: 'manual_only', channel: 'phone', selectedContactId: 'contact-legacy', normalizedDestination: '+77001234567', language: 'ru', blockedReasons: [], consentState: 'not_required', suppressionState: { global: false, channel: false }, representative: false, requiresManualReview: true },
    sms: { eligible: false, automatedEligible: false, manualEligible: false, status: 'consent_unknown', channel: 'sms', selectedContactId: 'contact-legacy', normalizedDestination: '+77001234567', language: 'ru', blockedReasons: ['consent_unknown', 'unverified_contact'], consentState: 'unknown', suppressionState: { global: false, channel: false }, representative: false, requiresManualReview: false },
    whatsapp: { eligible: false, automatedEligible: false, manualEligible: false, status: 'suppressed', channel: 'whatsapp', selectedContactId: 'contact-legacy', normalizedDestination: '+77001234567', language: 'ru', blockedReasons: ['channel_suppressed', 'consent_unknown'], consentState: 'unknown', suppressionState: { global: false, channel: true }, representative: false, requiresManualReview: false },
    email: { eligible: false, automatedEligible: false, manualEligible: false, status: 'blocked', channel: 'email', language: 'ru', blockedReasons: ['no_contact', 'consent_denied'], consentState: 'denied', suppressionState: { global: false, channel: false }, representative: false, requiresManualReview: false },
    status: 'manual_only',
  },
};

const hook = (overrides: Record<string, unknown> = {}) => ({
  profile,
  contacts: profile.contacts,
  preferences: profile.preferences,
  eligibility: profile.eligibility,
  consentEvents: profile.consentEvents,
  loading: false,
  savingContact: false,
  updatingConsent: false,
  updatingPreferences: false,
  updatingSuppression: false,
  error: null,
  canMutate: true,
  refresh: vi.fn(),
  saveContact: vi.fn().mockResolvedValue({ replayed: false, duplicateWarning: false }),
  archiveContact: vi.fn().mockResolvedValue({ replayed: false }),
  setPrimaryContact: vi.fn().mockResolvedValue({ replayed: false }),
  savePreferences: vi.fn().mockResolvedValue({ replayed: false }),
  recordConsent: vi.fn().mockResolvedValue({ replayed: false, changed: true }),
  changeSuppression: vi.fn().mockResolvedValue({ replayed: false }),
  clearError: vi.fn(),
  ...overrides,
}) as unknown as ReturnType<typeof usePatientCommunicationProfile>;

function renderSection() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => root.render(<PatientCommunicationSection patientId={patientId} />));
  return { container, root };
}

function change(element: HTMLInputElement | HTMLSelectElement, next: string | boolean) {
  act(() => {
    if (element instanceof HTMLInputElement && typeof next === 'boolean') {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked');
      descriptor?.set?.call(element, next);
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    const descriptor = Object.getOwnPropertyDescriptor(
      element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype,
      'value',
    );
    descriptor?.set?.call(element, next);
    element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  });
}

function button(container: HTMLElement, testId: string): HTMLButtonElement {
  const found = container.querySelector(`[data-testid="${testId}"]`);
  if (!found) throw new Error(`Missing ${testId}`);
  return found as HTMLButtonElement;
}

describe('PatientCommunicationSection', () => {
  beforeEach(() => vi.mocked(usePatientCommunicationProfile).mockReturnValue(hook()));
  afterEach(() => { document.body.innerHTML = ''; vi.clearAllMocks(); });

  it('shows legacy phone as unverified and consent unknown', () => {
    const { container, root } = renderSection();
    expect(container.textContent).toContain('+7 (700) 123-45-67');
    expect(container.textContent).toContain('Не подтверждён');
    expect(container.textContent).toContain('Не указано');
    expect(container.textContent).toContain('Наличие номера не означает согласие на сообщения.');
    act(() => root.unmount());
  });

  it('shows preferred language and channel', () => {
    const { container, root } = renderSection();
    expect((container.querySelector('[data-testid="communication-preferred-language"]') as HTMLSelectElement).value).toBe('ru');
    expect((container.querySelector('[data-testid="communication-preferred-channel"]') as HTMLSelectElement).value).toBe('none');
    act(() => root.unmount());
  });

  it('shows suppression and automated eligibility warning', () => {
    const { container, root } = renderSection();
    expect(container.textContent).toContain('Связь подавлена');
    expect(container.textContent).toContain('Автоматическая отправка заблокирована до получения согласия.');
    act(() => root.unmount());
  });

  it('validates an invalid phone before RPC', async () => {
    const saveContact = vi.fn();
    vi.mocked(usePatientCommunicationProfile).mockReturnValue(hook({ saveContact }));
    const { container, root } = renderSection();
    act(() => button(container, 'communication-add-contact').click());
    change(container.querySelector('[data-testid="communication-contact-value"]') as HTMLInputElement, '8700');
    await act(async () => button(container, 'communication-save-contact').click());
    expect(container.textContent).toContain('Укажите корректный номер телефона.');
    expect(saveContact).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('validates an invalid email before RPC', async () => {
    const saveContact = vi.fn();
    vi.mocked(usePatientCommunicationProfile).mockReturnValue(hook({ saveContact }));
    const { container, root } = renderSection();
    act(() => button(container, 'communication-add-contact').click());
    change(container.querySelector('[data-testid="communication-contact-type"]') as HTMLSelectElement, 'email');
    change(container.querySelector('[data-testid="communication-contact-value"]') as HTMLInputElement, 'bad@');
    await act(async () => button(container, 'communication-save-contact').click());
    expect(container.textContent).toContain('Укажите корректный адрес электронной почты.');
    expect(saveContact).not.toHaveBeenCalled();
    act(() => root.unmount());
  });

  it('saves an explicit representative contact', async () => {
    const saveContact = vi.fn().mockResolvedValue({ replayed: false, duplicateWarning: false });
    vi.mocked(usePatientCommunicationProfile).mockReturnValue(hook({ saveContact }));
    const { container, root } = renderSection();
    act(() => button(container, 'communication-add-contact').click());
    change(container.querySelector('[data-testid="communication-contact-value"]') as HTMLInputElement, '+77009998877');
    change(container.querySelector('[data-testid="communication-owner-type"]') as HTMLSelectElement, 'representative');
    change(container.querySelector('[data-testid="communication-representative-name"]') as HTMLInputElement, 'Мама пациента');
    change(container.querySelector('[data-testid="communication-representative-relation"]') as HTMLSelectElement, 'parent');
    await act(async () => button(container, 'communication-save-contact').click());
    expect(saveContact).toHaveBeenCalledWith(expect.objectContaining({
      ownerType: 'representative', representativeName: 'Мама пациента', representativeRelation: 'parent',
    }));
    act(() => root.unmount());
  });

  it('shows duplicate warning returned by the backend', async () => {
    const saveContact = vi.fn().mockResolvedValue({ replayed: false, duplicateWarning: true });
    vi.mocked(usePatientCommunicationProfile).mockReturnValue(hook({ saveContact }));
    const { container, root } = renderSection();
    act(() => button(container, 'communication-add-contact').click());
    change(container.querySelector('[data-testid="communication-contact-value"]') as HTMLInputElement, '+77009998877');
    await act(async () => button(container, 'communication-save-contact').click());
    expect(container.textContent).toContain('Этот контакт уже используется у другого пациента в этой клинике.');
    act(() => root.unmount());
  });

  it('records SMS consent separately from WhatsApp', async () => {
    const recordConsent = vi.fn().mockResolvedValue({ replayed: false, changed: true });
    vi.mocked(usePatientCommunicationProfile).mockReturnValue(hook({ recordConsent }));
    const { container, root } = renderSection();
    await act(async () => button(container, 'communication-consent-grant-sms').click());
    expect(recordConsent).toHaveBeenCalledWith('sms', 'granted', 'patient_verbal', undefined);
    expect(recordConsent).not.toHaveBeenCalledWith('whatsapp', 'granted', expect.anything(), expect.anything());
    act(() => root.unmount());
  });

  it('shows representative ownership explicitly', () => {
    vi.mocked(usePatientCommunicationProfile).mockReturnValue(hook({
      contacts: [{ ...legacyContact, id: 'representative', ownerType: 'representative', representativeName: 'Отец', representativeRelation: 'parent' }],
    }));
    const { container, root } = renderSection();
    expect(container.textContent).toContain('Этот контакт принадлежит представителю пациента.');
    expect(container.textContent).toContain('Родитель');
    act(() => root.unmount());
  });

  it('renders read-only role and no provider controls', () => {
    vi.mocked(usePatientCommunicationProfile).mockReturnValue(hook({ canMutate: false }));
    const { container, root } = renderSection();
    expect(container.textContent).toContain('Доступ только для просмотра.');
    expect(container.querySelector('[data-testid="communication-add-contact"]')).toBeNull();
    expect(container.textContent).not.toContain('Отправить SMS');
    expect(container.textContent).not.toContain('Отправить WhatsApp');
    expect(container.textContent).not.toContain('Отправить Email');
    act(() => root.unmount());
  });
});

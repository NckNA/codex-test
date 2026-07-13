import { useMemo, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, Mail, MessageCircle, Phone, Plus, ShieldAlert, Star, UserRound } from 'lucide-react';
import { usePatientCommunicationProfile } from '../../../data/hooks/usePatientCommunicationProfile';
import type {
  PatientAutomatedCommunicationChannel,
  PatientCommunicationConsentSource,
  PatientCommunicationConsentState,
  PatientCommunicationContactType,
  PatientCommunicationLanguage,
  PatientCommunicationOwnerType,
  PatientCommunicationSuppressionReason,
  PatientPreferredCommunicationChannel,
  PatientRepresentativeRelation,
} from '../../../types';

const CONSENT_LABELS: Record<PatientCommunicationConsentState, string> = {
  unknown: 'Не указано',
  granted: 'Согласие получено',
  denied: 'Не согласен',
  withdrawn: 'Согласие отозвано',
};

const CHANNEL_LABELS: Record<PatientAutomatedCommunicationChannel, string> = {
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  email: 'Email',
};

const ELIGIBILITY_LABELS = {
  available: 'Автоматический канал доступен',
  manual_only: 'Только ручная связь',
  consent_unknown: 'Согласие не указано',
  invalid_contact: 'Контакт не готов',
  suppressed: 'Связь подавлена',
  blocked: 'Автоматическая связь заблокирована',
} as const;

const RELATION_LABELS: Record<PatientRepresentativeRelation, string> = {
  parent: 'Родитель',
  guardian: 'Опекун',
  spouse: 'Супруг(а)',
  child: 'Ребёнок',
  caregiver: 'Ухаживающее лицо',
  other: 'Другое',
};

const makeInitialContact = () => ({
  contactType: 'phone' as PatientCommunicationContactType,
  contactValueRaw: '',
  ownerType: 'patient' as PatientCommunicationOwnerType,
  representativeName: '',
  representativeRelation: 'parent' as PatientRepresentativeRelation,
  language: 'ru' as PatientCommunicationLanguage,
  isPrimary: true,
  isVerified: false,
});

const validPhone = (raw: string) => /^\+[1-9][0-9\s()-]{7,20}$/.test(raw.trim());
const validEmail = (raw: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim());

export function PatientCommunicationSection({ patientId }: { patientId: string }) {
  const communication = usePatientCommunicationProfile(patientId);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactDraft, setContactDraft] = useState(makeInitialContact);
  const [formError, setFormError] = useState<string | null>(null);
  const [preferenceDraft, setPreferenceDraft] = useState<{
    language: PatientCommunicationLanguage;
    preferredChannel: PatientPreferredCommunicationChannel;
    allowManualPhone: boolean;
  } | null>(null);
  const [consentSource, setConsentSource] = useState<PatientCommunicationConsentSource>('patient_verbal');
  const [consentReason, setConsentReason] = useState('');
  const [suppressionReason, setSuppressionReason] = useState<PatientCommunicationSuppressionReason>('patient_request');
  const [success, setSuccess] = useState<string | null>(null);
  const language = preferenceDraft?.language ?? communication.preferences?.preferredLanguage ?? 'ru';
  const preferredChannel = preferenceDraft?.preferredChannel ?? communication.preferences?.preferredChannel ?? 'none';
  const allowManualPhone = preferenceDraft?.allowManualPhone ?? communication.preferences?.allowManualPhone ?? true;

  const primaryPhone = useMemo(
    () => communication.contacts.find((contact) => contact.contactType === 'phone' && contact.isPrimary),
    [communication.contacts],
  );
  const primaryEmail = useMemo(
    () => communication.contacts.find((contact) => contact.contactType === 'email' && contact.isPrimary),
    [communication.contacts],
  );

  const updatePreferenceDraft = (patch: Partial<{
    language: PatientCommunicationLanguage;
    preferredChannel: PatientPreferredCommunicationChannel;
    allowManualPhone: boolean;
  }>) => setPreferenceDraft((current) => ({
    language: current?.language ?? communication.preferences?.preferredLanguage ?? 'ru',
    preferredChannel: current?.preferredChannel ?? communication.preferences?.preferredChannel ?? 'none',
    allowManualPhone: current?.allowManualPhone ?? communication.preferences?.allowManualPhone ?? true,
    ...patch,
  }));

  const saveNewContact = async () => {
    setFormError(null);
    setSuccess(null);
    if (contactDraft.contactType === 'phone' && !validPhone(contactDraft.contactValueRaw)) {
      setFormError('Укажите корректный номер телефона.');
      return;
    }
    if (contactDraft.contactType === 'email' && !validEmail(contactDraft.contactValueRaw)) {
      setFormError('Укажите корректный адрес электронной почты.');
      return;
    }
    if (contactDraft.ownerType === 'representative' && !contactDraft.representativeName.trim()) {
      setFormError('Укажите представителя и его отношение к пациенту.');
      return;
    }
    try {
      const result = await communication.saveContact({
        contactType: contactDraft.contactType,
        contactValueRaw: contactDraft.contactValueRaw,
        isPrimary: contactDraft.isPrimary,
        isVerified: contactDraft.isVerified,
        verificationSource: contactDraft.isVerified
          ? contactDraft.ownerType === 'representative' ? 'representative_confirmed' : 'patient_confirmed'
          : 'staff_entered',
        ownerType: contactDraft.ownerType,
        representativeName: contactDraft.ownerType === 'representative' ? contactDraft.representativeName : undefined,
        representativeRelation: contactDraft.ownerType === 'representative' ? contactDraft.representativeRelation : undefined,
        language: contactDraft.language,
      });
      setShowContactForm(false);
      setContactDraft(makeInitialContact());
      setSuccess(result.duplicateWarning
        ? 'Контакт сохранён. Этот контакт уже используется у другого пациента в этой клинике.'
        : 'Контакт сохранён.');
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : 'Не удалось сохранить настройки связи.');
    }
  };

  const savePreferences = async () => {
    setSuccess(null);
    try {
      await communication.savePreferences(language, preferredChannel, allowManualPhone);
      setPreferenceDraft(null);
      setSuccess('Предпочтения сохранены.');
    } catch {
      // The hook exposes a safe message and keeps the editor visible.
    }
  };

  const updateConsent = async (channel: PatientAutomatedCommunicationChannel, state: PatientCommunicationConsentState) => {
    setSuccess(null);
    try {
      await communication.recordConsent(channel, state, consentSource, consentReason || undefined);
      setSuccess(`Статус ${CHANNEL_LABELS[channel]} сохранён.`);
    } catch {
      // Safe hook error remains visible.
    }
  };

  const toggleSuppression = async (
    channel: 'global' | 'phone' | PatientAutomatedCommunicationChannel,
    currentlySuppressed: boolean,
  ) => {
    setSuccess(null);
    try {
      await communication.changeSuppression(
        channel,
        !currentlySuppressed,
        currentlySuppressed ? undefined : suppressionReason,
      );
      setSuccess(currentlySuppressed ? 'Подавление снято.' : 'Подавление установлено.');
    } catch {
      // Safe hook error remains visible.
    }
  };

  if (communication.loading && !communication.profile) {
    return <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">Загрузка настроек связи…</div>;
  }

  return (
    <div className="space-y-6" data-testid="patient-communication-section">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>Наличие номера не означает согласие на сообщения.</span></div>
        <div className="mt-2 flex items-start gap-2"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>Автоматическая отправка заблокирована до получения согласия.</span></div>
      </div>

      {(communication.error || formError || success) && (
        <div className="space-y-2">
          {(communication.error || formError) && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError ?? communication.error}</div>}
          {success && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>}
        </div>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Контакты для связи</h2>
            <p className="mt-1 text-sm text-slate-500">Legacy-телефон сохраняется как неподтверждённый контакт и не означает согласие.</p>
          </div>
          {communication.canMutate && (
            <button type="button" data-testid="communication-add-contact" onClick={() => { setShowContactForm(true); setFormError(null); }} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
              <Plus className="h-4 w-4" /> Добавить контакт
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {communication.contacts.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-slate-300 p-8 text-center text-slate-500">Контактов нет.</div>}
          {communication.contacts.map((contact) => (
            <article key={contact.id} data-testid={`communication-contact-${contact.id}`} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {contact.contactType === 'phone' ? <Phone className="h-4 w-4 text-blue-600" /> : <Mail className="h-4 w-4 text-blue-600" />}
                    <span className="font-medium text-slate-900">{contact.contactValueRaw}</span>
                    {contact.isPrimary && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">Основной</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className={`rounded-full px-2 py-1 ${contact.isVerified ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                      {contact.isVerified ? 'Подтверждён' : contact.contactValueNormalized ? 'Не подтверждён' : 'Некорректный'}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-700">
                      {contact.ownerType === 'patient' ? 'Пациент' : `Представитель: ${contact.representativeName}`}
                    </span>
                    {contact.possibleDuplicate && <span className="rounded-full bg-orange-100 px-2 py-1 text-orange-800">Возможный дубль</span>}
                  </div>
                  {contact.contactValueNormalized && <div className="mt-2 text-xs text-slate-500">Нормализовано: {contact.contactValueNormalized}</div>}
                  {contact.ownerType === 'representative' && (
                    <div className="mt-2 rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-800">
                      Этот контакт принадлежит представителю пациента. {contact.representativeRelation ? RELATION_LABELS[contact.representativeRelation] : ''}
                    </div>
                  )}
                </div>
                {communication.canMutate && (
                  <div className="flex gap-1">
                    {!contact.isPrimary && <button type="button" data-testid={`communication-primary-${contact.id}`} title="Сделать основным" onClick={() => void communication.setPrimaryContact(contact.id, contact.updatedAt)} className="rounded p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-700"><Star className="h-4 w-4" /></button>}
                    <button type="button" data-testid={`communication-archive-${contact.id}`} title="Архивировать" onClick={() => void communication.archiveContact(contact.id, contact.updatedAt)} className="rounded p-2 text-slate-500 hover:bg-red-50 hover:text-red-700"><Archive className="h-4 w-4" /></button>
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        {showContactForm && communication.canMutate && (
          <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4" data-testid="communication-contact-editor">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-sm">Тип
                <select data-testid="communication-contact-type" value={contactDraft.contactType} onChange={(event) => setContactDraft((current) => ({ ...current, contactType: event.target.value as PatientCommunicationContactType }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="phone">Телефон</option><option value="email">Email</option>
                </select>
              </label>
              <label className="text-sm">Контакт
                <input data-testid="communication-contact-value" value={contactDraft.contactValueRaw} onChange={(event) => setContactDraft((current) => ({ ...current, contactValueRaw: event.target.value }))} placeholder={contactDraft.contactType === 'phone' ? '+77001234567' : 'patient@example.com'} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm">Владелец
                <select data-testid="communication-owner-type" value={contactDraft.ownerType} onChange={(event) => setContactDraft((current) => ({ ...current, ownerType: event.target.value as PatientCommunicationOwnerType }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="patient">Пациент</option><option value="representative">Представитель</option>
                </select>
              </label>
              <label className="text-sm">Язык
                <select value={contactDraft.language} onChange={(event) => setContactDraft((current) => ({ ...current, language: event.target.value as PatientCommunicationLanguage }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                  <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
                </select>
              </label>
              {contactDraft.ownerType === 'representative' && <>
                <label className="text-sm">Имя представителя
                  <input data-testid="communication-representative-name" value={contactDraft.representativeName} onChange={(event) => setContactDraft((current) => ({ ...current, representativeName: event.target.value }))} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
                </label>
                <label className="text-sm">Отношение
                  <select data-testid="communication-representative-relation" value={contactDraft.representativeRelation} onChange={(event) => setContactDraft((current) => ({ ...current, representativeRelation: event.target.value as PatientRepresentativeRelation }))} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                    {Object.entries(RELATION_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                  </select>
                </label>
              </>}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2"><input data-testid="communication-contact-primary" type="checkbox" checked={contactDraft.isPrimary} onChange={(event) => setContactDraft((current) => ({ ...current, isPrimary: event.target.checked }))} />Основной</label>
              <label className="flex items-center gap-2"><input data-testid="communication-contact-verified" type="checkbox" checked={contactDraft.isVerified} onChange={(event) => setContactDraft((current) => ({ ...current, isVerified: event.target.checked }))} />Подтверждён сотрудником</label>
            </div>
            <div className="mt-4 flex gap-2">
              <button type="button" data-testid="communication-save-contact" disabled={communication.savingContact} onClick={() => void saveNewContact()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Сохранить контакт</button>
              <button type="button" onClick={() => setShowContactForm(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">Отмена</button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Предпочтения</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Предпочитаемый язык
              <select data-testid="communication-preferred-language" value={language} disabled={!communication.canMutate} onChange={(event) => updatePreferenceDraft({ language: event.target.value as PatientCommunicationLanguage })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="ru">Русский</option><option value="kk">Қазақша</option><option value="en">English</option>
              </select>
            </label>
            <label className="text-sm">Предпочитаемый канал
              <select data-testid="communication-preferred-channel" value={preferredChannel} disabled={!communication.canMutate} onChange={(event) => updatePreferenceDraft({ preferredChannel: event.target.value as PatientPreferredCommunicationChannel })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
                <option value="none">Не выбран</option><option value="phone">Телефон</option><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option>
              </select>
            </label>
          </div>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={allowManualPhone} disabled={!communication.canMutate} onChange={(event) => updatePreferenceDraft({ allowManualPhone: event.target.checked })} />Разрешить ручной звонок</label>
          {communication.canMutate && <button type="button" data-testid="communication-save-preferences" disabled={communication.updatingPreferences} onClick={() => void savePreferences()} className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Сохранить предпочтения</button>}
          <div className="mt-4 border-t border-slate-200 pt-4 text-sm">
            <div>Основной телефон: <strong>{primaryPhone?.contactValueRaw ?? 'не выбран'}</strong></div>
            <div className="mt-1">Основной email: <strong>{primaryEmail?.contactValueRaw ?? 'не выбран'}</strong></div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Подавление связи</h2>
          <label className="mt-4 block text-sm">Причина
            <select data-testid="communication-suppression-reason" value={suppressionReason} disabled={!communication.canMutate} onChange={(event) => setSuppressionReason(event.target.value as PatientCommunicationSuppressionReason)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="patient_request">Просьба пациента</option><option value="representative_request">Просьба представителя</option><option value="invalid_contact">Некорректный контакт</option><option value="wrong_number">Неверный номер</option><option value="duplicate_contact">Дублирующий контакт</option><option value="legal_restriction">Правовое ограничение</option><option value="staff_decision">Решение сотрудника</option><option value="other">Другое</option>
            </select>
          </label>
          <div className="mt-4 space-y-2 text-sm">
            {([
              ['global', 'Все автоматические каналы', communication.preferences?.globalSuppression ?? false],
              ['phone', 'Ручной телефон', communication.preferences?.phoneSuppressed ?? false],
              ['sms', 'SMS', communication.preferences?.smsSuppressed ?? false],
              ['whatsapp', 'WhatsApp', communication.preferences?.whatsappSuppressed ?? false],
              ['email', 'Email', communication.preferences?.emailSuppressed ?? false],
            ] as const).map(([channel, label, suppressed]) => (
              <div key={channel} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <span>{label}</span>
                {communication.canMutate && <button type="button" data-testid={`communication-suppression-${channel}`} onClick={() => void toggleSuppression(channel, suppressed)} className={`rounded px-3 py-1 text-xs font-medium ${suppressed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{suppressed ? 'Снять' : 'Подавить'}</button>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Согласие по каналам</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Источник
            <select data-testid="communication-consent-source" value={consentSource} disabled={!communication.canMutate} onChange={(event) => setConsentSource(event.target.value as PatientCommunicationConsentSource)} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2">
              <option value="patient_verbal">Пациент, устно</option><option value="patient_written">Пациент, письменно</option><option value="representative_verbal">Представитель, устно</option><option value="representative_written">Представитель, письменно</option><option value="staff_correction">Исправление сотрудником</option>
            </select>
          </label>
          <label className="text-sm">Причина/заметка
            <input value={consentReason} onChange={(event) => setConsentReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2" />
          </label>
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {(['sms', 'whatsapp', 'email'] as const).map((channel) => {
            const current = communication.preferences?.[`${channel}ConsentState` as 'smsConsentState'] as PatientCommunicationConsentState | undefined;
            const eligibility = communication.eligibility?.[channel];
            return (
              <article key={channel} data-testid={`communication-consent-${channel}`} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 font-medium text-slate-900">{channel === 'email' ? <Mail className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}{CHANNEL_LABELS[channel]}</div>
                <div className="mt-2 text-sm">{CONSENT_LABELS[current ?? 'unknown']}</div>
                <div className={`mt-2 rounded-lg px-2 py-1 text-xs ${eligibility?.automatedEligible ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>
                  {eligibility ? ELIGIBILITY_LABELS[eligibility.status] : 'Проверка недоступна'}
                </div>
                {communication.canMutate && <div className="mt-3 flex flex-wrap gap-1">
                  <button type="button" data-testid={`communication-consent-grant-${channel}`} onClick={() => void updateConsent(channel, 'granted')} className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-800">Получено</button>
                  <button type="button" data-testid={`communication-consent-deny-${channel}`} onClick={() => void updateConsent(channel, 'denied')} className="rounded bg-red-100 px-2 py-1 text-xs text-red-800">Не согласен</button>
                  <button type="button" data-testid={`communication-consent-withdraw-${channel}`} onClick={() => void updateConsent(channel, 'withdrawn')} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">Отозвано</button>
                </div>}
              </article>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-blue-600" /><h2 className="text-lg font-semibold text-slate-900">История согласий</h2></div>
        <div className="mt-3 space-y-2">
          {communication.consentEvents.length === 0 && <div className="text-sm text-slate-500">Изменений согласия пока нет.</div>}
          {communication.consentEvents.map((event) => (
            <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span>{CHANNEL_LABELS[event.channel]}: {CONSENT_LABELS[event.previousState]} → {CONSENT_LABELS[event.newState]}</span>
              <span className="text-xs text-slate-500">{new Date(event.occurredAt).toLocaleString('ru-RU')}</span>
            </div>
          ))}
        </div>
      </section>

      {!communication.canMutate && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600"><UserRound className="h-4 w-4" />Доступ только для просмотра.</div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Archive, Eye, FilePlus2, Plus, Save, ShieldAlert, Upload } from 'lucide-react';
import type { CommunicationChannel, CommunicationLanguage, CommunicationPurpose } from '../../domain/communications/CommunicationCommand';
import {
  COMMUNICATION_TEMPLATE_CHANNELS,
  COMMUNICATION_TEMPLATE_LANGUAGES,
  COMMUNICATION_TEMPLATE_PURPOSES,
  COMMUNICATION_TEMPLATE_VARIABLES,
  type CommunicationTemplate,
  validateCommunicationTemplateContent,
} from '../../domain/communications/CommunicationTemplate';
import { useCommunicationTemplates } from '../../data/hooks/useCommunicationTemplates';

const PURPOSE_LABELS: Record<CommunicationPurpose, string> = {
  appointment_confirmation_request: 'Запрос подтверждения записи',
  appointment_day_before_reminder: 'Напоминание за день',
  appointment_same_day_reminder: 'Напоминание в день записи',
  appointment_control_call_task: 'Контрольный звонок',
};
const CHANNEL_LABELS: Record<CommunicationChannel, string> = { sms: 'SMS', whatsapp: 'WhatsApp', email: 'Email' };
const LANGUAGE_LABELS: Record<CommunicationLanguage, string> = { ru: 'RU', kk: 'KK', en: 'EN' };
const SAMPLE_VALUES: Record<string, string> = {
  patient_first_name: 'Айгүл',
  clinic_name: 'Демо-клиника',
  appointment_date: '14.07.2026',
  appointment_time: '10:30',
  doctor_display_name: 'Доктор Тестов',
  clinic_callback_phone: '+7 700 000 00 00',
};

const makeDraftState = (template: CommunicationTemplate | null) => ({
  subject: template?.draftVersion?.subject ?? '',
  body: template?.draftVersion?.body ?? '',
});

export function CommunicationTemplateManager() {
  const {
    templates,
    selectedTemplate,
    draft,
    preview,
    loading,
    saving,
    publishing,
    archiving,
    error,
    canRead,
    canManage,
    selectTemplate,
    createTemplate,
    createDraft,
    updateDraft,
    publishDraft,
    archiveTemplate,
    previewDraft,
  } = useCommunicationTemplates();

  const [purposeCode, setPurposeCode] = useState<CommunicationPurpose>('appointment_confirmation_request');
  const [channel, setChannel] = useState<CommunicationChannel>('sms');
  const [language, setLanguage] = useState<CommunicationLanguage>('ru');
  const [displayName, setDisplayName] = useState('');
  const [createSubject, setCreateSubject] = useState('');
  const [createBody, setCreateBody] = useState('');
  const [editor, setEditor] = useState(() => makeDraftState(null));
  const [localNotice, setLocalNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) setEditor(makeDraftState(selectedTemplate));
    });
    return () => { active = false; };
  }, [selectedTemplate]);

  const validation = useMemo(() => {
    if (!selectedTemplate || !draft) return { message: null, variableKeys: [] as string[] };
    try {
      const result = validateCommunicationTemplateContent({
        channel: selectedTemplate.channel,
        subject: editor.subject || null,
        body: editor.body,
      });
      return { message: null, variableKeys: result.variableKeys as string[] };
    } catch (cause) {
      return { message: cause instanceof Error ? cause.message : 'Шаблон содержит ошибку.', variableKeys: [] as string[] };
    }
  }, [draft, editor.body, editor.subject, selectedTemplate]);

  if (!canRead) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center" data-testid="template-access-blocked">
        <ShieldAlert className="mx-auto h-10 w-10 text-amber-600" />
        <h2 className="mt-3 text-lg font-semibold text-slate-900">Управление шаблонами недоступно</h2>
        <p className="mt-2 text-sm text-slate-600">Недостаточно прав для управления шаблонами.</p>
      </div>
    );
  }

  const run = async (action: () => Promise<unknown>, notice: string) => {
    setLocalNotice(null);
    try {
      await action();
      setLocalNotice(notice);
    } catch {
      // Hook exposes a redacted safe error and keeps the editor open.
    }
  };

  const insertVariable = (key: string) => {
    setEditor((current) => ({ ...current, body: `${current.body}{{${key}}}` }));
  };

  const submitCreate = async () => {
    await run(async () => {
      const result = await createTemplate({
        purposeCode,
        channel,
        language,
        displayName,
        subject: channel === 'email' ? createSubject : undefined,
        body: createBody,
      });
      setDisplayName('');
      setCreateSubject('');
      setCreateBody('');
      selectTemplate(result.template.id);
    }, 'Черновик шаблона создан.');
  };

  const previewVariables = Object.fromEntries(
    (draft?.variableKeys ?? []).map((key) => [key, SAMPLE_VALUES[key]]),
  );

  return (
    <section className="space-y-5" data-testid="communication-template-manager">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <strong className="block">Опубликованная версия неизменяема.</strong>
          Для правки создайте новую версию.
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <strong className="block">Шаблон не отправляет сообщения сам по себе.</strong>
          Предпросмотр не является доставкой.
        </div>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
          <strong className="block">Используйте только разрешённые переменные.</strong>
          Произвольные выражения, HTML и клинические данные запрещены.
        </div>
      </div>

      {(error || localNotice) && (
        <div className="space-y-2">
          {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {localNotice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{localNotice}</div>}
        </div>
      )}

      {canManage && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" data-testid="template-create-panel">
          <div className="flex items-center gap-2 font-semibold text-slate-900"><Plus className="h-4 w-4" />Новый шаблон</div>
          <div className="mt-4 grid gap-3 lg:grid-cols-4">
            <select value={purposeCode} onChange={(event) => setPurposeCode(event.target.value as CommunicationPurpose)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Назначение шаблона">
              {COMMUNICATION_TEMPLATE_PURPOSES.map((item) => <option key={item} value={item}>{PURPOSE_LABELS[item]}</option>)}
            </select>
            <select value={channel} onChange={(event) => setChannel(event.target.value as CommunicationChannel)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Канал шаблона">
              {COMMUNICATION_TEMPLATE_CHANNELS.map((item) => <option key={item} value={item}>{CHANNEL_LABELS[item]}</option>)}
            </select>
            <select value={language} onChange={(event) => setLanguage(event.target.value as CommunicationLanguage)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" aria-label="Язык шаблона">
              {COMMUNICATION_TEMPLATE_LANGUAGES.map((item) => <option key={item} value={item}>{LANGUAGE_LABELS[item]}</option>)}
            </select>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Название" aria-label="Название шаблона" />
          </div>
          {channel === 'email' && <input value={createSubject} onChange={(event) => setCreateSubject(event.target.value)} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Тема email" aria-label="Тема нового шаблона" />}
          <textarea value={createBody} onChange={(event) => setCreateBody(event.target.value)} className="mt-3 min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Текст шаблона" aria-label="Текст нового шаблона" />
          <button type="button" data-testid="create-template" disabled={saving || !displayName.trim() || !createBody.trim()} onClick={() => void submitCreate()} className="mt-3 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><FilePlus2 className="h-4 w-4" />Создать черновик</button>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="font-semibold text-slate-900">Шаблоны</h2>
          {loading ? <p className="mt-4 text-sm text-slate-500">Загрузка шаблонов…</p> : templates.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Шаблоны ещё не созданы.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {templates.map((template) => (
                <button key={template.id} type="button" onClick={() => selectTemplate(template.id)} data-testid={`template-row-${template.id}`} className={`w-full rounded-xl border p-3 text-left text-sm ${selectedTemplate?.id === template.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 hover:bg-slate-50'}`}>
                  <div className="font-semibold text-slate-900">{template.displayName}</div>
                  <div className="mt-1 text-xs text-slate-500">{PURPOSE_LABELS[template.purposeCode]} · {CHANNEL_LABELS[template.channel]} · {LANGUAGE_LABELS[template.language]}</div>
                  <div className="mt-2 flex gap-2 text-xs"><span className="rounded bg-slate-100 px-2 py-1">{template.status}</span><span>active v{template.activeVersion?.versionNumber ?? '—'}</span><span>draft v{template.draftVersion?.versionNumber ?? '—'}</span></div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {!selectedTemplate ? <p className="text-sm text-slate-500">Выберите шаблон.</p> : (
            <div data-testid="template-editor">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">{selectedTemplate.displayName}</h2>
                  <p className="mt-1 text-xs text-slate-500">{PURPOSE_LABELS[selectedTemplate.purposeCode]} · {CHANNEL_LABELS[selectedTemplate.channel]} · {LANGUAGE_LABELS[selectedTemplate.language]}</p>
                </div>
                {canManage && selectedTemplate.status !== 'archived' && (
                  <div className="flex flex-wrap gap-2">
                    {!draft && <button type="button" data-testid="create-template-draft" disabled={saving} onClick={() => void run(() => createDraft(selectedTemplate), 'Новый черновик создан.')} className="rounded-lg border border-slate-300 px-3 py-2 text-sm"><FilePlus2 className="mr-1 inline h-4 w-4" />Новая версия</button>}
                    <button type="button" data-testid="archive-template" disabled={archiving} onClick={() => void run(() => archiveTemplate(selectedTemplate), 'Шаблон архивирован.')} className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700"><Archive className="mr-1 inline h-4 w-4" />Архивировать</button>
                  </div>
                )}
              </div>

              {draft ? (
                <div className="mt-5 space-y-3">
                  {selectedTemplate.channel === 'email' && <input value={editor.subject} readOnly={!canManage} onChange={(event) => setEditor((current) => ({ ...current, subject: event.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm read-only:bg-slate-50" aria-label="Тема черновика" />}
                  <textarea value={editor.body} readOnly={!canManage} onChange={(event) => setEditor((current) => ({ ...current, body: event.target.value }))} className="min-h-48 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm read-only:bg-slate-50" aria-label="Текст черновика" data-testid="template-body-editor" />
                  <div className="flex flex-wrap gap-2" aria-label="Разрешённые переменные">
                    {COMMUNICATION_TEMPLATE_VARIABLES.map((key) => <button key={key} type="button" disabled={!canManage} onClick={() => insertVariable(key)} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs disabled:opacity-60">{`{{${key}}}`}</button>)}
                  </div>
                  {validation.message ? <p className="text-sm text-red-700" data-testid="template-validation-error">{validation.message}</p> : <p className="text-xs text-slate-500">Переменные: {validation.variableKeys.join(', ') || 'нет'}</p>}
                  <div className="flex flex-wrap gap-2">
                    {canManage && <button type="button" data-testid="save-template-draft" disabled={saving || Boolean(validation.message)} onClick={() => void run(() => updateDraft(selectedTemplate, editor.subject || undefined, editor.body), 'Черновик сохранён.')} className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save className="mr-1 inline h-4 w-4" />Сохранить</button>}
                    <button type="button" data-testid="preview-template" disabled={Boolean(validation.message)} onClick={() => void run(() => previewDraft(draft, previewVariables), 'Предпросмотр сформирован.')} className="rounded-lg border border-indigo-200 px-3 py-2 text-sm text-indigo-700 disabled:opacity-50"><Eye className="mr-1 inline h-4 w-4" />Предпросмотр</button>
                    {canManage && <button type="button" data-testid="publish-template" disabled={publishing || Boolean(validation.message)} onClick={() => void run(() => publishDraft(selectedTemplate), 'Версия опубликована.')} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"><Upload className="mr-1 inline h-4 w-4" />Опубликовать</button>}
                  </div>
                </div>
              ) : selectedTemplate.activeVersion ? (
                <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4" data-testid="published-template-readonly">
                  {selectedTemplate.activeVersion.subject && <div className="font-medium text-slate-800">{selectedTemplate.activeVersion.subject}</div>}
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-slate-700">{selectedTemplate.activeVersion.body}</pre>
                  <p className="mt-3 text-xs text-slate-500">Опубликована версия {selectedTemplate.activeVersion.versionNumber}; редактирование на месте запрещено.</p>
                </div>
              ) : <p className="mt-5 text-sm text-slate-500">У шаблона нет черновика или активной версии.</p>}

              {preview && (
                <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4" data-testid="template-preview">
                  <h3 className="font-semibold text-emerald-900">Безопасный предпросмотр</h3>
                  {preview.rendered.subject && <div className="mt-2 text-sm font-medium text-emerald-950">{preview.rendered.subject}</div>}
                  <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-emerald-900">{preview.rendered.body}</pre>
                  <div className="mt-2 text-xs text-emerald-700">Символов: {preview.rendered.renderedCharacterCount} · fingerprint: {preview.rendered.renderedFingerprint.slice(0, 12)}…</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

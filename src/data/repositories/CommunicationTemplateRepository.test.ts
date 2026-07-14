import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import repositorySource from './CommunicationTemplateRepository.ts?raw';
import {
  CommunicationTemplateRepositoryError,
  SupabaseCommunicationTemplateRepository,
  mapCommunicationTemplate,
  mapCommunicationTemplateVersion,
  toSafeCommunicationTemplateError,
} from './CommunicationTemplateRepository';

vi.mock('../../lib/supabaseClient', () => ({ supabase: { rpc: vi.fn(), from: vi.fn() } }));

const tenantId = '11111111-1111-4111-8111-111111111111';
const versionRow = {
  id: 'version-a', tenantId, templateId: 'template-a', versionNumber: 2, status: 'draft',
  subject: null, body: 'Здравствуйте, {{patient_first_name}}', variableKeys: ['patient_first_name'],
  contentFingerprint: 'a'.repeat(64), createdAt: '2026-07-13T00:00:00Z', updatedAt: '2026-07-13T01:00:00Z',
};
const templateRow = {
  id: 'template-a', tenantId, purposeCode: 'appointment_confirmation_request', channel: 'sms', language: 'ru',
  displayName: 'Подтверждение RU', status: 'inactive', activeVersionId: null,
  activeVersion: null, draftVersion: versionRow, createdAt: '2026-07-13T00:00:00Z', updatedAt: '2026-07-13T01:00:00Z',
};

describe('CommunicationTemplateRepository', () => {
  it('maps templates and versions', () => {
    expect(mapCommunicationTemplateVersion(versionRow)).toMatchObject({ versionNumber: 2, variableKeys: ['patient_first_name'] });
    expect(mapCommunicationTemplate(templateRow)).toMatchObject({
      tenantId, channel: 'sms', language: 'ru', draftVersion: { id: 'version-a' },
    });
  });

  it('lists templates tenant-scoped with deterministic filters', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [templateRow], error: null });
    const repository = new SupabaseCommunicationTemplateRepository(tenantId, { rpc } as unknown as SupabaseClient);
    await expect(repository.listTemplates({ channel: 'sms', language: 'ru' })).resolves.toHaveLength(1);
    expect(rpc).toHaveBeenCalledWith('list_communication_templates', {
      p_tenant_id: tenantId, p_purpose_code: null, p_channel: 'sms', p_language: 'ru',
    });
  });

  it('calls every controlled mutation and preview RPC', async () => {
    const result = { template: templateRow, version: versionRow, replayed: false };
    const rpc = vi.fn()
      .mockResolvedValueOnce({ data: result, error: null })
      .mockResolvedValueOnce({ data: result, error: null })
      .mockResolvedValueOnce({ data: result, error: null })
      .mockResolvedValueOnce({ data: result, error: null })
      .mockResolvedValueOnce({ data: { template: templateRow, replayed: false }, error: null })
      .mockResolvedValueOnce({ data: {
        templateId: 'template-a', versionId: 'version-a', versionNumber: 2,
        purposeCode: 'appointment_confirmation_request', channel: 'sms', language: 'ru',
        contentFingerprint: 'a'.repeat(64), rendered: {
          body: 'Здравствуйте, Айгүл', renderedCharacterCount: 19,
          renderedFingerprint: 'b'.repeat(64), variableKeys: ['patient_first_name'], warnings: [],
        },
      }, error: null });
    const repository = new SupabaseCommunicationTemplateRepository(tenantId, { rpc } as unknown as SupabaseClient);

    await repository.createTemplate({
      purposeCode: 'appointment_confirmation_request', channel: 'sms', language: 'ru',
      displayName: 'RU', body: 'Привет', operationKey: 'template-create-a',
    });
    await repository.createDraft('template-a', 'template-draft-a');
    await repository.updateDraft({ versionId: 'version-a', body: 'Текст', expectedUpdatedAt: 'v1', operationKey: 'template-update-a' });
    await repository.publishVersion('template-a', 'version-a', 'v1', 'template-publish-a');
    await repository.archiveTemplate('template-a', 't1', 'template-archive-a');
    await repository.previewTemplate('version-a', { patient_first_name: 'Айгүл' });

    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      'create_communication_template', 'create_communication_template_draft',
      'update_communication_template_draft', 'publish_communication_template_version',
      'archive_communication_template', 'preview_communication_template',
    ]);
    expect(rpc.mock.calls.every(([, params]) => params.p_tenant_id === tenantId)).toBe(true);
  });

  it('maps database failures to safe messages', () => {
    expect(toSafeCommunicationTemplateError({ message: 'permission denied 42501' })).toMatchObject({ code: 'permission' });
    expect(toSafeCommunicationTemplateError({ message: 'Шаблон содержит неизвестную или некорректную переменную.' })).toMatchObject({ code: 'invalid_template' });
    expect(toSafeCommunicationTemplateError({ message: 'Для формирования сообщения не хватает обязательных данных.' })).toMatchObject({ code: 'missing_variable' });
    expect(toSafeCommunicationTemplateError({ message: 'Опубликованную версию нельзя изменить.' })).toMatchObject({ code: 'published_immutable' });
    expect(toSafeCommunicationTemplateError({ message: '40001' })).toMatchObject({ code: 'stale' });
    expect(toSafeCommunicationTemplateError({ message: '23505' })).toMatchObject({ code: 'conflict' });
    expect(toSafeCommunicationTemplateError({ message: 'internal SQL stack trace' }))
      .toEqual(new CommunicationTemplateRepositoryError('save_failed'));
  });

  it('has no direct table writes or provider path', () => {
    expect(repositorySource).not.toMatch(/\.insert\s*\(|\.update\s*\(|\.delete\s*\(/);
    expect(repositorySource).not.toMatch(/fetch\s*\(|axios|twilio|smtp|amocrm|whatsapp.*api|service[_-]?role/i);
  });
});

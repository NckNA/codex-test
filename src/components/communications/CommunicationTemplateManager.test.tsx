/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCommunicationTemplates } from '../../data/hooks/useCommunicationTemplates';
import { CommunicationTemplateManager } from './CommunicationTemplateManager';

vi.mock('../../data/hooks/useCommunicationTemplates', () => ({ useCommunicationTemplates: vi.fn() }));

const version = {
  id: 'version-a', tenantId: 'tenant-a', templateId: 'template-a', versionNumber: 2, status: 'draft',
  subject: undefined, body: 'Здравствуйте, {{patient_first_name}}', variableKeys: ['patient_first_name'],
  contentFingerprint: 'a'.repeat(64), createdAt: 'now', updatedAt: 'version-time',
};
const template = {
  id: 'template-a', tenantId: 'tenant-a', purposeCode: 'appointment_confirmation_request', channel: 'sms', language: 'ru',
  displayName: 'RU SMS', status: 'active', activeVersionId: 'version-old',
  activeVersion: { ...version, id: 'version-old', versionNumber: 1, status: 'published', publishedAt: 'now' },
  draftVersion: version, createdAt: 'now', updatedAt: 'template-time',
};
const preview = {
  templateId: 'template-a', versionId: 'version-a', versionNumber: 2,
  purposeCode: 'appointment_confirmation_request', channel: 'sms', language: 'ru', contentFingerprint: 'a'.repeat(64),
  rendered: { body: 'Здравствуйте, Айгүл', renderedCharacterCount: 19, renderedFingerprint: 'b'.repeat(64), variableKeys: ['patient_first_name'], warnings: [] },
};
const makeHook = (overrides: Record<string, unknown> = {}) => ({
  templates: [template], selectedTemplate: template, draft: version, preview: null,
  loading: false, saving: false, publishing: false, archiving: false, error: null,
  canRead: true, canManage: true,
  refresh: vi.fn(), selectTemplate: vi.fn(), createTemplate: vi.fn(), createDraft: vi.fn(),
  updateDraft: vi.fn().mockResolvedValue({ template, version, replayed: false }),
  publishDraft: vi.fn().mockResolvedValue({ template, version, replayed: false }),
  archiveTemplate: vi.fn().mockResolvedValue({ template, replayed: false }),
  previewDraft: vi.fn().mockResolvedValue(preview), clearError: vi.fn(), ...overrides,
});
const mount = async () => {
  const container = document.createElement('div'); document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(<CommunicationTemplateManager />); });
  return { container, root };
};

describe('CommunicationTemplateManager', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(useCommunicationTemplates).mockReturnValue(makeHook() as any); });

  it('shows foundation warnings and no send action', async () => {
    const { container, root } = await mount();
    expect(container.textContent).toContain('Опубликованная версия неизменяема');
    expect(container.textContent).toContain('Шаблон не отправляет сообщения сам по себе');
    expect(container.textContent).toContain('Используйте только разрешённые переменные');
    expect(container.textContent).not.toContain('Отправить сообщение');
    await act(async () => root.unmount()); container.remove();
  });

  it('shows allowed variables and writable owner/admin editor', async () => {
    const { container, root } = await mount();
    expect(container.textContent).toContain('{{patient_first_name}}');
    expect(container.textContent).toContain('{{appointment_time}}');
    expect((container.querySelector('[data-testid="template-body-editor"]') as HTMLTextAreaElement).readOnly).toBe(false);
    expect(container.querySelector('[data-testid="publish-template"]')).not.toBeNull();
    await act(async () => root.unmount()); container.remove();
  });

  it('shows live invalid-placeholder warning and disables publish', async () => {
    const invalidVersion = { ...version, body: 'Диагноз {{diagnosis}}' };
    const invalidTemplate = { ...template, draftVersion: invalidVersion };
    vi.mocked(useCommunicationTemplates).mockReturnValue(makeHook({
      templates: [invalidTemplate], selectedTemplate: invalidTemplate, draft: invalidVersion,
    }) as any);
    const { container, root } = await mount();
    expect(container.querySelector('[data-testid="template-validation-error"]')?.textContent).toContain('запрещённую');
    expect((container.querySelector('[data-testid="publish-template"]') as HTMLButtonElement).disabled).toBe(true);
    await act(async () => root.unmount()); container.remove();
  });

  it('keeps registrar read-only with no mutation controls', async () => {
    vi.mocked(useCommunicationTemplates).mockReturnValue(makeHook({ canManage: false }) as any);
    const { container, root } = await mount();
    expect(container.querySelector('[data-testid="template-create-panel"]')).toBeNull();
    expect(container.querySelector('[data-testid="save-template-draft"]')).toBeNull();
    expect(container.querySelector('[data-testid="publish-template"]')).toBeNull();
    expect(container.querySelector('[data-testid="archive-template"]')).toBeNull();
    expect((container.querySelector('[data-testid="template-body-editor"]') as HTMLTextAreaElement).readOnly).toBe(true);
    expect(container.querySelector('[data-testid="preview-template"]')).not.toBeNull();
    await act(async () => root.unmount()); container.remove();
  });

  it('shows preview and exact rendered text', async () => {
    vi.mocked(useCommunicationTemplates).mockReturnValue(makeHook({ preview }) as any);
    const { container, root } = await mount();
    expect(container.querySelector('[data-testid="template-preview"]')?.textContent).toContain('Здравствуйте, Айгүл');
    expect(container.textContent).toContain('fingerprint');
    await act(async () => root.unmount()); container.remove();
  });
});

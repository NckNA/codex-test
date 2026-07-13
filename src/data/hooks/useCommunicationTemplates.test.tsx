/* eslint-disable @typescript-eslint/no-explicit-any */
// @vitest-environment jsdom
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { createCommunicationTemplateRepository } from '../repositories/CommunicationTemplateRepository';
import { useCommunicationTemplates } from './useCommunicationTemplates';

vi.mock('../../lib/supabaseClient', () => ({ isSupabaseConfigured: true, supabase: {} }));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../contexts/TenantContext', () => ({ useTenant: vi.fn() }));
vi.mock('../repositories/CommunicationTemplateRepository', async () => {
  const actual = await vi.importActual('../repositories/CommunicationTemplateRepository');
  return { ...actual as object, createCommunicationTemplateRepository: vi.fn() };
});

const tenantA = '11111111-1111-4111-8111-111111111111';
const tenantB = '22222222-2222-4222-8222-222222222222';
const version = {
  id: 'version-a', tenantId: tenantA, templateId: 'template-a', versionNumber: 1, status: 'draft' as const,
  body: 'Привет, {{patient_first_name}}', variableKeys: ['patient_first_name' as const],
  contentFingerprint: 'a'.repeat(64), createdAt: 'now', updatedAt: 'version-time',
};
const template = {
  id: 'template-a', tenantId: tenantA, purposeCode: 'appointment_confirmation_request' as const,
  channel: 'sms' as const, language: 'ru' as const, displayName: 'RU SMS', status: 'inactive' as const,
  draftVersion: version, createdAt: 'now', updatedAt: 'template-time',
};
const makeRepository = () => ({
  listTemplates: vi.fn().mockResolvedValue([template]),
  getTemplate: vi.fn().mockResolvedValue(template),
  getActiveTemplate: vi.fn().mockResolvedValue(null),
  createTemplate: vi.fn().mockResolvedValue({ template, version, replayed: false }),
  createDraft: vi.fn().mockResolvedValue({ template, version, replayed: false }),
  updateDraft: vi.fn().mockResolvedValue({ template, version, replayed: false }),
  publishVersion: vi.fn().mockResolvedValue({ template: { ...template, status: 'active' }, version: { ...version, status: 'published' }, replayed: false }),
  archiveTemplate: vi.fn().mockResolvedValue({ template: { ...template, status: 'archived' }, replayed: false }),
  previewTemplate: vi.fn().mockResolvedValue({
    templateId: template.id, versionId: version.id, versionNumber: 1,
    purposeCode: template.purposeCode, channel: template.channel, language: template.language,
    contentFingerprint: version.contentFingerprint,
    rendered: { body: 'Привет, Айгүл', renderedCharacterCount: 13, renderedFingerprint: 'b'.repeat(64), variableKeys: ['patient_first_name'], warnings: [] },
  }),
});

describe('useCommunicationTemplates', () => {
  let authState: any;
  let tenantState: any;
  let repository: ReturnType<typeof makeRepository>;
  let current: ReturnType<typeof useCommunicationTemplates> | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    authState = { authMode: 'supabase-active', user: { id: 'user-a' } };
    tenantState = { activeTenant: { tenantId: tenantA, role: 'clinic_admin' } };
    repository = makeRepository();
    vi.mocked(useAuth).mockImplementation(() => authState);
    vi.mocked(useTenant).mockImplementation(() => tenantState);
    vi.mocked(createCommunicationTemplateRepository).mockReturnValue(repository as any);
  });

  const mount = async () => {
    const container = document.createElement('div');
    const root = createRoot(container);
    const Harness = ({ tick = 0 }: { tick?: number }) => { void tick; current = useCommunicationTemplates(); return null; };
    await act(async () => { root.render(<Harness />); });
    return { root, Harness };
  };

  it('does not fetch without a tenant', async () => {
    tenantState = { activeTenant: null };
    const { root } = await mount();
    expect(createCommunicationTemplateRepository).not.toHaveBeenCalled();
    expect(current?.templates).toEqual([]);
    await act(async () => root.unmount());
  });

  it('loads templates and keeps registrar read-only', async () => {
    tenantState.activeTenant.role = 'registrar';
    const { root } = await mount();
    expect(repository.listTemplates).toHaveBeenCalledTimes(1);
    expect(current).toMatchObject({ canRead: true, canManage: false });
    await expect(current!.createDraft(template)).rejects.toMatchObject({ code: 'permission' });
    await act(async () => root.unmount());
  });

  it('updates, previews and publishes a draft', async () => {
    const { root } = await mount();
    await act(async () => { await current!.updateDraft(template, undefined, 'Новый текст'); });
    expect(repository.updateDraft).toHaveBeenCalledWith(expect.objectContaining({ versionId: version.id, expectedUpdatedAt: 'version-time' }));
    await act(async () => { await current!.previewDraft(version, { patient_first_name: 'Айгүл' }); });
    expect(current?.preview?.rendered.body).toBe('Привет, Айгүл');
    await act(async () => { await current!.publishDraft(template); });
    expect(repository.publishVersion).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('blocks duplicate publish while request is active', async () => {
    let resolve!: (value: any) => void;
    repository.publishVersion.mockReturnValueOnce(new Promise((res) => { resolve = res; }));
    const { root } = await mount();
    let first!: Promise<any>;
    await act(async () => { first = current!.publishDraft(template); });
    await expect(current!.publishDraft(template)).rejects.toMatchObject({ code: 'conflict' });
    await act(async () => { resolve({ template, version, replayed: false }); await first; });
    expect(repository.publishVersion).toHaveBeenCalledTimes(1);
    await act(async () => root.unmount());
  });

  it('clears tenant A state and ignores its late response after tenant switch', async () => {
    let resolveA!: (value: any) => void;
    const repoA = { ...makeRepository(), listTemplates: vi.fn(() => new Promise((res) => { resolveA = res; })) };
    const templateB = { ...template, id: 'template-b', tenantId: tenantB };
    const repoB = { ...makeRepository(), listTemplates: vi.fn().mockResolvedValue([templateB]) };
    vi.mocked(createCommunicationTemplateRepository).mockImplementation(({ tenantId }) => (tenantId === tenantA ? repoA : repoB) as any);
    const { root, Harness } = await mount();
    tenantState = { activeTenant: { tenantId: tenantB, role: 'clinic_admin' } };
    await act(async () => { root.render(<Harness tick={1} />); await Promise.resolve(); });
    expect(current?.templates[0]?.id).toBe('template-b');
    await act(async () => { resolveA([template]); });
    expect(current?.templates[0]?.id).toBe('template-b');
    await act(async () => root.unmount());
  });
});

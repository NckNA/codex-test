import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useTenant } from '../../contexts/TenantContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import type { CommunicationChannel, CommunicationLanguage, CommunicationPurpose } from '../../domain/communications/CommunicationCommand';
import type { CommunicationTemplate, CommunicationTemplateVersion } from '../../domain/communications/CommunicationTemplate';
import {
  CommunicationTemplateRepositoryError,
  createCommunicationTemplateRepository,
  type CommunicationTemplateFilters,
  type CommunicationTemplateMutationResult,
  type CommunicationTemplatePreview,
  type CommunicationTemplateRepository,
} from '../repositories/CommunicationTemplateRepository';

const READ_ROLES = new Set(['clinic_owner', 'clinic_admin', 'registrar']);
const MANAGE_ROLES = new Set(['clinic_owner', 'clinic_admin']);

const operationKey = (kind: string, id: string): string => {
  const random = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `communication-template-${kind}-${id}-${random}`;
};

export interface CreateTemplateDraftInput {
  purposeCode: CommunicationPurpose;
  channel: CommunicationChannel;
  language: CommunicationLanguage;
  displayName: string;
  subject?: string;
  body: string;
}

export interface UseCommunicationTemplatesResult {
  templates: CommunicationTemplate[];
  selectedTemplate: CommunicationTemplate | null;
  draft: CommunicationTemplateVersion | null;
  preview: CommunicationTemplatePreview | null;
  loading: boolean;
  saving: boolean;
  publishing: boolean;
  archiving: boolean;
  error: string | null;
  canRead: boolean;
  canManage: boolean;
  refresh: (filters?: CommunicationTemplateFilters) => Promise<void>;
  selectTemplate: (templateId: string | null) => void;
  createTemplate: (input: CreateTemplateDraftInput) => Promise<CommunicationTemplateMutationResult>;
  createDraft: (template: CommunicationTemplate) => Promise<CommunicationTemplateMutationResult>;
  updateDraft: (template: CommunicationTemplate, subject: string | undefined, body: string) => Promise<CommunicationTemplateMutationResult>;
  publishDraft: (template: CommunicationTemplate) => Promise<CommunicationTemplateMutationResult>;
  archiveTemplate: (template: CommunicationTemplate) => Promise<CommunicationTemplateMutationResult>;
  previewDraft: (version: CommunicationTemplateVersion, variables: Record<string, string>) => Promise<CommunicationTemplatePreview>;
  clearError: () => void;
}

export function useCommunicationTemplates(): UseCommunicationTemplatesResult {
  const { authMode, user } = useAuth();
  const { activeTenant } = useTenant();
  const tenantId = activeTenant?.tenantId;
  const role = activeTenant?.role;
  const canRead = authMode === 'dev' || READ_ROLES.has(role ?? '');
  const canManage = authMode === 'dev' || MANAGE_ROLES.has(role ?? '');
  const isSupabaseMode = authMode === 'supabase-active' && isSupabaseConfigured;

  const repository = useMemo<CommunicationTemplateRepository | null>(() => {
    if (!tenantId || !user?.id || !isSupabaseMode || !canRead) return null;
    return createCommunicationTemplateRepository({ tenantId });
  }, [canRead, isSupabaseMode, tenantId, user?.id]);

  const [templates, setTemplates] = useState<CommunicationTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<CommunicationTemplatePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequence = useRef(0);
  const busy = useRef(new Set<string>());

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedId) ?? null,
    [selectedId, templates],
  );
  const draft = selectedTemplate?.draftVersion ?? null;

  const refresh = useCallback(async (filters: CommunicationTemplateFilters = {}): Promise<void> => {
    const request = ++sequence.current;
    if (!repository || !tenantId || !canRead) {
      setTemplates([]);
      setSelectedId(null);
      setPreview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const next = await repository.listTemplates(filters);
      if (request !== sequence.current) return;
      setTemplates(next);
      setSelectedId((current) => current && next.some((item) => item.id === current)
        ? current : next[0]?.id ?? null);
    } catch (cause) {
      if (request !== sequence.current) return;
      setError(cause instanceof Error ? cause.message : 'Не удалось загрузить шаблоны.');
      setTemplates([]);
      setSelectedId(null);
    } finally {
      if (request === sequence.current) setLoading(false);
    }
  }, [canRead, repository, tenantId]);

  useEffect(() => {
    const request = ++sequence.current;
    busy.current.clear();
    void Promise.resolve().then(() => {
      if (request !== sequence.current) return;
      setTemplates([]);
      setSelectedId(null);
      setPreview(null);
      setError(null);
      return refresh();
    });
  }, [refresh, tenantId]);

  const applyResult = useCallback(async (result: CommunicationTemplateMutationResult) => {
    await refresh();
    setSelectedId(result.template.id);
    return result;
  }, [refresh]);

  const assertManage = useCallback(() => {
    if (!repository || !tenantId || !canManage) throw new CommunicationTemplateRepositoryError('permission');
  }, [canManage, repository, tenantId]);

  const createTemplate = useCallback(async (input: CreateTemplateDraftInput) => {
    assertManage();
    setSaving(true);
    setError(null);
    try {
      const result = await repository!.createTemplate({
        ...input,
        operationKey: operationKey('create', `${input.purposeCode}-${input.channel}-${input.language}`),
      });
      return await applyResult(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить шаблон.');
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [applyResult, assertManage, repository]);

  const createDraft = useCallback(async (template: CommunicationTemplate) => {
    assertManage();
    setSaving(true);
    setError(null);
    try {
      const result = await repository!.createDraft(template.id, operationKey('draft', template.id));
      return await applyResult(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить шаблон.');
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [applyResult, assertManage, repository]);

  const updateDraft = useCallback(async (
    template: CommunicationTemplate,
    subject: string | undefined,
    body: string,
  ) => {
    assertManage();
    const currentDraft = template.draftVersion;
    if (!currentDraft) throw new CommunicationTemplateRepositoryError('not_found');
    setSaving(true);
    setError(null);
    try {
      const result = await repository!.updateDraft({
        versionId: currentDraft.id,
        subject,
        body,
        expectedUpdatedAt: currentDraft.updatedAt,
        operationKey: operationKey('update', currentDraft.id),
      });
      return await applyResult(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить шаблон.');
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [applyResult, assertManage, repository]);

  const publishDraft = useCallback(async (template: CommunicationTemplate) => {
    assertManage();
    const currentDraft = template.draftVersion;
    if (!currentDraft) throw new CommunicationTemplateRepositoryError('not_found');
    const slot = `publish:${template.id}`;
    if (busy.current.has(slot)) throw new CommunicationTemplateRepositoryError('conflict');
    busy.current.add(slot);
    setPublishing(true);
    setError(null);
    try {
      const result = await repository!.publishVersion(
        template.id,
        currentDraft.id,
        currentDraft.updatedAt,
        operationKey('publish', currentDraft.id),
      );
      return await applyResult(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить шаблон.');
      throw cause;
    } finally {
      busy.current.delete(slot);
      setPublishing(false);
    }
  }, [applyResult, assertManage, repository]);

  const archiveTemplate = useCallback(async (template: CommunicationTemplate) => {
    assertManage();
    setArchiving(true);
    setError(null);
    try {
      const result = await repository!.archiveTemplate(
        template.id,
        template.updatedAt,
        operationKey('archive', template.id),
      );
      setPreview(null);
      return await applyResult(result);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить шаблон.');
      throw cause;
    } finally {
      setArchiving(false);
    }
  }, [applyResult, assertManage, repository]);

  const previewDraft = useCallback(async (
    version: CommunicationTemplateVersion,
    variables: Record<string, string>,
  ) => {
    if (!repository || !tenantId || !canRead) throw new CommunicationTemplateRepositoryError('permission');
    setError(null);
    try {
      const result = await repository.previewTemplate(version.id, variables);
      setPreview(result);
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось сохранить шаблон.');
      throw cause;
    }
  }, [canRead, repository, tenantId]);

  return {
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
    refresh,
    selectTemplate: (templateId) => {
      setSelectedId(templateId);
      setPreview(null);
    },
    createTemplate,
    createDraft,
    updateDraft,
    publishDraft,
    archiveTemplate,
    previewDraft,
    clearError: () => setError(null),
  };
}

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import type { CommunicationChannel, CommunicationLanguage, CommunicationPurpose } from '../../domain/communications/CommunicationCommand';
import type {
  CommunicationTemplate,
  CommunicationTemplateVersion,
  CommunicationTemplateVariable,
} from '../../domain/communications/CommunicationTemplate';

type Row = Record<string, unknown>;

export interface CommunicationTemplateFilters {
  purposeCode?: CommunicationPurpose;
  channel?: CommunicationChannel;
  language?: CommunicationLanguage;
}

export interface CreateCommunicationTemplateInput {
  purposeCode: CommunicationPurpose;
  channel: CommunicationChannel;
  language: CommunicationLanguage;
  displayName: string;
  subject?: string;
  body: string;
  operationKey: string;
}

export interface UpdateCommunicationTemplateDraftInput {
  versionId: string;
  subject?: string;
  body: string;
  expectedUpdatedAt: string;
  operationKey: string;
}

export interface CommunicationTemplateMutationResult {
  template: CommunicationTemplate;
  version?: CommunicationTemplateVersion;
  supersededVersion?: CommunicationTemplateVersion;
  replayed: boolean;
}

export interface CommunicationTemplatePreview {
  templateId: string;
  versionId: string;
  versionNumber: number;
  purposeCode: CommunicationPurpose;
  channel: CommunicationChannel;
  language: CommunicationLanguage;
  contentFingerprint: string;
  rendered: {
    subject?: string;
    body: string;
    renderedCharacterCount: number;
    renderedFingerprint: string;
    variableKeys: CommunicationTemplateVariable[];
    warnings: string[];
  };
}

export type CommunicationTemplateRepositoryErrorCode =
  | 'permission'
  | 'invalid_template'
  | 'missing_variable'
  | 'published_immutable'
  | 'stale'
  | 'conflict'
  | 'not_found'
  | 'read_failed'
  | 'save_failed';

const SAFE_MESSAGES: Record<CommunicationTemplateRepositoryErrorCode, string> = {
  permission: 'Недостаточно прав для управления шаблонами.',
  invalid_template: 'Шаблон содержит неизвестную или некорректную переменную.',
  missing_variable: 'Для формирования сообщения не хватает обязательных данных.',
  published_immutable: 'Опубликованную версию нельзя изменить. Создайте новую версию.',
  stale: 'Черновик был изменён другим пользователем. Обновите данные.',
  conflict: 'Операция уже выполнена с другими параметрами.',
  not_found: 'Шаблон не найден.',
  read_failed: 'Не удалось загрузить шаблоны.',
  save_failed: 'Не удалось сохранить шаблон.',
};

export class CommunicationTemplateRepositoryError extends Error {
  readonly code: CommunicationTemplateRepositoryErrorCode;

  constructor(code: CommunicationTemplateRepositoryErrorCode, message = SAFE_MESSAGES[code]) {
    super(message);
    this.name = 'CommunicationTemplateRepositoryError';
    this.code = code;
  }
}

const value = (row: Row, camel: string, snake: string): unknown => row[camel] ?? row[snake];
const optionalString = (item: unknown): string | undefined => {
  const normalized = String(item ?? '');
  return normalized || undefined;
};

export function mapCommunicationTemplateVersion(row: Row): CommunicationTemplateVersion {
  return {
    id: String(value(row, 'id', 'id')),
    tenantId: String(value(row, 'tenantId', 'tenant_id')),
    templateId: String(value(row, 'templateId', 'template_id')),
    versionNumber: Number(value(row, 'versionNumber', 'version_number')),
    status: value(row, 'status', 'status') as CommunicationTemplateVersion['status'],
    subject: optionalString(value(row, 'subject', 'subject')),
    body: String(value(row, 'body', 'body') ?? ''),
    variableKeys: (value(row, 'variableKeys', 'variable_keys') ?? []) as CommunicationTemplateVariable[],
    contentFingerprint: String(value(row, 'contentFingerprint', 'content_fingerprint') ?? ''),
    createdBy: optionalString(value(row, 'createdBy', 'created_by')),
    createdAt: String(value(row, 'createdAt', 'created_at') ?? ''),
    updatedAt: String(value(row, 'updatedAt', 'updated_at') ?? ''),
    publishedBy: optionalString(value(row, 'publishedBy', 'published_by')),
    publishedAt: optionalString(value(row, 'publishedAt', 'published_at')),
    archivedAt: optionalString(value(row, 'archivedAt', 'archived_at')),
    supersedesVersionId: optionalString(value(row, 'supersedesVersionId', 'supersedes_version_id')),
  };
}

export function mapCommunicationTemplate(row: Row): CommunicationTemplate {
  const active = value(row, 'activeVersion', 'active_version') as Row | null | undefined;
  const draft = value(row, 'draftVersion', 'draft_version') as Row | null | undefined;
  return {
    id: String(value(row, 'id', 'id')),
    tenantId: String(value(row, 'tenantId', 'tenant_id')),
    purposeCode: value(row, 'purposeCode', 'purpose_code') as CommunicationPurpose,
    channel: value(row, 'channel', 'channel') as CommunicationChannel,
    language: value(row, 'language', 'language') as CommunicationLanguage,
    displayName: String(value(row, 'displayName', 'display_name') ?? ''),
    status: value(row, 'status', 'status') as CommunicationTemplate['status'],
    activeVersionId: optionalString(value(row, 'activeVersionId', 'active_version_id')),
    activeVersion: active ? mapCommunicationTemplateVersion(active) : undefined,
    draftVersion: draft ? mapCommunicationTemplateVersion(draft) : undefined,
    createdAt: String(value(row, 'createdAt', 'created_at') ?? ''),
    updatedAt: String(value(row, 'updatedAt', 'updated_at') ?? ''),
    archivedAt: optionalString(value(row, 'archivedAt', 'archived_at')),
  };
}

const object = (data: unknown): Row => (
  data && typeof data === 'object' && !Array.isArray(data) ? data as Row : {}
);

export function toSafeCommunicationTemplateError(
  error: unknown,
  context: 'read' | 'write' = 'write',
): CommunicationTemplateRepositoryError {
  if (error instanceof CommunicationTemplateRepositoryError) return error;
  const row = error && typeof error === 'object' ? error as Row : {};
  const normalized = [row.message, row.details, row.hint, row.code, error]
    .map((item) => String(item ?? '')).join(' ').toLowerCase();
  if (normalized.includes('недостаточно прав') || normalized.includes('42501') || normalized.includes('permission denied')) {
    return new CommunicationTemplateRepositoryError('permission');
  }
  if (normalized.includes('неизвестную или некорректную') || normalized.includes('запрещённую клиническую')
    || normalized.includes('тема разрешена') || normalized.includes('требуется тема') || normalized.includes('превышает допустимую')) {
    return new CommunicationTemplateRepositoryError('invalid_template');
  }
  if (normalized.includes('не хватает обязательных данных')) return new CommunicationTemplateRepositoryError('missing_variable');
  if (normalized.includes('опубликованную версию')) return new CommunicationTemplateRepositoryError('published_immutable');
  if (normalized.includes('изменён другим пользователем') || normalized.includes('40001')) {
    return new CommunicationTemplateRepositoryError('stale');
  }
  if (normalized.includes('другими параметрами') || normalized.includes('уже существует') || normalized.includes('23505')) {
    return new CommunicationTemplateRepositoryError('conflict');
  }
  if (normalized.includes('не найден') || normalized.includes('p0002')) return new CommunicationTemplateRepositoryError('not_found');
  return new CommunicationTemplateRepositoryError(context === 'read' ? 'read_failed' : 'save_failed');
}

export interface CommunicationTemplateRepository {
  listTemplates(filters?: CommunicationTemplateFilters): Promise<CommunicationTemplate[]>;
  getTemplate(templateId: string): Promise<CommunicationTemplate | null>;
  getActiveTemplate(purpose: CommunicationPurpose, channel: CommunicationChannel, language: CommunicationLanguage): Promise<CommunicationTemplateMutationResult | null>;
  createTemplate(input: CreateCommunicationTemplateInput): Promise<CommunicationTemplateMutationResult>;
  createDraft(templateId: string, operationKey: string): Promise<CommunicationTemplateMutationResult>;
  updateDraft(input: UpdateCommunicationTemplateDraftInput): Promise<CommunicationTemplateMutationResult>;
  publishVersion(templateId: string, draftVersionId: string, expectedUpdatedAt: string, operationKey: string): Promise<CommunicationTemplateMutationResult>;
  archiveTemplate(templateId: string, expectedUpdatedAt: string, operationKey: string): Promise<CommunicationTemplateMutationResult>;
  previewTemplate(versionId: string, variables: Record<string, string>): Promise<CommunicationTemplatePreview>;
}

export class SupabaseCommunicationTemplateRepository implements CommunicationTemplateRepository {
  private readonly tenantId: string;
  private readonly client: SupabaseClient;

  constructor(tenantId: string, client: SupabaseClient) {
    this.tenantId = tenantId;
    this.client = client;
  }

  async listTemplates(filters: CommunicationTemplateFilters = {}): Promise<CommunicationTemplate[]> {
    try {
      const { data, error } = await this.client.rpc('list_communication_templates', {
        p_tenant_id: this.tenantId,
        p_purpose_code: filters.purposeCode ?? null,
        p_channel: filters.channel ?? null,
        p_language: filters.language ?? null,
      });
      if (error) throw error;
      return (Array.isArray(data) ? data : []).map((row) => mapCommunicationTemplate(row as Row));
    } catch (error) {
      throw toSafeCommunicationTemplateError(error, 'read');
    }
  }

  async getTemplate(templateId: string): Promise<CommunicationTemplate | null> {
    try {
      const { data, error } = await this.client.rpc('get_communication_template', {
        p_tenant_id: this.tenantId,
        p_template_id: templateId,
      });
      if (error) throw error;
      return data ? mapCommunicationTemplate(object(data)) : null;
    } catch (error) {
      throw toSafeCommunicationTemplateError(error, 'read');
    }
  }

  async getActiveTemplate(
    purpose: CommunicationPurpose,
    channel: CommunicationChannel,
    language: CommunicationLanguage,
  ): Promise<CommunicationTemplateMutationResult | null> {
    try {
      const { data, error } = await this.client.rpc('get_active_communication_template', {
        p_tenant_id: this.tenantId,
        p_purpose_code: purpose,
        p_channel: channel,
        p_language: language,
      });
      if (error) throw error;
      if (!data) return null;
      const result = object(data);
      return {
        template: mapCommunicationTemplate(object(result.template)),
        version: mapCommunicationTemplateVersion(object(result.version)),
        replayed: false,
      };
    } catch (error) {
      throw toSafeCommunicationTemplateError(error, 'read');
    }
  }

  private async mutation(name: string, params: Row): Promise<CommunicationTemplateMutationResult> {
    try {
      const { data, error } = await this.client.rpc(name, params);
      if (error) throw error;
      const result = object(data);
      return {
        template: mapCommunicationTemplate(object(result.template)),
        version: result.version ? mapCommunicationTemplateVersion(object(result.version)) : undefined,
        supersededVersion: result.supersededVersion
          ? mapCommunicationTemplateVersion(object(result.supersededVersion)) : undefined,
        replayed: Boolean(result.replayed),
      };
    } catch (error) {
      throw toSafeCommunicationTemplateError(error);
    }
  }

  createTemplate(input: CreateCommunicationTemplateInput): Promise<CommunicationTemplateMutationResult> {
    return this.mutation('create_communication_template', {
      p_tenant_id: this.tenantId,
      p_purpose_code: input.purposeCode,
      p_channel: input.channel,
      p_language: input.language,
      p_display_name: input.displayName,
      p_subject: input.subject ?? null,
      p_body: input.body,
      p_operation_key: input.operationKey,
    });
  }

  createDraft(templateId: string, operationKey: string): Promise<CommunicationTemplateMutationResult> {
    return this.mutation('create_communication_template_draft', {
      p_tenant_id: this.tenantId,
      p_template_id: templateId,
      p_operation_key: operationKey,
    });
  }

  updateDraft(input: UpdateCommunicationTemplateDraftInput): Promise<CommunicationTemplateMutationResult> {
    return this.mutation('update_communication_template_draft', {
      p_tenant_id: this.tenantId,
      p_version_id: input.versionId,
      p_subject: input.subject ?? null,
      p_body: input.body,
      p_expected_updated_at: input.expectedUpdatedAt,
      p_operation_key: input.operationKey,
    });
  }

  publishVersion(templateId: string, draftVersionId: string, expectedUpdatedAt: string, operationKey: string): Promise<CommunicationTemplateMutationResult> {
    return this.mutation('publish_communication_template_version', {
      p_tenant_id: this.tenantId,
      p_template_id: templateId,
      p_draft_version_id: draftVersionId,
      p_expected_draft_updated_at: expectedUpdatedAt,
      p_operation_key: operationKey,
    });
  }

  archiveTemplate(templateId: string, expectedUpdatedAt: string, operationKey: string): Promise<CommunicationTemplateMutationResult> {
    return this.mutation('archive_communication_template', {
      p_tenant_id: this.tenantId,
      p_template_id: templateId,
      p_expected_updated_at: expectedUpdatedAt,
      p_operation_key: operationKey,
    });
  }

  async previewTemplate(versionId: string, variables: Record<string, string>): Promise<CommunicationTemplatePreview> {
    try {
      const { data, error } = await this.client.rpc('preview_communication_template', {
        p_tenant_id: this.tenantId,
        p_version_id: versionId,
        p_variables: variables,
      });
      if (error) throw error;
      const result = object(data);
      const rendered = object(result.rendered);
      return {
        templateId: String(result.templateId ?? ''),
        versionId: String(result.versionId ?? ''),
        versionNumber: Number(result.versionNumber ?? 0),
        purposeCode: result.purposeCode as CommunicationPurpose,
        channel: result.channel as CommunicationChannel,
        language: result.language as CommunicationLanguage,
        contentFingerprint: String(result.contentFingerprint ?? ''),
        rendered: {
          subject: optionalString(rendered.subject),
          body: String(rendered.body ?? ''),
          renderedCharacterCount: Number(rendered.renderedCharacterCount ?? 0),
          renderedFingerprint: String(rendered.renderedFingerprint ?? ''),
          variableKeys: (rendered.variableKeys ?? []) as CommunicationTemplateVariable[],
          warnings: (rendered.warnings ?? []) as string[],
        },
      };
    } catch (error) {
      throw toSafeCommunicationTemplateError(error);
    }
  }
}

export function createCommunicationTemplateRepository(options: {
  tenantId: string;
  client?: SupabaseClient | null;
}): CommunicationTemplateRepository {
  const client = options.client ?? supabase;
  if (!client) throw new CommunicationTemplateRepositoryError('read_failed');
  return new SupabaseCommunicationTemplateRepository(options.tenantId, client);
}

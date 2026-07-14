import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { mapAmoCrmHealth, type AmoCrmHealth } from '../../domain/integrations/amocrm/AmoCrmHealth';
import {
  AmoCrmIntegrationError,
  toSafeAmoCrmError,
} from '../../domain/integrations/amocrm/AmoCrmIntegration';

export interface AmoCrmConnectionStartResult {
  authorizationUrl: string;
  expiresAt: string;
  integrationAccountId: string;
  status: string;
}

export interface AmoCrmExternalReference {
  id: string;
  entityType: string;
  internalEntityId: string;
  externalEntityId: string;
  externalParentId?: string;
  version: number;
}

export interface CreateAmoCrmExternalReferenceInput {
  entityType: 'contact' | 'lead' | 'deal' | 'task' | 'note' | 'message' | 'conversation';
  internalEntityId: string;
  externalEntityId: string;
  externalParentId?: string;
}

export interface AmoCrmIntegrationRepositoryContract {
  getAmoCrmIntegrationHealth(): Promise<AmoCrmHealth>;
  startAmoCrmConnection(): Promise<AmoCrmConnectionStartResult>;
  disconnectAmoCrmConnection(): Promise<AmoCrmHealth>;
  reconnectAmoCrmConnection(): Promise<AmoCrmConnectionStartResult>;
  requestAmoCrmHealthRefresh(): Promise<AmoCrmHealth>;
  listExternalReferences(entityType?: string): Promise<AmoCrmExternalReference[]>;
  createExternalReference(input: CreateAmoCrmExternalReferenceInput): Promise<AmoCrmExternalReference>;
  archiveExternalReference(referenceId: string): Promise<{ id: string; archived: boolean; version: number }>;
}

type FetchLike = typeof fetch;
type TokenProvider = () => Promise<string>;

async function defaultTokenProvider(client: SupabaseClient | null): Promise<string> {
  if (!client) throw new AmoCrmIntegrationError('authentication_required');
  const { data, error } = await client.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new AmoCrmIntegrationError('authentication_required');
  }
  return data.session.access_token;
}

function mapExternalReference(row: unknown): AmoCrmExternalReference {
  const item = row && typeof row === 'object' ? row as Record<string, unknown> : {};
  return {
    id: String(item.id ?? ''),
    entityType: String(item.entityType ?? item.entity_type ?? ''),
    internalEntityId: String(item.internalEntityId ?? item.internal_entity_id ?? ''),
    externalEntityId: String(item.externalEntityId ?? item.external_entity_id ?? ''),
    externalParentId: item.externalParentId || item.external_parent_id
      ? String(item.externalParentId ?? item.external_parent_id)
      : undefined,
    version: Number(item.version ?? 1),
  };
}

export class AmoCrmIntegrationRepository implements AmoCrmIntegrationRepositoryContract {
  private readonly tenantId: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly tokenProvider: TokenProvider;

  constructor(
    tenantId: string,
    options: {
      baseUrl?: string;
      fetchImpl?: FetchLike;
      tokenProvider?: TokenProvider;
      client?: SupabaseClient | null;
    } = {},
  ) {
    this.tenantId = tenantId;
    this.baseUrl = (options.baseUrl ?? import.meta.env.VITE_INTEGRATION_API_URL ?? 'http://localhost:4000')
      .replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    const client = options.client === undefined ? supabase : options.client;
    this.tokenProvider = options.tokenProvider ?? (() => defaultTokenProvider(client));
  }

  private async request(path: string, init: RequestInit = {}): Promise<unknown> {
    if (!this.tenantId) throw new AmoCrmIntegrationError('permission');
    try {
      const accessToken = await this.tokenProvider();
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Tenant-Id': this.tenantId,
          'Content-Type': 'application/json',
          ...(init.headers ?? {}),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw payload;
      return payload;
    } catch (error) {
      throw toSafeAmoCrmError(error);
    }
  }

  async getAmoCrmIntegrationHealth(): Promise<AmoCrmHealth> {
    return mapAmoCrmHealth(await this.request('/api/integrations/amocrm/status'));
  }

  async startAmoCrmConnection(): Promise<AmoCrmConnectionStartResult> {
    const row = await this.request('/api/integrations/amocrm/connect', {
      method: 'POST',
      body: '{}',
    }) as Record<string, unknown>;
    return {
      authorizationUrl: String(row.authorizationUrl ?? ''),
      expiresAt: String(row.expiresAt ?? ''),
      integrationAccountId: String(row.integrationAccountId ?? ''),
      status: String(row.status ?? 'authorization_pending'),
    };
  }

  async reconnectAmoCrmConnection(): Promise<AmoCrmConnectionStartResult> {
    const row = await this.request('/api/integrations/amocrm/reconnect', {
      method: 'POST',
      body: '{}',
    }) as Record<string, unknown>;
    return {
      authorizationUrl: String(row.authorizationUrl ?? ''),
      expiresAt: String(row.expiresAt ?? ''),
      integrationAccountId: String(row.integrationAccountId ?? ''),
      status: String(row.status ?? 'authorization_pending'),
    };
  }

  async disconnectAmoCrmConnection(): Promise<AmoCrmHealth> {
    return mapAmoCrmHealth(await this.request('/api/integrations/amocrm/disconnect', {
      method: 'POST',
      body: '{}',
    }));
  }

  async requestAmoCrmHealthRefresh(): Promise<AmoCrmHealth> {
    return mapAmoCrmHealth(await this.request('/api/integrations/amocrm/refresh', {
      method: 'POST',
      body: '{}',
    }));
  }

  async listExternalReferences(entityType?: string): Promise<AmoCrmExternalReference[]> {
    const suffix = entityType ? `?entityType=${encodeURIComponent(entityType)}` : '';
    const row = await this.request(`/api/integrations/amocrm/external-references${suffix}`) as Record<string, unknown>;
    return Array.isArray(row.items) ? row.items.map(mapExternalReference) : [];
  }

  async createExternalReference(input: CreateAmoCrmExternalReferenceInput): Promise<AmoCrmExternalReference> {
    return mapExternalReference(await this.request('/api/integrations/amocrm/external-references', {
      method: 'POST',
      body: JSON.stringify(input),
    }));
  }

  async archiveExternalReference(referenceId: string): Promise<{ id: string; archived: boolean; version: number }> {
    const row = await this.request(
      `/api/integrations/amocrm/external-references/${encodeURIComponent(referenceId)}/archive`,
      { method: 'POST', body: '{}' },
    ) as Record<string, unknown>;
    return {
      id: String(row.id ?? referenceId),
      archived: Boolean(row.archived),
      version: Number(row.version ?? 1),
    };
  }
}

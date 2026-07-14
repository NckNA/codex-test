import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabaseClient';
import { mapPlatformAdminStatus, type PlatformAdminStatusResult } from '../../domain/platform/PlatformAdmin';
import { mapTenantLifecycle, type TenantLifecycle, type TenantLifecycleStatus } from '../../domain/platform/TenantLifecycle';
import { mapTenantSubscription, type TenantSubscriptionPeriod } from '../../domain/platform/TenantSubscription';

export interface PlatformTenantListItem extends TenantLifecycle {
  timezone: string;
  ownerCount: number;
}

export interface PlatformTenantOwner {
  userId: string;
  displayName?: string;
  membershipStatus: string;
  createdAt?: string;
}

export interface PlatformLifecycleHistoryItem {
  id: string;
  action: string;
  actorUserId?: string;
  reasonCode?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface PlatformTenantDetails {
  tenant: TenantLifecycle & { timezone: string };
  owners: PlatformTenantOwner[];
  subscriptionHistory: TenantSubscriptionPeriod[];
  lifecycleHistory: PlatformLifecycleHistoryItem[];
}

export interface PlatformTenantFilters {
  search?: string;
  status?: TenantLifecycleStatus | '';
  limit?: number;
  offset?: number;
}

export interface CreatePlatformTenantCommand {
  name: string;
  ownerUserId: string;
  subscriptionStartedAt: string;
  subscriptionExpiresAt: string;
  graceExpiresAt?: string;
  operationKey: string;
}

export interface TenantOwnerCommand { tenantId: string; ownerUserId: string; operationKey: string; }
export interface ReplaceTenantOwnerCommand extends TenantOwnerCommand { currentOwnerUserId: string; confirmation: boolean; }
export interface SetTenantSubscriptionCommand {
  tenantId: string; startsAt: string; expiresAt: string; graceExpiresAt?: string; reasonCode: string; operationKey: string;
}
export interface ChangeTenantSubscriptionCommand {
  tenantId: string; newExpiresAt: string; newGraceExpiresAt?: string; reasonCode: string; operationKey: string;
}
export interface ShortenTenantSubscriptionCommand extends ChangeTenantSubscriptionCommand { confirmation: boolean; immediateExpiration: boolean; }
export interface SuspendTenantCommand { tenantId: string; reasonCode: string; suspensionNote?: string; suspendedUntil?: string; operationKey: string; }
export interface ResumeTenantCommand { tenantId: string; reasonCode: string; operationKey: string; }
export interface ArchiveTenantCommand { tenantId: string; reasonCode: string; confirmation: boolean; operationKey: string; }

export type PlatformTenantSafeErrorCode =
  | 'permission'
  | 'owner_required'
  | 'last_owner'
  | 'invalid_subscription'
  | 'renew_subscription_first'
  | 'already_archived'
  | 'idempotency_conflict'
  | 'not_found'
  | 'generic';

export class PlatformTenantError extends Error {
  readonly code: PlatformTenantSafeErrorCode;
  constructor(code: PlatformTenantSafeErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

const messages: Record<PlatformTenantSafeErrorCode, string> = {
  permission: 'Недостаточно прав для управления платформой.',
  owner_required: 'Для клиники необходимо назначить хотя бы одного владельца.',
  last_owner: 'Нельзя удалить последнего владельца клиники.',
  invalid_subscription: 'Проверьте даты действия подписки.',
  renew_subscription_first: 'Сначала продлите подписку клиники.',
  already_archived: 'Клиника уже архивирована.',
  idempotency_conflict: 'Операция уже выполнена с другими параметрами.',
  not_found: 'Клиника не найдена.',
  generic: 'Не удалось изменить состояние клиники.',
};

export function mapPlatformTenantError(error: unknown): PlatformTenantError {
  const row = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const raw = String(row.message ?? row.error_description ?? error ?? '').toUpperCase();
  let code: PlatformTenantSafeErrorCode = 'generic';
  if (raw.includes('PLATFORM_ADMIN_REQUIRED') || raw.includes('42501')) code = 'permission';
  else if (raw.includes('OWNER_NOT_FOUND') || raw.includes('OWNER_REQUIRED')) code = 'owner_required';
  else if (raw.includes('LAST_ACTIVE_OWNER')) code = 'last_owner';
  else if (raw.includes('INVALID_SUBSCRIPTION')) code = 'invalid_subscription';
  else if (raw.includes('SUBSCRIPTION_RENEWAL_REQUIRED')) code = 'renew_subscription_first';
  else if (raw.includes('ALREADY_ARCHIVED')) code = 'already_archived';
  else if (raw.includes('IDEMPOTENCY_CONFLICT')) code = 'idempotency_conflict';
  else if (raw.includes('NOT_FOUND') || raw.includes('P0002')) code = 'not_found';
  return new PlatformTenantError(code, messages[code]);
}

interface RpcClient { rpc(name: string, args?: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>; }
const toRecord = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const optional = (value: unknown): string | undefined => value == null || value === '' ? undefined : String(value);

export class PlatformTenantRepository {
  private readonly client: RpcClient;
  constructor(client: SupabaseClient | RpcClient | null = supabase) {
    if (!client) throw new PlatformTenantError('permission', messages.permission);
    this.client = client as RpcClient;
  }

  private async call(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const { data, error } = await this.client.rpc(name, args);
    if (error) throw mapPlatformTenantError(error);
    return data;
  }

  async getPlatformAdminStatus(): Promise<PlatformAdminStatusResult> {
    return mapPlatformAdminStatus(await this.call('get_platform_admin_status'));
  }

  async listTenants(filters: PlatformTenantFilters = {}): Promise<PlatformTenantListItem[]> {
    const data = await this.call('list_platform_tenants', {
      p_search: filters.search || null,
      p_status: filters.status || null,
      p_limit: filters.limit ?? 50,
      p_offset: filters.offset ?? 0,
    });
    return (Array.isArray(data) ? data : []).map((value) => {
      const row = toRecord(value);
      return {
        ...mapTenantLifecycle(row),
        timezone: String(row.timezone ?? 'Asia/Almaty'),
        ownerCount: Number(row.ownerCount ?? row.owner_count ?? 0),
      };
    }).sort((a, b) => a.tenantName.localeCompare(b.tenantName) || a.tenantId.localeCompare(b.tenantId));
  }

  async getTenant(tenantId: string): Promise<PlatformTenantDetails> {
    const root = toRecord(await this.call('get_platform_tenant_details', { p_tenant_id: tenantId }));
    const tenantRow = toRecord(root.tenant);
    return {
      tenant: { ...mapTenantLifecycle(tenantRow), timezone: String(tenantRow.timezone ?? 'Asia/Almaty') },
      owners: (Array.isArray(root.owners) ? root.owners : []).map((value) => {
        const row = toRecord(value);
        return { userId: String(row.userId ?? row.user_id ?? ''), displayName: optional(row.displayName ?? row.display_name), membershipStatus: String(row.membershipStatus ?? row.membership_status ?? 'active'), createdAt: optional(row.createdAt ?? row.created_at) };
      }),
      subscriptionHistory: (Array.isArray(root.subscriptionHistory) ? root.subscriptionHistory : []).map(mapTenantSubscription),
      lifecycleHistory: (Array.isArray(root.lifecycleHistory) ? root.lifecycleHistory : []).map((value) => {
        const row = toRecord(value);
        return { id: String(row.id ?? ''), action: String(row.action ?? ''), actorUserId: optional(row.actorUserId ?? row.actor_user_id), reasonCode: optional(row.reasonCode ?? row.reason_code), metadata: toRecord(row.metadata), createdAt: String(row.createdAt ?? row.created_at ?? '') };
      }),
    };
  }

  createTenant(command: CreatePlatformTenantCommand): Promise<unknown> { return this.call('create_platform_tenant', { p_name: command.name, p_owner_user_id: command.ownerUserId, p_subscription_started_at: command.subscriptionStartedAt, p_subscription_expires_at: command.subscriptionExpiresAt, p_grace_expires_at: command.graceExpiresAt ?? null, p_operation_key: command.operationKey }); }
  addOwner(command: TenantOwnerCommand): Promise<unknown> { return this.call('add_platform_tenant_owner', { p_tenant_id: command.tenantId, p_owner_user_id: command.ownerUserId, p_operation_key: command.operationKey }); }
  replaceOwner(command: ReplaceTenantOwnerCommand): Promise<unknown> { return this.call('replace_platform_tenant_owner', { p_tenant_id: command.tenantId, p_current_owner_user_id: command.currentOwnerUserId, p_new_owner_user_id: command.ownerUserId, p_confirmation: command.confirmation, p_operation_key: command.operationKey }); }
  removeOwner(command: TenantOwnerCommand): Promise<unknown> { return this.call('remove_platform_tenant_owner', { p_tenant_id: command.tenantId, p_owner_user_id: command.ownerUserId, p_operation_key: command.operationKey }); }
  setSubscription(command: SetTenantSubscriptionCommand): Promise<unknown> { return this.call('set_tenant_subscription', { p_tenant_id: command.tenantId, p_starts_at: command.startsAt, p_expires_at: command.expiresAt, p_grace_expires_at: command.graceExpiresAt ?? null, p_reason_code: command.reasonCode, p_operation_key: command.operationKey }); }
  extendSubscription(command: ChangeTenantSubscriptionCommand): Promise<unknown> { return this.call('extend_tenant_subscription', { p_tenant_id: command.tenantId, p_new_expires_at: command.newExpiresAt, p_new_grace_expires_at: command.newGraceExpiresAt ?? null, p_reason_code: command.reasonCode, p_operation_key: command.operationKey }); }
  shortenSubscription(command: ShortenTenantSubscriptionCommand): Promise<unknown> { return this.call('shorten_tenant_subscription', { p_tenant_id: command.tenantId, p_new_expires_at: command.newExpiresAt, p_new_grace_expires_at: command.newGraceExpiresAt ?? null, p_reason_code: command.reasonCode, p_confirmation: command.confirmation, p_immediate_expiration: command.immediateExpiration, p_operation_key: command.operationKey }); }
  suspendTenant(command: SuspendTenantCommand): Promise<unknown> { return this.call('suspend_tenant', { p_tenant_id: command.tenantId, p_reason_code: command.reasonCode, p_suspension_note: command.suspensionNote ?? null, p_suspended_until: command.suspendedUntil ?? null, p_operation_key: command.operationKey }); }
  resumeTenant(command: ResumeTenantCommand): Promise<unknown> { return this.call('resume_tenant', { p_tenant_id: command.tenantId, p_reason_code: command.reasonCode, p_operation_key: command.operationKey }); }
  archiveTenant(command: ArchiveTenantCommand): Promise<unknown> { return this.call('archive_tenant', { p_tenant_id: command.tenantId, p_reason_code: command.reasonCode, p_confirmation: command.confirmation, p_operation_key: command.operationKey }); }
}

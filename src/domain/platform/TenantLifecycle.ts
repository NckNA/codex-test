export type TenantLifecycleStatus = 'provisioning' | 'active' | 'suspended' | 'expired' | 'archived';
export type TenantAccessReason =
  | 'none'
  | 'tenant_provisioning'
  | 'subscription_not_started'
  | 'subscription_expired'
  | 'tenant_suspended'
  | 'tenant_archived'
  | 'no_tenant_membership'
  | 'tenant_unavailable';

export interface TenantLifecycle {
  tenantId: string;
  tenantName: string;
  storedStatus: TenantLifecycleStatus;
  effectiveStatus: TenantLifecycleStatus;
  subscriptionStartedAt?: string;
  subscriptionExpiresAt?: string;
  graceExpiresAt?: string;
  suspendedAt?: string;
  suspendedUntil?: string;
  suspensionReasonCode?: string;
  resumedAt?: string;
  expiredAt?: string;
  archivedAt?: string;
  lifecycleVersion: number;
  updatedAt?: string;
}

export interface TenantOperationalAccess {
  allowed: boolean;
  effectiveStatus: TenantLifecycleStatus;
  reasonCode: TenantAccessReason;
  actionRequired: 'none' | 'wait' | 'renew_subscription' | 'contact_support' | 'switch_tenant';
}

const statuses = new Set<TenantLifecycleStatus>(['provisioning', 'active', 'suspended', 'expired', 'archived']);
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const optionalText = (value: unknown): string | undefined => value == null || value === '' ? undefined : String(value);

export function parseTenantLifecycleStatus(value: unknown): TenantLifecycleStatus {
  if (typeof value === 'string' && statuses.has(value as TenantLifecycleStatus)) return value as TenantLifecycleStatus;
  throw new Error('Некорректный статус жизненного цикла клиники.');
}

export function mapTenantLifecycle(value: unknown): TenantLifecycle {
  const row = record(value);
  return {
    tenantId: String(row.tenantId ?? row.tenant_id ?? ''),
    tenantName: String(row.tenantName ?? row.tenant_name ?? ''),
    storedStatus: parseTenantLifecycleStatus(row.storedStatus ?? row.stored_status),
    effectiveStatus: parseTenantLifecycleStatus(row.effectiveStatus ?? row.effective_status ?? row.storedStatus ?? row.stored_status),
    subscriptionStartedAt: optionalText(row.subscriptionStartedAt ?? row.subscription_started_at),
    subscriptionExpiresAt: optionalText(row.subscriptionExpiresAt ?? row.subscription_expires_at),
    graceExpiresAt: optionalText(row.graceExpiresAt ?? row.grace_expires_at),
    suspendedAt: optionalText(row.suspendedAt ?? row.suspended_at),
    suspendedUntil: optionalText(row.suspendedUntil ?? row.suspended_until),
    suspensionReasonCode: optionalText(row.suspensionReasonCode ?? row.suspension_reason_code),
    resumedAt: optionalText(row.resumedAt ?? row.resumed_at),
    expiredAt: optionalText(row.expiredAt ?? row.expired_at),
    archivedAt: optionalText(row.archivedAt ?? row.archived_at),
    lifecycleVersion: Number(row.lifecycleVersion ?? row.lifecycle_version ?? 1),
    updatedAt: optionalText(row.updatedAt ?? row.updated_at ?? row.last_lifecycle_update),
  };
}

const date = (value?: string): number | null => value ? Date.parse(value) : null;

export function deriveTenantOperationalAccess(
  lifecycle: Pick<TenantLifecycle, 'storedStatus' | 'subscriptionStartedAt' | 'subscriptionExpiresAt' | 'graceExpiresAt' | 'suspendedUntil' | 'archivedAt'>,
  at: Date = new Date(),
): TenantOperationalAccess {
  const now = at.getTime();
  if (lifecycle.storedStatus === 'archived' || lifecycle.archivedAt) {
    return { allowed: false, effectiveStatus: 'archived', reasonCode: 'tenant_archived', actionRequired: 'contact_support' };
  }
  if (lifecycle.storedStatus === 'suspended') {
    const until = date(lifecycle.suspendedUntil);
    if (until == null || until > now) {
      return { allowed: false, effectiveStatus: 'suspended', reasonCode: 'tenant_suspended', actionRequired: 'contact_support' };
    }
  }
  const starts = date(lifecycle.subscriptionStartedAt);
  if (starts != null && now < starts) {
    return { allowed: false, effectiveStatus: 'provisioning', reasonCode: 'subscription_not_started', actionRequired: 'wait' };
  }
  const end = date(lifecycle.graceExpiresAt) ?? date(lifecycle.subscriptionExpiresAt);
  if (end != null && now > end) {
    return { allowed: false, effectiveStatus: 'expired', reasonCode: 'subscription_expired', actionRequired: 'renew_subscription' };
  }
  if (lifecycle.storedStatus === 'provisioning') {
    return { allowed: false, effectiveStatus: 'provisioning', reasonCode: 'tenant_provisioning', actionRequired: 'contact_support' };
  }
  return { allowed: true, effectiveStatus: 'active', reasonCode: 'none', actionRequired: 'none' };
}

export function validateLifecycleTransition(from: TenantLifecycleStatus, to: TenantLifecycleStatus): boolean {
  if (from === 'archived') return to === 'archived';
  if (from === to) return true;
  const allowed: Record<TenantLifecycleStatus, TenantLifecycleStatus[]> = {
    provisioning: ['active', 'suspended', 'expired', 'archived'],
    active: ['suspended', 'expired', 'archived'],
    suspended: ['active', 'expired', 'archived'],
    expired: ['active', 'suspended', 'archived'],
    archived: [],
  };
  return allowed[from].includes(to);
}

export function lifecycleBlockedMessage(status: TenantLifecycleStatus): string {
  switch (status) {
    case 'suspended': return 'Работа клиники временно приостановлена. Обратитесь к владельцу клиники или в поддержку DentalFlow.';
    case 'expired': return 'Срок подписки клиники истёк.';
    case 'archived': return 'Клиника архивирована и недоступна для работы.';
    case 'provisioning': return 'Настройка клиники ещё не завершена.';
    default: return '';
  }
}

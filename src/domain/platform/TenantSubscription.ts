export type TenantSubscriptionStatus = 'scheduled' | 'active' | 'superseded' | 'expired' | 'cancelled';

export interface TenantSubscriptionPeriod {
  id: string;
  tenantId?: string;
  startsAt: string;
  expiresAt: string;
  graceExpiresAt?: string;
  status: TenantSubscriptionStatus;
  reasonCode?: string;
  previousPeriodId?: string;
  createdBy?: string;
  createdAt?: string;
  supersededAt?: string;
}

export interface SubscriptionValidationResult {
  valid: boolean;
  error?: 'start_required' | 'expiry_required' | 'expiry_before_start' | 'grace_before_expiry' | 'shortening_confirmation_required';
}

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const optional = (value: unknown): string | undefined => value == null || value === '' ? undefined : String(value);
const statuses = new Set<TenantSubscriptionStatus>(['scheduled', 'active', 'superseded', 'expired', 'cancelled']);

export function mapTenantSubscription(value: unknown): TenantSubscriptionPeriod {
  const row = record(value);
  const status = String(row.status ?? 'scheduled') as TenantSubscriptionStatus;
  if (!statuses.has(status)) throw new Error('Некорректный статус подписки.');
  return {
    id: String(row.id ?? ''),
    tenantId: optional(row.tenantId ?? row.tenant_id),
    startsAt: String(row.startsAt ?? row.starts_at ?? ''),
    expiresAt: String(row.expiresAt ?? row.expires_at ?? ''),
    graceExpiresAt: optional(row.graceExpiresAt ?? row.grace_expires_at),
    status,
    reasonCode: optional(row.reasonCode ?? row.reason_code),
    previousPeriodId: optional(row.previousPeriodId ?? row.previous_period_id),
    createdBy: optional(row.createdBy ?? row.created_by),
    createdAt: optional(row.createdAt ?? row.created_at),
    supersededAt: optional(row.supersededAt ?? row.superseded_at),
  };
}

export function validateSubscriptionDates(
  startsAt?: string,
  expiresAt?: string,
  graceExpiresAt?: string,
): SubscriptionValidationResult {
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) return { valid: false, error: 'start_required' };
  if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) return { valid: false, error: 'expiry_required' };
  if (Date.parse(expiresAt) <= Date.parse(startsAt)) return { valid: false, error: 'expiry_before_start' };
  if (graceExpiresAt && (Number.isNaN(Date.parse(graceExpiresAt)) || Date.parse(graceExpiresAt) < Date.parse(expiresAt))) {
    return { valid: false, error: 'grace_before_expiry' };
  }
  return { valid: true };
}

export function isSubscriptionShortening(currentExpiresAt: string, nextExpiresAt: string): boolean {
  return Date.parse(nextExpiresAt) < Date.parse(currentExpiresAt);
}

export function validateSubscriptionChange(
  currentExpiresAt: string,
  nextExpiresAt: string,
  confirmed: boolean,
): SubscriptionValidationResult {
  if (isSubscriptionShortening(currentExpiresAt, nextExpiresAt) && !confirmed) {
    return { valid: false, error: 'shortening_confirmation_required' };
  }
  return { valid: true };
}

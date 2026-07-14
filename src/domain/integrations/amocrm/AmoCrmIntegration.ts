export const AMOCRM_INTEGRATION_STATUSES = [
  'disconnected',
  'authorization_pending',
  'connected',
  'refresh_required',
  'degraded',
  'account_mismatch',
  'revoked',
  'disabled',
] as const;

export type AmoCrmIntegrationStatus = typeof AMOCRM_INTEGRATION_STATUSES[number];

export interface AmoCrmAccountIdentity {
  externalAccountId: string;
  domain: string;
  displayName?: string;
}

export interface AmoCrmIntegrationPublicState {
  integrationAccountId?: string;
  providerCode: 'amocrm';
  status: AmoCrmIntegrationStatus;
  connected: boolean;
  externalAccountId?: string;
  externalAccountDomain?: string;
  displayName?: string;
  tokenExpiresAt?: string;
  lastConnectedAt?: string;
  lastVerifiedAt?: string;
  lastRefreshAt?: string;
  lastErrorCode?: string;
  lastErrorAt?: string;
  credentialVersion?: number;
}

export type AmoCrmSafeErrorCode =
  | 'authentication_required'
  | 'permission'
  | 'expired_state'
  | 'consumed_state'
  | 'cancelled_state'
  | 'state_in_progress'
  | 'account_mismatch'
  | 'account_already_bound'
  | 'credential_revoked'
  | 'invalid_grant'
  | 'temporary_provider_error'
  | 'network_timeout_before_response'
  | 'network_timeout_after_possible_acceptance'
  | 'configuration_error'
  | 'encryption_error'
  | 'generic';

const SAFE_ERROR_MESSAGES: Record<AmoCrmSafeErrorCode, string> = {
  authentication_required: 'Требуется авторизация.',
  permission: 'Недостаточно прав для управления интеграцией.',
  expired_state: 'Срок подключения истёк. Начните подключение заново.',
  consumed_state: 'Эта попытка подключения уже использована.',
  cancelled_state: 'Эта попытка подключения отменена.',
  state_in_progress: 'Эта попытка подключения уже обрабатывается.',
  account_mismatch: 'Подключён другой аккаунт amoCRM. Подключение отменено.',
  account_already_bound: 'Этот аккаунт amoCRM уже связан с другой клиникой.',
  credential_revoked: 'Доступ amoCRM отозван. Требуется повторное подключение.',
  invalid_grant: 'Доступ amoCRM отозван. Требуется повторное подключение.',
  temporary_provider_error: 'amoCRM временно недоступна. Повторите проверку позже.',
  network_timeout_before_response: 'amoCRM временно недоступна. Повторите проверку позже.',
  network_timeout_after_possible_acceptance: 'Ответ amoCRM не подтверждён. Требуется повторное подключение.',
  configuration_error: 'Интеграция amoCRM не настроена на сервере.',
  encryption_error: 'Не удалось безопасно обработать учётные данные amoCRM.',
  generic: 'Не удалось выполнить операцию с amoCRM.',
};

export class AmoCrmIntegrationError extends Error {
  readonly code: AmoCrmSafeErrorCode;

  constructor(code: AmoCrmSafeErrorCode, message = SAFE_ERROR_MESSAGES[code]) {
    super(message);
    this.name = 'AmoCrmIntegrationError';
    this.code = code;
  }
}

export function normalizeAmoCrmDomain(input: string, platformHint = ''): string {
  let domain = input.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .split(':')[0]
    .replace(/\.+$/, '');

  if (/^[a-z0-9][a-z0-9-]{1,62}$/.test(domain)) {
    const normalizedHint = platformHint.trim().toLowerCase();
    const suffix = normalizedHint.endsWith('.kommo.com')
      ? '.kommo.com'
      : normalizedHint.endsWith('.amocrm.com')
        ? '.amocrm.com'
        : '.amocrm.ru';
    domain += suffix;
  }

  if (!/^[a-z0-9][a-z0-9.-]*\.(amocrm\.ru|amocrm\.com|kommo\.com)$/.test(domain)) {
    throw new AmoCrmIntegrationError('account_mismatch');
  }
  return domain;
}

export function sameAmoCrmAccount(
  left: AmoCrmAccountIdentity,
  right: AmoCrmAccountIdentity,
): boolean {
  return String(left.externalAccountId) === String(right.externalAccountId)
    && normalizeAmoCrmDomain(left.domain) === normalizeAmoCrmDomain(right.domain);
}

export function detectAmoCrmAccountMismatch(
  expected: Partial<AmoCrmAccountIdentity> | undefined,
  actual: AmoCrmAccountIdentity,
): boolean {
  if (!expected) return false;
  if (expected.externalAccountId && String(expected.externalAccountId) !== String(actual.externalAccountId)) {
    return true;
  }
  if (expected.domain && normalizeAmoCrmDomain(expected.domain, actual.domain) !== normalizeAmoCrmDomain(actual.domain)) {
    return true;
  }
  return false;
}

export function toSafeAmoCrmError(error: unknown): AmoCrmIntegrationError {
  if (error instanceof AmoCrmIntegrationError) return error;
  const candidate = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const code = String(candidate.errorCode ?? candidate.code ?? '').toLowerCase() as AmoCrmSafeErrorCode;
  if (code in SAFE_ERROR_MESSAGES) return new AmoCrmIntegrationError(code);
  return new AmoCrmIntegrationError('generic');
}

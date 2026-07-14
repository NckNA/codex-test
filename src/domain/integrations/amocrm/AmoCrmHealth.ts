import type { AmoCrmIntegrationPublicState, AmoCrmIntegrationStatus } from './AmoCrmIntegration';

export type AmoCrmActionRequired =
  | 'none'
  | 'connect'
  | 'reconnect'
  | 'check_later'
  | 'complete_authorization';

export interface AmoCrmHealth extends AmoCrmIntegrationPublicState {
  actionRequired: AmoCrmActionRequired;
  canReconnect: boolean;
  canDisconnect: boolean;
  canManage: boolean;
  role?: string;
}

export function deriveAmoCrmActionRequired(status: AmoCrmIntegrationStatus): AmoCrmActionRequired {
  switch (status) {
    case 'revoked':
    case 'refresh_required':
    case 'account_mismatch':
      return 'reconnect';
    case 'degraded':
      return 'check_later';
    case 'disconnected':
    case 'disabled':
      return 'connect';
    case 'authorization_pending':
      return 'complete_authorization';
    case 'connected':
      return 'none';
  }
}

export function mapAmoCrmHealth(input: unknown): AmoCrmHealth {
  const row = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const status = String(row.status || 'disconnected') as AmoCrmIntegrationStatus;
  return {
    integrationAccountId: row.integrationAccountId ? String(row.integrationAccountId) : undefined,
    providerCode: 'amocrm',
    status,
    connected: Boolean(row.connected),
    externalAccountId: row.externalAccountId ? String(row.externalAccountId) : undefined,
    externalAccountDomain: row.externalAccountDomain ? String(row.externalAccountDomain) : undefined,
    displayName: row.displayName ? String(row.displayName) : undefined,
    tokenExpiresAt: row.tokenExpiresAt ? String(row.tokenExpiresAt) : undefined,
    lastConnectedAt: row.lastConnectedAt ? String(row.lastConnectedAt) : undefined,
    lastVerifiedAt: row.lastVerifiedAt ? String(row.lastVerifiedAt) : undefined,
    lastRefreshAt: row.lastRefreshAt ? String(row.lastRefreshAt) : undefined,
    lastErrorCode: row.lastErrorCode ? String(row.lastErrorCode) : undefined,
    lastErrorAt: row.lastErrorAt ? String(row.lastErrorAt) : undefined,
    credentialVersion: row.credentialVersion === undefined ? undefined : Number(row.credentialVersion),
    actionRequired: (row.actionRequired as AmoCrmActionRequired | undefined)
      ?? deriveAmoCrmActionRequired(status),
    canReconnect: Boolean(row.canReconnect),
    canDisconnect: Boolean(row.canDisconnect),
    canManage: Boolean(row.canManage),
    role: row.role ? String(row.role) : undefined,
  };
}

const crypto = require('crypto');
const { AmoCrmProviderError } = require('./amoCrmProviderClient');
const { CredentialVaultError } = require('./credentialVault');
const { SupabaseGatewayError } = require('./supabaseGateway');

const SAFE_MESSAGES = Object.freeze({
  authentication_required: 'РўСЂРµР±СѓРµС‚СЃСЏ Р°РІС‚РѕСЂРёР·Р°С†РёСЏ.',
  permission: 'РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ РїСЂР°РІ РґР»СЏ СѓРїСЂР°РІР»РµРЅРёСЏ РёРЅС‚РµРіСЂР°С†РёРµР№.',
  expired_state: 'РЎСЂРѕРє РїРѕРґРєР»СЋС‡РµРЅРёСЏ РёСЃС‚С‘Рє. РќР°С‡РЅРёС‚Рµ РїРѕРґРєР»СЋС‡РµРЅРёРµ Р·Р°РЅРѕРІРѕ.',
  consumed_state: 'Р­С‚Р° РїРѕРїС‹С‚РєР° РїРѕРґРєР»СЋС‡РµРЅРёСЏ СѓР¶Рµ РёСЃРїРѕР»СЊР·РѕРІР°РЅР°.',
  cancelled_state: 'Р­С‚Р° РїРѕРїС‹С‚РєР° РїРѕРґРєР»СЋС‡РµРЅРёСЏ РѕС‚РјРµРЅРµРЅР°.',
  state_in_progress: 'Р­С‚Р° РїРѕРїС‹С‚РєР° РїРѕРґРєР»СЋС‡РµРЅРёСЏ СѓР¶Рµ РѕР±СЂР°Р±Р°С‚С‹РІР°РµС‚СЃСЏ.',
  account_mismatch: 'РџРѕРґРєР»СЋС‡С‘РЅ РґСЂСѓРіРѕР№ Р°РєРєР°СѓРЅС‚ amoCRM. РџРѕРґРєР»СЋС‡РµРЅРёРµ РѕС‚РјРµРЅРµРЅРѕ.',
  account_already_bound: 'Р­С‚РѕС‚ Р°РєРєР°СѓРЅС‚ amoCRM СѓР¶Рµ СЃРІСЏР·Р°РЅ СЃ РґСЂСѓРіРѕР№ РєР»РёРЅРёРєРѕР№.',
  credential_revoked: 'Р”РѕСЃС‚СѓРї amoCRM РѕС‚РѕР·РІР°РЅ. РўСЂРµР±СѓРµС‚СЃСЏ РїРѕРІС‚РѕСЂРЅРѕРµ РїРѕРґРєР»СЋС‡РµРЅРёРµ.',
  invalid_grant: 'Р”РѕСЃС‚СѓРї amoCRM РѕС‚РѕР·РІР°РЅ. РўСЂРµР±СѓРµС‚СЃСЏ РїРѕРІС‚РѕСЂРЅРѕРµ РїРѕРґРєР»СЋС‡РµРЅРёРµ.',
  temporary_provider_error: 'amoCRM РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРЅР°. РџРѕРІС‚РѕСЂРёС‚Рµ РїСЂРѕРІРµСЂРєСѓ РїРѕР·Р¶Рµ.',
  network_timeout_before_response: 'amoCRM РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРЅР°. РџРѕРІС‚РѕСЂРёС‚Рµ РїСЂРѕРІРµСЂРєСѓ РїРѕР·Р¶Рµ.',
  network_timeout_after_possible_acceptance: 'РћС‚РІРµС‚ amoCRM РЅРµ РїРѕРґС‚РІРµСЂР¶РґС‘РЅ. РўСЂРµР±СѓРµС‚СЃСЏ РїРѕРІС‚РѕСЂРЅРѕРµ РїРѕРґРєР»СЋС‡РµРЅРёРµ.',
  configuration_error: 'РРЅС‚РµРіСЂР°С†РёСЏ amoCRM РЅРµ РЅР°СЃС‚СЂРѕРµРЅР° РЅР° СЃРµСЂРІРµСЂРµ.',
  encryption_error: 'РќРµ СѓРґР°Р»РѕСЃСЊ Р±РµР·РѕРїР°СЃРЅРѕ РѕР±СЂР°Р±РѕС‚Р°С‚СЊ СѓС‡С‘С‚РЅС‹Рµ РґР°РЅРЅС‹Рµ amoCRM.',
  generic: 'РќРµ СѓРґР°Р»РѕСЃСЊ РІС‹РїРѕР»РЅРёС‚СЊ РѕРїРµСЂР°С†РёСЋ СЃ amoCRM.',
});

class AmoCrmServiceError extends Error {
  constructor(code, status = 400, message = SAFE_MESSAGES[code] || SAFE_MESSAGES.generic) {
    super(message);
    this.name = 'AmoCrmServiceError';
    this.code = code;
    this.status = status;
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function mapGatewayError(error) {
  const code = String(error?.code || error?.message || '');
  if (code.includes('AMOCRM_PERMISSION_DENIED')) return new AmoCrmServiceError('permission', 403);
  if (code.includes('AMOCRM_STATE_EXPIRED')) return new AmoCrmServiceError('expired_state', 400);
  if (code.includes('AMOCRM_STATE_CONSUMED')) return new AmoCrmServiceError('consumed_state', 409);
  if (code.includes('AMOCRM_STATE_CANCELLED')) return new AmoCrmServiceError('cancelled_state', 409);
  if (code.includes('AMOCRM_STATE_IN_PROGRESS')) return new AmoCrmServiceError('state_in_progress', 409);
  if (code.includes('AMOCRM_STATE_NOT_FOUND')) return new AmoCrmServiceError('expired_state', 400);
  if (code.includes('AMOCRM_CREDENTIAL_NOT_FOUND')) return new AmoCrmServiceError('credential_revoked', 409);
  return new AmoCrmServiceError('generic', error?.status || 500);
}

function mapProviderError(error) {
  if (!(error instanceof AmoCrmProviderError)) return new AmoCrmServiceError('generic', 500);
  const code = error.code === 'invalid_code' ? 'expired_state' : error.code;
  return new AmoCrmServiceError(code, error.status || 502);
}

class AmoCrmIntegrationService {
  constructor({ gateway, providerClient, vault, config, randomBytes = crypto.randomBytes, randomUUID = crypto.randomUUID }) {
    this.gateway = gateway;
    this.providerClient = providerClient;
    this.vault = vault;
    this.config = config;
    this.randomBytes = randomBytes;
    this.randomUUID = randomUUID;
  }

  assertConfigured() {
    if (!this.gateway || !this.providerClient || !this.vault) {
      throw new AmoCrmServiceError('configuration_error', 503);
    }
  }

  callbackRedirect(status, errorCode) {
    const target = new URL('/settings', this.config.frontendUrl || 'http://localhost:5173');
    target.searchParams.set('amocrm_status', status);
    if (errorCode) target.searchParams.set('amocrm_error', errorCode);
    return target.toString();
  }

  async startConnection(context, { reconnect = false, expectedExternalAccountId, expectedDomain } = {}) {
    this.assertConfigured();
    if (!context?.tenantId || !context?.actorId) throw new AmoCrmServiceError('permission', 403);
    const rawState = this.randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + Math.min(Math.max(Number(this.config.oauthStateTtlSeconds || 600), 60), 900) * 1000,
    ).toISOString();
    let stored;
    try {
      stored = await this.gateway.rpc('amocrm_start_connection_server', {
        p_tenant_id: context.tenantId,
        p_actor_id: context.actorId,
        p_state_hash: sha256(rawState),
        p_redirect_uri_fingerprint: sha256(this.config.amoCrmRedirectUri),
        p_state_expires_at: expiresAt,
        p_expected_external_account_id: expectedExternalAccountId || null,
        p_expected_domain: expectedDomain || null,
        p_reconnect: Boolean(reconnect),
      });
    } catch (error) {
      throw mapGatewayError(error);
    }
    return {
      authorizationUrl: this.providerClient.buildAuthorizationUrl(rawState),
      expiresAt,
      integrationAccountId: stored.integrationAccountId,
      status: stored.status,
    };
  }

  async reconnect(context) {
    const health = await this.getHealth(context);
    return this.startConnection(context, {
      reconnect: true,
      expectedExternalAccountId: health.externalAccountId,
      expectedDomain: health.externalAccountDomain,
    });
  }

  async completeCallback({ code, state, referer }) {
    this.assertConfigured();
    if (!code || !state || !referer) {
      throw new AmoCrmServiceError('expired_state', 400);
    }
    const stateHash = sha256(state);
    const exchangeLeaseToken = this.randomUUID();
    let claim;
    try {
      claim = await this.gateway.rpc('amocrm_claim_callback_state_server', {
        p_state_hash: stateHash,
        p_exchange_lease_token: exchangeLeaseToken,
      });
    } catch (error) {
      throw mapGatewayError(error);
    }

    if (claim.redirectUriFingerprint !== sha256(this.config.amoCrmRedirectUri)) {
      await this.gateway.rpc('amocrm_fail_callback_server', {
        p_state_hash: stateHash,
        p_exchange_lease_token: exchangeLeaseToken,
        p_error_code: 'configuration_error',
        p_terminal: true,
      }).catch(() => null);
      throw new AmoCrmServiceError('configuration_error', 503);
    }

    try {
      const tokenSet = await this.providerClient.exchangeAuthorizationCode({ code, referer });
      const account = await this.providerClient.getAccountInfo({
        accessToken: tokenSet.accessToken,
        accountDomain: tokenSet.accountDomain,
      });
      const encryptedAccess = this.vault.encrypt(tokenSet.accessToken);
      const encryptedRefresh = this.vault.encrypt(tokenSet.refreshToken);
      const completed = await this.gateway.rpc('amocrm_complete_callback_server', {
        p_state_hash: stateHash,
        p_exchange_lease_token: exchangeLeaseToken,
        p_external_account_id: account.externalAccountId,
        p_external_account_domain: account.domain,
        p_display_name: account.displayName || null,
        p_encrypted_access_credential: this.vault.toBytea(encryptedAccess),
        p_encrypted_refresh_credential: this.vault.toBytea(encryptedRefresh),
        p_encryption_key_version: this.vault.keyVersion,
        p_access_expires_at: tokenSet.expiresAt,
      });
      if (!completed?.ok) {
        const safeCode = completed?.errorCode === 'account_already_bound'
          ? 'account_already_bound'
          : 'account_mismatch';
        throw new AmoCrmServiceError(safeCode, 409);
      }
      return {
        ok: true,
        status: 'connected',
        integrationAccountId: completed.integrationAccountId,
        redirectUrl: this.callbackRedirect('connected'),
      };
    } catch (error) {
      if (error instanceof AmoCrmServiceError) throw error;
      const providerError = error instanceof AmoCrmProviderError ? error : null;
      const errorCode = providerError?.code
        || (error instanceof CredentialVaultError ? error.code : 'temporary_provider_error');
      const terminal = providerError
        ? Boolean(providerError.terminal || providerError.uncertain)
        : true;
      await this.gateway.rpc('amocrm_fail_callback_server', {
        p_state_hash: stateHash,
        p_exchange_lease_token: exchangeLeaseToken,
        p_error_code: errorCode,
        p_terminal: terminal,
      }).catch(() => null);
      if (error instanceof CredentialVaultError) {
        throw new AmoCrmServiceError(error.code, 500);
      }
      throw mapProviderError(error);
    }
  }

  async getHealth(context) {
    this.assertConfigured();
    try {
      return await this.gateway.rpc('amocrm_get_health_server', {
        p_tenant_id: context.tenantId,
        p_actor_id: context.actorId,
      });
    } catch (error) {
      throw mapGatewayError(error);
    }
  }

  async refreshCredentials(context) {
    this.assertConfigured();
    const leaseToken = this.randomUUID();
    let lease;
    try {
      lease = await this.gateway.rpc('amocrm_acquire_refresh_server', {
        p_tenant_id: context.tenantId,
        p_actor_id: context.actorId,
        p_refresh_lease_token: leaseToken,
        p_min_valid_seconds: 300,
      });
    } catch (error) {
      throw mapGatewayError(error);
    }

    if (lease.status === 'no_change' || lease.status === 'in_progress') {
      return this.getHealth(context);
    }
    if (lease.status !== 'acquired') {
      throw new AmoCrmServiceError('credential_revoked', 409);
    }

    try {
      const encryptedRefresh = this.vault.fromHex(lease.encryptedRefreshCredential);
      const refreshToken = this.vault.decrypt(encryptedRefresh);
      const tokenSet = await this.providerClient.refreshCredentials({
        refreshToken,
        accountDomain: lease.externalAccountDomain,
      });
      const account = await this.providerClient.getAccountInfo({
        accessToken: tokenSet.accessToken,
        accountDomain: tokenSet.accountDomain,
      });
      const committed = await this.gateway.rpc('amocrm_commit_refresh_server', {
        p_integration_account_id: lease.integrationAccountId,
        p_actor_id: context.actorId,
        p_refresh_lease_token: leaseToken,
        p_expected_credential_version: lease.credentialVersion,
        p_encrypted_access_credential: this.vault.toBytea(this.vault.encrypt(tokenSet.accessToken)),
        p_encrypted_refresh_credential: this.vault.toBytea(this.vault.encrypt(tokenSet.refreshToken)),
        p_encryption_key_version: this.vault.keyVersion,
        p_access_expires_at: tokenSet.expiresAt,
        p_verified_external_account_id: account.externalAccountId,
        p_verified_external_account_domain: account.domain,
        p_verified_display_name: account.displayName || null,
      });
      if (committed.status === 'account_mismatch') {
        throw new AmoCrmServiceError('account_mismatch', 409);
      }
      return this.getHealth(context);
    } catch (error) {
      const errorCode = error instanceof AmoCrmProviderError
        ? error.code
        : error instanceof CredentialVaultError
          ? error.code
          : error instanceof AmoCrmServiceError
            ? error.code
            : 'temporary_provider_error';
      await this.gateway.rpc('amocrm_fail_refresh_server', {
        p_integration_account_id: lease.integrationAccountId,
        p_actor_id: context.actorId,
        p_refresh_lease_token: leaseToken,
        p_error_code: errorCode,
      }).catch(() => null);
      if (error instanceof AmoCrmServiceError) throw error;
      if (error instanceof CredentialVaultError) throw new AmoCrmServiceError(error.code, 500);
      throw mapProviderError(error);
    }
  }

  async disconnect(context) {
    this.assertConfigured();
    try {
      await this.gateway.rpc('amocrm_disconnect_server', {
        p_tenant_id: context.tenantId,
        p_actor_id: context.actorId,
      });
      return this.getHealth(context);
    } catch (error) {
      throw mapGatewayError(error);
    }
  }

  async listExternalReferences(context, entityType) {
    try {
      return await this.gateway.rpc('amocrm_list_external_references_server', {
        p_tenant_id: context.tenantId,
        p_actor_id: context.actorId,
        p_entity_type: entityType || null,
      });
    } catch (error) {
      throw mapGatewayError(error);
    }
  }

  async createExternalReference(context, input) {
    try {
      return await this.gateway.rpc('amocrm_create_external_reference_server', {
        p_tenant_id: context.tenantId,
        p_actor_id: context.actorId,
        p_entity_type: input.entityType,
        p_internal_entity_id: input.internalEntityId,
        p_external_entity_id: input.externalEntityId,
        p_external_parent_id: input.externalParentId || null,
      });
    } catch (error) {
      throw mapGatewayError(error);
    }
  }

  async archiveExternalReference(context, referenceId) {
    try {
      return await this.gateway.rpc('amocrm_archive_external_reference_server', {
        p_tenant_id: context.tenantId,
        p_actor_id: context.actorId,
        p_reference_id: referenceId,
      });
    } catch (error) {
      throw mapGatewayError(error);
    }
  }
}

function toSafeServiceError(error) {
  if (error instanceof AmoCrmServiceError) return error;
  if (error instanceof SupabaseGatewayError) return mapGatewayError(error);
  if (error instanceof AmoCrmProviderError) return mapProviderError(error);
  if (error instanceof CredentialVaultError) return new AmoCrmServiceError(error.code, 500);
  return new AmoCrmServiceError('generic', 500);
}

module.exports = {
  AmoCrmIntegrationService,
  AmoCrmServiceError,
  SAFE_MESSAGES,
  sha256,
  toSafeServiceError,
};

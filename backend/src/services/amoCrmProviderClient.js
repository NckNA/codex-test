class AmoCrmProviderError extends Error {
  constructor(code, { terminal = false, uncertain = false, status = 502 } = {}) {
    super(code);
    this.name = 'AmoCrmProviderError';
    this.code = code;
    this.terminal = terminal;
    this.uncertain = uncertain;
    this.status = status;
  }
}

function normalizeAmoCrmDomain(value, platformHint = '') {
  let domain = String(value || '').trim().toLowerCase();
  domain = domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0].replace(/\.+$/, '');
  if (!domain) throw new AmoCrmProviderError('account_mismatch', { terminal: true, status: 400 });
  if (/^[a-z0-9][a-z0-9-]{1,62}$/.test(domain)) {
    const hint = String(platformHint || '').toLowerCase();
    const suffix = hint.endsWith('.kommo.com')
      ? '.kommo.com'
      : hint.endsWith('.amocrm.com')
        ? '.amocrm.com'
        : '.amocrm.ru';
    domain += suffix;
  }
  if (!/^[a-z0-9][a-z0-9.-]*\.(amocrm\.ru|amocrm\.com|kommo\.com)$/.test(domain)) {
    throw new AmoCrmProviderError('account_mismatch', { terminal: true, status: 400 });
  }
  return domain;
}

function accountDomainFromSubdomain(subdomain, referer) {
  return normalizeAmoCrmDomain(subdomain, normalizeAmoCrmDomain(referer));
}

function safeExpiresAt(expiresIn, now = Date.now()) {
  const seconds = Number(expiresIn);
  if (!Number.isFinite(seconds) || seconds <= 0 || seconds > 315360000) {
    throw new AmoCrmProviderError('invalid_provider_response', { terminal: true, status: 502 });
  }
  return new Date(now + seconds * 1000).toISOString();
}

class AmoCrmProviderClient {
  constructor({ config, fetchImpl = globalThis.fetch, now = () => Date.now() }) {
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.now = now;
  }

  buildAuthorizationUrl(state) {
    const url = new URL(this.config.amoCrmAuthorizeUrl || 'https://www.amocrm.ru/oauth');
    url.searchParams.set('client_id', this.config.amoCrmClientId);
    url.searchParams.set('state', state);
    url.searchParams.set('mode', 'popup');
    return url.toString();
  }

  resolveAccountDomain(referer) {
    const domain = normalizeAmoCrmDomain(referer);
    if (this.config.amoCrmAllowedAccountDomain) {
      const expected = normalizeAmoCrmDomain(this.config.amoCrmAllowedAccountDomain, domain);
      if (domain !== expected) {
        throw new AmoCrmProviderError('account_mismatch', { terminal: true, status: 400 });
      }
    }
    return domain;
  }

  providerBaseUrl(accountDomain) {
    const configured = String(this.config.amoCrmProviderBaseUrl || '').replace(/\/$/, '');
    return configured || `https://${accountDomain}`;
  }

  async fetchJson(url, options, { refresh = false } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1000, Number(this.config.requestTimeoutMs || 10000)),
    );
    try {
      const response = await this.fetchImpl(url, { ...options, signal: controller.signal });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 400) {
          throw new AmoCrmProviderError(refresh ? 'invalid_grant' : 'invalid_code', {
            terminal: true,
            status: 400,
          });
        }
        if (response.status === 401 || response.status === 403) {
          throw new AmoCrmProviderError('credential_revoked', { terminal: true, status: 401 });
        }
        if (response.status === 429) {
          throw new AmoCrmProviderError('temporary_provider_error', { status: 503 });
        }
        if (response.status >= 500) {
          throw new AmoCrmProviderError('temporary_provider_error', { status: 503 });
        }
        throw new AmoCrmProviderError('invalid_provider_response', { terminal: true, status: 502 });
      }
      return payload;
    } catch (error) {
      if (error instanceof AmoCrmProviderError) throw error;
      if (error?.name === 'AbortError') {
        throw new AmoCrmProviderError('network_timeout_after_possible_acceptance', {
          terminal: true,
          uncertain: true,
          status: 504,
        });
      }
      throw new AmoCrmProviderError('network_timeout_before_response', { status: 503 });
    } finally {
      clearTimeout(timeout);
    }
  }

  async exchangeAuthorizationCode({ code, referer }) {
    if (!code) throw new AmoCrmProviderError('invalid_code', { terminal: true, status: 400 });
    const accountDomain = this.resolveAccountDomain(referer);
    const baseUrl = this.providerBaseUrl(accountDomain);
    const payload = await this.fetchJson(`${baseUrl}/oauth2/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DentalFlow-Account-Domain': accountDomain,
      },
      body: JSON.stringify({
        client_id: this.config.amoCrmClientId,
        client_secret: this.config.amoCrmClientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.config.amoCrmRedirectUri,
      }),
    });
    if (!payload?.access_token || !payload?.refresh_token) {
      throw new AmoCrmProviderError('invalid_provider_response', { terminal: true, status: 502 });
    }
    return {
      accessToken: String(payload.access_token),
      refreshToken: String(payload.refresh_token),
      tokenType: String(payload.token_type || 'Bearer'),
      expiresAt: safeExpiresAt(payload.expires_in, this.now()),
      accountDomain,
    };
  }

  async refreshCredentials({ refreshToken, accountDomain }) {
    if (!refreshToken) {
      throw new AmoCrmProviderError('credential_revoked', { terminal: true, status: 401 });
    }
    const domain = this.resolveAccountDomain(accountDomain);
    const baseUrl = this.providerBaseUrl(domain);
    const payload = await this.fetchJson(`${baseUrl}/oauth2/access_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-DentalFlow-Account-Domain': domain,
      },
      body: JSON.stringify({
        client_id: this.config.amoCrmClientId,
        client_secret: this.config.amoCrmClientSecret,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        redirect_uri: this.config.amoCrmRedirectUri,
      }),
    }, { refresh: true });
    if (!payload?.access_token || !payload?.refresh_token) {
      throw new AmoCrmProviderError('invalid_provider_response', { terminal: true, status: 502 });
    }
    return {
      accessToken: String(payload.access_token),
      refreshToken: String(payload.refresh_token),
      tokenType: String(payload.token_type || 'Bearer'),
      expiresAt: safeExpiresAt(payload.expires_in, this.now()),
      accountDomain: domain,
    };
  }

  async getAccountInfo({ accessToken, accountDomain }) {
    const domain = this.resolveAccountDomain(accountDomain);
    const baseUrl = this.providerBaseUrl(domain);
    const payload = await this.fetchJson(`${baseUrl}/api/v4/account`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-DentalFlow-Account-Domain': domain,
      },
    });
    if (payload?.id === undefined || !payload?.subdomain) {
      throw new AmoCrmProviderError('invalid_provider_response', { terminal: true, status: 502 });
    }
    return {
      externalAccountId: String(payload.id),
      domain: accountDomainFromSubdomain(String(payload.subdomain), domain),
      displayName: payload.name ? String(payload.name) : undefined,
    };
  }
}

module.exports = {
  AmoCrmProviderClient,
  AmoCrmProviderError,
  normalizeAmoCrmDomain,
  accountDomainFromSubdomain,
  safeExpiresAt,
};

class SupabaseGatewayError extends Error {
  constructor(code, status = 500) {
    super(code);
    this.name = 'SupabaseGatewayError';
    this.code = code;
    this.status = status;
  }
}

function safeProviderErrorCode(payload, fallback) {
  const message = String(payload?.message || payload?.code || '').toUpperCase();
  const known = [
    'AMOCRM_PERMISSION_DENIED',
    'AMOCRM_STATE_NOT_FOUND',
    'AMOCRM_STATE_CANCELLED',
    'AMOCRM_STATE_CONSUMED',
    'AMOCRM_STATE_EXPIRED',
    'AMOCRM_STATE_IN_PROGRESS',
    'AMOCRM_INTEGRATION_NOT_FOUND',
    'AMOCRM_CREDENTIAL_NOT_FOUND',
    'AMOCRM_REFERENCE_NOT_FOUND',
    'AMOCRM_INVALID_DOMAIN',
    'AMOCRM_DIRECT_WRITE_FORBIDDEN',
  ];
  return known.find((item) => message.includes(item)) || fallback;
}

class SupabaseGateway {
  constructor({ supabaseUrl, anonKey, serviceRoleKey, fetchImpl = globalThis.fetch }) {
    this.supabaseUrl = String(supabaseUrl || '').replace(/\/$/, '');
    this.anonKey = anonKey;
    this.serviceRoleKey = serviceRoleKey;
    this.fetchImpl = fetchImpl;
  }

  async authenticateUser(accessToken) {
    if (!accessToken) throw new SupabaseGatewayError('authentication_required', 401);
    const response = await this.fetchImpl(`${this.supabaseUrl}/auth/v1/user`, {
      method: 'GET',
      headers: {
        apikey: this.anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!response.ok) throw new SupabaseGatewayError('authentication_required', 401);
    const payload = await response.json();
    if (!payload?.id) throw new SupabaseGatewayError('authentication_required', 401);
    return { id: String(payload.id), email: payload.email ? String(payload.email) : undefined };
  }

  async rpc(functionName, args) {
    const response = await this.fetchImpl(`${this.supabaseUrl}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: this.serviceRoleKey,
        Authorization: `Bearer ${this.serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(args || {}),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const fallback = response.status === 401 || response.status === 403
        ? 'AMOCRM_PERMISSION_DENIED'
        : 'AMOCRM_STORAGE_ERROR';
      throw new SupabaseGatewayError(
        safeProviderErrorCode(payload, fallback),
        response.status,
      );
    }
    return payload;
  }
}

module.exports = {
  SupabaseGateway,
  SupabaseGatewayError,
  safeProviderErrorCode,
};

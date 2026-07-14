const PORT = Number(process.env.PORT || 4000);

const config = Object.freeze({
  port: Number.isFinite(PORT) ? PORT : 4000,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  amoCrmClientId: process.env.AMOCRM_CLIENT_ID || '',
  amoCrmClientSecret: process.env.AMOCRM_CLIENT_SECRET || '',
  amoCrmRedirectUri: process.env.AMOCRM_REDIRECT_URI || '',
  amoCrmAuthorizeUrl: process.env.AMOCRM_AUTHORIZE_URL || 'https://www.amocrm.ru/oauth',
  amoCrmProviderBaseUrl: process.env.AMOCRM_PROVIDER_BASE_URL || '',
  amoCrmAllowedAccountDomain: process.env.AMOCRM_ALLOWED_ACCOUNT_DOMAIN || '',
  credentialEncryptionKey: process.env.AMOCRM_CREDENTIAL_ENCRYPTION_KEY || '',
  credentialEncryptionKeyVersion: Number(process.env.AMOCRM_CREDENTIAL_KEY_VERSION || 1),
  requestTimeoutMs: Number(process.env.AMOCRM_REQUEST_TIMEOUT_MS || 10000),
  oauthStateTtlSeconds: Number(process.env.AMOCRM_OAUTH_STATE_TTL_SECONDS || 600),
});

function isSupabaseServerConfigured(runtime = config) {
  return Boolean(
    runtime.supabaseUrl &&
    runtime.supabaseAnonKey &&
    runtime.supabaseServiceRoleKey
  );
}

function isAmoCrmConfigured(runtime = config) {
  return Boolean(
    isSupabaseServerConfigured(runtime) &&
    runtime.amoCrmClientId &&
    runtime.amoCrmClientSecret &&
    runtime.amoCrmRedirectUri &&
    runtime.credentialEncryptionKey &&
    Number.isInteger(runtime.credentialEncryptionKeyVersion) &&
    runtime.credentialEncryptionKeyVersion > 0
  );
}

module.exports = {
  PORT: config.port,
  config,
  isSupabaseServerConfigured,
  isAmoCrmConfigured,
};

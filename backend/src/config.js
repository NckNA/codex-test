// Safe config loader for backend proxy skeleton

const PORT = process.env.PORT || 4000;
const AMOCRM_BASE_URL = process.env.AMOCRM_BASE_URL || '';
const AMOCRM_CLIENT_ID = process.env.AMOCRM_CLIENT_ID || '';
const AMOCRM_CLIENT_SECRET = process.env.AMOCRM_CLIENT_SECRET || '';
const AMOCRM_REDIRECT_URI = process.env.AMOCRM_REDIRECT_URI || '';
const AMOCRM_ALLOWED_ACCOUNT_DOMAIN = process.env.AMOCRM_ALLOWED_ACCOUNT_DOMAIN || '';
const AMOCRM_TOKEN_STORE_MODE = process.env.AMOCRM_TOKEN_STORE_MODE || 'memory';

/**
 * Checks if the minimal required amoCRM variables are set for OAuth exchange.
 */
function isAmoCrmConfigured() {
  return Boolean(
    AMOCRM_BASE_URL &&
    AMOCRM_CLIENT_ID &&
    AMOCRM_CLIENT_SECRET &&
    AMOCRM_REDIRECT_URI
  );
}

/**
 * Returns configuration values needed for amoCRM integrations.
 * Never logs or exposes the client secret unnecessarily.
 */
function getAmoCrmConfig() {
  return {
    baseUrl: AMOCRM_BASE_URL,
    clientId: AMOCRM_CLIENT_ID,
    clientSecret: AMOCRM_CLIENT_SECRET, // Must be handled securely
    redirectUri: AMOCRM_REDIRECT_URI,
    allowedDomain: AMOCRM_ALLOWED_ACCOUNT_DOMAIN,
    storeMode: AMOCRM_TOKEN_STORE_MODE
  };
}

module.exports = {
  PORT,
  isAmoCrmConfigured,
  getAmoCrmConfig
};

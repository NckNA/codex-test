// Safe config loader for backend proxy skeleton

const PORT = process.env.PORT || 4000;
const AMOCRM_BASE_URL = process.env.AMOCRM_BASE_URL || '';
const AMOCRM_CLIENT_ID = process.env.AMOCRM_CLIENT_ID || '';
const AMOCRM_CLIENT_SECRET = process.env.AMOCRM_CLIENT_SECRET || '';
const AMOCRM_REDIRECT_URI = process.env.AMOCRM_REDIRECT_URI || '';
const AMOCRM_ALLOWED_ACCOUNT_DOMAIN = process.env.AMOCRM_ALLOWED_ACCOUNT_DOMAIN || '';

/**
 * Checks if the minimal required amoCRM variables are set.
 * Returns false during AMO-003 since we are not implementing real calls.
 */
function isAmoCrmConfigured() {
  return Boolean(
    AMOCRM_BASE_URL &&
    AMOCRM_CLIENT_ID &&
    AMOCRM_CLIENT_SECRET &&
    AMOCRM_REDIRECT_URI
  );
}

module.exports = {
  PORT,
  AMOCRM_BASE_URL,
  AMOCRM_CLIENT_ID,
  AMOCRM_CLIENT_SECRET, // Note: Secret is loaded but never logged
  AMOCRM_REDIRECT_URI,
  AMOCRM_ALLOWED_ACCOUNT_DOMAIN,
  isAmoCrmConfigured
};

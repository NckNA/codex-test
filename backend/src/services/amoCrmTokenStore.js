/**
 * Safe dev-only memory token storage for amoCRM integration.
 * IMPORTANT: This is for local development skeleton only.
 * Production MUST use encrypted database storage later.
 * Rules: no logging tokens, no disk write, no frontend exposure.
 */

let currentTokenSet = null;

/**
 * Returns a safe subset of connection status for frontend display.
 * Never exposes access/refresh tokens or secrets.
 */
function getConnectionStatus() {
  if (!currentTokenSet) {
    return { connected: false };
  }

  return {
    connected: true,
    accountDomain: currentTokenSet.accountDomain || null,
    expiresAt: currentTokenSet.expiresAt || null,
    updatedAt: currentTokenSet.updatedAt || null
  };
}

/**
 * Saves a token set securely into the in-memory store.
 * @param {Object} tokenSet
 */
function saveTokenSet(tokenSet) {
  if (!tokenSet || !tokenSet.accessToken) {
    return false;
  }

  currentTokenSet = {
    accessToken: tokenSet.accessToken,
    refreshToken: tokenSet.refreshToken,
    expiresAt: tokenSet.expiresAt,
    tokenType: tokenSet.tokenType || 'Bearer',
    accountDomain: tokenSet.accountDomain || null,
    createdAt: currentTokenSet ? currentTokenSet.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  return true;
}

/**
 * Retrieves the full token set for backend API consumption.
 * Must NEVER be passed to public endpoints.
 */
function getTokenSet() {
  return currentTokenSet;
}

/**
 * Clears the stored token set (disconnect).
 */
function clearTokenSet() {
  currentTokenSet = null;
  return true;
}

/**
 * Checks if a token set currently exists in memory.
 */
function hasTokenSet() {
  return currentTokenSet !== null;
}

module.exports = {
  getConnectionStatus,
  saveTokenSet,
  getTokenSet,
  clearTokenSet,
  hasTokenSet
};

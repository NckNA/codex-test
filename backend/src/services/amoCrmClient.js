const { isAmoCrmConfigured, getAmoCrmConfig } = require('../config');

/**
 * Builds the URL for the frontend to open and authenticate with amoCRM.
 * @param {string} state - The generated secure one-time state.
 * @returns {string} The authorization URL.
 */
function buildAuthorizationUrl(state) {
  if (!isAmoCrmConfigured()) {
    throw new Error('amoCRM integration is not configured.');
  }

  const config = getAmoCrmConfig();
  const authUrl = new URL('https://www.amocrm.ru/oauth');
  
  authUrl.searchParams.append('client_id', config.clientId);
  authUrl.searchParams.append('state', state);
  authUrl.searchParams.append('mode', 'popup');
  
  return authUrl.toString();
}

/**
 * Exchanges the authorization code for an access/refresh token pair.
 * Utilizes the native global fetch API (Node 18+).
 * @param {Object} params 
 * @param {string} params.code - The authorization code from the callback.
 * @param {string} params.referer - The domain the callback came from.
 * @returns {Promise<Object>} The normalized token set.
 */
async function exchangeAuthorizationCode({ code, referer }) {
  if (!isAmoCrmConfigured()) {
    throw new Error('amoCRM integration is not configured.');
  }
  
  if (!code) {
    throw new Error('Missing authorization code.');
  }

  const config = getAmoCrmConfig();
  
  // Attempt to use configured base URL, or fallback to the referer domain if provided and allowed.
  // For the skeleton we simply use the configured AMOCRM_BASE_URL.
  let targetDomain = config.baseUrl;
  if (!targetDomain && referer && config.allowedDomain && referer.includes(config.allowedDomain)) {
    targetDomain = 'https://' + referer;
  }
  
  if (!targetDomain) {
    throw new Error('Cannot determine target amoCRM domain for token exchange.');
  }

  const tokenEndpoint = targetDomain + '/oauth2/access_token';
  
  const payload = {
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: config.redirectUri
  };

  try {
    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      // Safe error message to avoid exposing raw JSON body with tokens/secrets
      throw new Error('amoCRM token exchange failed (HTTP status ' + response.status + ').');
    }

    const data = await response.json();
    
    if (!data.access_token || !data.refresh_token) {
      throw new Error('amoCRM token exchange failed (missing tokens in response).');
    }

    // Convert expires_in (seconds) to absolute ISO string
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000)).toISOString();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: expiresAt,
      tokenType: data.token_type || 'Bearer',
      accountDomain: targetDomain
    };

  } catch (error) {
    // Explicitly hide any error details that might accidentally contain secrets or tokens
    throw new Error('amoCRM token exchange failed: ' + (error.message || 'Unknown network error'));
  }
}

/**
 * Placeholder for future patient syncing.
 */
function placeholderSyncContact() {
  throw new Error('Real amoCRM API is not implemented in AMO-004 skeleton.');
}

/**
 * Placeholder for future treatment plan syncing.
 */
function placeholderSyncLead() {
  throw new Error('Real amoCRM API is not implemented in AMO-004 skeleton.');
}

module.exports = {
  buildAuthorizationUrl,
  exchangeAuthorizationCode,
  placeholderSyncContact,
  placeholderSyncLead
};

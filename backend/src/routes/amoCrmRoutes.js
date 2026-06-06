const { sendJson } = require('../utils/jsonResponse');
const { isAmoCrmConfigured } = require('../config');
const { createOAuthState, validateOAuthState } = require('../services/amoCrmStateStore');
const { getConnectionStatus, saveTokenSet, clearTokenSet } = require('../services/amoCrmTokenStore');
const { buildAuthorizationUrl, exchangeAuthorizationCode } = require('../services/amoCrmClient');

/**
 * Handles all /api/integrations/amocrm/* routes.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} pathname
 * @param {URL} url
 * @returns {boolean} true if handled, false otherwise
 */
async function handleAmoCrmRoutes(req, res, pathname, url) {
  if (!pathname.startsWith('/api/integrations/amocrm')) {
    return false;
  }

  // GET /api/integrations/amocrm/status
  if (req.method === 'GET' && pathname === '/api/integrations/amocrm/status') {
    const status = getConnectionStatus();
    sendJson(res, 200, {
      ...status,
      provider: 'amocrm',
      configured: isAmoCrmConfigured(),
      message: status.connected
        ? 'amoCRM is connected.'
        : 'amoCRM integration backend skeleton is available. Ready to connect.'
    });
    return true;
  }

  // POST /api/integrations/amocrm/connect
  if (req.method === 'POST' && pathname === '/api/integrations/amocrm/connect') {
    if (!isAmoCrmConfigured()) {
      sendJson(res, 400, {
        ok: false,
        message: 'amoCRM integration is not configured.'
      });
      return true;
    }

    const state = createOAuthState();
    const authorizationUrl = buildAuthorizationUrl(state);

    sendJson(res, 200, {
      ok: true,
      provider: 'amocrm',
      authorizationUrl: authorizationUrl,
      message: 'Open authorizationUrl to connect amoCRM.'
    });
    return true;
  }

  // GET /api/integrations/amocrm/callback
  if (req.method === 'GET' && pathname === '/api/integrations/amocrm/callback') {
    const code = url.searchParams.get('code');
    const referer = url.searchParams.get('referer');
    const state = url.searchParams.get('state');

    if (!code) {
      sendJson(res, 400, { ok: false, message: 'Missing authorization code in callback.' });
      return true;
    }

    if (!validateOAuthState(state)) {
      sendJson(res, 400, { ok: false, message: 'Invalid or expired OAuth state.' });
      return true;
    }

    try {
      const tokenSet = await exchangeAuthorizationCode({ code, referer });
      const saved = saveTokenSet(tokenSet);

      if (!saved) {
        throw new Error('Failed to save token set locally.');
      }

      sendJson(res, 200, {
        ok: true,
        provider: 'amocrm',
        connected: true,
        accountDomain: tokenSet.accountDomain,
        message: 'amoCRM connected successfully.'
      });
    } catch (err) {
      sendJson(res, 400, {
        ok: false,
        message: err.message || 'Failed to exchange tokens during callback.'
      });
    }
    return true;
  }

  // POST /api/integrations/amocrm/disconnect
  if (req.method === 'POST' && pathname === '/api/integrations/amocrm/disconnect') {
    clearTokenSet();
    sendJson(res, 200, {
      ok: true,
      provider: 'amocrm',
      connected: false,
      message: 'amoCRM disconnected.'
    });
    return true;
  }

  // POST /api/integrations/amocrm/webhook
  if (req.method === 'POST' && pathname === '/api/integrations/amocrm/webhook') {
    sendJson(res, 202, {
      ok: true,
      message: 'ignored placeholder webhook'
    });
    return true;
  }

  // Still placeholders
  const syncEndpoints = [
    '/api/integrations/amocrm/sync-patient',
    '/api/integrations/amocrm/sync-treatment-plan'
  ];

  if (syncEndpoints.includes(pathname)) {
    sendJson(res, 501, {
      ok: false,
      provider: 'amocrm',
      message: 'Patient and treatment plan sync is not implemented in AMO-004. This endpoint is a placeholder.'
    });
    return true;
  }

  // If it starts with the prefix but doesn't match known routes
  sendJson(res, 404, { error: 'amoCRM endpoint not found' });
  return true;
}

module.exports = {
  handleAmoCrmRoutes
};

const { sendJson } = require('../utils/jsonResponse');

/**
 * Handles all /api/integrations/amocrm/* routes.
 * Currently returns 501 placeholders or minimal status info.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} pathname
 * @returns {boolean} true if handled, false otherwise
 */
function handleAmoCrmRoutes(req, res, pathname) {
  if (!pathname.startsWith('/api/integrations/amocrm')) {
    return false; // Not an amoCRM route
  }

  // GET /api/integrations/amocrm/status
  if (req.method === 'GET' && pathname === '/api/integrations/amocrm/status') {
    sendJson(res, 200, {
      connected: false,
      provider: 'amocrm',
      message: 'amoCRM integration backend skeleton is available, but OAuth is not implemented yet.'
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

  // Placeholder handlers for all other known amoCRM endpoints
  const knownEndpoints = [
    '/api/integrations/amocrm/connect',
    '/api/integrations/amocrm/callback',
    '/api/integrations/amocrm/disconnect',
    '/api/integrations/amocrm/sync-patient',
    '/api/integrations/amocrm/sync-treatment-plan'
  ];

  if (knownEndpoints.includes(pathname)) {
    sendJson(res, 501, {
      ok: false,
      provider: 'amocrm',
      message: 'OAuth flow is not implemented in AMO-003. This endpoint is a placeholder.'
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

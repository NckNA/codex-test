const { sendJson } = require('../utils/jsonResponse');

/**
 * Handles the GET /health route.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @param {string} pathname
 * @returns {boolean} true if handled, false otherwise
 */
function handleHealthRoutes(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: "dentalflow-integration-proxy",
      status: "healthy"
    });
    return true;
  }
  return false;
}

module.exports = {
  handleHealthRoutes
};

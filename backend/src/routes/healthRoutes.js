const { sendJson } = require('../utils/jsonResponse');

function handleHealthRoutes(req, res, pathname, status = {}) {
  if (req.method === 'GET' && pathname === '/health') {
    sendJson(res, 200, {
      ok: true,
      service: 'dentalflow-integration-proxy',
      status: 'healthy',
      amoCrmConfigured: Boolean(status.configured),
    });
    return true;
  }
  return false;
}

module.exports = {
  handleHealthRoutes,
};

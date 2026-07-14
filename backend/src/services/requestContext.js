const { AmoCrmServiceError } = require('./amoCrmIntegrationService');

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : '';
}

function tenantIdHeader(req) {
  const value = String(req.headers['x-tenant-id'] || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value
    : '';
}

async function authenticateTenantRequest(req, gateway) {
  const token = bearerToken(req);
  const tenantId = tenantIdHeader(req);
  if (!token) throw new AmoCrmServiceError('authentication_required', 401);
  if (!tenantId) throw new AmoCrmServiceError('permission', 403);
  const user = await gateway.authenticateUser(token);
  return {
    actorId: user.id,
    tenantId,
  };
}

module.exports = {
  bearerToken,
  tenantIdHeader,
  authenticateTenantRequest,
};

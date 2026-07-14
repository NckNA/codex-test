const { applyCors, sendJson, readJsonBody } = require('../utils/jsonResponse');
const { authenticateTenantRequest } = require('../services/requestContext');
const { toSafeServiceError } = require('../services/amoCrmIntegrationService');

function callbackParams(url) {
  return {
    code: url.searchParams.get('code') || '',
    state: url.searchParams.get('state') || '',
    referer: url.searchParams.get('referer') || '',
  };
}

function safeErrorPayload(error) {
  const safe = toSafeServiceError(error);
  return {
    status: safe.status,
    body: {
      ok: false,
      providerCode: 'amocrm',
      errorCode: safe.code,
      message: safe.message,
    },
  };
}

async function handleAmoCrmRoutes(req, res, pathname, url, dependencies) {
  if (!pathname.startsWith('/api/integrations/amocrm')) return false;

  const { service, gateway, frontendUrl } = dependencies;
  if (req.method === 'OPTIONS') {
    applyCors(res, frontendUrl);
    res.writeHead(204);
    res.end();
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/integrations/amocrm/callback') {
    try {
      const result = await service.completeCallback(callbackParams(url));
      res.writeHead(302, {
        Location: result.redirectUrl,
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
      res.end();
    } catch (error) {
      const safe = toSafeServiceError(error);
      res.writeHead(302, {
        Location: service.callbackRedirect('error', safe.code),
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      });
      res.end();
    }
    return true;
  }

  try {
    const context = await authenticateTenantRequest(req, gateway);

    if (req.method === 'GET' && pathname === '/api/integrations/amocrm/status') {
      sendJson(res, 200, await service.getHealth(context), frontendUrl);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/integrations/amocrm/connect') {
      const body = await readJsonBody(req);
      const result = await service.startConnection(context, {
        expectedExternalAccountId: body.expectedExternalAccountId,
        expectedDomain: body.expectedDomain,
      });
      sendJson(res, 200, { ok: true, providerCode: 'amocrm', ...result }, frontendUrl);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/integrations/amocrm/reconnect') {
      const result = await service.reconnect(context);
      sendJson(res, 200, { ok: true, providerCode: 'amocrm', ...result }, frontendUrl);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/integrations/amocrm/refresh') {
      const result = await service.refreshCredentials(context);
      sendJson(res, 200, result, frontendUrl);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/integrations/amocrm/disconnect') {
      const result = await service.disconnect(context);
      sendJson(res, 200, result, frontendUrl);
      return true;
    }

    if (req.method === 'GET' && pathname === '/api/integrations/amocrm/external-references') {
      const entityType = url.searchParams.get('entityType') || undefined;
      const result = await service.listExternalReferences(context, entityType);
      sendJson(res, 200, { items: result }, frontendUrl);
      return true;
    }

    if (req.method === 'POST' && pathname === '/api/integrations/amocrm/external-references') {
      const body = await readJsonBody(req);
      const result = await service.createExternalReference(context, body);
      sendJson(res, 201, result, frontendUrl);
      return true;
    }

    const archiveMatch = pathname.match(/^\/api\/integrations\/amocrm\/external-references\/([0-9a-f-]+)\/archive$/i);
    if (req.method === 'POST' && archiveMatch) {
      const result = await service.archiveExternalReference(context, archiveMatch[1]);
      sendJson(res, 200, result, frontendUrl);
      return true;
    }

    sendJson(res, 404, {
      ok: false,
      errorCode: 'not_found',
      message: 'amoCRM endpoint not found.',
    }, frontendUrl);
    return true;
  } catch (error) {
    const safe = safeErrorPayload(error);
    console.warn('amoCRM API request failed', { method: req.method, path: pathname, status: safe.status, errorCode: safe.body.errorCode });
    sendJson(res, safe.status, safe.body, frontendUrl);
    return true;
  }
}

module.exports = {
  handleAmoCrmRoutes,
  callbackParams,
  safeErrorPayload,
};

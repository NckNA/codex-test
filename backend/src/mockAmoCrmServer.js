const http = require('http');
const { readJsonBody, sendJson } = require('./utils/jsonResponse');

const port = Number(process.env.AMOCRM_MOCK_PORT || 49001);
const state = {
  tokenExchanges: 0,
  refreshCalls: 0,
  accountCalls: 0,
  realMutations: 0,
  messages: 0,
  entityCreates: 0,
  activeRefreshTokens: new Set(['mock-refresh-1']),
  mode: 'success',
};

function scenario(req, body) {
  return String(req.headers['x-amocrm-mock-scenario'] || body?.scenario || state.mode || 'success');
}

function accountDomain(req) {
  return String(req.headers['x-dentalflow-account-domain'] || 'clinic-test.amocrm.ru')
    .replace(/^https?:\/\//, '')
    .split('/')[0]
    .toLowerCase();
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/__mock/counters') {
    return sendJson(res, 200, {
      tokenExchanges: state.tokenExchanges,
      refreshCalls: state.refreshCalls,
      accountCalls: state.accountCalls,
      realMutations: state.realMutations,
      messages: state.messages,
      entityCreates: state.entityCreates,
    });
  }

  if (req.method === 'POST' && url.pathname === '/__mock/scenario') {
    const body = await readJsonBody(req);
    state.mode = String(body.mode || 'success');
    return sendJson(res, 200, { ok: true, mode: state.mode });
  }

  if (req.method === 'POST' && url.pathname === '/__mock/invalidate-refresh') {
    state.activeRefreshTokens.clear();
    return sendJson(res, 200, { ok: true });
  }
  if (req.method === 'POST' && url.pathname === '/__mock/reset') {
    state.tokenExchanges = 0;
    state.refreshCalls = 0;
    state.accountCalls = 0;
    state.realMutations = 0;
    state.messages = 0;
    state.entityCreates = 0;
    state.activeRefreshTokens = new Set(['mock-refresh-1']);
    state.mode = 'success';
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'POST' && url.pathname === '/oauth2/access_token') {
    const body = await readJsonBody(req);
    const mode = scenario(req, body);
    if (mode === 'timeout_before_response') return req.socket.destroy();
    if (mode === 'rate_limit') return sendJson(res, 429, { title: 'rate limited' });
    if (mode === 'temporary_server_error') return sendJson(res, 503, { title: 'temporary' });

    if (body.grant_type === 'authorization_code') {
      state.tokenExchanges += 1;
      if (mode === 'expired_code' || mode === 'invalid_code' || body.code === 'invalid') {
        return sendJson(res, 400, { hint: 'invalid code' });
      }
      return sendJson(res, 200, {
        token_type: 'Bearer',
        expires_in: 86400,
        access_token: `mock-access-${state.tokenExchanges}`,
        refresh_token: 'mock-refresh-1',
      });
    }

    if (body.grant_type === 'refresh_token') {
      state.refreshCalls += 1;
      if (mode === 'invalid_grant' || !state.activeRefreshTokens.has(body.refresh_token)) {
        return sendJson(res, 400, { hint: 'invalid grant' });
      }
      state.activeRefreshTokens.delete(body.refresh_token);
      const rotated = `mock-refresh-${state.refreshCalls + 1}`;
      state.activeRefreshTokens.add(rotated);
      return sendJson(res, 200, {
        token_type: 'Bearer',
        expires_in: 86400,
        access_token: `mock-access-refresh-${state.refreshCalls}`,
        refresh_token: rotated,
      });
    }

    return sendJson(res, 400, { hint: 'unsupported grant' });
  }

  if (req.method === 'GET' && url.pathname === '/api/v4/account') {
    state.accountCalls += 1;
    const mode = String(req.headers['x-amocrm-mock-scenario'] || state.mode || 'success');
    const domain = accountDomain(req);
    const subdomain = domain.split('.')[0];
    return sendJson(res, 200, {
      id: mode === 'account_mismatch' ? 999999 : 123456,
      subdomain: mode === 'account_mismatch' ? 'wrong-account' : subdomain,
      name: mode === 'account_mismatch' ? 'Wrong Account' : 'DentalFlow Local QA',
    });
  }

  if (/\/(contacts|leads|tasks|notes|messages|chats)/i.test(url.pathname)) {
    state.realMutations += 1;
    state.entityCreates += 1;
    if (/messages|chats/i.test(url.pathname)) state.messages += 1;
    return sendJson(res, 501, { error: 'forbidden_in_foundation_task' });
  }

  sendJson(res, 404, { error: 'not_found' });
});

if (require.main === module) {
  server.listen(port, '127.0.0.1', () => {
    console.log(`Local amoCRM mock listening on http://127.0.0.1:${port}`);
  });
}

module.exports = { server, state };

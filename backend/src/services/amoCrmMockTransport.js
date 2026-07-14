function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

function createAmoCrmMockFetch(options = {}) {
  const state = {
    tokenExchanges: 0,
    refreshCalls: 0,
    accountCalls: 0,
    refreshTokens: new Set(options.refreshTokens || ['refresh-1']),
    accountId: String(options.accountId || '123456'),
    subdomain: options.subdomain || 'clinic-test',
    accountName: options.accountName || 'Clinic Test',
    mode: options.mode || 'success',
  };

  const fetchImpl = async (url, request = {}) => {
    const target = String(url);
    if (state.mode === 'timeout_before_response') {
      throw new Error('network unavailable');
    }
    if (state.mode === 'timeout_after_possible_acceptance') {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }
    if (state.mode === 'rate_limit') return jsonResponse(429, { title: 'rate limited' });
    if (state.mode === 'temporary_server_error') return jsonResponse(503, { title: 'temporary' });

    if (target.endsWith('/oauth2/access_token')) {
      const body = JSON.parse(String(request.body || '{}'));
      if (body.grant_type === 'authorization_code') {
        state.tokenExchanges += 1;
        if (state.mode === 'expired_code' || state.mode === 'invalid_code') {
          return jsonResponse(400, { hint: 'invalid code' });
        }
        return jsonResponse(200, {
          token_type: 'Bearer',
          expires_in: 86400,
          access_token: `access-${state.tokenExchanges}`,
          refresh_token: 'refresh-1',
        });
      }
      if (body.grant_type === 'refresh_token') {
        state.refreshCalls += 1;
        if (state.mode === 'invalid_grant' || !state.refreshTokens.has(body.refresh_token)) {
          return jsonResponse(400, { hint: 'invalid grant' });
        }
        state.refreshTokens.delete(body.refresh_token);
        const rotated = `refresh-${state.refreshCalls + 1}`;
        state.refreshTokens.add(rotated);
        return jsonResponse(200, {
          token_type: 'Bearer',
          expires_in: 86400,
          access_token: `access-refresh-${state.refreshCalls}`,
          refresh_token: rotated,
        });
      }
    }

    if (target.endsWith('/api/v4/account')) {
      state.accountCalls += 1;
      return jsonResponse(200, {
        id: state.mode === 'account_mismatch' ? '999999' : state.accountId,
        subdomain: state.mode === 'account_mismatch' ? 'wrong-account' : state.subdomain,
        name: state.accountName,
      });
    }

    return jsonResponse(404, { title: 'not found' });
  };

  return { fetchImpl, state };
}

module.exports = {
  createAmoCrmMockFetch,
};

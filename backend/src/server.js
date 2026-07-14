const http = require('http');
const { config, isAmoCrmConfigured } = require('./config');
const { handleHealthRoutes } = require('./routes/healthRoutes');
const { handleAmoCrmRoutes } = require('./routes/amoCrmRoutes');
const { sendJson } = require('./utils/jsonResponse');
const { SupabaseGateway } = require('./services/supabaseGateway');
const { CredentialVault } = require('./services/credentialVault');
const { AmoCrmProviderClient } = require('./services/amoCrmProviderClient');
const { AmoCrmIntegrationService } = require('./services/amoCrmIntegrationService');

const gateway = new SupabaseGateway({
  supabaseUrl: config.supabaseUrl,
  anonKey: config.supabaseAnonKey,
  serviceRoleKey: config.supabaseServiceRoleKey,
});

let vault = null;
try {
  if (config.credentialEncryptionKey) {
    vault = new CredentialVault({
      key: config.credentialEncryptionKey,
      keyVersion: config.credentialEncryptionKeyVersion,
    });
  }
} catch {
  vault = null;
}

const providerClient = new AmoCrmProviderClient({ config });
const service = new AmoCrmIntegrationService({
  gateway,
  providerClient,
  vault,
  config,
});

const dependencies = {
  gateway,
  service,
  frontendUrl: config.frontendUrl,
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (handleHealthRoutes(req, res, pathname, {
    configured: isAmoCrmConfigured(config) && Boolean(vault),
  })) return;

  if (await handleAmoCrmRoutes(req, res, pathname, url, dependencies)) return;

  sendJson(res, 404, { error: 'Not Found' }, config.frontendUrl);
});

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`DentalFlow integration proxy listening on port ${config.port}`);
  });
}

module.exports = {
  server,
  dependencies,
};

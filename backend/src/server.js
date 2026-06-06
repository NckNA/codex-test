const http = require('http');
const config = require('./config');
const { handleHealthRoutes } = require('./routes/healthRoutes');
const { handleAmoCrmRoutes } = require('./routes/amoCrmRoutes');
const { sendJson } = require('./utils/jsonResponse');

const server = http.createServer(async (req, res) => {
  // Simple URL parsing
  const url = new URL(req.url || '/', 'http://' + (req.headers.host || 'localhost'));
  const pathname = url.pathname;

  // Dispatch to route handlers
  if (handleHealthRoutes(req, res, pathname)) {
    return;
  }

  if (await handleAmoCrmRoutes(req, res, pathname, url)) {
    return;
  }

  // Fallback 404
  sendJson(res, 404, { error: 'Not Found' });
});

server.listen(config.PORT, () => {
  console.log('DentalFlow Integration Proxy skeleton running on port ' + config.PORT);
});

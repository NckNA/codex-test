/**
 * Sends a JSON response with standard headers.
 * @param {import('http').ServerResponse} res 
 * @param {number} statusCode 
 * @param {object} data 
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Reads and parses a JSON body from an incoming request.
 * @param {import('http').IncomingMessage} req 
 * @returns {Promise<object>}
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', err => reject(err));
  });
}

module.exports = {
  sendJson,
  readJsonBody
};

/**
 * Anthropic API Proxy for Databricks
 *
 * This proxy sits between VS Code Claude extension and Databricks serving endpoints
 * to strip unsupported prompt caching parameters.
 *
 * PROBLEM:
 * The Claude VS Code extension sends `cache_control` fields in API requests for
 * prompt caching optimization. Databricks endpoints don't support these fields
 * and return 400 errors when they're present.
 *
 * SOLUTION:
 * This proxy intercepts requests, removes all `cache_control` fields from:
 * - message content blocks (messages[].content[].cache_control)
 * - system message blocks (system[].cache_control)
 * Then forwards the cleaned request to Databricks.
 *
 * USAGE:
 * 1. Start proxy:
 *    node proxy.js           # Normal mode (concise logging)
 *    VERBOSE=true node proxy.js    # Verbose mode (full request/response details)
 *
 * 2. Configure VS Code settings.json:
 *    {
 *      "env": {
 *        "ANTHROPIC_BASE_URL": "http://localhost:3000/serving-endpoints/anthropic",
 *        "ANTHROPIC_AUTH_TOKEN": "your-databricks-token",
 *        "ANTHROPIC_MODEL": "databricks-claude-sonnet-4-5"
 *      }
 *    }
 *
 * LOGGING:
 * - Normal mode: Shows what was stripped, request URL, response status only
 * - Verbose mode: Shows full headers and bodies for debugging (properly decompressed)
 */

const http = require('http');
const https = require('https');
const zlib = require('zlib');




// Set to true for verbose logging
const VERBOSE = process.env.VERBOSE === 'true';
const HOSTNAME = process.env.HOSTNAME || 'YOUNEEDTOPROVIDETHIS.cloud.databricks.com';

const server = http.createServer((req, res) => {
  let body = '';

  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', () => {
    try {
      const data = JSON.parse(body);
      const changes = [];

      if (VERBOSE) {
        console.log('\n=== INCOMING REQUEST ===');
        console.log(`${req.method} ${req.url}`);
        console.log('Headers:', JSON.stringify(req.headers, null, 2));
        console.log('Body:', JSON.stringify(data, null, 2));
      }

      // Strip cache_control from messages
      if (data.messages) {
        data.messages.forEach((msg, msgIdx) => {
          if (Array.isArray(msg.content)) {
            msg.content.forEach((block, blockIdx) => {
              if (block.cache_control) {
                changes.push(`messages[${msgIdx}].content[${blockIdx}].cache_control`);
                delete block.cache_control;
              }
            });
          }
        });
      }

      // Strip cache_control from system
      if (Array.isArray(data.system)) {
        data.system.forEach((block, idx) => {
          if (block.cache_control) {
            changes.push(`system[${idx}].cache_control`);
            delete block.cache_control;
          }
        });
      }

      // Log changes
      if (changes.length > 0) {
        console.log(`\n[${new Date().toISOString()}] STRIPPED: ${changes.join(', ')}`);
      }

      const modifiedBody = JSON.stringify(data);

      if (VERBOSE && changes.length > 0) {
        console.log('Modified Body:', JSON.stringify(data, null, 2));
      }

      const options = {
        hostname: HOSTNAME,
        port: 443,
        path: req.url,
        method: req.method,
        headers: {
          ...req.headers,
          'content-length': Buffer.byteLength(modifiedBody),
          host: HOSTNAME 
        }
      };

      console.log(`REQUEST: ${req.method} https://${options.hostname}${options.path}`);

      if (VERBOSE) {
        console.log('Forward Headers:', JSON.stringify(options.headers, null, 2));
      }

      const proxyReq = https.request(options, proxyRes => {
        const chunks = [];

        proxyRes.on('data', chunk => {
          chunks.push(chunk);
        });

        proxyRes.on('end', () => {
          console.log(`RESPONSE: ${proxyRes.statusCode}`);

          if (VERBOSE) {
            const buffer = Buffer.concat(chunks);
            const encoding = proxyRes.headers['content-encoding'];

            // Decompress if needed
            const decompress = (buf, callback) => {
              if (encoding === 'gzip') {
                zlib.gunzip(buf, callback);
              } else if (encoding === 'deflate') {
                zlib.inflate(buf, callback);
              } else if (encoding === 'br') {
                zlib.brotliDecompress(buf, callback);
              } else {
                callback(null, buf);
              }
            };

            decompress(buffer, (err, decompressed) => {
              const responseBody = err ? buffer.toString() : decompressed.toString();
              console.log('Response Headers:', JSON.stringify(proxyRes.headers, null, 2));
              console.log('Response Body:', responseBody);
            });
          }

          console.log('---');
        });

        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
      });

      proxyReq.on('error', err => {
        console.error('ERROR:', err.message);
        if (VERBOSE) {
          console.error(err);
        }
        res.writeHead(500);
        res.end(JSON.stringify({ error: err.message }));
      });

      proxyReq.write(modifiedBody);
      proxyReq.end();

    } catch (err) {
      console.error('PARSE ERROR:', err.message);
      if (VERBOSE) {
        console.error(err);
        console.error('Raw body:', body);
      }
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }
  });
});

server.listen(3000, () => {
  console.log(`Proxy running on http://localhost:3000 ${VERBOSE ? '(VERBOSE MODE)' : ''}`);
  console.log('---');
});
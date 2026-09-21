/**
 * Minimal BFF (Backend for Frontend) for MAX Web Messenger.
 * Dependency-free, Node 22+. Holds GREEN-API tokens server-side so the
 * browser never sees apiTokenInstance.
 *
 * Env:
 *   BFF_PORT=3101
 *   BFF_TOKENS_JSON='{"310022742216":"<token>"}'   # vault: idInstance -> token
 *   GREEN_API_BASE=https://3100.api.green-api.com   # default gateway
 *   BFF_CORS_ORIGINS=https://web.max.example.com    # comma list, or * for dev
 *
 * Contract (mirrors src/utils/bffClient.ts):
 *   GET  /health
 *   POST /api/send-message   { idInstance, chatId, message }
 *   GET  /api/notification?idInstance=&timeout=5
 *   POST /api/ack            { idInstance, receiptId }
 */
import http from 'node:http';

const PORT = Number(process.env.BFF_PORT || 3101);
const GREEN_API_BASE = (process.env.GREEN_API_BASE || 'https://3100.api.green-api.com').replace(/\/+$/, '');
const CORS_ORIGINS = (process.env.BFF_CORS_ORIGINS || '*').split(',').map((s) => s.trim()).filter(Boolean);

let TOKENS = {};
try {
  TOKENS = JSON.parse(process.env.BFF_TOKENS_JSON || '{}');
} catch {
  console.error('[bff] BFF_TOKENS_JSON is not valid JSON — starting with empty vault');
}
// Single-instance shortcut: BFF_ID_INSTANCE + BFF_API_TOKEN
if (process.env.BFF_ID_INSTANCE && process.env.BFF_API_TOKEN) {
  TOKENS[process.env.BFF_ID_INSTANCE] = process.env.BFF_API_TOKEN;
}

function tokenFor(idInstance) {
  const t = TOKENS[String(idInstance || '').trim()];
  return typeof t === 'string' && t ? t : null;
}

function corsHeaders(origin) {
  const allow = CORS_ORIGINS.includes('*') ? '*' : CORS_ORIGINS.includes(origin) ? origin : '';
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function sendJson(res, status, obj, origin) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...corsHeaders(origin),
  });
  res.end(body);
}

function readBody(req, limit = 1_048_576) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function upstream(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${GREEN_API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text().catch(() => '');
  return { status: res.status, text };
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin || '';
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(origin));
    res.end();
    return;
  }
  const url = new URL(req.url || '/', 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/health') {
    sendJson(res, 200, { ok: true, mode: 'bff', instances: Object.keys(TOKENS).length }, origin);
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/send-message') {
    try {
      const { idInstance, chatId, message } = JSON.parse(await readBody(req));
      const token = tokenFor(idInstance);
      if (!token) return sendJson(res, 401, { error: 'unknown instance' }, origin);
      if (!chatId || !message) return sendJson(res, 400, { error: 'chatId and message required' }, origin);
      const up = await upstream(`/waInstance${String(idInstance).trim()}/sendMessage/${token}`, {
        method: 'POST',
        body: { chatId: String(chatId).replace(/\D/g, ''), message: String(message).slice(0, 4096) },
      });
      res.writeHead(up.status, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
      res.end(up.text || '{}');
    } catch (e) {
      sendJson(res, 400, { error: String(e.message || e) }, origin);
    }
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/notification') {
    const idInstance = url.searchParams.get('idInstance') || '';
    const timeout = Math.min(Math.max(Number(url.searchParams.get('timeout') || 5), 1), 20);
    const token = tokenFor(idInstance);
    if (!token) return sendJson(res, 401, { error: 'unknown instance' }, origin);
    const up = await upstream(
      `/waInstance${String(idInstance).trim()}/receiveNotification/${token}?receiveTimeout=${timeout}`
    );
    res.writeHead(up.status, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
    res.end(up.text || 'null');
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ack') {
    try {
      const { idInstance, receiptId } = JSON.parse(await readBody(req));
      const token = tokenFor(idInstance);
      if (!token) return sendJson(res, 401, { error: 'unknown instance' }, origin);
      if (typeof receiptId !== 'number') return sendJson(res, 400, { error: 'receiptId must be number' }, origin);
      const up = await upstream(
        `/waInstance${String(idInstance).trim()}/deleteNotification/${token}/${receiptId}`,
        { method: 'DELETE' }
      );
      res.writeHead(up.status, { 'Content-Type': 'application/json', ...corsHeaders(origin) });
      res.end(up.text || '{"result":true}');
    } catch (e) {
      sendJson(res, 400, { error: String(e.message || e) }, origin);
    }
    return;
  }

  sendJson(res, 404, { error: 'not found' }, origin);
});

server.listen(PORT, () => {
  console.log(`[bff] listening on :${PORT}, gateway=${GREEN_API_BASE}, instances=${Object.keys(TOKENS).length}`);
});

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join, normalize } from 'node:path';
import { createStore, DEMO_USERS } from './db.js';
import { emptyDocument, importTextFile, validDocument } from './document.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const MAX_BODY_BYTES = 3 * 1024 * 1024;
function reply(res, status, value, extraHeaders = {}) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extraHeaders });
  res.end(JSON.stringify(value));
}
async function bodyJson(req) {
  let size = 0;
  const parts = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) { const error = new Error('Request too large (3 MB max)'); error.status = 413; throw error; }
    parts.push(chunk);
  }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); }
  catch { const error = new Error('Invalid JSON'); error.status = 400; throw error; }
}
function selectedUser(req, store) {
  const cookie = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('collabdoc_user='));
  let id = 'ava';
  if (cookie) { try { id = decodeURIComponent(cookie.slice('collabdoc_user='.length)); } catch { id = 'ava'; } }
  return store.getUser(id) || store.getUser('ava');
}
function errorResult(res, result) {
  if (!result?.error) return false;
  if (result.error === 'not_found') reply(res, 404, { error: 'Document not found' });
  else if (result.error === 'forbidden') reply(res, 403, { error: 'You do not have access to this document' });
  else if (result.error === 'conflict') reply(res, 409, { error: 'Document changed in another session. Reload before editing again.', currentVersion: result.currentVersion });
  else if (result.error === 'invalid_user') reply(res, 400, { error: 'Select another valid user' });
  else reply(res, 500, { error: 'Unexpected operation error' });
  return true;
}
function documentName(input) {
  return typeof input === 'string' && input.trim().length > 0 && input.trim().length <= 120 ? input.trim() : null;
}
async function api(req, res, url, store) {
  const path = url.pathname;
  const user = selectedUser(req, store);
  if (path === '/api/session') {
    if (req.method === 'GET') return reply(res, 200, { currentUser: user, users: DEMO_USERS });
    if (req.method === 'POST') {
      const data = await bodyJson(req);
      if (!data || typeof data.userId !== 'string' || !store.getUser(data.userId)) return reply(res, 400, { error: 'Unknown demo user' });
      return reply(res, 200, { currentUser: store.getUser(data.userId) }, { 'set-cookie': `collabdoc_user=${encodeURIComponent(data.userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${process.env.NODE_ENV === 'production' ? '; Secure' : ''}` });
    }
  }
  if (path === '/api/documents') {
    if (req.method === 'GET') return reply(res, 200, store.list(user.id));
    if (req.method === 'POST') {
      const data = await bodyJson(req);
      const title = documentName(data?.title || 'Untitled document');
      if (!title) return reply(res, 400, { error: 'Title must be 1–120 characters' });
      const doc = store.create(user.id, title, emptyDocument());
      return reply(res, 201, { document: doc });
    }
  }
  if (path === '/api/import' && req.method === 'POST') {
    const data = await bodyJson(req);
    try {
      const file = importTextFile(data?.filename, data?.content);
      if (!validDocument(file.content)) return reply(res, 400, { error: 'Imported file is too complex. Try a smaller file.' });
      const doc = store.create(user.id, file.title, file.content);
      return reply(res, 201, { document: doc });
    } catch (error) { return reply(res, 400, { error: error.message }); }
  }
  const match = path.match(/^\/api\/documents\/([a-f0-9-]{36})(?:\/share(?:\/([a-z]+))?)?$/i);
  if (match) {
    const [, id, target] = match;
    const isShare = path.includes('/share');
    if (isShare) {
      if (req.method === 'DELETE' && target) {
        const result = store.revoke(id, user.id, target);
        return errorResult(res, result) || reply(res, 200, result);
      }
    } else {
      if (req.method === 'GET') {
        const result = store.get(id, user.id);
        return errorResult(res, result) || reply(res, 200, result);
      }
      if (req.method === 'PATCH') {
        const data = await bodyJson(req);
        if (!data || typeof data.expectedVersion !== 'number' || !Number.isSafeInteger(data.expectedVersion)) return reply(res, 400, { error: 'expectedVersion is required' });
        if (data.title === undefined && data.content === undefined) return reply(res, 400, { error: 'Nothing to update' });
        if (data.title !== undefined && !documentName(data.title)) return reply(res, 400, { error: 'Title must be 1–120 characters' });
        if (data.content !== undefined && !validDocument(data.content)) return reply(res, 400, { error: 'Invalid document content' });
        const result = store.update(id, user.id, { title: data.title === undefined ? undefined : documentName(data.title), content: data.content, expectedVersion: data.expectedVersion });
        return errorResult(res, result) || reply(res, 200, result);
      }
      if (req.method === 'DELETE') {
        const result = store.remove(id, user.id);
        return errorResult(res, result) || reply(res, 200, result);
      }
    }
  }
  return reply(res, 404, { error: 'Unknown API endpoint' });
}
async function route(req, res, store) {
  const url = new URL(req.url || '/', 'http://localhost');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('content-security-policy', "default-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  if (url.pathname.startsWith('/api/')) {
    // Share POST needs to return success payload as well as errors.
    const match = url.pathname.match(/^\/api\/documents\/([a-f0-9-]{36})\/share$/i);
    if (match && req.method === 'POST') {
      try {
        const data = await bodyJson(req);
        const result = store.share(match[1], selectedUser(req, store).id, data?.userId);
        return errorResult(res, result) || reply(res, 200, result);
      } catch (error) { return reply(res, error.status || 500, { error: error.status ? error.message : 'Unexpected error' }); }
    }
    try { return await api(req, res, url, store); }
    catch (error) { console.error('API error:', error); return reply(res, error.status || 500, { error: error.status ? error.message : 'Unexpected server error' }); }
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  // Serve only known static paths. All app routes return index.html.
  const file = ['/', '/index.html'].includes(url.pathname) || url.pathname.startsWith('/documents/') ? 'index.html' : url.pathname.replace(/^\//, '');
  const resolved = normalize(file);
  if (resolved.startsWith('..') || resolved.includes('\\') || resolved.startsWith('/')) { res.writeHead(404); return res.end(); }
  try {
    const target = join(PUBLIC_DIR, resolved);
    const info = await stat(target);
    if (!info.isFile()) { res.writeHead(404); return res.end(); }
    const content = await readFile(target);
    res.writeHead(200, { 'content-type': types[extname(target)] || 'application/octet-stream', 'cache-control': 'no-cache', 'x-content-type-options': 'nosniff' });
    return res.end(req.method === 'HEAD' ? undefined : content);
  } catch { res.writeHead(404); res.end('Not found'); }
}
export function makeServer(store = createStore()) {
  return createServer((req, res) => { route(req, res, store).catch(err => { console.error(err); if (!res.headersSent) reply(res, 500, { error: 'Unexpected server error' }); else res.end(); }); });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 3000);
  const server = makeServer();
  server.listen(port, '0.0.0.0', () => console.log(`CollabDoc running at http://localhost:${port}`));
}

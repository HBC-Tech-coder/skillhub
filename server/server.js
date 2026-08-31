// SkillHub 服务器端（零依赖，Node >= 18）
// 职责：静态托管 site/ + plugins.json；检索 API；管理 API（AI 维护入口）；触发爬虫。
// 用法：node server.js  （环境变量见 server/README.md）
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE_DIR = path.join(ROOT, 'site');
const DATA_DIR = path.join(ROOT, 'data');
const ENTRIES_DIR = path.join(DATA_DIR, 'entries');
const PLUGINS_JSON = path.join(DATA_DIR, 'plugins.json');
const PORT = Number(process.env.PORT || 4290);
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_TOKEN = process.env.SKILLHUB_ADMIN_TOKEN || '';
const { validateEntry } = require(path.join(ROOT, 'scripts', 'validate-entry.js'));
const admin = require('./lib/admin');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml; charset=utf-8', '.csv': 'text/csv; charset=utf-8' };

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}
function readPlugins() { return JSON.parse(fs.readFileSync(PLUGINS_JSON, 'utf8')); }
function isLoopback(req) { const a = req.socket.remoteAddress || ''; return a === '127.0.0.1' || a === '::1' || a === '::ffff:127.0.0.1'; }
function adminOk(req) {
  if (!ADMIN_TOKEN) return false;
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tok) return false;
  const a = Buffer.from(tok); const b = Buffer.from(ADMIN_TOKEN);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('body too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------- 超管后台（/api/panel/，会话保护） ----------
function ipOf(req) {
  return (req.headers['x-real-ip'] || req.socket.remoteAddress || '').split(',')[0].trim();
}
function isHttps(req) {
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase() === 'https';
}
function originOk(req) {
  // 变更类请求的 CSRF 防线（配合 SameSite=Strict cookie）：
  //   带 Origin 时：协议合法、HTTPS 前端必须 https、host 与请求 host 一致；无 Origin（非浏览器客户端）放行。
  const o = req.headers.origin;
  if (!o) return true;
  let u;
  try { u = new URL(o); } catch { return false; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return false;
  if (isHttps(req) && u.protocol !== 'https:') return false;
  return u.host === req.headers.host;
}
function setAuthCookie(res, req, token) {
  // 生产经 nginx TLS 终止 + X-Forwarded-Proto → 加 Secure；loopback http 调试不加（保持可用）。
  const secure = isHttps(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', admin.COOKIE_NAME + '=' + token + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200' + secure);
}
function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', admin.COOKIE_NAME + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
}
function authedSession(req) {
  return admin.sessionOf(admin.cookieOf(req));
}
function requireAdmin(req, res) {
  const s = authedSession(req);
  if (!s) { json(res, 401, { error: '未登录或会话已过期', code: 'NO_SESSION' }); return null; }
  if (s.role !== 'admin') { json(res, 403, { error: '首次登录须先修改密码并重新登录', code: 'MUST_CHANGE' }); return null; }
  return s;
}

async function handlePanel(req, res, url) {
  const p = url.pathname;
  const method = req.method;

  if (p === '/api/panel/session') {
    const s = authedSession(req);
    return json(res, 200, s ? { user: s.user, role: s.role, mustChange: s.role === 'mustChange' } : { user: null, role: null });
  }

  if (p === '/api/panel/login' && method === 'POST') {
    if (!originOk(req)) return json(res, 403, { error: 'origin mismatch' });
    const ip = ipOf(req);
    if (admin.loginBlocked(ip)) return json(res, 429, { error: '尝试过多，请 15 分钟后再试' });
    let body;
    try { body = JSON.parse(await readBody(req, 64 * 1024)); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    const st = admin.loadState();
    const userOk = String(body.user || '') === st.account.user;
    const passOk = admin.verifyPassword(String(body.pass || ''), st.account.salt, st.account.hash);
    if (!userOk || !passOk) { admin.loginFailed(ip); return json(res, 401, { error: '用户名或密码错误' }); }
    admin.loginOk(ip);
    const role = st.account.mustChange ? 'mustChange' : 'admin';
    const token = admin.createSession(role);
    setAuthCookie(res, req, token);
    return json(res, 200, { ok: true, user: st.account.user, mustChange: role === 'mustChange' });
  }

  if (p === '/api/panel/logout' && method === 'POST') {
    if (!originOk(req)) return json(res, 403, { error: 'origin mismatch' });
    admin.destroySession(admin.cookieOf(req));
    clearAuthCookie(res);
    return json(res, 200, { ok: true });
  }

  if (p === '/api/panel/change-password' && method === 'POST') {
    if (!originOk(req)) return json(res, 403, { error: 'origin mismatch' });
    const s = authedSession(req);
    if (!s) return json(res, 401, { error: '未登录', code: 'NO_SESSION' });
    let body;
    try { body = JSON.parse(await readBody(req, 64 * 1024)); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    const st = admin.loadState();
    if (!admin.verifyPassword(String(body.old || ''), st.account.salt, st.account.hash)) {
      return json(res, 400, { error: '当前密码不正确' });
    }
    const errs = admin.policyErrors(String(body.next || ''));
    if (errs.length) return json(res, 422, { error: '新密码不符合规则', details: errs });
    const h = admin.hashPassword(String(body.next));
    st.account.salt = h.salt;
    st.account.hash = h.hash;
    st.account.mustChange = false;
    st.account.changedAt = new Date().toISOString();
    admin.saveState();
    admin.destroyAll(); // 强制所有会话（含当前）下线 → 重新登录后才有完整超管权限
    clearAuthCookie(res);
    admin.appendRunlog({ task: 'auth', event: 'password-changed', user: st.account.user });
    return json(res, 200, { ok: true, relogin: true, note: '密码已更新，请重新登录' });
  }

  // —— 以下均需完整超管权限（已改密并重新登录）——
  if (!requireAdmin(req, res)) return;

  if (p === '/api/panel/config' && method === 'GET') {
    return json(res, 200, admin.publicConfig());
  }
  if (p === '/api/panel/config' && method === 'POST') {
    if (!originOk(req)) return json(res, 403, { error: 'origin mismatch' });
    let body;
    try { body = JSON.parse(await readBody(req, 64 * 1024)); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    try {
      const cfg = admin.saveConfig(body || {});
      admin.appendRunlog({ task: 'config', event: 'saved' });
      return json(res, 200, { ok: true, config: cfg });
    } catch (e) { return json(res, 422, { error: e.message }); }
  }
  if (p === '/api/panel/run' && method === 'POST') {
    if (!originOk(req)) return json(res, 403, { error: 'origin mismatch' });
    let body;
    try { body = JSON.parse(await readBody(req, 16 * 1024)); } catch { return json(res, 400, { error: 'invalid JSON' }); }
    try {
      admin.createRequest(String(body.task || ''));
      admin.appendRunlog({ task: String(body.task || ''), event: 'queued' });
      return json(res, 200, { ok: true, note: '已排队，tick 定时器 ≤5 分钟内执行，可在概览查看运行日志' });
    } catch (e) { return json(res, 400, { error: e.message }); }
  }
  if (p === '/api/panel/status') {
    const cfg = admin.publicConfig();
    return json(res, 200, {
      ok: true,
      now: new Date().toISOString(),
      dataUpdated: (() => { try { return readPlugins().updated; } catch { return null; } })(),
      count: (() => { try { return readPlugins().count; } catch { return null; } })(),
      config: cfg,
      runs: admin.readRunlog(50),
      drafts: admin.listDrafts().slice(0, 20),
    });
  }
  if (p === '/api/panel/promo-drafts') {
    return json(res, 200, { drafts: admin.listDrafts().slice(0, 50) });
  }
  if (p === '/api/panel/promo-draft') {
    try {
      return json(res, 200, { name: String(url.searchParams.get('name') || ''), content: admin.readDraft(String(url.searchParams.get('name') || '')) });
    } catch (e) { return json(res, 404, { error: e.message }); }
  }
  return json(res, 404, { error: 'not found' });
}

function serveStatic(req, res, pathname) {
  let p = pathname === '/' ? '/index.html' : pathname;
  p = decodeURIComponent(p).replace(/^\/+/, '');
  const file = path.normalize(path.join(SITE_DIR, p));
  if (!file.startsWith(SITE_DIR + path.sep) && file !== SITE_DIR) { res.writeHead(403); return res.end('forbidden'); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

function handleSearch(url) {
  const q = (url.searchParams.get('q') || '').toLowerCase();
  const eco = url.searchParams.get('eco') || '';
  const cat = url.searchParams.get('cat') || '';
  const limit = Math.min(Number(url.searchParams.get('limit') || 50) || 50, 200);
  const data = readPlugins();
  // 意图回退：意图词表命中 → 场景置顶（无 LLM 时的语义检索）
  let intentHits = {};
  try {
    const scen = JSON.parse(fs.readFileSync(path.join(SITE_DIR, 'scenarios.json'), 'utf8'));
    for (const [w, ids] of Object.entries(scen.intents || {})) {
      if (q && q.includes(w.toLowerCase())) for (const id of ids) intentHits[id] = (intentHits[id] || 0) + 1;
    }
  } catch { /* scenarios.json 缺失时纯关键词 */ }
  const scored = data.plugins.map((i) => {
    let score = 0;
    for (const s of i.scenarios || []) if (intentHits[s]) score += intentHits[s];
    return { i, score };
  });
  const hits = scored.filter(({ i, score }) => {
    if (eco && !(i.ecosystems || []).some((e) => e.id === eco)) return false;
    if (cat && i.category !== cat) return false;
    if (!q) return true;
    if (score > 0) return true;
    const hay = [i.name, i.owner, i.author, (i.description || {}).zh, (i.description || {}).en, (i.tags || []).join(' ')].join(' ').toLowerCase();
    return hay.includes(q);
  }).sort((a, b) => (b.score - a.score) || ((b.i.stars ?? -1) - (a.i.stars ?? -1)));
  const items = hits.slice(0, limit).map(({ i }) => i);
  return { total: hits.length, count: items.length, intent: Object.keys(intentHits).length > 0, items };
}

async function handleAdmin(req, res, url) {
  if (!isLoopback(req) || !adminOk(req)) return json(res, 403, { error: 'admin: loopback + Bearer token required' });
  const pathname = url.pathname;
  if (pathname === '/api/admin/entries' && req.method === 'POST') {
    let body;
    try { body = JSON.parse(await readBody(req, 1024 * 1024)); }
    catch (e) { return json(res, 400, { error: 'invalid JSON: ' + e.message }); }
    const errs = validateEntry(body);
    if (errs.length) return json(res, 422, { error: 'validation failed', details: errs });
    const file = path.join(ENTRIES_DIR, body.id + '.json');
    fs.mkdirSync(ENTRIES_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
    return json(res, 200, { ok: true, id: body.id, note: '已写入 entries，POST /api/admin/publish 后生效' });
  }
  if (pathname === '/api/admin/publish' && req.method === 'POST') {
    const out = await new Promise((resolve) => {
      const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'build-plugins.js')], { cwd: ROOT });
      let s = ''; let e = '';
      child.stdout.on('data', (d) => { s += d; }); child.stderr.on('data', (d) => { e += d; });
      child.on('close', (code) => resolve({ code, stdout: s, stderr: e }));
    });
    return json(res, out.code === 0 ? 200 : 500, { ok: out.code === 0, code: out.code, stdout: out.stdout, stderr: out.stderr });
  }
  const m = pathname.match(/^\/api\/admin\/crawl\/([a-z0-9-]+)$/);
  if (m && req.method === 'POST') {
    const eco = m[1];
    const crawlerName = eco === 'foreign' ? 'foreign.js' : eco + '.js';
    const crawler = path.join(__dirname, 'crawlers', crawlerName);
    if (!fs.existsSync(crawler)) return json(res, 404, { error: `unknown crawler: ${eco}` });
    const child = spawn(process.execPath, [crawler], { cwd: ROOT, detached: true, stdio: 'ignore' });
    child.unref();
    return json(res, 202, { ok: true, started: true, eco, note: '异步运行，结果写入 data/pending/' });
  }
  return json(res, 404, { error: 'not found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://' + req.headers.host);
  const p = url.pathname;
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type' }); return res.end(); }
  if (p === '/api/health') return json(res, 200, { ok: true, time: new Date().toISOString(), dataUpdated: (() => { try { return readPlugins().updated; } catch { return null; } })() });
  if (p === '/api/search') { try { return json(res, 200, handleSearch(url)); } catch (e) { return json(res, 500, { error: e.message }); } }
  if (p.startsWith('/api/items/')) {
    const id = p.slice('/api/items/'.length);
    const data = readPlugins();
    const item = data.plugins.find((x) => x.id === id);
    return item ? json(res, 200, item) : json(res, 404, { error: 'not found' });
  }
  if (p.startsWith('/api/panel/')) {
    // handlePanel 为 async：同步 throw 会成为 rejected promise，必须 .catch；
    // fail-closed：账号状态损坏/不可读时面板整体 503，绝不重置为默认口令，公开站点不受影响。
    return handlePanel(req, res, url).catch(() => {
      try { json(res, 503, { error: 'ADMIN_STATE_UNAVAILABLE', code: 'STATE_ERROR' }); } catch { /* res 已结束则忽略 */ }
    });
  }
  if (p.startsWith('/api/admin/')) return handleAdmin(req, res, url);
  if (p === '/admin' || p === '/admin/') {
    fs.readFile(path.join(SITE_DIR, 'admin.html'), (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      res.end(buf);
    });
    return;
  }
  if (p === '/plugins.json' || p === '/feed.xml' || p === '/skillhub.csv') {
    const file = path.join(DATA_DIR, p.slice(1));
    const type = { '/plugins.json': 'application/json; charset=utf-8', '/feed.xml': 'application/atom+xml; charset=utf-8', '/skillhub.csv': 'text/csv; charset=utf-8' }[p];
    fs.readFile(file, (err, buf) => {
      if (err) return json(res, 500, { error: p + ' 不存在，请先运行 build-plugins.js / export-csv.js' });
      res.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
      res.end(buf);
    });
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('method not allowed'); }
  serveStatic(req, res, p);
});

server.listen(PORT, HOST, () => {
  console.log(`[skillhub] listening http://${HOST}:${PORT}`);
  console.log(`[skillhub] admin ${ADMIN_TOKEN ? 'enabled (loopback + token)' : 'DISABLED (set SKILLHUB_ADMIN_TOKEN)'}`);
});

// 防御：未处理拒绝只记日志、不打崩整站（公开站点与检索 API 必须保持在线）
process.on('unhandledRejection', (err) => {
  console.error('[skillhub] unhandledRejection:', err && err.message ? err.message : err);
});

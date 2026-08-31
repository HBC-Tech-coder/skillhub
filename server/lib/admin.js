// SkillHub 超管后台核心（零依赖，Node 内置模块）。
// 职责：账户与口令（scrypt）、内存会话、登录限流、后台配置（API 密钥 + 管线调度 + 推广）、
//       立即执行请求标记、运行日志、推广草稿列表。
// 存储：data/.ops/（服务进程可写；.gitignore 排除，绝不上传 GitHub）。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OPS_DIR = path.join(__dirname, '..', '..', 'data', '.ops');
const STATE_FILE = path.join(OPS_DIR, 'admin.json');
const APP_ENV = path.join(OPS_DIR, 'app.env');
const REQUESTS_DIR = path.join(OPS_DIR, 'requests');
const RUNLOG = path.join(OPS_DIR, 'runlog.jsonl');
const DRAFTS_DIR = path.join(OPS_DIR, 'promo-drafts');

const DEFAULT_USER = 'admin';
const DEFAULT_PASS = 'admin888';
const COOKIE_NAME = 'skhub_admin';
const SESSION_TTL_MS = 12 * 3600 * 1000; // 12 小时滑动过期
const LOGIN_WINDOW_MS = 15 * 60 * 1000; // 限流窗口 15 分钟
const LOGIN_MAX_FAIL = 10;

// ---------- 基础 ----------
function ensureOps() {
  for (const dir of [OPS_DIR, REQUESTS_DIR, DRAFTS_DIR]) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    try { fs.chmodSync(dir, 0o700); } catch { /* Windows 下忽略 */ }
  }
}

function defaultState() {
  const { salt, hash } = hashPassword(DEFAULT_PASS);
  return {
    account: {
      user: DEFAULT_USER,
      salt,
      hash,
      mustChange: true, // 首次登录必须改密，改密后才有完整权限
      createdAt: new Date().toISOString(),
      changedAt: null,
    },
    keys: { deepseek: '', github: '' },
    pipeline: {
      syncEnabled: true,
      syncIntervalHours: 1,
      dailyEnabled: true,
      dailyTime: '04:00',
      promoEnabled: false,
      promoTime: '05:00',
      promoChannels: '',
      promoTemplate: '',
    },
  };
}

let state = null;
let stateError = null;
// 状态加载 fail-closed：
//   ENOENT（首次运行）→ 创建默认 admin/admin888（mustChange）；
//   其它读取/解析错误 → 保留原文件、置 stateError 并抛出，面板返回 503，绝不重置为默认口令。
function loadState() {
  ensureOps();
  if (state) return state;
  if (stateError) throw stateError;
  let raw;
  try {
    raw = fs.readFileSync(STATE_FILE, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') {
      state = defaultState();
      saveState();
      return state;
    }
    stateError = new Error('admin state unreadable (' + (e.code || e.message) + ') — file preserved, no reset');
    throw stateError;
  }
  try {
    state = JSON.parse(raw.replace(/^\uFEFF/, '')); // 容忍手写文件 BOM；语义损坏仍 fail-closed
  } catch (e) {
    stateError = new Error('admin state corrupted — file preserved, no reset to default password');
    throw stateError;
  }
  applyKeysToEnv();
  return state;
}

function saveState() {
  ensureOps();
  const tmp = STATE_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, STATE_FILE);
  try { fs.chmodSync(STATE_FILE, 0o600); } catch { /* Windows */ }
  writeAppEnv();
}

// data/.ops/app.env：供 sync/daily 周期脚本 source（脚本是 bash，读不了 JSON）。
// 双重防护：① 密钥字符集严格校验（仅字母数字 . _ -）——不合法直接拒绝，不落盘；
//           ② 写入时单引号包裹 + ' 转义，即使未来放宽校验也不会产生 shell 注入。
const KEY_CHARSET_RE = /^[A-Za-z0-9._-]+$/;
function shellQuote(s) {
  return "'" + String(s).replace(/'/g, "'\\''") + "'";
}
function writeAppEnv() {
  const lines = [];
  if (state.keys.deepseek) lines.push('DEEPSEEK_API_KEY=' + shellQuote(state.keys.deepseek));
  if (state.keys.github) lines.push('GITHUB_TOKEN=' + shellQuote(state.keys.github));
  fs.writeFileSync(APP_ENV, lines.join('\n') + (lines.length ? '\n' : ''), { mode: 0o600 });
}

function applyKeysToEnv() {
  if (state.keys.deepseek) process.env.DEEPSEEK_API_KEY = state.keys.deepseek;
  if (state.keys.github) process.env.GITHUB_TOKEN = state.keys.github;
}

// ---------- 口令 ----------
function hashPassword(pass) {
  const salt = crypto.randomBytes(16);
  return { salt: salt.toString('base64'), hash: crypto.scryptSync(pass, salt, 64).toString('base64') };
}

function verifyPassword(pass, saltB64, hashB64) {
  try {
    const got = crypto.scryptSync(String(pass), Buffer.from(saltB64, 'base64'), 64);
    const want = Buffer.from(hashB64, 'base64');
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  } catch { return false; }
}

// 密码规则：超过 8 个字符（≥9）；大写/小写/数字/特殊字符至少 3 类；不得与初始密码相同。
function policyErrors(pass) {
  const errs = [];
  if (typeof pass !== 'string' || pass.length < 9) errs.push('至少 9 个字符（超过 8 位）');
  if (typeof pass === 'string') {
    let kinds = 0;
    if (/[A-Z]/.test(pass)) kinds += 1;
    if (/[a-z]/.test(pass)) kinds += 1;
    if (/[0-9]/.test(pass)) kinds += 1;
    if (/[^A-Za-z0-9]/.test(pass)) kinds += 1;
    if (kinds < 3) errs.push('大写、小写、数字、特殊字符中至少包含 3 类');
  }
  if (pass === DEFAULT_PASS) errs.push('不能与初始密码相同');
  return errs;
}

// ---------- 会话（内存；服务重启后全部失效，需重新登录） ----------
const sessions = new Map(); // token -> {user, role, createdAt, lastUsed}
function pruneSessions() {
  const now = Date.now();
  for (const [t, s] of sessions) if (now - s.lastUsed > SESSION_TTL_MS) sessions.delete(t);
}
function createSession(role) {
  pruneSessions();
  const token = crypto.randomBytes(32).toString('base64url');
  sessions.set(token, { user: state.account.user, role, createdAt: Date.now(), lastUsed: Date.now() });
  return token;
}
function sessionOf(token) {
  if (!token) return null;
  const s = sessions.get(token);
  if (!s) return null;
  if (Date.now() - s.lastUsed > SESSION_TTL_MS) { sessions.delete(token); return null; }
  s.lastUsed = Date.now();
  return s;
}
function destroySession(token) { if (token) sessions.delete(token); }
function destroyAll() { sessions.clear(); }

function cookieOf(req) {
  const h = req.headers.cookie || '';
  const m = h.split(';').map((c) => c.trim()).find((c) => c.startsWith(COOKIE_NAME + '='));
  if (!m) return null;
  return m.slice(COOKIE_NAME.length + 1).trim() || null;
}

// ---------- 登录限流（按 IP，内存） ----------
const loginFails = new Map(); // ip -> {count, firstAt}
function loginBlocked(ip) {
  const now = Date.now();
  const rec = loginFails.get(ip);
  if (!rec) return false;
  if (now - rec.firstAt > LOGIN_WINDOW_MS) { loginFails.delete(ip); return false; }
  return rec.count >= LOGIN_MAX_FAIL;
}
function loginFailed(ip) {
  const now = Date.now();
  const rec = loginFails.get(ip);
  if (!rec || now - rec.firstAt > LOGIN_WINDOW_MS) loginFails.set(ip, { count: 1, firstAt: now });
  else rec.count += 1;
}
function loginOk(ip) { loginFails.delete(ip); }

// ---------- 配置 ----------
function maskKey(k) {
  if (!k) return '';
  if (k.length <= 8) return '****';
  return k.slice(0, 3) + '****' + k.slice(-4);
}

function publicConfig() {
  const p = state.pipeline;
  return {
    account: { user: state.account.user, mustChange: state.account.mustChange, createdAt: state.account.createdAt, changedAt: state.account.changedAt },
    keys: { deepseek: maskKey(state.keys.deepseek), github: maskKey(state.keys.github) },
    pipeline: {
      syncEnabled: !!p.syncEnabled,
      syncIntervalHours: p.syncIntervalHours || 1,
      dailyEnabled: !!p.dailyEnabled,
      dailyTime: p.dailyTime || '04:00',
      promoEnabled: !!p.promoEnabled,
      promoTime: p.promoTime || '05:00',
      promoChannels: p.promoChannels || '',
      promoTemplate: p.promoTemplate || '',
    },
  };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
function saveConfig(patch) {
  if (patch && patch.keys) {
    const k = patch.keys;
    if (typeof k.deepseek === 'string' && k.deepseek.trim() && k.deepseek !== '__KEEP__') {
      const v = k.deepseek.trim();
      if (v.length < 8 || v.length > 300 || !KEY_CHARSET_RE.test(v)) {
        throw new Error('DeepSeek key 非法：仅允许 8-300 位字母/数字/点/下划线/连字符（防 shell 注入）');
      }
      state.keys.deepseek = v;
    }
    if (typeof k.github === 'string' && k.github.trim() && k.github !== '__KEEP__') {
      const v = k.github.trim();
      if (v.length < 8 || v.length > 300 || !KEY_CHARSET_RE.test(v)) {
        throw new Error('GitHub token 非法：仅允许 8-300 位字母/数字/点/下划线/连字符（防 shell 注入）');
      }
      state.keys.github = v;
    }
  }
  if (patch && patch.pipeline) {
    const p = patch.pipeline;
    const cur = state.pipeline;
    if (typeof p.syncEnabled === 'boolean') cur.syncEnabled = p.syncEnabled;
    if (typeof p.dailyEnabled === 'boolean') cur.dailyEnabled = p.dailyEnabled;
    if (typeof p.promoEnabled === 'boolean') cur.promoEnabled = p.promoEnabled;
    if (p.syncIntervalHours !== undefined) {
      const n = Number(p.syncIntervalHours);
      if (!Number.isInteger(n) || n < 1 || n > 24) throw new Error('同步间隔需为 1-24 的整数小时');
      cur.syncIntervalHours = n;
    }
    if (p.dailyTime !== undefined) {
      if (!TIME_RE.test(String(p.dailyTime))) throw new Error('每日管线时间格式需为 HH:MM');
      cur.dailyTime = String(p.dailyTime);
    }
    if (p.promoTime !== undefined) {
      if (!TIME_RE.test(String(p.promoTime))) throw new Error('推广时间格式需为 HH:MM');
      cur.promoTime = String(p.promoTime);
    }
    if (typeof p.promoChannels === 'string' && p.promoChannels.length <= 2000) cur.promoChannels = p.promoChannels;
    if (typeof p.promoTemplate === 'string' && p.promoTemplate.length <= 2000) cur.promoTemplate = p.promoTemplate;
  }
  saveState();
  applyKeysToEnv();
  return publicConfig();
}

// ---------- 立即执行请求标记（UI 写入 → tick 定时器消费） ----------
function createRequest(task) {
  if (!['sync', 'daily', 'promo'].includes(task)) throw new Error('未知任务: ' + task);
  ensureOps();
  fs.writeFileSync(path.join(REQUESTS_DIR, task + '-' + Date.now() + '.json'), JSON.stringify({ task, at: new Date().toISOString() }), { mode: 0o600 });
}

// ---------- 运行日志 ----------
function appendRunlog(entry) {
  try {
    ensureOps();
    const line = JSON.stringify(Object.assign({ t: new Date().toISOString() }, entry));
    fs.appendFileSync(RUNLOG, line + '\n', { mode: 0o600 });
    // 只保留最近 200 行
    const lines = fs.readFileSync(RUNLOG, 'utf8').trim().split('\n');
    if (lines.length > 200) fs.writeFileSync(RUNLOG, lines.slice(-200).join('\n') + '\n', { mode: 0o600 });
  } catch { /* 日志尽力而为 */ }
}
function readRunlog(n) {
  n = Math.min(Number(n) || 50, 200);
  try {
    const lines = fs.readFileSync(RUNLOG, 'utf8').trim().split('\n').filter(Boolean);
    return lines.slice(-n).map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } }).reverse();
  } catch { return []; }
}

// ---------- 推广草稿 ----------
function listDrafts() {
  try {
    ensureOps();
    return fs.readdirSync(DRAFTS_DIR)
      .filter((f) => /^promo-\d{4}-\d{2}-\d{2}\.md$/.test(f))
      .sort().reverse();
  } catch { return []; }
}
function readDraft(name) {
  if (!/^promo-\d{4}-\d{2}-\d{2}\.md$/.test(name)) throw new Error('非法文件名');
  const p = path.join(DRAFTS_DIR, name);
  if (!fs.existsSync(p)) throw new Error('草稿不存在');
  return fs.readFileSync(p, 'utf8');
}

module.exports = {
  COOKIE_NAME, DEFAULT_USER, DEFAULT_PASS,
  loadState, saveState, applyKeysToEnv,
  hashPassword, verifyPassword, policyErrors,
  createSession, sessionOf, destroySession, destroyAll, cookieOf,
  loginBlocked, loginFailed, loginOk,
  publicConfig, saveConfig, maskKey,
  createRequest, appendRunlog, readRunlog,
  listDrafts, readDraft,
};

// SkillHub 管线门禁 + 运行日志（零依赖）。
// 用法：
//   node scripts/lib/pipeline-gate.js gate <sync|daily|promo>
//     按超管后台配置判定是否执行：放行 exit 0；跳过 exit 42（并向 stdout 输出原因）。
//   node scripts/lib/pipeline-gate.js log <task> <exitCode>
//     收尾：追加运行日志；成功时更新 data/.ops/last-runs.json（调度依据）。
// 设计：systemd 定时器与 tick 调度器都可能触发同一周期脚本，脚本入口统一先过 gate、
//       配合 flock 互斥，超管 UI 的开关/间隔/时间即唯一权威调度配置。
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const OPS = path.join(ROOT, 'data', '.ops');
const STATE_FILE = path.join(OPS, 'admin.json');
const LAST_FILE = path.join(OPS, 'last-runs.json');
const RUNLOG = path.join(OPS, 'runlog.jsonl');

function loadState() {
  let raw;
  try { raw = fs.readFileSync(STATE_FILE, 'utf8'); }
  catch (e) {
    // ENOENT=从未配置（旧行为，按默认放行）；其它读取失败 fail-closed（跳过并告警）
    return e.code === 'ENOENT' ? null : { __error: 'unreadable (' + (e.code || e.message) + ')' };
  }
  try { return JSON.parse(raw.replace(/^\uFEFF/, '')); } // 容忍 BOM
  catch (e) { return { __error: 'corrupted JSON' }; }
}
function loadLast() {
  try { return JSON.parse(fs.readFileSync(LAST_FILE, 'utf8')); } catch { return {}; }
}
function saveLast(last) {
  fs.mkdirSync(OPS, { recursive: true, mode: 0o700 });
  fs.writeFileSync(LAST_FILE, JSON.stringify(last, null, 2), { mode: 0o600 });
}
function todayStr(now) {
  const d = now || new Date();
  return d.toISOString().slice(0, 10);
}
function hhmm(now) {
  const d = now || new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}
// 时间一致性：gate 与 tick/systemd 定时器同机、同本地时区（CST），统一用 new Date() 本地时间。
// 判定用"到期以来"（due-since）而非分钟精确相等：tick 每 5 分钟、systemd 每日 04:00，
// 精确相等会让 02:01 这类时刻永远不触发。任务在时间点之后的第一个触发点执行（≤5 分钟偏差），
// 当日已成功执行（last-runs 日期 == 今天）则不再重复。

// 返回 {ok:bool, reason:string}
function shouldRun(task, now) {
  const t = now || new Date();
  // 超管后台"立即执行"请求：tick 调度器带 SKILLHUB_FORCE=1 触发，绕过开关/时间判定
  if (process.env.SKILLHUB_FORCE === '1') return { ok: true, reason: 'forced by admin request' };
  const cfg = loadState();
  // 无配置（从未打开过后台）→ 按默认放行，保持旧行为；配置损坏 → fail-closed 跳过（不违背管理员意图）
  if (cfg && cfg.__error) return { ok: false, reason: 'config ' + cfg.__error + ' — skipping (fail closed)' };
  if (!cfg || !cfg.pipeline) return { ok: true, reason: 'no config, default allow' };
  const p = cfg.pipeline;
  const last = loadLast();
  if (task === 'sync') {
    if (p.syncEnabled === false) return { ok: false, reason: 'sync disabled by admin' };
    const hours = Number(p.syncIntervalHours) || 1;
    const prev = last.sync ? new Date(last.sync).getTime() : 0;
    if (prev && t.getTime() - prev < hours * 3600 * 1000) return { ok: false, reason: 'sync not due (interval ' + hours + 'h)' };
    return { ok: true, reason: 'due' };
  }
  if (task === 'daily') {
    if (p.dailyEnabled === false) return { ok: false, reason: 'daily disabled by admin' };
    const time = p.dailyTime || '04:00';
    if (hhmm(t) < time) return { ok: false, reason: 'daily scheduled at ' + time + ', now ' + hhmm(t) };
    if (last.daily === todayStr(t)) return { ok: false, reason: 'daily already ran today' };
    return { ok: true, reason: 'due since ' + time + ' (now ' + hhmm(t) + ')' };
  }
  if (task === 'promo') {
    if (p.promoEnabled === false) return { ok: false, reason: 'promo disabled by admin' };
    const time = p.promoTime || '05:00';
    if (hhmm(t) < time) return { ok: false, reason: 'promo scheduled at ' + time + ', now ' + hhmm(t) };
    if (last.promo === todayStr(t)) return { ok: false, reason: 'promo already ran today' };
    return { ok: true, reason: 'due since ' + time + ' (now ' + hhmm(t) + ')' };
  }
  return { ok: false, reason: 'unknown task ' + task };
}

function appendRunlog(entry) {
  try {
    fs.mkdirSync(OPS, { recursive: true, mode: 0o700 });
    const line = JSON.stringify(Object.assign({ t: new Date().toISOString() }, entry));
    fs.appendFileSync(RUNLOG, line + '\n', { mode: 0o600 });
    const lines = fs.readFileSync(RUNLOG, 'utf8').trim().split('\n').filter(Boolean);
    if (lines.length > 200) fs.writeFileSync(RUNLOG, lines.slice(-200).join('\n') + '\n', { mode: 0o600 });
  } catch { /* 尽力而为 */ }
}

function recordResult(task, code) {
  appendRunlog({ task, event: 'finished', code: Number(code) || 0 });
  if (Number(code) === 0) {
    const last = loadLast();
    if (task === 'daily') last.daily = todayStr();
    else if (task === 'promo') last.promo = todayStr();
    else if (task === 'sync') last.sync = new Date().toISOString();
    saveLast(last);
  }
}

if (require.main === module) {
  const [cmd, task, code] = process.argv.slice(2);
  if (cmd === 'gate') {
    const r = shouldRun(task);
    console.log('[gate] ' + task + ': ' + r.reason);
    process.exit(r.ok ? 0 : 42);
  } else if (cmd === 'log') {
    recordResult(task, code);
    process.exit(0);
  } else {
    console.error('usage: pipeline-gate.js gate <task> | log <task> <code>');
    process.exit(2);
  }
}

module.exports = { shouldRun, appendRunlog, recordResult, loadState, loadLast, saveLast, todayStr, hhmm, OPS };

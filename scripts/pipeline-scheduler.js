// SkillHub tick 调度器（零依赖）。每 5 分钟由 skillhub-tick.timer 触发：
//   1) 消费超管后台"立即执行"请求标记（data/.ops/requests/*.json）→ 强制触发对应任务；
//   2) 按后台配置评估到期任务（同步间隔 / 每日管线时间 / 推广时间）→ 触发。
// 与 systemd 定时器并存：周期脚本内部同样走 pipeline-gate + flock，重复触发安全。
// 调度权威 = 超管后台 data/.ops/admin.json 的 pipeline 配置（缺失时按默认放行）。
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const gate = require('./lib/pipeline-gate');

const ROOT = path.join(__dirname, '..');
const OPS = gate.OPS;
const REQUESTS = path.join(OPS, 'requests');
const TASKS = ['sync', 'daily', 'promo'];

function spawnTask(task, force) {
  gate.appendRunlog({ task, event: 'started', by: 'tick-scheduler', forced: !!force });
  if (process.platform !== 'linux') {
    gate.appendRunlog({ task, event: 'skipped', by: 'tick-scheduler', reason: 'non-linux host' });
    return;
  }
  let cmd, args;
  if (task === 'promo') {
    cmd = process.execPath;
    args = [path.join(ROOT, 'scripts', 'promo-cycle.js')];
  } else {
    cmd = '/bin/bash';
    args = [path.join(ROOT, 'server', 'deploy', task + '-cycle.sh')];
  }
  try {
    const env = Object.assign({}, process.env, force ? { SKILLHUB_FORCE: '1' } : {});
    const child = spawn(cmd, args, { cwd: ROOT, detached: true, stdio: 'ignore', env });
    child.unref();
    console.log('[tick] started ' + task + (force ? ' (forced)' : ''));
  } catch (e) {
    gate.appendRunlog({ task, event: 'spawn-failed', by: 'tick-scheduler', reason: String(e.message || e) });
  }
}

function consumeRequests() {
  try {
    if (!fs.existsSync(REQUESTS)) return;
    const files = fs.readdirSync(REQUESTS);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const p = path.join(REQUESTS, f);
      let task = null;
      try {
        task = JSON.parse(fs.readFileSync(p, 'utf8')).task;
      } catch { /* 坏文件直接清掉 */ }
      fs.unlinkSync(p);
      if (TASKS.includes(task)) {
        console.log('[tick] 消费立即执行请求: ' + task);
        spawnTask(task, true);
      }
    }
  } catch (e) {
    console.error('[tick] requests error: ' + e.message);
  }
}

function evaluateDue() {
  const now = new Date();
  const cfg = gate.loadState();
  // 无配置时退化为默认调度：每小时 sync、04:00 daily —— 但 systemd 定时器已覆盖，
  // 为避免双触发，tick 只在配置存在时额外调度（配置不存在=旧行为，交给 systemd）。
  if (!cfg || !cfg.pipeline) return;
  for (const task of TASKS) {
    const r = gate.shouldRun(task, now);
    if (r.ok) {
      console.log('[tick] due task: ' + task + ' (' + r.reason + ')');
      spawnTask(task);
    }
  }
}

consumeRequests();
evaluateDue();

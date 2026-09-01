// pipeline-gate 回归测试（零依赖，node scripts/lib/pipeline-gate.test.js 直接运行，exit 0 = 全过）。
// 覆盖宿主预检契约：本地日历日一致性、同一天 08:05 不重复、跨本地午夜/次日、任意分钟、
// 同步间隔、FORCE 旁路、损坏配置 fail-closed。日期一律用本地时间构造器（时区无关语义）。
const fs = require('fs');
const path = require('path');
const gate = require('./pipeline-gate');

const OPS = gate.OPS;
const STATE_FILE = path.join(OPS, 'admin.json');
const LAST_FILE = path.join(OPS, 'last-runs.json');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('PASS  ' + name); }
  else { fail++; console.log('FAIL  ' + name + (extra ? '  [' + extra + ']' : '')); }
}

// 快照/恢复 data/.ops 的测试相关文件
const snap = {};
for (const f of [STATE_FILE, LAST_FILE]) {
  snap[f] = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
}
function writeCfg(pipeline) {
  fs.mkdirSync(OPS, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ account: { user: 'admin' }, keys: {}, pipeline }));
}
function setLast(last) {
  fs.mkdirSync(OPS, { recursive: true });
  fs.writeFileSync(LAST_FILE, JSON.stringify(last));
}

// 本地时间构造器（不依赖运行机器时区，语义=“本机日历”）
const L = (y, m, d, hh, mm) => new Date(y, m - 1, d, hh, mm, 0);

try {
  // 1. calendar_day_uses_local_date：任何本地时刻的 todayStr 都等于本地日历日（凌晨 00:00–07:59 是关键区间）
  for (const [hh, mm] of [[0, 30], [2, 5], [7, 59], [8, 0], [12, 0]]) {
    const d = L(2026, 9, 1, hh, mm);
    ok('calendar_day_uses_local_date@' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'),
      gate.todayStr(d) === '2026-09-01', 'got ' + gate.todayStr(d));
  }

  // 2. daily 同一天不重复（02:05 成功记账后 08:05 不再 due）
  writeCfg({ syncEnabled: true, syncIntervalHours: 1, dailyEnabled: true, dailyTime: '02:01', promoEnabled: false, promoTime: '05:00' });
  setLast({ daily: gate.todayStr(L(2026, 9, 1, 2, 5)) });
  ok('same_local_day_not_repeated_0805', gate.shouldRun('daily', L(2026, 9, 1, 8, 5)).ok === false,
    gate.shouldRun('daily', L(2026, 9, 1, 8, 5)).reason);

  // 3. promo 同一天不重复
  writeCfg({ syncEnabled: true, syncIntervalHours: 1, dailyEnabled: false, dailyTime: '04:00', promoEnabled: true, promoTime: '02:01' });
  setLast({ promo: gate.todayStr(L(2026, 9, 1, 2, 5)) });
  ok('promo_same_local_day_not_repeated_0805', gate.shouldRun('promo', L(2026, 9, 1, 8, 5)).ok === false,
    gate.shouldRun('promo', L(2026, 9, 1, 8, 5)).reason);

  // 4. 任意分钟：到期前不放行、到点与到点后放行
  writeCfg({ syncEnabled: true, syncIntervalHours: 1, dailyEnabled: true, dailyTime: '02:01', promoEnabled: false, promoTime: '05:00' });
  setLast({});
  ok('arbitrary_minute_before_not_due', gate.shouldRun('daily', L(2026, 9, 1, 2, 0)).ok === false);
  ok('arbitrary_minute_at_time_due', gate.shouldRun('daily', L(2026, 9, 1, 2, 1)).ok === true);
  ok('arbitrary_minute_after_due', gate.shouldRun('daily', L(2026, 9, 1, 2, 6)).ok === true);

  // 5. 本地午夜：前一晚记账不挡次日凌晨；同日晚间不重复
  writeCfg({ syncEnabled: true, syncIntervalHours: 1, dailyEnabled: true, dailyTime: '00:05', promoEnabled: false, promoTime: '05:00' });
  setLast({ daily: gate.todayStr(L(2026, 9, 1, 23, 59)) });
  ok('midnight_same_day_evening_not_due', gate.shouldRun('daily', L(2026, 9, 1, 23, 59)).ok === false);
  ok('midnight_next_day_00_30_due', gate.shouldRun('daily', L(2026, 9, 2, 0, 30)).ok === true);

  // 6. 次日到期：今天记账后，次日到点重新 due
  writeCfg({ syncEnabled: true, syncIntervalHours: 1, dailyEnabled: true, dailyTime: '02:01', promoEnabled: false, promoTime: '05:00' });
  setLast({ daily: gate.todayStr(L(2026, 9, 1, 2, 5)) });
  ok('next_day_due', gate.shouldRun('daily', L(2026, 9, 2, 2, 5)).ok === true);

  // 7. 同步间隔不受影响（时间戳语义）
  writeCfg({ syncEnabled: true, syncIntervalHours: 1, dailyEnabled: true, dailyTime: '04:00', promoEnabled: false, promoTime: '05:00' });
  const base = L(2026, 9, 1, 12, 0);
  setLast({ sync: new Date(base.getTime() - 30 * 60000).toISOString() });
  ok('sync_interval_not_due', gate.shouldRun('sync', base).ok === false);
  setLast({ sync: new Date(base.getTime() - 61 * 60000).toISOString() });
  ok('sync_interval_due', gate.shouldRun('sync', base).ok === true);

  // 8. FORCE 旁路（超管"立即执行"）
  process.env.SKILLHUB_FORCE = '1';
  ok('force_bypass', gate.shouldRun('daily', L(2026, 9, 1, 10, 0)).ok === true);
  delete process.env.SKILLHUB_FORCE;

  // 9. 损坏配置 fail-closed（不违背管理员意图，不按默认放行）
  fs.writeFileSync(STATE_FILE, '{broken');
  ok('corrupt_config_fail_closed', gate.shouldRun('daily', L(2026, 9, 1, 10, 0)).ok === false,
    gate.shouldRun('daily', L(2026, 9, 1, 10, 0)).reason);
  ok('corrupt_config_sync_fail_closed', gate.shouldRun('sync', L(2026, 9, 1, 10, 0)).ok === false);

  // 10. 无配置（从未打开过后台）→ 默认放行，保持旧行为
  fs.unlinkSync(STATE_FILE);
  setLast({});
  ok('no_config_default_allow', gate.shouldRun('sync', L(2026, 9, 1, 10, 0)).ok === true);
} finally {
  // 恢复快照
  for (const [f, content] of Object.entries(snap)) {
    try {
      if (content == null) fs.rmSync(f, { force: true });
      else { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); }
    } catch { /* ignore */ }
  }
}

console.log('');
console.log('RESULT: ' + pass + ' PASS / ' + fail + ' FAIL');
process.exit(fail === 0 ? 0 : 1);

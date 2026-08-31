// SkillHub: 单条目校验（零依赖）。用法：node scripts/validate-entry.js <entry.json>
const fs = require('fs');

const KINDS = ['plugin', 'skill', 'server', 'registry', 'theme', 'other'];
const STATUSES = ['active', 'archived', 'pending'];

function validateEntry(e, src) {
  const errs = [];
  const req = (cond, msg) => { if (!cond) errs.push(msg); };

  req(typeof e === 'object' && e !== null, '不是 JSON 对象');
  if (!e || typeof e !== 'object') return errs;
  req(typeof e.id === 'string' && /^[a-z0-9][a-z0-9._-]{0,127}$/.test(e.id), 'id 缺失或不合法（小写字母数字开头，可含 . _ -）');
  req(typeof e.name === 'string' && e.name.trim().length > 0 && e.name.length <= 120, 'name 缺失或超长');
  req(typeof e.owner === 'string' && e.owner.trim().length > 0, 'owner 缺失');
  req(typeof e.url === 'string' && /^https?:\/\//.test(e.url), 'url 缺失或不是 http(s)');
  req(typeof e.category === 'string' && e.category.trim().length > 0, 'category 缺失');
  req(e.description && typeof e.description.en === 'string' && e.description.en.trim().length > 0, 'description.en 缺失');
  req(e.description && typeof e.description.zh === 'string' && e.description.zh.trim().length > 0, 'description.zh 缺失');
  req(typeof e.install === 'string' && e.install.trim().length > 0, 'install 缺失');
  req(Array.isArray(e.ecosystems) && e.ecosystems.length > 0, 'ecosystems 缺失或为空');
  if (Array.isArray(e.ecosystems)) {
    e.ecosystems.forEach((ec, i) => {
      req(ec && typeof ec.id === 'string' && ec.id.trim(), `ecosystems[${i}].id 缺失`);
      req(ec && KINDS.includes(ec.kind), `ecosystems[${i}].kind 非法（${ec && ec.kind}）`);
      req(ec && typeof ec.install === 'string' && ec.install.trim(), `ecosystems[${i}].install 缺失`);
    });
  }
  req(typeof e.added === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e.added), 'added 缺失或不是 YYYY-MM-DD');
  if (e.npm !== undefined && e.npm !== null) req(typeof e.npm === 'string', 'npm 必须是字符串或 null');
  if (e.stars !== undefined && e.stars !== null) req(Number.isInteger(e.stars) && e.stars >= 0, 'stars 必须是非负整数或 null');
  if (e.downloads !== undefined && e.downloads !== null) req(Number.isInteger(e.downloads) && e.downloads >= 0, 'downloads 必须是非负整数或 null');
  if (e.kind !== undefined) req(KINDS.includes(e.kind), `kind 非法（${e.kind}）`);
  if (e.status !== undefined) req(STATUSES.includes(e.status), `status 非法（${e.status}）`);
  if (e.verified !== undefined) req(typeof e.verified === 'boolean', 'verified 必须是布尔');
  if (e.tags !== undefined) req(Array.isArray(e.tags), 'tags 必须是数组');
  if (e.scenarios !== undefined) req(Array.isArray(e.scenarios) && e.scenarios.every((s) => typeof s === 'string'), 'scenarios 必须是字符串数组');
  return errs;
}

function main() {
  const file = process.argv[2];
  if (!file) { console.error('用法: node scripts/validate-entry.js <entry.json>'); process.exit(2); }
  const src = fs.readFileSync(file, 'utf8');
  let e;
  try { e = JSON.parse(src); } catch (err) { console.error(`JSON 解析失败: ${err.message}`); process.exit(1); }
  const errs = validateEntry(e, src);
  if (errs.length) {
    console.error(`✗ ${file} 校验失败：`);
    for (const m of errs) console.error(`  - ${m}`);
    process.exit(1);
  }
  console.log(`✓ ${file} 校验通过 (${e.id})`);
}

module.exports = { validateEntry };
if (require.main === module) main();

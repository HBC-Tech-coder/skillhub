// SkillHub: 校验全部条目。用法：node scripts/validate-all.js
const fs = require('fs');
const path = require('path');
const { validateEntry } = require('./validate-entry.js');

const ENTRIES_DIR = path.resolve(__dirname, '..', 'data', 'entries');

function main() {
  if (!fs.existsSync(ENTRIES_DIR)) { console.error('entries 目录不存在'); process.exit(1); }
  const files = fs.readdirSync(ENTRIES_DIR).filter((f) => f.endsWith('.json'));
  let fails = 0;
  const ids = new Set();
  for (const f of files) {
    const p = path.join(ENTRIES_DIR, f);
    let e;
    try { e = JSON.parse(fs.readFileSync(p, 'utf8')); }
    catch (err) { console.error(`✗ ${f}: JSON 解析失败 ${err.message}`); fails++; continue; }
    if (ids.has(e.id)) { console.error(`✗ ${f}: id 重复 (${e.id})`); fails++; }
    ids.add(e.id);
    const errs = validateEntry(e, p);
    if (errs.length) { console.error(`✗ ${f}:`); errs.forEach((m) => console.error(`  - ${m}`)); fails++; }
    else console.log(`✓ ${f} (${e.id})`);
  }
  if (fails) { console.error(`\n校验失败 ${fails} 处`); process.exit(1); }
  console.log(`\n全部通过：${files.length} 个条目`);
}

main();

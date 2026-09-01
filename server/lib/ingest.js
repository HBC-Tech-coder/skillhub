// AI 自动收录：把 labeled-*.json 中 keep:true 的草稿转正为 entries（幂等，已存在跳过）。
// 用法：node server/lib/ingest.js [labeled文件]（默认取最新 labeled-*.json）
// 红线：仅写入 data/entries/<id>.json；不覆盖既有条目；verified 一律 false（AI 打标非人工核验）。
const fs = require('fs');
const path = require('path');
const { CATEGORY_BY_SCENARIO } = require('../../scripts/lib/scenarios.js');
const { localDate } = require('../../scripts/lib/dates.js');

const ROOT = path.resolve(__dirname, '..', '..');
const PENDING_DIR = path.join(ROOT, 'data', 'pending');
const ENTRIES_DIR = path.join(ROOT, 'data', 'entries');

function latestLabeled() {
  const files = fs.readdirSync(PENDING_DIR).filter((f) => f.startsWith('labeled-') && f.endsWith('.json')).sort();
  return files.length ? path.join(PENDING_DIR, files[files.length - 1]) : null;
}

function main() {
  const arg = process.argv[2];
  const labeledFile = arg ? path.resolve(arg) : latestLabeled();
  if (!labeledFile || !fs.existsSync(labeledFile)) {
    console.error('[ingest] 无 labeled 文件（先跑 node server/lib/label.js）');
    process.exit(1);
  }
  const labeled = JSON.parse(fs.readFileSync(labeledFile, 'utf8'));
  const byId = {};
  // 草稿原始数据：从 pending 各文件合并
  for (const f of fs.readdirSync(PENDING_DIR)) {
    if (!f.endsWith('.json') || f.startsWith('review') || f.startsWith('labeled')) continue;
    try {
      const d = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, f), 'utf8'));
      (d.items || []).forEach((i) => { if (!byId[i.id]) byId[i.id] = i; });
    } catch { /* ignore */ }
  }
  const today = localDate(); // 本地日历日（勿用 UTC）
  // URL 级去重：已收录条目（含不同 slug 的同仓库）不重复入库
  const existingUrls = new Set();
  for (const f of fs.readdirSync(ENTRIES_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const e = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, f), 'utf8'));
      if (e.url) existingUrls.add(String(e.url).toLowerCase().replace(/\/$/, ''));
    } catch { /* ignore */ }
  }
  let created = 0, skipped = 0;
  for (const r of labeled.items || []) {
    if (!r.keep) continue;
    const d = byId[r.id];
    if (!d) { skipped++; continue; }
    const file = path.join(ENTRIES_DIR, r.id + '.json');
    if (fs.existsSync(file)) { skipped++; continue; }
    if (d.url && existingUrls.has(String(d.url).toLowerCase().replace(/\/$/, ''))) { skipped++; continue; }
    const scenarios = (r.scenarios || []).filter((s) => typeof s === 'string').slice(0, 3);
    const eco = (d.ecosystems || [])[0] || { id: 'generic', kind: 'other', install: `git clone ${d.url}` };
    const entry = {
      id: r.id,
      name: d.name || r.id,
      owner: d.owner || '',
      url: d.url,
      category: CATEGORY_BY_SCENARIO[scenarios[0]] || 'tools',
      description: {
        en: ((d.description && d.description.en) || '').slice(0, 300) || r.descZh || d.name,
        zh: r.descZh || ((d.description && d.description.zh) || '（待补充）'),
      },
      install: eco.install || `git clone ${d.url}`,
      ecosystems: d.ecosystems || [{ id: eco.id, kind: eco.kind || 'skill', install: `git clone ${d.url}` }],
      scenarios,
      audience: { zh: r.audienceZh || '', en: r.audienceEn || '' },
      usecases: { zh: r.usecasesZh || '', en: r.usecasesEn || '' },
      added: today,
      npm: d.npm || null,
      tarball: null,
      stars: d.stars ?? null,
      downloads: null,
      screenshots: [],
      kind: d.kind || eco.kind || 'skill',
      license: d.license || null,
      author: d.owner || '',
      tags: (d.tags || []).slice(0, 10),
      verified: false,
      status: 'active',
    };
    fs.writeFileSync(file, JSON.stringify(entry, null, 2) + '\n');
    created++;
  }
  console.log(`[ingest] 新增 ${created} 条，跳过 ${skipped} 条（已存在/缺草稿）`);
}

main();

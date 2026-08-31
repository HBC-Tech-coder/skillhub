// SkillHub: 导出扁平 CSV（Hugging Face datasets 等渠道用）。用法：node scripts/export-csv.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'data', 'plugins.json');
const OUT = path.join(ROOT, 'data', 'skillhub.csv');

function main() {
  const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const cols = ['id', 'name', 'owner', 'url', 'category', 'description_zh', 'description_en', 'install', 'ecosystems', 'kinds', 'stars', 'downloads', 'license', 'verified', 'added'];
  const esc = (v) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const rows = data.plugins.map((p) => [
    p.id, p.name, p.owner, p.url, p.category,
    (p.description && p.description.zh) || '', (p.description && p.description.en) || '',
    p.install,
    (p.ecosystems || []).map((e) => e.id).join('|'),
    (p.ecosystems || []).map((e) => e.kind).join('|'),
    p.stars != null ? p.stars : '', p.downloads != null ? p.downloads : '',
    p.license || '', p.verified ? 'true' : 'false', p.added,
  ].map(esc).join(','));
  fs.writeFileSync(OUT, cols.join(',') + '\n' + rows.join('\n') + '\n');
  console.log(`[export] ${rows.length} rows -> ${path.relative(ROOT, OUT)}`);
}

main();

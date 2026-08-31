// SkillHub 草稿审阅助手：检查 pending 草稿是否真是可安装的 DSH bundle。
// 证据：仓库根 package.json 的 dsh.bundle.patch 字段 + cordis.patch.yml 存在性。
// 用法：node scripts/review-pending.js [pending文件] [--limit N] [--eco dsh]
// 限速：未认证 60 次/小时（搜索已计入），每次调用间隔约 2.5s；可用 GITHUB_TOKEN 提速。
const fs = require('fs');
const path = require('path');
const { ghGet } = require('../server/lib/github.js');

const ROOT = path.resolve(__dirname, '..');
const PENDING_DIR = path.join(ROOT, 'data', 'pending');
const TOKEN = process.env.GITHUB_TOKEN || '';

function b64utf8(s) { try { return Buffer.from(s, 'base64').toString('utf8'); } catch { return ''; } }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function repoFile(fullName, file, token) {
  try {
    const res = await ghGet(`/repos/${fullName}/contents/${file}`, token);
    return { found: true, content: res.content ? b64utf8(res.content) : '' };
  } catch (e) {
    if (String(e.message).includes('404')) return { found: false };
    if (String(e.message).includes('rate limited')) throw e;
    return { found: false, error: e.message };
  }
}

async function reviewItem(item) {
  const out = { id: item.id, name: item.name, owner: item.owner, stars: item.stars ?? null, url: item.url };
  const pkg = await repoFile(item.url.replace('https://github.com/', '').replace(/\/$/, ''), 'package.json', TOKEN);
  out.hasPackageJson = pkg.found;
  let dshBundle = false;
  let clientInfo = null;
  if (pkg.found && pkg.content) {
    try {
      const j = JSON.parse(pkg.content);
      if (j.dsh && j.dsh.bundle && typeof j.dsh.bundle.patch === 'string') dshBundle = true;
      if (j.dsh && j.dsh.client) clientInfo = { platform: j.dsh.client.platform || null, immediately: !!j.dsh.client.immediately };
    } catch { /* 非 JSON 视为无 bundle */ }
  }
  out.dshBundle = dshBundle;
  out.client = clientInfo;
  const patch = await repoFile(item.url.replace('https://github.com/', '').replace(/\/$/, ''), 'cordis.patch.yml', TOKEN);
  out.hasCordisPatch = patch.found;
  out.verdict = dshBundle || patch.found ? 'BUNDLE_CONFIRMED' : (pkg.found ? 'NOT_A_BUNDLE' : 'UNKNOWN_NO_PACKAGE_JSON');
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const ecoFilter = args.includes('--eco') ? args[args.indexOf('--eco') + 1] : null;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1] || 12) : 12;
  const skipIdx = args.indexOf('--skip');
  const skip = skipIdx >= 0 ? Number(args[skipIdx + 1] || 0) : 0;
  const fileArg = args.find((a) => a.endsWith('.json') && !a.startsWith('--'));
  const files = fileArg ? [path.resolve(fileArg)] : fs.readdirSync(PENDING_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(PENDING_DIR, f));
  const results = [];
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    let items = data.items || [];
    if (ecoFilter) items = items.filter((i) => (i.ecosystems || []).some((e) => e.id === ecoFilter));
    items.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1));
    for (const item of items.slice(skip, skip + limit)) {
      try {
        results.push(await reviewItem(item));
      } catch (e) {
        console.error(`[review] ${item.id}: ${e.message} —— 停止继续（限速保护）`);
        break;
      }
      await sleep(2500);
    }
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const outFile = path.join(PENDING_DIR, `review-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ reviewedAt: new Date().toISOString(), eco: ecoFilter || 'all', results }, null, 2) + '\n');
  const confirmed = results.filter((r) => r.verdict === 'BUNDLE_CONFIRMED');
  console.log(`[review] ${results.length} checked | BUNDLE_CONFIRMED ${confirmed.length} | report: ${outFile}`);
  for (const r of results) {
    console.log(`${r.verdict.padEnd(20)} ⭐${String(r.stars ?? '-').padStart(6)}  ${r.id}`);
  }
  console.log('\nBUNDLE_CONFIRMED 可直接转正（install = dsh plugin add github:owner/repo）：');
  confirmed.forEach((r) => console.log(`  - ${r.id} ${r.client ? `(client: ${r.client.platform || '?'})` : ''}`));
}

main().catch((e) => { console.error('[review] fatal:', e.message); process.exit(1); });

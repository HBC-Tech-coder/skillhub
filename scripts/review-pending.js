// SkillHub 草稿审阅助手（跨生态）。
// - dsh：核验 package.json 的 dsh.bundle.patch + cordis.patch.yml（可安装 bundle 证据）。
// - mcp：README 中 MCP 协议标记（mcpServers / Model Context Protocol）。
// - workbuddy / trae / 其他技能生态：根 SKILL.md（raw 免费通道）或 skills 目录。
// 用法：node scripts/review-pending.js [pending文件] [--eco dsh|mcp|workbuddy|trae] [--limit N] [--skip N]
// 限速：GitHub API 未认证 60 次/小时；raw.githubusercontent 不计限速。
const fs = require('fs');
const path = require('path');
const { ghGet, rawGetText } = require('../server/lib/github.js');

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

async function reviewDsh(item) {
  const repo = item.url.replace('https://github.com/', '').replace(/\/$/, '');
  const out = { id: item.id, name: item.name, owner: item.owner, stars: item.stars ?? null, eco: 'dsh' };
  const pkg = await repoFile(repo, 'package.json', TOKEN);
  out.hasPackageJson = pkg.found;
  let dshBundle = false;
  if (pkg.found && pkg.content) {
    try {
      const j = JSON.parse(pkg.content);
      if (j.dsh && j.dsh.bundle && typeof j.dsh.bundle.patch === 'string') dshBundle = true;
    } catch { /* ignore */ }
  }
  out.dshBundle = dshBundle;
  const patch = await repoFile(repo, 'cordis.patch.yml', TOKEN);
  out.hasCordisPatch = patch.found;
  out.verdict = dshBundle || patch.found ? 'BUNDLE_CONFIRMED' : (pkg.found ? 'NOT_A_BUNDLE' : 'UNKNOWN_NO_PACKAGE_JSON');
  return out;
}

async function reviewMcp(item) {
  const repo = item.url.replace('https://github.com/', '').replace(/\/$/, '');
  const out = { id: item.id, name: item.name, owner: item.owner, stars: item.stars ?? null, eco: 'mcp' };
  const readme = await rawGetText(repo, 'README.md');
  out.hasReadme = !!readme;
  out.mcpMarkers = /mcpServers|modelcontextprotocol|Model Context Protocol/i.test(readme);
  out.verdict = out.mcpMarkers ? 'MCP_LIKELY' : 'MCP_UNLIKELY';
  return out;
}

async function reviewSkillEco(item, eco) {
  const repo = item.url.replace('https://github.com/', '').replace(/\/$/, '');
  const out = { id: item.id, name: item.name, owner: item.owner, stars: item.stars ?? null, eco };
  const rootSkill = await rawGetText(repo, 'SKILL.md');
  out.hasRootSkill = !!rootSkill;
  let skillsDir = false;
  if (!out.hasRootSkill) {
    try {
      const listing = await ghGet(`/repos/${repo}/contents/`, TOKEN);
      skillsDir = Array.isArray(listing) && listing.some((f) => f.type === 'dir' && (f.name === 'skills' || f.name === 'Skills'));
    } catch (e) {
      if (String(e.message).includes('rate limited')) throw e;
      skillsDir = false;
    }
  }
  out.hasSkillsDir = skillsDir;
  out.verdict = out.hasRootSkill || skillsDir ? 'SKILL_LIKELY' : 'SKILL_UNLIKELY';
  return out;
}

async function reviewItem(item, eco) {
  if (eco === 'dsh') return reviewDsh(item);
  if (eco === 'mcp') return reviewMcp(item);
  return reviewSkillEco(item, eco);
}

async function main() {
  const args = process.argv.slice(2);
  const eco = args.includes('--eco') ? args[args.indexOf('--eco') + 1] : null;
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1] || 10) : 10;
  const skipIdx = args.indexOf('--skip');
  const skip = skipIdx >= 0 ? Number(args[skipIdx + 1] || 0) : 0;
  const fileArg = args.find((a) => a.endsWith('.json') && !a.startsWith('--'));
  const files = fileArg ? [path.resolve(fileArg)] : fs.readdirSync(PENDING_DIR).filter((f) => f.endsWith('.json')).map((f) => path.join(PENDING_DIR, f));
  const results = [];
  for (const f of files) {
    let data;
    try { data = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { continue; }
    let items = data.items || [];
    if (eco) items = items.filter((i) => (i.ecosystems || []).some((e) => e.id === eco));
    items.sort((a, b) => (b.stars ?? -1) - (a.stars ?? -1));
    const ecoOf = (i) => ((i.ecosystems || [])[0] || {}).id || eco;
    for (const item of items.slice(skip, skip + limit)) {
      try {
        results.push(await reviewItem(item, ecoOf(item)));
      } catch (e) {
        console.error(`[review] ${item.id}: ${e.message} —— 停止继续（限速保护）`);
        break;
      }
      await sleep(1200);
    }
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const outFile = path.join(PENDING_DIR, `review-${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify({ reviewedAt: new Date().toISOString(), eco: eco || 'all', results }, null, 2) + '\n');
  const GOOD = new Set(['BUNDLE_CONFIRMED', 'MCP_LIKELY', 'SKILL_LIKELY']);
  const good = results.filter((r) => GOOD.has(r.verdict));
  console.log(`[review] ${results.length} checked | 可转正候选 ${good.length} | report: ${outFile}`);
  for (const r of results) {
    console.log(`${r.verdict.padEnd(22)} ⭐${String(r.stars ?? '-').padStart(7)}  [${r.eco}] ${r.id}`);
  }
  console.log('\n可转正候选：');
  good.forEach((r) => console.log(`  - [${r.eco}] ${r.id} (${r.verdict})`));
}

main().catch((e) => { console.error('[review] fatal:', e.message); process.exit(1); });

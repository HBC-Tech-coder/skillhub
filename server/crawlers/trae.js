// TRAE 技能/插件爬虫：GitHub topic + 文本搜索（各 top 200）合并去重（topic 命名仍在社区形成中）。
// 噪音过滤：'trae' 是 'traefik' 的子串，文本搜索会捞进大量 traefik 插件；同时排除其他明显无关仓库。
const fs = require('fs');
const path = require('path');
const { searchReposPaged } = require('../lib/github.js');
const { repoToDraft } = require('../lib/draft.js');

const ECO = 'trae';
const TOKEN = process.env.GITHUB_TOKEN || '';
const TOP = 200;
const STAR_FLOOR = 3;
const NOISE = /traefik|proxy|middleware|geoblock|modsecurity|ondemand|wake-on-lan/i;
const QUERIES = ['topic:trae', 'trae skills in:name,description', 'trae plugin in:name,description'];

(async () => {
  try {
    const seen = new Map();
    for (const q of QUERIES) {
      const repos = await searchReposPaged(q, TOP, TOKEN, 100);
      for (const r of repos) {
        const txt = (r.name || '') + ' ' + (r.description || '');
        if (!seen.has(r.full_name) && !NOISE.test(txt) && (r.stargazers_count || 0) >= STAR_FLOOR) {
          seen.set(r.full_name, r);
        }
      }
    }
    const drafts = [...seen.values()].map((r) => repoToDraft(r, ECO));
    const dir = path.resolve(__dirname, '..', '..', 'data', 'pending');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const out = path.join(dir, `${ECO}-${ts}.json`);
    fs.writeFileSync(out, JSON.stringify({ source: 'github:topics/text:trae(top200)', crawledAt: new Date().toISOString(), items: drafts }, null, 2) + '\n');
    console.log(`[crawler:${ECO}] ${drafts.length} drafts (>=${STAR_FLOOR}★, noise filtered) -> ${out}`);
  } catch (e) {
    console.error(`[crawler:${ECO}] failed: ${e.message}`);
    process.exit(1);
  }
})();

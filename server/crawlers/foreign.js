// 国外生态爬虫：claude-code / codex / gemini（技能类仓库，各查询 top 200），草稿入 data/pending/。
// 用法：node server/crawlers/foreign.js [--eco claude-code|codex|gemini]（默认全部）
const fs = require('fs');
const path = require('path');
const { searchReposPaged } = require('../lib/github.js');
const { repoToDraft } = require('../lib/draft.js');

const TOKEN = process.env.GITHUB_TOKEN || '';
const TOP = 200;
const STAR_FLOOR = 5;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const QUERIES = {
  'claude-code': ['topic:claude-skills', 'topic:claude-skill', 'claude code skills in:name,description'],
  codex: ['topic:codex-skills', 'codex skills in:name,description'],
  gemini: ['topic:gemini-cli', 'gemini cli skills in:name,description'],
};
const NOISE = /interview|test|demo|example-only/i;

(async () => {
  const args = process.argv.slice(2);
  const only = args.includes('--eco') ? args[args.indexOf('--eco') + 1] : null;
  const ecos = only ? [only] : Object.keys(QUERIES);
  for (const eco of ecos) {
    const seen = new Map();
    for (const q of QUERIES[eco] || []) {
      try {
        const repos = await searchReposPaged(q, TOP, TOKEN, 100);
        for (const r of repos) {
          const txt = (r.name || '') + ' ' + (r.description || '');
          if (!seen.has(r.full_name) && !NOISE.test(txt) && (r.stargazers_count || 0) >= STAR_FLOOR) {
            seen.set(r.full_name, r);
          }
        }
      } catch (e) {
        console.error(`[crawler:${eco}] ${q} failed: ${e.message}`);
      }
      await sleep(1500);
    }
    const drafts = [...seen.values()].map((r) => repoToDraft(r, eco));
    const dir = path.resolve(__dirname, '..', '..', 'data', 'pending');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const out = path.join(dir, `${eco}-${ts}.json`);
    fs.writeFileSync(out, JSON.stringify({ source: `github:${eco}(top200)`, crawledAt: new Date().toISOString(), items: drafts }, null, 2) + '\n');
    console.log(`[crawler:${eco}] ${drafts.length} drafts (>=${STAR_FLOOR}★, noise filtered) -> ${out}`);
  }
})();

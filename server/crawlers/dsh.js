// DSH 插件爬虫：GitHub topic:dsh-plugin（top 200，星标门槛 ≥3），结果写入 data/pending/
const fs = require('fs');
const path = require('path');
const { searchReposPaged } = require('../lib/github.js');
const { repoToDraft } = require('../lib/draft.js');

const ECO = 'dsh';
const TOKEN = process.env.GITHUB_TOKEN || '';
const TOP = 200;
const STAR_FLOOR = 3;

(async () => {
  try {
    const repos = await searchReposPaged('topic:dsh-plugin', TOP, TOKEN, 100);
    const picked = repos.filter((r) => (r.stargazers_count || 0) >= STAR_FLOOR);
    const drafts = picked.map((r) => repoToDraft(r, ECO));
    const dir = path.resolve(__dirname, '..', '..', 'data', 'pending');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const out = path.join(dir, `${ECO}-${ts}.json`);
    fs.writeFileSync(out, JSON.stringify({ source: 'github-topic:dsh-plugin(top200)', crawledAt: new Date().toISOString(), items: drafts }, null, 2) + '\n');
    console.log(`[crawler:${ECO}] ${repos.length} repos -> ${drafts.length} drafts (>=${STAR_FLOOR}★) -> ${out}`);
  } catch (e) {
    console.error(`[crawler:${ECO}] failed: ${e.message}`);
    process.exit(1);
  }
})();

// DSH 插件爬虫：GitHub topic:dsh-plugin，结果写入 data/pending/
const fs = require('fs');
const path = require('path');
const { searchRepos } = require('../lib/github.js');
const { repoToDraft } = require('../lib/draft.js');

const ECO = 'dsh';
const TOKEN = process.env.GITHUB_TOKEN || '';

(async () => {
  try {
    const res = await searchRepos('topic:dsh-plugin', 30, TOKEN);
    const repos = res.items || [];
    const drafts = repos.map((r) => repoToDraft(r, ECO));
    const dir = path.resolve(__dirname, '..', '..', 'data', 'pending');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const out = path.join(dir, `${ECO}-${ts}.json`);
    fs.writeFileSync(out, JSON.stringify({ source: 'github-topic:dsh-plugin', crawledAt: new Date().toISOString(), items: drafts }, null, 2) + '\n');
    console.log(`[crawler:${ECO}] ${drafts.length} drafts -> ${out}`);
  } catch (e) {
    console.error(`[crawler:${ECO}] failed: ${e.message}`);
    process.exit(1);
  }
})();

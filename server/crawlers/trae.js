// TRAE 技能/插件爬虫：GitHub topic 搜索（topic 命名仍在社区形成中，命中率低属预期）。
const fs = require('fs');
const path = require('path');
const { searchRepos } = require('../lib/github.js');
const { repoToDraft } = require('../lib/draft.js');

const ECO = 'trae';
const TOKEN = process.env.GITHUB_TOKEN || '';

(async () => {
  try {
    const res = await searchRepos('topic:trae OR topic:trae-skills OR topic:trae-plugin', 30, TOKEN);
    const repos = res.items || [];
    const drafts = repos.map((r) => repoToDraft(r, ECO));
    const dir = path.resolve(__dirname, '..', '..', 'data', 'pending');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const out = path.join(dir, `${ECO}-${ts}.json`);
    fs.writeFileSync(out, JSON.stringify({ source: 'github-topics:trae', crawledAt: new Date().toISOString(), items: drafts }, null, 2) + '\n');
    console.log(`[crawler:${ECO}] ${drafts.length} drafts -> ${out}（TRAE topic 生态未定型，请人工筛噪）`);
  } catch (e) {
    console.error(`[crawler:${ECO}] failed: ${e.message}`);
    process.exit(1);
  }
})();

// TRAE 技能/插件爬虫：GitHub topic + 文本搜索合并去重（topic 命名仍在社区形成中，命中率低属预期）。
const fs = require('fs');
const path = require('path');
const { searchRepos } = require('../lib/github.js');
const { repoToDraft } = require('../lib/draft.js');

const ECO = 'trae';
const TOKEN = process.env.GITHUB_TOKEN || '';
const QUERIES = ['topic:trae', 'trae skills in:name,description', 'trae plugin in:name,description'];

(async () => {
  try {
    const seen = new Map();
    for (const q of QUERIES) {
      const res = await searchRepos(q, 20, TOKEN);
      for (const r of res.items || []) if (!seen.has(r.full_name)) seen.set(r.full_name, r);
    }
    const drafts = [...seen.values()].map((r) => repoToDraft(r, ECO));
    const dir = path.resolve(__dirname, '..', '..', 'data', 'pending');
    fs.mkdirSync(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
    const out = path.join(dir, `${ECO}-${ts}.json`);
    fs.writeFileSync(out, JSON.stringify({ source: 'github:topics/text:trae', crawledAt: new Date().toISOString(), items: drafts }, null, 2) + '\n');
    console.log(`[crawler:${ECO}] ${drafts.length} drafts -> ${out}（TRAE topic 生态未定型，请人工筛噪）`);
  } catch (e) {
    console.error(`[crawler:${ECO}] failed: ${e.message}`);
    process.exit(1);
  }
})();

// WorkBuddy 技能爬虫：GitHub topic + 文本搜索合并去重，结果写入 data/pending/
// 注：GitHub 搜索 API 的 OR 只作用于文本词，不能用于 topic: 限定符，故分两次查询。
const fs = require('fs');
const path = require('path');
const { searchRepos } = require('../lib/github.js');
const { repoToDraft } = require('../lib/draft.js');

const ECO = 'workbuddy';
const TOKEN = process.env.GITHUB_TOKEN || '';
const QUERIES = ['topic:workbuddy', 'workbuddy skills in:name,description'];

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
    fs.writeFileSync(out, JSON.stringify({ source: 'github:topic:workbuddy + text search', crawledAt: new Date().toISOString(), items: drafts }, null, 2) + '\n');
    console.log(`[crawler:${ECO}] ${drafts.length} drafts -> ${out}`);
  } catch (e) {
    console.error(`[crawler:${ECO}] failed: ${e.message}`);
    process.exit(1);
  }
})();

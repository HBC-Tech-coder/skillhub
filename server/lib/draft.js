// GitHub 仓库 -> SkillHub 条目草稿（爬虫共用）。
// 草稿进入 data/pending/ 待人工/AI 审阅，不直接进 entries/。
const ECO_DEFAULTS = {
  dsh: { kind: 'plugin', install: (r) => `dsh plugin --profile web add github:${r.full_name}` },
  workbuddy: { kind: 'skill', install: (r) => `git clone ${r.html_url}` },
  trae: { kind: 'skill', install: (r) => `git clone ${r.html_url}` },
  mcp: { kind: 'server', install: () => '参照仓库 README 配置 MCP 客户端' },
  'claude-code': { kind: 'skill', install: (r) => `git clone ${r.html_url}（按 README 导入 Claude Code）` },
  codex: { kind: 'skill', install: (r) => `git clone ${r.html_url}（按 README 导入 Codex）` },
  gemini: { kind: 'skill', install: (r) => `git clone ${r.html_url}（按 README 导入 Gemini CLI）` },
  cursor: { kind: 'skill', install: (r) => `git clone ${r.html_url}（按 README 导入 Cursor）` },
};

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, ''); }

function repoToDraft(repo, eco) {
  const [owner, name] = (repo.full_name || '/').split('/');
  const def = ECO_DEFAULTS[eco] || ECO_DEFAULTS.generic || { kind: 'other', install: (r) => r.html_url };
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: slug(repo.full_name),
    name: name || repo.full_name,
    owner: owner || '',
    url: repo.html_url,
    category: 'tools',
    description: {
      en: (repo.description || '').slice(0, 300),
      zh: '（待翻译）' + (repo.description ? '' : '（无描述）'),
    },
    install: def.install(repo),
    ecosystems: [{ id: eco, kind: def.kind, install: def.install(repo) }],
    added: today,
    npm: null, tarball: null,
    stars: repo.stargazers_count ?? null,
    downloads: null,
    screenshots: [],
    kind: def.kind,
    license: (repo.license && repo.license.spdx_id) || null,
    author: owner || '',
    tags: (repo.topics || []).slice(0, 12),
    verified: false,
    status: 'pending',
    needsReview: true,
    crawledFrom: 'github-topic',
    crawledAt: new Date().toISOString(),
  };
}

module.exports = { repoToDraft, slug };

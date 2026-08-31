// SkillHub: 条目聚合构建脚本（零依赖，Node >= 18）
// 用法：node scripts/build-plugins.js
const fs = require('fs');
const path = require('path');
const { SCENARIOS, intentIndex } = require('./lib/scenarios.js');

const ROOT = path.resolve(__dirname, '..');
const ENTRIES_DIR = path.join(ROOT, 'data', 'entries');
const OUT = path.join(ROOT, 'data', 'plugins.json');

// 分类表：与 awesome-dsh-plugin 的 23 类保持一致（可扩展）
const CATEGORIES = {
  agi: { en: 'AGI Architecture Exploration', zh: 'AGI 架构探索' },
  ui: { en: 'UI Enhancements', zh: 'UI 增强' },
  usage: { en: 'Usage & Billing', zh: '用量与计费' },
  theme: { en: 'Themes & Appearance', zh: '主题与外观' },
  model: { en: 'Models & Providers', zh: '模型与账号接入' },
  identity: { en: 'Identity & Communication', zh: '身份与通信' },
  session: { en: 'Sessions & Messages', zh: '会话与消息' },
  memory: { en: 'Memory', zh: '记忆' },
  tools: { en: 'Tools & Capabilities', zh: '工具与能力' },
  wsl: { en: 'WSL & Windows Interop', zh: 'WSL 与 Windows 互操作' },
  browser: { en: 'Browser & Web', zh: '浏览器与网页' },
  vision: { en: 'Vision & Multimodal', zh: '视觉与多模态' },
  voice: { en: 'Voice & Audio', zh: '语音与音频' },
  docs: { en: 'Docs & Rendering', zh: '文档与渲染' },
  skill: { en: 'Skills', zh: '技能包' },
  workflow: { en: 'Workflow & Automation', zh: '工作流与自动化' },
  git: { en: 'Git & Code Review', zh: 'Git 与代码评审' },
  notify: { en: 'Notifications & Integrations', zh: '通知与集成' },
  dev: { en: 'Development & Runtime', zh: '开发与运行时' },
  security: { en: 'Security & Permissions', zh: '安全与权限' },
  remote: { en: 'Remote & Mobile', zh: '远程与移动端' },
  market: { en: 'Plugin Markets & Managers', zh: '插件市场与管理' },
  fun: { en: 'Just for Fun', zh: '娱乐' },
};

function loadEntries() {
  if (!fs.existsSync(ENTRIES_DIR)) {
    console.error(`[build] entries 目录不存在: ${ENTRIES_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(ENTRIES_DIR).filter((f) => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('[build] entries 目录为空');
    process.exit(1);
  }
  const entries = [];
  for (const f of files) {
    try {
      const e = JSON.parse(fs.readFileSync(path.join(ENTRIES_DIR, f), 'utf8'));
      if (!e.id) throw new Error('missing id');
      if (e.id !== path.basename(f, '.json')) {
        console.warn(`[build] WARN: ${f} 的 id 与文件名不一致 (${e.id})`);
      }
      entries.push(e);
    } catch (err) {
      console.error(`[build] 解析失败 ${f}: ${err.message}`);
      process.exit(1);
    }
  }
  return entries;
}

function sortEntries(entries) {
  return entries.sort((a, b) => {
    const as = a.stars ?? -1;
    const bs = b.stars ?? -1;
    if (as !== bs) return bs - as;
    return String(b.added).localeCompare(String(a.added));
  });
}

function build() {
  const entries = sortEntries(loadEntries());
  const usedCategories = {};
  const warnings = [];
  for (const e of entries) {
    if (!CATEGORIES[e.category]) {
      warnings.push(`${e.id}: 未知分类 "${e.category}"，将自动加入分类表`);
      usedCategories[e.category] = { en: e.category, zh: e.category };
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  const out = {
    name: 'skillhub',
    url: 'https://hub.hibcglobal.com',
    source: 'https://github.com/HBC-Tech-coder/skillhub',
    updated: today,
    count: entries.length,
    categories: Object.assign({}, CATEGORIES, usedCategories),
    scenarios: Object.fromEntries(Object.entries(SCENARIOS).map(([id, s]) => [id, { zh: s.zh, en: s.en, group: s.group }])),
    plugins: entries,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
  // 意图检索表（站点静态语义搜索回退用）
  const siteScenarios = { updated: today, scenarios: SCENARIOS, intents: intentIndex() };
  fs.mkdirSync(path.join(ROOT, 'site'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'site', 'scenarios.json'), JSON.stringify(siteScenarios, null, 1) + '\n');
  // 编辑推荐（data/recommendations.json）复制进站点目录，供服务器与 Pages 同源读取
  const recSrc = path.join(ROOT, 'data', 'recommendations.json');
  if (fs.existsSync(recSrc)) {
    fs.copyFileSync(recSrc, path.join(ROOT, 'site', 'recommendations.json'));
  }
  buildFeed(out);
  for (const w of warnings) console.warn(`[build] WARN: ${w}`);
  console.log(`[build] OK: ${entries.length} entries -> ${path.relative(ROOT, OUT)} (updated=${today})`);
}

// Atom 订阅源：data/feed.xml（供 RSS 读者/推广渠道订阅，字段对齐 plugins.json）
function buildFeed(data) {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const items = data.plugins.map((p) => {
    const desc = (p.description && (p.description.zh || p.description.en)) || '';
    return `  <entry>
    <id>skillhub:${esc(p.id)}</id>
    <title>${esc(p.name)}</title>
    <link href="${esc(p.url)}"/>
    <updated>${esc(p.added)}T00:00:00Z</updated>
    <summary>${esc(desc.slice(0, 400))}</summary>
    <category term="${esc(p.category)}"/>
  </entry>`;
  }).join('\n');
  const feed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>skillhub:${esc(data.updated)}</id>
  <title>技能港 SkillHub — 跨生态 AI 插件与技能</title>
  <link href="${esc(data.url)}"/>
  <updated>${esc(data.updated)}T00:00:00Z</updated>
  <author><name>SkillHub</name></author>
${items}
</feed>
`;
  fs.writeFileSync(path.join(ROOT, 'data', 'feed.xml'), feed);
}

build();

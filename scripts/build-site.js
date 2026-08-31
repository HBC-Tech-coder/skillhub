// SkillHub 站点构建：为每条目生成 SEO 友好的独立详情页 site/items/<id>.html + sitemap.xml。
// 用法：node scripts/build-site.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'plugins.json'), 'utf8'));
const SITE = path.join(ROOT, 'site');
const ITEMS_DIR = path.join(SITE, 'items');

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

const PAGE_TMPL = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>__TITLE__ — 技能港 SkillHub</title>
<meta name="description" content="__DESC__">
<meta property="og:title" content="__TITLE__">
<meta property="og:description" content="__DESC__">
<meta property="og:url" content="__URL__">
<meta property="og:type" content="website">
<link rel="canonical" href="__URL__">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='14' fill='%235b5bd6'/%3E%3Ctext x='32' y='44' font-size='36' text-anchor='middle' fill='white' font-family='sans-serif' font-weight='bold'%3E技%3C/text%3E%3C/svg%3E">
<link rel="stylesheet" href="../style.css">
</head>
<body>
<header><div class="head">
  <div class="logo">技</div><div class="brand">技能港 <small>SkillHub</small></div>
  <div class="spacer"></div>
  <a href="../" style="color:var(--accent);text-decoration:none;font-size:14px">← 返回目录</a>
</div></header>
<main style="max-width:860px;margin:0 auto;padding:24px 20px 60px">
  <div class="modal" style="position:static;max-width:100%;margin:0 auto;max-height:none;overflow:visible" id="item">
    <div class="empty">正在加载 …</div>
  </div>
</main>
<footer><div>技能港 SkillHub · 列出 ≠ 背书：安装第三方代码前请先查看源码 · <a href="../">返回目录</a></div></footer>
<script>
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] }); }
  var ECO = { dsh: { label: 'DSH', color: '#4d7cfe' }, workbuddy: { label: 'WorkBuddy', color: '#0aa869' }, trae: { label: 'TRAE', color: '#f0662f' }, mcp: { label: 'MCP', color: '#8b5cf6' }, 'skills-sh': { label: 'Skills.sh', color: '#d97706' }, generic: { label: '通用', color: '#64748b' } };
  var id = location.pathname.split('/').filter(Boolean).pop().replace(/\\.html$/, '');
  fetch('../plugins.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (d) {
    var i = d.plugins.find(function (x) { return x.id === id; });
    var el = document.getElementById('item');
    if (!i) { el.innerHTML = '<div class="empty">未找到该条目（可能已下架）</div>'; return; }
    var ecos = (i.ecosystems && i.ecosystems.length ? i.ecosystems : [{ id: 'generic', kind: 'other', install: i.install || '' }]);
    var cat = (d.categories && d.categories[i.category]) ? (d.categories[i.category].zh || d.categories[i.category].en) : i.category;
    var badges = ecos.map(function (e) { var c = ECO[e.id] || ECO.generic; return '<span class="badge" style="background:' + c.color + '">' + esc(c.label) + '</span>'; }).join(' ');
    el.innerHTML =
      '<h2>' + esc(i.name) + ' ' + badges + '</h2>' +
      '<div class="en">' + esc(i.owner || i.author || '') + ' · ' + esc(cat) + ' · ' + esc(i.kind || '') + (i.verified ? ' · ✓ 已核验' : '') + '</div>' +
      '<div class="row"><b>描述</b>' + esc((i.description && i.description.zh) || '') + '</div>' +
      '<div class="row"><b>English</b>' + esc((i.description && i.description.en) || '') + '</div>' +
      '<div class="row"><b>来源</b><a href="' + esc(i.url) + '" target="_blank" rel="noopener">' + esc(i.url) + '</a></div>' +
      '<div class="row"><b>星标</b>⭐ ' + (i.stars != null ? i.stars : '暂无数据') + (i.downloads != null ? ' · 下载 ' + i.downloads : '') + (i.license ? ' · ' + esc(i.license) : '') + '</div>' +
      ((i.tags || []).length ? '<div class="row"><b>标签</b>' + i.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join(' ') + '</div>' : '') +
      '<div class="row"><b>安装</b></div>' +
      '<div class="ecolist">' + ecos.map(function (e) {
        var c = ECO[e.id] || ECO.generic;
        return '<div class="ecoline"><span class="badge" style="background:' + c.color + '">' + esc(c.label) + '</span><code>' + esc(e.install) + '</code></div>';
      }).join('') + '</div>';
  }).catch(function (e) { document.getElementById('item').innerHTML = '<div class="empty">加载失败：' + esc(e && e.message) + '</div>'; });
})();
</script>
</body>
</html>
`;

function buildPages() {
  fs.mkdirSync(ITEMS_DIR, { recursive: true });
  const canonBase = (DATA.url || 'https://hub.hibcglobal.com').replace(/\/$/, '');
  for (const p of DATA.plugins) {
    const desc = ((p.description && (p.description.zh || p.description.en)) || '').slice(0, 200);
    const url = `${canonBase}/items/${p.id}.html`;
    const html = PAGE_TMPL
      .replace(/__TITLE__/g, esc(p.name))
      .replace(/__DESC__/g, esc(desc))
      .replace(/__URL__/g, esc(url));
    fs.writeFileSync(path.join(ITEMS_DIR, p.id + '.html'), html);
  }
  const urls = [`${canonBase}/`].concat(DATA.plugins.map((p) => `${canonBase}/items/${p.id}.html`));
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc><lastmod>${DATA.updated}</lastmod></url>`).join('\n')}
</urlset>
`;
  fs.writeFileSync(path.join(SITE, 'sitemap.xml'), sitemap);
  buildDemo();
  console.log(`[site] ${DATA.plugins.length} item pages -> site/items/ ; sitemap.xml (${urls.length} urls)`);
}

// 精选 demo 数据集（Founder 审设计用）：site/demo.json + site/demo-recommendations.json
const DEMO_IDS = [
  'yt-dlp', 'bbdown', 'trendradar', 'ecommerce-visual-copywriting-skill', 'rayskills',
  'wechat-openclaw-channel', 'serena', 'codebase-memory-mcp', 'context-mode',
  'open-design', 'ui-ux-pro-max-skill', 'codedrobe-skills',
  'graphify', 'superpowers-zh', 'caveman', 'agency-agents-zh',
];
function buildDemo() {
  const plugins = DATA.plugins.filter((p) => DEMO_IDS.includes(p.id));
  fs.writeFileSync(path.join(SITE, 'demo.json'), JSON.stringify({
    name: DATA.name + '-demo', url: DATA.url, source: DATA.source, updated: DATA.updated,
    count: plugins.length, categories: DATA.categories, scenarios: DATA.scenarios, plugins,
  }, null, 1) + '\n');
  let recs = null;
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'recommendations.json'), 'utf8'));
    recs = { updated: raw.updated, source: raw.source, entries: (raw.entries || []).filter((r) => (r.itemIds || []).every((id) => DEMO_IDS.includes(id))) };
  } catch { /* 无推荐文件时忽略 */ }
  if (recs && recs.entries.length) fs.writeFileSync(path.join(SITE, 'demo-recommendations.json'), JSON.stringify(recs, null, 1) + '\n');
  // demo.html 由 index.html 注入数据集覆盖生成（保持单一模板源）
  const index = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const demoHtml = index
    .replace(/<title>.*?<\/title>/, '<title>技能港 SkillHub（Demo 预览版）— 跨生态 AI 插件与技能聚合</title>')
    .replace('<script src="app.js"></script>', "<script>window.SKILLHUB_DATASET='demo.json';window.SKILLHUB_RECS='demo-recommendations.json';window.SKILLHUB_IS_DEMO=true;</script>\n<script src=\"app.js\"></script>");
  fs.writeFileSync(path.join(SITE, 'demo.html'), demoHtml);
  console.log(`[site] demo 数据集 ${plugins.length} 条 -> site/demo.json + demo.html${recs && recs.entries.length ? '（含 ' + recs.entries.length + ' 条推荐）' : ''}`);
}

buildPages();

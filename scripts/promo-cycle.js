// SkillHub 每日推广草稿生成（零依赖）。
// 触发：超管后台开启推广后，由 tick 调度器在 promoTime 触发（或后台"立即生成"）。
// 产物：data/.ops/promo-drafts/promo-YYYY-MM-DD.md —— 中英双语推广文案草稿（人工审阅后发布）。
// 诚实说明：本脚本只生成草稿文件，【不会】自动外发到任何平台；
//           自动外发（公众号/微博/知乎/X 等平台 API 或浏览器自动化）是后续扩展点。
const fs = require('fs');
const path = require('path');
const gate = require('./lib/pipeline-gate');

const ROOT = path.join(__dirname, '..');
const OPS = gate.OPS;
const DRAFTS = path.join(OPS, 'promo-drafts');

// 草稿文件名与"当日已跑"去重统一用 gate.todayStr()（本地日历日，勿用 UTC）。

function esc(s) {
  return String(s == null ? '' : s).replace(/[\\`*_{}\[\]()#+\-.!|]/g, '\\$&');
}

function buildDraft() {
  const cfg = gate.loadState();
  const p = (cfg && cfg.pipeline) || {};
  const channels = (p.promoChannels || '').trim();
  const template = (p.promoTemplate || '').trim();

  let rec = null;
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'recommendations.json'), 'utf8'));
    rec = (j.entries && j.entries[0]) || null;
  } catch { /* 无推荐数据则生成通用版 */ }

  let plugins = [];
  try {
    const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'plugins.json'), 'utf8'));
    plugins = (j.plugins || []).slice().sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 5);
  } catch { /* ignore */ }

  const date = gate.todayStr();
  const lines = [];
  lines.push('# SkillHub 推广草稿 ' + date + '（自动生成 · 人工发布）');
  lines.push('');
  lines.push('> 生成方式：超管后台推广任务自动产出；发布前请人工审阅。');
  lines.push('> 目标渠道：' + (channels || '（未配置，请在后台"推广"页填写）'));
  lines.push('> 说明：本文件仅为草稿，系统不会自动外发。');
  lines.push('');
  if (template) {
    lines.push('## 你的模板');
    lines.push('');
    lines.push(template);
    lines.push('');
  }
  if (rec) {
    lines.push('## 今日编辑推荐（可直接作为推广正文）');
    lines.push('');
    lines.push('**' + esc(rec.title) + '**');
    lines.push('');
    lines.push(esc(rec.text));
    lines.push('');
    lines.push('**' + esc(rec.titleEn) + '**');
    lines.push('');
    lines.push(esc(rec.textEn));
    lines.push('');
    const ids = rec.itemIds || [];
    const byId = {};
    for (const pl of plugins) byId[pl.id] = pl;
    for (const id of ids) {
      const pl = byId[id];
      if (!pl) continue;
      lines.push('- ' + esc(pl.name) + ' — ' + esc((pl.description && pl.description.zh) || '') + ' → https://hbc-tech-coder.github.io/skillhub/items/' + encodeURIComponent(id) + '.html');
    }
    lines.push('');
  } else {
    lines.push('## 今日热门（可按此方向编写推广）');
    lines.push('');
    for (const pl of plugins) {
      lines.push('- ' + esc(pl.name) + '（⭐ ' + (pl.stars || '—') + '）' + (pl.install ? ' `' + esc(pl.install) + '`' : ''));
    }
    lines.push('');
  }
  lines.push('## 发布贴士');
  lines.push('');
  lines.push('- 附目录链接：https://hub.hibcglobal.com 或镜像 https://hbc-tech-coder.github.io/skillhub/');
  lines.push('- 突出"说出你想做的事，找到能干的工具"的意图搜索卖点；');
  lines.push('- 文案里的安装命令务必保留原文，方便用户复制。');
  lines.push('');

  return lines.join('\n');
}

function main() {
  const r = gate.shouldRun('promo', new Date());
  if (!r.ok) {
    console.log('[promo] skip: ' + r.reason);
    process.exit(0);
  }
  fs.mkdirSync(DRAFTS, { recursive: true, mode: 0o700 });
  const file = path.join(DRAFTS, 'promo-' + gate.todayStr() + '.md');
  const content = buildDraft();
  fs.writeFileSync(file, content, { mode: 0o600 });
  gate.recordResult('promo', 0);
  console.log('[promo] draft written: ' + file);
}

main();

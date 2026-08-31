// 噪音清扫：移除高置信度噪音条目（泛平台/非 AI 面向的蹭标签项目）。
// 不直接删除：移动到 data/rejected/（gitignore，工作材料，保留审计）。
// 用法：node scripts/sweep-noise.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ENTRIES_DIR = path.join(ROOT, 'data', 'entries');
const REJECTED_DIR = path.join(ROOT, 'data', 'rejected');

// id -> 剔除原因（人工判定，2026-08-31）
const NOISE = {
  'amruthpillai-reactive-resume': '通用简历生成器（非 AI 插件/技能，蹭 agent-skills 标签）',
  'molunerfinn-picgo': '图片上传工具（非 AI 面向，蹭 dsh-plugin 标签）',
  'nocobase-nocobase': '无代码业务平台（非 agent 插件/技能）',
  'activepieces-activepieces': 'iPaaS 自动化平台（非 agent 技能目录对象）',
  'open-metadata-openmetadata': '数据目录平台（非 AI 用户工具）',
  'gosom-google-maps-scraper': 'Google Maps 数据抓取器（非 AI 面向）',
  'danilo-znamerovszkij-draw-your-font': '手写转字体工具（与 AI 无关）',
  'jackiotyu-git-worktree-manager': 'VSCode 扩展（非 AI 面向）',
  'wanniwa-editorjumper': 'JetBrains 插件（非 AI 面向）',
  'modelscope-funasr': '语音模型工具包（面向 ASR 开发者，非 agent 插件/技能）',
};

function main() {
  fs.mkdirSync(REJECTED_DIR, { recursive: true });
  let removed = 0;
  for (const [id, reason] of Object.entries(NOISE)) {
    const f = path.join(ENTRIES_DIR, id + '.json');
    if (!fs.existsSync(f)) { console.warn(`skip ${id}: 无此条目`); continue; }
    fs.renameSync(f, path.join(REJECTED_DIR, id + '.json'));
    console.log(`✗ ${id} — ${reason}`);
    removed++;
  }
  console.log(`[sweep] 已移除 ${removed} 条 -> data/rejected/（未删除，可恢复）`);
}

main();

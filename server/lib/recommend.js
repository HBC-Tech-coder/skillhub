// 每日编辑推荐生成器：用 LLM 基于 plugins.json 生成 App Store 式"装了这几个就能…"套装。
// 用法：node server/lib/recommend.js
// - 无 DEEPSEEK_API_KEY：跳过（保留现有 data/recommendations.json，输出提示）。
// - 生成结果校验 itemIds 必须全部存在于目录，否则保留旧版（fail-safe）。
const fs = require('fs');
const path = require('path');
const llm = require('./llm.js');

const ROOT = path.resolve(__dirname, '..', '..');
const REC_FILE = path.join(ROOT, 'data', 'recommendations.json');

async function main() {
  if (!llm.available()) {
    console.log('[recommend] DEEPSEEK_API_KEY 未配置，跳过每日推荐生成（保留现有版本）');
    return;
  }
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'plugins.json'), 'utf8'));
  const compact = data.plugins.map((p) => ({
    id: p.id, name: p.name, stars: p.stars ?? null,
    scenarios: p.scenarios || [], ecos: (p.ecosystems || []).map((e) => e.id),
    desc: ((p.description && p.description.zh) || '').slice(0, 80),
  }));
  const prompt = `你是「技能港 SkillHub」的编辑。基于以下插件/技能目录（共 ${compact.length} 条），撰写 3 条 App Store 式的"编辑推荐"套装。
每条要求：
1. 围绕一个真实用户场景（如新媒体运营、开发者效率、设计产出）；
2. 选 3-4 个目录里真实存在的条目组成套装（id 必须来自下方清单）；
3. title/text 用中文口语化、有吸引力、不夸大；titleEn/textEn 为对应英文；
4. 每条说明"装了这几个就能怎样"。

只输出 JSON，格式：
{"updated":"<今天YYYY-MM-DD>","source":"llm","entries":[{"id":"rec-1","title":"…","titleEn":"…","text":"…","textEn":"…","itemIds":["<真实id>"],"scenarios":["<场景id>"]}]}

目录清单：
${JSON.stringify(compact)}`;
  let result;
  try {
    result = await llm.chat([{ role: 'user', content: prompt }], { json: true, temperature: 0.8, maxTokens: 3000 });
  } catch (e) {
    console.error('[recommend] LLM 调用失败，保留现有版本：' + e.message);
    return;
  }
  const ids = new Set(data.plugins.map((p) => p.id));
  const entries = (result.entries || []).filter((r) => Array.isArray(r.itemIds) && r.itemIds.length > 0 && r.itemIds.every((i) => ids.has(i)));
  if (entries.length === 0) {
    console.error('[recommend] 生成结果校验失败（itemIds 不在目录中），保留现有版本');
    return;
  }
  const out = {
    updated: result.updated || new Date().toISOString().slice(0, 10),
    source: 'llm',
    entries,
  };
  fs.writeFileSync(REC_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`[recommend] 已生成 ${entries.length} 条推荐 -> ${path.relative(ROOT, REC_FILE)}`);
}

main().catch((e) => { console.error('[recommend] fatal:', e.message); process.exit(1); });

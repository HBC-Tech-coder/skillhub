// AI 自动打标器：用 DeepSeek 为草稿批量产出「人群/场合/场景/中文描述/是否收录」。
// 用法：node server/lib/label.js [pending文件...]（默认全部非 review 草稿）
// 输出：data/pending/labeled-<ts>.json（含 keep/scenarios/audience/usecases/descZh）
// 无 DEEPSEEK_API_KEY 时跳过；失败保留已处理批次，可重跑（幂等：同 id 覆盖）。
const fs = require('fs');
const path = require('path');
const llm = require('./llm.js');
const { SCENARIOS } = require('../../scripts/lib/scenarios.js');

const ROOT = path.resolve(__dirname, '..', '..');
const PENDING_DIR = path.join(ROOT, 'data', 'pending');
const BATCH = 15;

function sceneTable() {
  return Object.entries(SCENARIOS).map(([id, s]) => `${id}（${s.zh}/${s.en}）`).join('；');
}

async function labelBatch(items) {
  const compact = items.map((i) => ({
    id: i.id, name: i.name, owner: i.owner, stars: i.stars ?? null,
    eco: ((i.ecosystems || [])[0] || {}).id || 'generic',
    desc: ((i.description && i.description.en) || '').slice(0, 240),
  }));
  const prompt = `你是「技能港 SkillHub」的目录编辑。逐个判断下列 GitHub 仓库，输出 JSON。

规则：
1. keep：仓库是真实有用、面向 AI 用户的插件/技能/工具就 true；明显蹭标签噪音、泛平台项目、与 AI 无关就 false。
2. scenarios：从场景表选 1-3 个最贴切的 id（可空数组）。场景表：${sceneTable()}
3. audienceZh/audienceEn：一句话「适合人群」（如"新媒体运营/短视频创作者"）。
4. usecasesZh/usecasesEn：一句话「典型场合与用途」（如"每天自动盯热点、写公众号文案"）。
5. descZh：一句忠实原意的中文描述（不夸大）。

只输出 JSON：{"items":[{"id":"<id>","keep":true,"scenarios":["..."],"audienceZh":"…","audienceEn":"…","usecasesZh":"…","usecasesEn":"…","descZh":"…"}]}

仓库清单：
${JSON.stringify(compact)}`;
  const res = await llm.chat([{ role: 'user', content: prompt }], { json: true, temperature: 0.3, maxTokens: 6000 });
  return Array.isArray(res.items) ? res.items : [];
}

async function main() {
  if (!llm.available()) {
    console.log('[label] DEEPSEEK_API_KEY 未配置，跳过');
    return;
  }
  const args = process.argv.slice(2);
  const files = (args.length ? args : fs.readdirSync(PENDING_DIR).filter((f) => f.endsWith('.json') && !f.startsWith('review') && !f.startsWith('labeled')).map((f) => path.join(PENDING_DIR, f)));
  const all = [];
  for (const f of files) {
    try {
      const d = JSON.parse(fs.readFileSync(f, 'utf8'));
      all.push(...(d.items || []));
    } catch (e) { console.warn('[label] skip ' + f + ': ' + e.message); }
  }
  const seen = new Map();
  all.forEach((i) => { if (!seen.has(i.id)) seen.set(i.id, i); });
  const items = [...seen.values()];
  console.log(`[label] ${items.length} 条草稿，按 ${BATCH} 条/批调用`);
  const results = [];
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    try {
      const labeled = await labelBatch(batch);
      results.push(...labeled);
      console.log(`[label] 批次 ${i / BATCH + 1}/${Math.ceil(items.length / BATCH)}: ${labeled.length} 条`);
    } catch (e) {
      console.error(`[label] 批次 ${i / BATCH + 1} 失败: ${e.message}`);
    }
  }
  const ts = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15);
  const out = path.join(PENDING_DIR, `labeled-${ts}.json`);
  fs.writeFileSync(out, JSON.stringify({ labeledAt: new Date().toISOString(), source: 'llm', items: results }, null, 2) + '\n');
  const keep = results.filter((r) => r.keep);
  console.log(`[label] 完成：${results.length} 条，建议收录 ${keep.length} 条 -> ${out}`);
}

main().catch((e) => { console.error('[label] fatal:', e.message); process.exit(1); });

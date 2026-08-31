// 一次性迁移：为存量条目补 `scenarios`（功能场景标签）。
// 未来新条目直接在 entry JSON 里写 scenarios；本脚本仅作初始标注记录。
const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..', 'data', 'entries');

const MAP = {
  'dsh-market': ['dev-coding', 'workflow'],
  'dsh-find-plugin': ['dev-coding', 'workflow'],
  'awesome-dsh-plugin': ['dev-coding'],
  'dsh-web': ['dev-coding'],
  'dsh-popout-sidebar': ['dev-coding'],
  'dsh-better-sidebar': ['dev-coding'],
  'dsh-tui-pi': ['dev-coding'],
  'dsh-skill-picker': ['dev-coding', 'workflow'],
  'dsh-routing-suite': ['dev-coding'],
  'modlens': ['dev-coding', 'workflow'],
  'open-design': ['design'],
  'petdex': ['fun'],
  'chrome-devtools-mcp': ['dev-coding'],
  'codebase-memory-mcp': ['dev-coding', 'memory-knowledge'],
  'github-mcp-server': ['dev-coding', 'workflow'],
  'serena': ['dev-coding'],
  'mcp-python-sdk': ['dev-coding'],
  'n8n-mcp': ['workflow', 'marketing'],
  'context-mode': ['dev-coding', 'memory-knowledge'],
  'worldmonitor': ['trends-monitor'],
  'trendradar': ['trends-monitor', 'content-social', 'marketing'],
  'superpowers-zh': ['dev-coding'],
  'workbuddyskills': ['learn', 'dev-coding'],
  'workbuddyguide': ['learn'],
  'learn-workbuddy': ['learn'],
  'awesome-workbuddy': ['learn'],
  'zhijian-ai-bluebook-workbuddy-harness': ['learn'],
  'ecommerce-visual-copywriting-skill': ['ecommerce', 'copywriting', 'content-social'],
  'codedrobe-skills': ['design'],
  'tencentmeeting-cli': ['workflow'],
  'awesome-website-prompts-and-skills': ['design', 'dev-coding'],
  'agency-agents-zh': ['agents-roles', 'content-social'],
  'ai-guide': ['learn'],
  'rayskills': ['content-social', 'copywriting', 'workflow'],
  'system-prompts-and-models-of-ai-tools': ['learn', 'dev-coding'],
  'ui-ux-pro-max-skill': ['design'],
  'wechat-openclaw-channel': ['content-social', 'workflow'],
  'linkcode': ['dev-coding'],
  'todo-for-ai': ['workflow'],
  'any-auto-register': ['accounts'],
};

let updated = 0;
for (const [id, scenarios] of Object.entries(MAP)) {
  const f = path.join(DIR, id + '.json');
  if (!fs.existsSync(f)) { console.warn(`skip ${id}: 无此条目`); continue; }
  const e = JSON.parse(fs.readFileSync(f, 'utf8'));
  e.scenarios = scenarios;
  fs.writeFileSync(f, JSON.stringify(e, null, 2) + '\n');
  updated++;
}
console.log(`[scenarios] 已标注 ${updated} 个条目`);

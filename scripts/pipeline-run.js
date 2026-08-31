// SkillHub 一键数据管线：爬取 → AI 打标 → 自动收录 → 构建 → 校验 → 提交推送。
// 用法：DEEPSEEK_API_KEY=... node scripts/pipeline-run.js
// 服务器上线后由 sync-cycle 每小时调用同一组步骤。
const { spawnSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STEPS = [
  ['node', ['server/crawlers/dsh.js']],
  ['node', ['server/crawlers/workbuddy.js']],
  ['node', ['server/crawlers/trae.js']],
  ['node', ['server/crawlers/mcp.js']],
  ['node', ['server/crawlers/foreign.js']],
  ['node', ['server/lib/label.js']],
  ['node', ['server/lib/ingest.js']],
  ['node', ['scripts/build-plugins.js']],
  ['node', ['scripts/export-csv.js']],
  ['node', ['scripts/build-site.js']],
  ['node', ['scripts/validate-all.js']],
  ['git', ['add', '-A']],
  ['git', ['commit', '-m', 'data: 管线自动更新（爬取+AI打标+自动收录）']],
  ['git', ['push', 'origin', 'main']],
];

for (const [cmd, args] of STEPS) {
  console.log(`\n== ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', encoding: 'utf8' });
  if (r.status !== 0) {
    if (cmd === 'git') { console.log('(git 步骤可容忍失败：无变更或网络重试)'); continue; }
    console.error(`[pipeline] 中止于 ${args.join(' ')}（exit ${r.status}）`);
    process.exit(1);
  }
}
console.log('\n[pipeline] 全部完成');

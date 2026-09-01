#!/usr/bin/env bash
# SkillHub 每日管线（默认 04:00，超管后台可改）：爬取 → AI 推荐 → AI 打标 → 自动收录 → 构建 → 推送。
# 依赖：DEEPSEEK_API_KEY（推荐/打标，缺失时跳过并显式告警）、GITHUB_TOKEN（推送）；
#       均来自 systemd EnvironmentFile 或超管后台 app.env。调度权威：后台配置（gate 判定开关/时间）。
set -euo pipefail
APP=/opt/skillhub
cd "$APP"

exec 9>"$APP/data/.sync.lock"
flock -n 9 || { echo "[daily] $(date -u +%T) 另一实例运行中，跳过"; exit 0; }

# 超管后台配置门禁：禁用/未到时间/当日已跑 → 跳过（退出 42）
if ! node "$APP/scripts/lib/pipeline-gate.js" gate daily; then
  echo "[daily] $(date -u +%T) gate 判定跳过（见上）"
  exit 0
fi

# 超管后台写入的密钥（覆盖 systemd EnvironmentFile 引导值）
if [ -f "$APP/data/.ops/app.env" ]; then set -a; . "$APP/data/.ops/app.env"; set +a; fi

# 收尾记录运行日志；成功时更新 last-runs（gate 判定"当日已跑"的依据）
trap 'RC=$?; node "$APP/scripts/lib/pipeline-gate.js" log daily "$RC"' EXIT

echo "[daily] $(date -u +%T) 开始每日管线"

for eco in dsh workbuddy trae mcp; do
  node "server/crawlers/$eco.js" || echo "[daily] WARN 爬取 $eco 失败"
done
node server/crawlers/foreign.js || echo "[daily] WARN 爬取 foreign 失败"

if [ -n "${DEEPSEEK_API_KEY:-}" ]; then
  node server/lib/recommend.js || echo "[daily] WARN 每日推荐生成失败"
  node server/lib/label.js || echo "[daily] WARN AI 打标失败"
else
  echo "[daily] DEEPSEEK_API_KEY 未配置，跳过推荐与打标"
fi
node server/lib/ingest.js || echo "[daily] WARN 自动收录失败"

node scripts/build-plugins.js
node scripts/export-csv.js
node scripts/build-site.js

if git diff --quiet data/; then
  # 无新变更——但本地可能有历史遗留的"已提交未推送"数据（push 失败后），本地领先远端时补推
  if [ "$(git rev-parse @ 2>/dev/null)" = "$(git rev-parse @{u} 2>/dev/null)" ]; then
    echo "[daily] $(date -u +%T) no data change"
    exit 0
  fi
  echo "[daily] $(date -u +%T) no new change but local ahead of origin, pushing pending commits"
fi
git add data/entries data/plugins.json data/skillhub.csv data/feed.xml data/recommendations.json data/recommendations-history.json site/
git -c user.name="skillhub-server" -c user.email="skillhub-server@hibcglobal.com" \
    commit -m "data: 服务器每日管线 $(date -u +%Y-%m-%dT%H:%MZ)" || true

# push：优先宿主安全 Git 适配器（SKILLHUB_GIT_ADAPTER）；否则 GIT_ASKPASS 提供凭据，token 不进 argv/ps。
if [ -n "${SKILLHUB_GIT_ADAPTER:-}" ] && [ -x "$SKILLHUB_GIT_ADAPTER" ]; then
  "$SKILLHUB_GIT_ADAPTER" \
    || { echo "[daily] PUSH FAILED（宿主适配器返回非零）"; exit 1; }
elif [ -n "${SKILLHUB_GIT_TOKEN:-${GITHUB_TOKEN:-}}" ]; then
  GIT_TERMINAL_PROMPT=0 GIT_ASKPASS="$APP/server/deploy/git-askpass.sh" \
    git push "https://x-access-token@github.com/HBC-Tech-coder/skillhub.git" main \
    || { echo "[daily] PUSH FAILED（检查 token 权限）"; exit 1; }
else
  echo "[daily] GITHUB_TOKEN 未配置，跳过 push"
  exit 1
fi
echo "[daily] $(date -u +%T) 完成并推送"

#!/usr/bin/env bash
# SkillHub 每日管线（每天 04:00）：爬取 → AI 推荐 → AI 打标 → 自动收录 → 构建 → 推送。
# 依赖：DEEPSEEK_API_KEY（推荐/打标，缺失时跳过并显式告警）、GITHUB_TOKEN（推送）。
set -euo pipefail
APP=/opt/skillhub
cd "$APP"

exec 9>"$APP/data/.sync.lock"
flock -n 9 || { echo "[daily] $(date -u +%T) 另一实例运行中，跳过"; exit 0; }

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
  echo "[daily] $(date -u +%T) no data change"
  exit 0
fi
git add data/entries data/plugins.json data/skillhub.csv data/feed.xml data/recommendations.json data/recommendations-history.json site/
git -c user.name="skillhub-server" -c user.email="skillhub-server@hibcglobal.com" \
    commit -m "data: 服务器每日管线 $(date -u +%Y-%m-%dT%H:%MZ)" || true
if [ -n "${GITHUB_TOKEN:-}" ]; then
  git -c "http.extraHeader=Authorization: Bearer ${GITHUB_TOKEN}" push origin main \
    || { echo "[daily] PUSH FAILED（检查 GITHUB_TOKEN 权限）"; exit 1; }
else
  echo "[daily] GITHUB_TOKEN 未配置，跳过 push"
  exit 1
fi
echo "[daily] $(date -u +%T) 完成并推送"

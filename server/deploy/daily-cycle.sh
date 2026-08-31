#!/usr/bin/env bash
# SkillHub 每日管线（建议每天 04:00 触发）：爬取 → AI 推荐 → AI 打标 → 自动收录 → 构建 → 推送。
# 依赖：DEEPSEEK_API_KEY（推荐/打标，无则跳过对应步骤）、GITHUB_TOKEN 或 deploy key（推送）。
set -euo pipefail
APP=/opt/skillhub
cd "$APP"
node server/crawlers/dsh.js || true
node server/crawlers/workbuddy.js || true
node server/crawlers/trae.js || true
node server/crawlers/mcp.js || true
node server/crawlers/foreign.js || true
node server/lib/recommend.js || true
node server/lib/label.js || true
node server/lib/ingest.js || true
node scripts/build-plugins.js
node scripts/export-csv.js
node scripts/build-site.js
if ! git diff --quiet data/; then
  git add data/entries data/plugins.json data/skillhub.csv data/feed.xml data/recommendations.json data/recommendations-history.json site/
  git -c user.name="skillhub-server" -c user.email="skillhub-server@hibcglobal.com" \
      commit -m "data: 服务器每日管线 $(date -u +%Y-%m-%dT%H:%MZ)" || true
  git push origin main || echo "push failed（检查 GITHUB_TOKEN/deploy key）"
else
  echo "no data change"
fi

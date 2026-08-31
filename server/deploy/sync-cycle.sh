#!/usr/bin/env bash
# SkillHub 每小时同步：构建 + 有变更则推送回 GitHub（服务器为源的管线）。
set -euo pipefail
APP=/opt/skillhub
cd "$APP"
node scripts/build-plugins.js
node scripts/export-csv.js
node scripts/build-site.js
if ! git diff --quiet data/plugins.json data/skillhub.csv site/; then
  git add data/plugins.json data/skillhub.csv data/feed.xml site/
  git -c user.name="skillhub-server" -c user.email="skillhub-server@hibcglobal.com" \
      commit -m "data: 服务器每小时同步 $(date -u +%Y-%m-%dT%H:%MZ)" || true
  git push origin main || echo "push failed（检查 GITHUB_TOKEN/deploy key）"
else
  echo "no data change"
fi

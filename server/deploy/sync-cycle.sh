#!/usr/bin/env bash
# SkillHub 每小时同步：构建 + 有变更则推送回 GitHub（服务器为源的管线）。
# 依赖：GITHUB_TOKEN（经 systemd EnvironmentFile 注入）；flock 互斥；失败显式退出非零。
set -euo pipefail
APP=/opt/skillhub
cd "$APP"

exec 9>"$APP/data/.sync.lock"
flock -n 9 || { echo "[sync] $(date -u +%T) 另一实例运行中，跳过"; exit 0; }

node scripts/build-plugins.js
node scripts/export-csv.js
node scripts/build-site.js
if git diff --quiet data/plugins.json data/skillhub.csv site/; then
  echo "[sync] $(date -u +%T) no data change"
  exit 0
fi
git add data/plugins.json data/skillhub.csv data/feed.xml data/recommendations-history.json site/
git -c user.name="skillhub-server" -c user.email="skillhub-server@hibcglobal.com" \
    commit -m "data: 服务器每小时同步 $(date -u +%Y-%m-%dT%H:%MZ)" || true
if [ -n "${GITHUB_TOKEN:-}" ]; then
  git -c "http.extraHeader=Authorization: Bearer ${GITHUB_TOKEN}" push origin main \
    || { echo "[sync] PUSH FAILED（检查 GITHUB_TOKEN 权限）"; exit 1; }
else
  echo "[sync] GITHUB_TOKEN 未配置，跳过 push"
  exit 1
fi
echo "[sync] $(date -u +%T) pushed"

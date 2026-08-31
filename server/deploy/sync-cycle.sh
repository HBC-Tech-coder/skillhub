#!/usr/bin/env bash
# SkillHub 数据同步周期：构建 + 提交推送回 GitHub（服务器为源的管线）。
# 由 skillhub-sync.timer 每天/每小时触发；需要 skillhub 用户对 GitHub 有推送权限
# （部署时由 host owner 配置 GITHUB_TOKEN 或 deploy key，本脚本不内置任何凭据）。
set -euo pipefail
APP=/opt/skillhub
cd "$APP"
node scripts/build-plugins.js
if ! git diff --quiet data/plugins.json; then
  git add data/plugins.json data/entries
  git -c user.name="skillhub-server" -c user.email="skillhub-server@hibcglobal.com" \
      commit -m "data: 服务器侧数据同步 $(date -u +%Y-%m-%dT%H:%MZ)" || true
  git push origin main || echo "push failed（检查 GITHUB_TOKEN/deploy key）"
else
  echo "no data change"
fi

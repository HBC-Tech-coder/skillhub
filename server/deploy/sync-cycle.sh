#!/usr/bin/env bash
# SkillHub 每小时同步：构建 + 有变更则推送回 GitHub（服务器为源的管线）。
# 依赖：GITHUB_TOKEN（systemd EnvironmentFile 或超管后台 app.env）；flock 互斥；失败显式退出非零。
# 调度权威：超管后台 data/.ops/admin.json（gate 判定开关/间隔）；tick 调度器与 systemd 定时器并存，重复触发安全。
set -euo pipefail
APP=/opt/skillhub
cd "$APP"

exec 9>"$APP/data/.sync.lock"
flock -n 9 || { echo "[sync] $(date -u +%T) 另一实例运行中，跳过"; exit 0; }

# 超管后台配置门禁：禁用/未到期 → 跳过（退出 42）
if ! node "$APP/scripts/lib/pipeline-gate.js" gate sync; then
  echo "[sync] $(date -u +%T) gate 判定跳过（见上）"
  exit 0
fi

# 超管后台写入的密钥（覆盖 systemd EnvironmentFile 引导值）
if [ -f "$APP/data/.ops/app.env" ]; then set -a; . "$APP/data/.ops/app.env"; set +a; fi

# 收尾记录运行日志；成功时更新 last-runs（gate 判定间隔的依据）
trap 'RC=$?; node "$APP/scripts/lib/pipeline-gate.js" log sync "$RC"' EXIT

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

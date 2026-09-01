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
  # 无新变更——但本地可能有历史遗留的"已提交未推送"数据（如 push 失败后的 066ecc9），
  # 若本地领先远端仍需补推，否则数据将卡在服务器直到下一次新变更。
  if [ "$(git rev-parse @ 2>/dev/null)" = "$(git rev-parse @{u} 2>/dev/null)" ]; then
    echo "[sync] $(date -u +%T) no data change"
    exit 0
  fi
  echo "[sync] $(date -u +%T) no new change but local ahead of origin, pushing pending commits"
fi
git add data/plugins.json data/skillhub.csv data/feed.xml data/recommendations-history.json site/
git -c user.name="skillhub-server" -c user.email="skillhub-server@hibcglobal.com" \
    commit -m "data: 服务器每小时同步 $(date -u +%Y-%m-%dT%H:%MZ)" || true

# push：优先宿主安全 Git 适配器（SKILLHUB_GIT_ADAPTER，可经 runtime.env 或 unit drop-in 注入，
#       sync/daily/tick 三条触发路径继承同一环境）；否则用 GIT_ASKPASS 提供凭据，
#       token 只在环境变量与 askpass 脚本中，绝不进入命令行参数/ps。
if [ -n "${SKILLHUB_GIT_ADAPTER:-}" ] && [ -x "$SKILLHUB_GIT_ADAPTER" ]; then
  "$SKILLHUB_GIT_ADAPTER" \
    || { echo "[sync] PUSH FAILED（宿主适配器返回非零）"; exit 1; }
elif [ -n "${SKILLHUB_GIT_TOKEN:-${GITHUB_TOKEN:-}}" ]; then
  GIT_TERMINAL_PROMPT=0 GIT_ASKPASS="$APP/server/deploy/git-askpass.sh" \
    git push "https://x-access-token@github.com/HBC-Tech-coder/skillhub.git" main \
    || { echo "[sync] PUSH FAILED（检查 token 权限）"; exit 1; }
else
  echo "[sync] GITHUB_TOKEN 未配置，跳过 push"
  exit 1
fi
echo "[sync] $(date -u +%T) pushed"

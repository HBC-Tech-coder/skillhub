#!/usr/bin/env bash
# SkillHub 部署/更新脚本（幂等）。在 39.105.17.219 上以 root 或 sudo 运行一次。
# 红线：只创建 /opt/skillhub 与 skillhub 用户/服务，不修改任何既有路径、vhost、服务。
set -euo pipefail

REPO="${SKILLHUB_REPO:-https://github.com/HBC-Tech-coder/skillhub.git}"
APP=/opt/skillhub

if ! id skillhub >/dev/null 2>&1; then
  useradd --system --home "$APP" --shell /usr/sbin/nologin skillhub
fi
mkdir -p "$APP"
chown -R skillhub:skillhub "$APP"

if [ -d "$APP/.git" ]; then
  (cd "$APP" && sudo -u skillhub git pull --ff-only)
else
  sudo -u skillhub git clone "$REPO" "$APP"
fi

# 构建 plugins.json
sudo -u skillhub node "$APP/scripts/build-plugins.js"

# systemd 服务（先复制模板再启动，环境变量占位符由部署者替换）
cp "$APP/server/deploy/skillhub.service" /etc/systemd/system/skillhub.service
systemctl daemon-reload
systemctl enable --now skillhub
systemctl restart skillhub

# nginx：仅提示，不自动改配置
echo "== 请手动把 $APP/server/deploy/skillhub.nginx.conf 合入 sites-available，"
echo "== 确认无端口/路径冲突后 nginx -t && systemctl reload nginx。"
echo "== 阿里云云解析：hub.hibcglobal.com A -> 39.105.17.219（由 DNS owner 执行）。"
echo "== 验证: curl -s http://127.0.0.1:4290/api/health"

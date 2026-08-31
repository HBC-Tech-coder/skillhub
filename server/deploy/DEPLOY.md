# SkillHub 服务器部署说明（39.105.17.219）

## 范围与红线

- 只新增：`/opt/skillhub`（代码+数据）、`skillhub` 系统用户、`skillhub.service`、`skillhub-sync.{service,timer}`、一个新 nginx vhost `hub.hibcglobal.com`、一个新 DNS A 记录。
- **不修改**：任何既有路径、vhost、服务、端口（尤其 14280 与 play.hibcglobal.com 相关配置）。
- 端口：`127.0.0.1:4290`（已在 `D:\aishare\PORTS.md` 登记），公网仅经 nginx 反代。

## 部署步骤（host owner 执行）

1. `bash server/deploy/deploy.sh`（自动：建用户、clone/更新、构建、装 systemd 服务）。
2. 编辑 `/etc/systemd/system/skillhub.service`：替换 `SKILLHUB_ADMIN_TOKEN`（64 位随机 hex，AI 维护入口）与可选的 `GITHUB_TOKEN`（数据同步推送用，或 deploy key）；如需每日 LLM 推荐，再加 `Environment=DEEPSEEK_API_KEY=<key>`。`systemctl daemon-reload && systemctl restart skillhub`。
3. nginx：把 `skillhub.nginx.conf` 作为**新 vhost** 合入，`nginx -t` 通过后 reload；TLS 用 certbot 补（免费证书，不要动其他域名证书）。
4. DNS（由 DNS owner 执行）：阿里云云解析 `hub.hibcglobal.com` A → `39.105.17.219`。
5. 启用同步周期：`cp skillhub-sync.timer skillhub-sync.service /etc/systemd/system/ && systemctl enable --now skillhub-sync.timer`（每小时：构建 → 有变更则 commit+push 回 GitHub）。
6. 验证：`curl -s http://127.0.0.1:4290/api/health`；`curl -s https://hub.hibcglobal.com/plugins.json`。

## 回滚

`systemctl disable --now skillhub skillhub-sync.timer`，移除 nginx vhost 后 reload，删除 DNS 记录即可；`/opt/skillhub` 保留数据不删。

## AI 维护入口（部署后可用）

- `POST /api/admin/entries` 写条目；`POST /api/admin/publish` 重建 plugins.json；`POST /api/admin/crawl/{dsh|workbuddy|trae|mcp}` 触发爬虫（草稿入 `data/pending/`）。
- 全部要求 loopback + `Authorization: Bearer <token>`；公网不可达（仅经 nginx 的路径也被应用层拒绝）。

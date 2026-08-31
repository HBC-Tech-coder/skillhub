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
5. 启用同步周期：`cp skillhub-sync.timer skillhub-sync.service skillhub-daily.timer skillhub-daily.service skillhub-tick.timer skillhub-tick.service /etc/systemd/system/ && systemctl daemon-reload && systemctl enable --now skillhub-sync.timer skillhub-daily.timer skillhub-tick.timer`——每小时：构建 → 有变更则 commit+push 回 GitHub；每天 04:00：7 生态爬取 + AI 每日推荐 + AI 打标 + 自动收录 + push；每 5 分钟 tick：消费超管后台"立即执行"请求并按后台配置触发到期任务（需要 `DEEPSEEK_API_KEY` 与 `GITHUB_TOKEN`，经受保护的 EnvironmentFile 注入，不落任何共享文件）。三个周期脚本都先经 `scripts/lib/pipeline-gate.js` 门禁判定（超管后台配置为调度权威），重复触发安全。
6. 验证：`curl -s http://127.0.0.1:4290/api/health`；`curl -s https://hub.hibcglobal.com/plugins.json`；浏览器打开 `https://hub.hibcglobal.com/admin`（超管后台登录页）。

## 超管后台（Founder 使用）

- 入口：`https://hub.hibcglobal.com/admin`（公开可达；API 前缀 `/api/panel/`，注意不要被公网 404 加固策略拦截）。
- 初始账号：`admin` / `admin888`。**首次登录强制修改密码**（规则：≥9 位、大写/小写/数字/特殊字符至少 3 类、不得与初始密码相同）；改密后所有会话下线，须重新登录才有完整权限。账号数据存 `data/.ops/admin.json`（scrypt 哈希，0600，不入 GitHub）。
- 功能：设置 DeepSeek/GitHub 密钥（写入 `data/.ops/app.env`，定时任务自动读取）；管线调度（每小时同步开关/间隔、每日管线开关/时间）；推广自动化（每日草稿开关/时间/渠道/模板，人工发布，不自动外发）；立即执行按钮（tick ≤5 分钟消费）；运行日志与草稿归档。
- 安全：HttpOnly + SameSite=Strict Cookie 会话（12h 滑动过期，服务重启全部失效）；登录 IP 限流（15 分钟 10 次）；变更请求 Origin 校验。
- 忘记密码恢复：删除服务器上 `data/.ops/admin.json` 后重启服务 → 恢复 `admin/admin888` 并重新走首登改密。
- 注意：超管后台只写 `data/.ops/`（`skillhub.service` 已允许写 `data/`，无需改 unit）；密钥在 UI 保存后立即对服务进程生效。

## 回滚

`systemctl disable --now skillhub skillhub-sync.timer`，移除 nginx vhost 后 reload，删除 DNS 记录即可；`/opt/skillhub` 保留数据不删。

## AI 维护入口（部署后可用）

- `POST /api/admin/entries` 写条目；`POST /api/admin/publish` 重建 plugins.json；`POST /api/admin/crawl/{dsh|workbuddy|trae|mcp}` 触发爬虫（草稿入 `data/pending/`）。
- 全部要求 loopback + `Authorization: Bearer <token>`；公网不可达（仅经 nginx 的路径也被应用层拒绝）。

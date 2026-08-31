# SkillHub API 参考

## 静态资源（服务器与 GitHub Pages 相同）

| 路径 | 说明 |
|---|---|
| `/plugins.json` | 全量目录（dshmarket 同构；`DSHM_REGISTRY_URL` 可直接指向） |
| `/feed.xml` | Atom 订阅源 |
| `/skillhub.csv` | 扁平 CSV（HF datasets 用） |
| `/sitemap.xml` | 站点地图 |
| `/items/<id>.html` | 条目独立详情页（SEO） |

## 服务器端检索 API（仅自有服务器版）

基地址：`https://hub.hibcglobal.com`（备案前为临时域名；GitHub Pages 无此 API）

### GET /api/search

| 参数 | 说明 |
|---|---|
| `q` | 关键词（大小写不敏感子串，匹配名称/作者/中英描述/标签） |
| `eco` | 生态过滤：`dsh` / `workbuddy` / `trae` / `mcp` |
| `cat` | 分类 id（见 plugins.json 的 categories 键） |
| `limit` | 返回上限（默认 50，最大 200） |

返回：

```json
{ "total": 123, "count": 20, "items": [ {条目}, ... ] }
```

### GET /api/items/:id

返回单条目；404 表示不存在。

### GET /api/health

```json
{ "ok": true, "time": "...", "dataUpdated": "2026-08-31" }
```

## 管理 API（维护者专用）

见 `docs/MAINTENANCE.md`；全部要求 loopback + Bearer token，公网 403。

## 超管后台 API（/api/panel/，会话保护）

仅服务器版可用；入口页面 `/admin`。会话为 HttpOnly + SameSite=Strict Cookie（12h 滑动过期）。GitHub Pages 静态镜像无此服务。

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/panel/session` | GET | 当前会话：`{user, role}`；role ∈ `null / mustChange / admin` |
| `/api/panel/login` | POST | `{user, pass}`；成功下发 Cookie；首登 `mustChange:true`；IP 限流（15 分钟 10 次） |
| `/api/panel/logout` | POST | 注销当前会话 |
| `/api/panel/change-password` | POST | `{old, next}`；规则：≥9 位、大写/小写/数字/特殊字符至少 3 类、不得与初始密码相同；成功后所有会话下线（`relogin:true`） |
| `/api/panel/config` | GET | 配置（密钥掩码显示） |
| `/api/panel/config` | POST | 保存 `{keys:{deepseek,github}, pipeline:{syncEnabled,syncIntervalHours,dailyEnabled,dailyTime,promoEnabled,promoTime,promoChannels,promoTemplate}}`；密钥留空=不修改 |
| `/api/panel/run` | POST | `{task: sync|daily|promo}` 写执行请求标记；tick 定时器 ≤5 分钟消费 |
| `/api/panel/status` | GET | 服务状态 + 配置摘要 + 最近运行日志 + 草稿列表 |
| `/api/panel/promo-drafts` | GET | 草稿文件名列表 |
| `/api/panel/promo-draft?name=` | GET | 单篇草稿内容（文件名白名单校验） |

`mustChange` 会话只能调用 session / change-password / logout；其余端点返回 403 `MUST_CHANGE`（改密并重新登录后才有完整权限）。所有 POST 校验 Origin（与 Host 一致），CSRF 防线叠加 SameSite=Strict。

## CORS

GET 端点与 `/plugins.json` 开放 `Access-Control-Allow-Origin: *`（供镜像、推广插件与目录站跨域读取）。

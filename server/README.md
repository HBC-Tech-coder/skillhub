# SkillHub 服务器端

零依赖 Node 服务（Node >= 18）。职责：静态托管站点、检索 API、管理 API、爬虫触发。

## 运行

```sh
cd server
PORT=4290 HOST=127.0.0.1 SKILLHUB_ADMIN_TOKEN=<长随机串> node server.js
```

- 站点：`http://127.0.0.1:4290/`（同仓库 `site/`，与 GitHub Pages 同一套文件）
- 数据：`/plugins.json`（构建产物，先 `node scripts/build-plugins.js`）

## API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 健康检查 |
| GET | `/api/search?q=&eco=&cat=&limit=` | 服务器端检索（q 大小写不敏感子串） |
| GET | `/api/items/:id` | 单条详情 |
| POST | `/api/admin/entries` | 写入/更新条目（body 为条目 JSON，自动校验） |
| POST | `/api/admin/publish` | 重新构建 plugins.json |
| POST | `/api/admin/crawl/:eco` | 触发爬虫（dsh/workbuddy/trae/mcp），结果进 data/pending/ |

管理端点要求 **loopback 来源 + `Authorization: Bearer <SKILLHUB_ADMIN_TOKEN>`**，两者缺一 403。GET 端点开放 CORS（供镜像与推广插件读取）。

## 爬虫

```sh
node crawlers/dsh.js        # GitHub topic:dsh-plugin
node crawlers/workbuddy.js  # topic:workbuddy*
node crawlers/trae.js       # topic:trae*（topic 未定型，人工筛噪）
node crawlers/mcp.js        # topic:mcp-server
```

- 未认证限速 10 次/分钟；设置 `GITHUB_TOKEN` 后 30 次/分钟。
- 产物 `data/pending/<eco>-<ts>.json` 是**草稿**，需人工/AI 审阅后转正进 `data/entries/`（`POST /api/admin/entries` 可代写，但仍建议审阅）。

## 上线注意（39.105.17.219）

- 端口：部署前在 `D:\aishare\PORTS.md` 登记（本服务默认 4290，仅本机回环，公网经 nginx 反代）。
- 不动该机任何既有 nginx 配置、服务与数据；新增 vhost 需与 host owner 协调。

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

## CORS

GET 端点与 `/plugins.json` 开放 `Access-Control-Allow-Origin: *`（供镜像、推广插件与目录站跨域读取）。

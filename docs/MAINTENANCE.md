# SkillHub 维护手册（给维护 AI / 维护者）

> 目标：让任何接手维护的 AI 都能按本手册独立完成「爬取 → 审阅 → 转正 → 发布 → 回推 GitHub」全链路。
> 安全底线：不编造数据；描述必须来自真实来源；`verified` 只表示核验过描述与安装形态，不是安全背书。

## 日常维护链路

```sh
# 1. 爬取（每生态一次，草稿入 data/pending/，gitignore 不进仓）
#    top 200 × 14 查询（GitHub 搜索分页，见 server/crawlers/*）；星标门槛：
#    dsh/workbuddy/trae ≥3★，mcp/claude-code/codex/gemini ≥5★；trae/foreign 带噪音过滤。
#    自动入库有质量闸门（server/lib/ingest.js）：INGEST_MIN_STARS 默认 10、INGEST_DAILY_CAP 默认 100，
#    低于门槛/超出上限的 keep 草稿保留打标结果，走人工审阅转正（长尾覆盖靠人工/点名清单）。
node server/crawlers/dsh.js
node server/crawlers/workbuddy.js
node server/crawlers/trae.js
node server/crawlers/mcp.js
node server/crawlers/foreign.js          # claude-code / codex / gemini 三生态

# 2. 审阅（机械证据判定）
node scripts/review-pending.js data/pending/dsh-*.json --eco dsh --limit 15        # bundle 证据
node scripts/review-pending.js data/pending/mcp-*.json --eco mcp --limit 10        # README 协议标记
node scripts/review-pending.js data/pending/workbuddy-*.json --eco workbuddy --limit 8  # SKILL.md/skills 目录
node scripts/review-pending.js data/pending/trae-*.json --eco trae --limit 8

# 3. 转正（只有 BUNDLE_CONFIRMED / MCP_LIKELY / SKILL_LIKELY 可转正）
#    写 data/entries/<id>.json：描述取自仓库自述（可翻译，不夸大），stars 取爬取值，
#    install 必须是真实命令（不确定就写"按 README"，不要编命令），verified 保守为 false。
#    噪音特征：非本生态项目蹭 topic（如 PicGo/NocoBase 打 dsh-plugin 标签）、
#    traefik 蹭 trae 文本、仓库已 404/归档。

# 4. 校验 + 构建（全链）
node scripts/validate-all.js
npm run build     # plugins.json + feed.xml + skillhub.csv + 详情页 + sitemap

# 5. 回推 GitHub（服务器为源的管线）
git add data/entries data/plugins.json data/feed.xml data/skillhub.csv site/items site/sitemap.xml
git commit -m "data: <本轮摘要>"
git push origin main
```

## 管理 API（服务器版）

全部要求 **loopback 来源 + `Authorization: Bearer <SKILLHUB_ADMIN_TOKEN>`**：

| 端点 | 作用 |
|---|---|
| `POST /api/admin/entries` | 写入/更新单条目（body=条目 JSON，自动校验） |
| `POST /api/admin/publish` | 重新构建 plugins.json |
| `POST /api/admin/crawl/{dsh|workbuddy|trae|mcp|foreign}` | 触发爬虫（异步，草稿入 pending） |

## 每日 LLM 推荐（服务器版可选）

- 配置 `DEEPSEEK_API_KEY` 后，`node server/lib/recommend.js` 用 LLM 基于 plugins.json 生成 App Store 式编辑推荐（中英双语），写入 `data/recommendations.json`（itemIds 校验失败自动保留旧版）；`sync-cycle.sh` 每小时触发一次（无 key 自动跳过）。
- 语义搜索升级：`/api/search` 在意图词表回退之上，可继续接 LLM 查询改写（见 `server/lib/llm.js`）。

## 质量红线

1. **描述与安装命令必须可核对**：声称"N 个工具"会被抽查；`stars/downloads` 未知就 null。
2. **不收录**：蹭标签噪音、已 404/归档、无法确认安装方式的仓库。
3. **多生态诚实口径**："应用内嵌 MCP" 用 `kind: other` + "按 README 部署"；不是 bundle 就不写 `dsh plugin add github:...`。
4. **verified 规则**：有机械证据（bundle 声明 / 官方 SDK / 官方发布）且描述取自仓库自述 → 可 true；否则 false。
5. 每次实质动作后在 `D:\aishare\CODEX-SKILLHUB-STATUS-LATEST.md` 更新进度（本仓库作者约定）。

## 故障速查

- 爬虫 `rate limited`：GitHub API 未认证 60 次/小时；稍后重试或配置 `GITHUB_TOKEN`。
- 审阅 `UNKNOWN_NO_PACKAGE_JSON`：非 bundle 形态，按对应生态规则另判或跳过。
- Pages 未更新：CI publish-pages 失败时看 Actions 日志；构建脚本在 CI 与本地一致。

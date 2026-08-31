# SkillHub 架构（v1）

## 核心原则：服务器为源，静态页为镜像

```
                     ┌─────────────────────────────────────────────┐
  人工 PR / AI 维护 ──▶│  自有服务器（hub.hibcglobal.com，39.105.17.219）  │
                     │  data/entries/*.json  ←─ 爬虫(每生态) + 管理API   │
                     │        │ node scripts/build-plugins.js           │
                     │        ▼                                        │
                     │  data/plugins.json ──▶ 服务器站点(同一套 site/)    │
                     │        │ 提供 /api/search /api/admin/*           │
                     └────────┼────────────────────────────────────────┘
                              │ 定时 git commit + push（爬虫/AI 维护管线）
                              ▼
                     ┌─────────────────────────────────────────────┐
                     │  GitHub 仓库 skillhub（HBC-Tech-coder）        │
                     │  CI: validate → build → GitHub Pages 镜像      │
                     │  https://hbc-tech-coder.github.io/skillhub/   │
                     └─────────────────────────────────────────────┘
```

- **同一套前端**：`site/` 是纯静态 HTML/JS/CSS，读取同源 `plugins.json`。服务器与 GitHub Pages 部署的是同一份文件，零分歧。
- **差异只在 API**：服务器额外提供 `/api/search`（更强检索）与 `/api/admin/*`（AI 维护入口）；静态页在无 API 时自动退化为客户端过滤。
- **为什么服务器为源**：爬虫需要长驻进程与出网权限；数据每天变化，服务器持续聚合并把结果 commit/push 回 GitHub（AI 维护同一管线）。

## 数据流

1. **来源**：各生态爬虫（`server/crawlers/*`）+ 人工 PR 条目（`data/entries/*.json`）+ 管理 API 写入。
2. **规范化**：所有条目收敛为同一 schema（`schema/plugins.schema.json`），字段为 awesome-dsh-plugin/dshmarket 格式的超集，保证 dshmarket 可通过 `DSHM_REGISTRY_URL` 直接镜像本仓库的 `plugins.json`。
3. **构建**：`scripts/build-plugins.js` 把 entries 聚合为 `data/plugins.json`（按星标排序、生成分类表、updated/count）。
4. **分发**：服务器静态托管 + GitHub Pages（CI 发布）+ dshmarket 镜像（兼容）。
5. **回流**：推广插件 `dsh-skillhub` 与通用 Skill 把用户带回 hub（搜索/安装/投稿）。

## 关键设计

- **零依赖**：所有脚本仅用 Node 内置模块；服务器端不引入框架（AI 维护时代码越少越稳）。
- **兼容优先**：`plugins.json` 顶层形状对齐 `awesome-dsh-plugin.com/plugins.json`（name/url/source/updated/count/categories/plugins[]），条目字段为其超集。
- **多生态归一**：一个条目可带多个 `ecosystems`（如某插件同时有 DSH 与 MCP 安装方式），每生态给出独立安装命令。
- **安全边界**：管理 API 仅接受 loopback + Bearer token；安装类命令仅记录不代执行（v1）；爬虫仅做 GET、限速、结果进入 `data/pending/` 待审。

## 待定 / 下一阶段

- Hugging Face 等更多分发渠道；
- 评分/评论（giscus 或自建）；
- 服务器端定时任务（systemd timer）固化爬虫节奏。

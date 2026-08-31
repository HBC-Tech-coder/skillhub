# SkillHub 技能港

> 一个地方，装齐所有 AI 的插件与技能。跨生态（DSH · WorkBuddy · TRAE · MCP）聚合平台。

- **数据规范**：`plugins.json`（schema 见 `schema/plugins.schema.json`，规范见 `docs/SPEC.md`）
- **架构**：自有服务器为数据源 → 同一套静态目录站双部署（服务器 + GitHub Pages 镜像），见 `docs/ARCHITECTURE.md`
- **当前状态**：v0.1 开发中（UI 风格选型见 `mockups/`）

## 目录

| 路径 | 说明 |
|---|---|
| `schema/` | plugins.json 的 JSON Schema |
| `data/entries/` | 单条目 JSON（数据源，人工/爬虫/AI 维护） |
| `data/plugins.json` | 构建产物（`node scripts/build-plugins.js` 生成，勿手改） |
| `scripts/` | 构建、校验、草稿审阅脚本（`review-pending.js` 用 GitHub API 机械核验草稿是否真为 DSH bundle） |
| `site/` | 静态目录站（同一套代码部署到服务器与 GitHub Pages） |
| `server/` | 服务器端：静态托管 + 检索 API + 管理 API + 爬虫 |
| `contrib/` | 投稿模板与投稿指南 |
| `plugins/dsh-skillhub/` | 推广用 DSH 插件（浏览/检索/安装 SkillHub 资源） |
| `skills/` | 通用 Skill：发现/评估/安装 hub 资源；投稿指南 |
| `mockups/` | UI 风格参考页（选型用，不参与构建） |
| `.github/workflows/` | CI 校验与 GitHub Pages 发布 |

## 快速开始（本地预览）

```sh
node scripts/build-plugins.js        # entries -> data/plugins.json
npx --yes serve site                 # 或任意静态服务器，浏览器打开 site/index.html
```

服务器版（含检索/管理 API）：

```sh
cd server && node server.js          # 默认 4290 端口，见 server/README.md
```

## dsh-market 镜像接入

本仓库的 `data/plugins.json` 与 dshmarket 数据源同构，dsh-market 用户可把技能港挂为镜像（浏览全部目录；安装受 dsh-market 自身的 awesome-dsh-plugin 白名单约束，未收录来源会被拒绝安装）：

```sh
# 服务器版
DSHM_REGISTRY_URL=https://hub.hibcglobal.com/plugins.json dsh web
# GitHub Pages 镜像（服务器不可达时）
DSHM_REGISTRY_URL=https://hbc-tech-coder.github.io/skillhub/plugins.json dsh web
```

## 收录与投稿

- 收录标准：可安装、描述属实、分类正确、在维护（同 awesome-dsh-plugin 标准）。
- 投稿：按 `contrib/CONTRIBUTING.md` 提交条目 PR；CI 自动校验格式。

## 域名与部署

- 正式域名：`skillharbor.com` / `jinenggang.com` / `jinenggang.cn` / `skillhub.xyz`（备案中）
- 临时域名：`hub.hibcglobal.com`
- GitHub Pages 镜像：https://hbc-tech-coder.github.io/skillhub/（首次发布后生效）

## License

MIT

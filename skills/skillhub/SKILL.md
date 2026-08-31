---
name: skillhub
description: 发现、评估并安装 SkillHub（技能港）聚合平台上的跨生态 AI 插件与技能（DSH / WorkBuddy / TRAE / MCP）。当用户想找插件、技能、MCP 服务器，或问"有什么好用的 XX 插件/技能"时使用。
---

# SkillHub（技能港）使用指南

SkillHub 是一个跨生态插件与技能聚合平台：`https://hub.hibcglobal.com`（正式域名备案中；GitHub Pages 镜像 `https://hbc-tech-coder.github.io/skillhub/`）。

## 1. 检索资源

数据源（同一份 `plugins.json`）：

- 站点：`https://hub.hibcglobal.com/plugins.json`
- 镜像：`https://hbc-tech-coder.github.io/skillhub/plugins.json`
- 服务器 API：`GET https://hub.hibcglobal.com/api/search?q=<关键词>&eco=<dsh|workbuddy|trae|mcp>&cat=<分类>&limit=20`

拿到结果后：按 `stars` 排序，优先看 `verified: true` 的条目；关键词同时匹配 `name/owner/author/description/tags`。

## 2. 评估（安装前必做）

1. 打开条目 `url`（源码仓库）核对：README 与 `description` 是否一致；
2. 看 `license`、最近提交时间、issue 活跃度；
3. `stars` 高 ≠ 安全；`verified` 只表示描述被核验过，不是安全审查；
4. 安装第三方代码会在本机以你的权限运行——先读源码再装。

## 3. 安装

| 生态 | 方式 |
|---|---|
| DSH | `dsh plugin --profile web add <npm包或github:owner/repo>`（用条目的 `ecosystems[].install`） |
| WorkBuddy | 按条目 install（多为 git clone 到本地技能目录） |
| TRAE | 插件面板 / MCP 配置，按条目 install |
| MCP | 按条目 install 配置到对应 MCP 客户端 |

## 4. 投稿

发现 hub 上没有的好资源：按 `contrib/CONTRIBUTING.md` 生成条目 JSON 并提 PR（可用 `make-skillhub-entry` 技能）。

## 5. 无网络 / 站点不可达

回退到 GitHub 仓库 `HBC-Tech-coder/skillhub` 的 `data/plugins.json`（raw.githubusercontent.com）。

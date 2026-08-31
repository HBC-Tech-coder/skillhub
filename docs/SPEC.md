# SkillHub plugins.json 规范（v1）

本文档是 `data/plugins.json` 与 `data/entries/*.json` 的字段规范。机器可读约束见 `schema/plugins.schema.json`。

## 设计目标

1. **dshmarket 兼容**：顶层形状对齐 `awesome-dsh-plugin.com/plugins.json`，dsh-market 可通过 `DSHM_REGISTRY_URL` 指向本文件直接镜像。
2. **多生态归一**：DSH / WorkBuddy / TRAE / MCP 统一为同一条目模型；每生态独立安装方式。
3. **零依赖可维护**：条目是普通 JSON，AI/爬虫/人类都可编辑；构建脚本负责聚合与排序。

## 顶层结构

```json
{
  "name": "skillhub",
  "url": "https://hub.hibcglobal.com",
  "source": "https://github.com/HBC-Tech-coder/skillhub",
  "updated": "2026-08-31",
  "count": 8,
  "categories": { "market": {"en": "Plugin Markets & Managers", "zh": "插件市场与管理"}, "...": {} },
  "plugins": [ {条目}, ... ]
}
```

- `updated`：YYYY-MM-DD（构建时生成）。
- `count`：条目总数。
- `categories`：分类表，键为分类 id，值为 `{en, zh}`。v1 直接复用 awesome-dsh-plugin 的 23 个分类，允许新增。
- `plugins`：按 `stars` 降序（null 排最后）、`added` 降序排序。

## 条目结构（entries/*.json，也是 plugins[].*）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | string | ✅ | 全局唯一 slug（如 `dsh-market`）；文件名与之一致 |
| `name` | string | ✅ | 展示名 |
| `owner` | string | ✅ | GitHub owner 或组织名 |
| `url` | string | ✅ | 源码/主页 URL |
| `category` | string | ✅ | 分类 id（必须出现在 categories 表） |
| `description` | {en,zh} | ✅ | 双语一句话描述（各 ≤ 300 字符） |
| `install` | string | ✅ | 主安装命令（默认生态） |
| `ecosystems` | array | ✅ | 见下 |
| `added` | string | ✅ | 收录日期 YYYY-MM-DD |
| `npm` | string\|null | | npm 包名 |
| `tarball` | string\|null | | 预构建包 URL（可选） |
| `stars` | number\|null | | GitHub 星标（爬虫刷新） |
| `downloads` | number\|null | | npm 下载量（爬虫刷新） |
| `screenshots` | string[] | | 截图 URL（可选） |
| `kind` | string | | 主类型：`plugin` / `skill` / `server` / `registry` |
| `license` | string | | SPDX 标识（如 MIT） |
| `author` | string | | 作者/组织名 |
| `tags` | string[] | | 检索标签 |
| `verified` | boolean | | 人工核验过描述与安装方式（默认 false） |
| `status` | string | | `active` / `archived` / `pending` |

### ecosystems

```json
"ecosystems": [
  { "id": "dsh", "kind": "plugin", "install": "dsh plugin --profile web add dshmarket" }
]
```

- `id`：`dsh` / `workbuddy` / `trae` / `mcp` / `skills-sh` / `generic`（可扩展）。
- `kind`：该生态下的形态（plugin / skill / server / registry）。
- `install`：该生态的安装方式（命令、面板路径或 URL）。

## 兼容说明

- awesome-dsh-plugin 条目字段（`name/owner/url/page/category/description/npm/tarball/stars/downloads/install/added/screenshots`）全部保留同名语义；本规范新增 `id/ecosystems/kind/license/author/tags/verified/status`。
- 镜像方（dshmarket）只读其认识的字段，因此把本文件作为 `DSHM_REGISTRY_URL` 使用时，未知字段会被忽略——向上兼容。

## 校验与构建

```sh
node scripts/validate-entry.js data/entries/<id>.json   # 校验单条
node scripts/validate-all.js                            # 校验全部
node scripts/build-plugins.js                           # 聚合生成 data/plugins.json
```

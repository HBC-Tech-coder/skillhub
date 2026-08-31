# SkillHub 投稿指南

## 收录标准

与 awesome-dsh-plugin 一致：

1. **能安装**——`install` / `ecosystems[].install` 给出的命令真实可用；
2. **描述属实**——一句话描述与实际功能一致（评审会对照源码抽查）；
3. **分类正确**——`category` 使用 `docs/SPEC.md` / 构建脚本中的分类 id；
4. **在维护**——仓库存在、未明显弃坑。

> 上架不是安全审查：安装第三方插件会在你的机器上运行第三方代码。列出 ≠ 背书，请自行检查源码。

## 投稿步骤

1. Fork 本仓库，切出分支；
2. 复制 `contrib/ENTRY_TEMPLATE.json` 到 `data/entries/<你的条目id>.json`（id 用全小写 slug，文件名与 id 一致）；
3. 本地校验：
   ```sh
   node scripts/validate-entry.js data/entries/<id>.json
   node scripts/build-plugins.js
   ```
4. 提交 PR。CI 会自动跑全量校验；`data/plugins.json` 是构建产物，**不要手改**（构建脚本会覆盖）。

## 多生态条目

同一资源支持多个生态时，用 `ecosystems` 数组给出每生态的安装方式（如一个 MCP 服务器同时有 DSH 接入方式）。`install` 填默认生态的主安装命令。

## 数据字段

见 `docs/SPEC.md`；机器可读约束见 `schema/plugins.schema.json`。`stars`/`downloads` 由爬虫刷新，投稿时可留 null。

## 审核

维护者（或 AI 维护管线）会：校验格式 → 抽查安装命令与描述 → 合并。合并后服务器构建管线与 GitHub Pages 会自动更新（通常一天内）。

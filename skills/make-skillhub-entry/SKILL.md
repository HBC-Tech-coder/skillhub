---
name: make-skillhub-entry
description: 为 SkillHub（技能港）聚合平台撰写并校验插件/技能收录条目（entry JSON）。当用户想把某个插件、技能或 MCP 服务器投稿到 SkillHub 时使用。
---

# 投稿 SkillHub 条目

目标：为资源生成一条符合 SkillHub 规范的 `data/entries/<id>.json`，本地校验通过后指导用户提 PR。

## 步骤

1. **收集事实**（不要编造）：打开资源仓库，读取 README、package.json / manifest、license、star 数（能取到才填，否则 null）。
2. **写条目**：以 `contrib/ENTRY_TEMPLATE.json` 为模板（仓库 `HBC-Tech-coder/skillhub`）：
   - `id`：全小写 slug（如 `dsh-market`），文件名与之一致；
   - `description`：中英各一句，忠于 README，不夸大（声称 N 个工具会被核对）；
   - `category`：从 `docs/SPEC.md` 分类表选择；
   - `ecosystems`：每生态一条 `{id, kind, install}`，install 必须是真实可执行的命令/路径（不确认就写"参照仓库 README"并说明）；
   - `stars/downloads` 未知一律 null；`verified: false`；`status: "active"`。
3. **本地校验**（在仓库根目录）：
   ```sh
   node scripts/validate-entry.js data/entries/<id>.json
   node scripts/build-plugins.js && node scripts/validate-all.js
   ```
4. **交付**：说明新增文件路径、校验结果，提醒用户提交 PR；不要代替用户 push。

## 注意

- 不要改 `data/plugins.json`（构建产物）；
- 多生态资源用 `ecosystems` 数组，`install` 填默认生态；
- 描述与实际不符会被打回：优先"保守准确"而非"营销吸引"。

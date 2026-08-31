# SkillHub 数据集（Hugging Face 渠道准备）

将 SkillHub 目录导出为 HF datasets 可直接消费的数据集。

## 生成

```sh
node scripts/build-plugins.js        # 生成 plugins.json + feed.xml
node scripts/export-csv.js           # 生成 data/skillhub.csv
```

## 上传到 Hugging Face（有 HF 账号后执行）

```sh
huggingface-cli repo create skillhub-catalog --type dataset
huggingface-cli upload skillhub-catalog data/skillhub.csv data/plugins.json data/feed.xml README.md hf/README.md
```

## Dataset Card 要点（hf/README.md 即模板）

- 数据为跨生态聚合目录：DSH / WorkBuddy / TRAE / MCP 的插件、技能、注册表与工具；
- 每条含 id/name/owner/url/category/中英描述/安装命令/ecosystems/星标/许可/verified；
- 收录标准：可安装、描述属实、在维护；`verified` 仅表示人工核验过描述，**不是安全背书**；
- 更新节奏：服务器爬虫管线每日聚合，GitHub 仓库为源（https://github.com/HBC-Tech-coder/skillhub）。

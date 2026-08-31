# dsh-skillhub（技能港入口插件）

在 DeepSeek Harness Web UI 右下角注入「技」悬浮按钮，点击打开 SkillHub 搜索面板：浏览跨生态（DSH / WorkBuddy / TRAE / MCP）插件与技能，一键复制安装命令。

## 安装

```sh
dsh plugin --profile web add dsh-skillhub
# 或
dsh plugin --profile web add github:HBC-Tech-coder/skillhub#path:/plugins/dsh-skillhub
```

## 配置（可选，profile 的 cordis 配置行内）

```yaml
- id: skillhub
  name: dsh-skillhub
  config:
    registryUrl: 'https://hub.hibcglobal.com/plugins.json'
```

不配置时依次回退：hub.hibcglobal.com → GitHub Pages 镜像 → 仓库 raw。

## 当前版本

- **v0.1（本目录）**：纯客户端面板——发现 + 检索 + 复制安装命令。零宿主 API 依赖，安全边界=只读 fetch。
- **v0.2 路线图**（待真实 dsh 宿主 API 验证后启用）：
  - Host 注册 model tool `skillhub_search`（agent 可对话式检索 hub）；
  - 同源 loopback 安装端点（面板内一键 `dsh plugin add`，仅限本机回环请求）。

## 收录状态

- 目标收录渠道：GitHub `dsh-plugin` topic + awesome-dsh-plugin 注册表 PR（见主仓库 `contrib/CONTRIBUTING.md`）。
- ⚠️ 本插件尚未在真实 dsh（upstream）上冒烟测试；HarnessDesk fork 上验证通过不代表 upstream 一致，收录前必须实测。

## 安全

- 只读：面板仅 GET `plugins.json`；不代执行任何安装命令（用户自行粘贴运行）。
- 条目数据为第三方描述，`verified` 仅表示人工核验过描述，不是安全背书；安装前请查看条目源码仓库。

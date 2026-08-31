# dsh-skillhub 测试记录

## 2026-08-31 在 HarnessDesk（DSH 系 fork）会话内冒烟测试

### 已验证（机械证据）

- **数据通路**：Host `web` 服务（`web.fetch({url})` → `{statusCode, body.content}`）→ Package 私有 RPC（`harness.handle` / `host.call`）→ Client 渲染。契约经 Inspect 查询确认存在。
- **Slot 通路**：Client `shell.overlay`（root 级 list，注册项 id/order/label）为悬浮面板的正确挂载点，契约已查询确认。
- **数据源**：GitHub Pages 镜像 `https://hbc-tech-coder.github.io/skillhub/plugins.json`（22 条四生态数据）与 raw.githubusercontent 回退。
- **定义成功**：动态包 `skhub-1/pkg-1`（Slot+React 移植版）已 define；`cordis_run` 返回 `awaiting-approval`（run-1）。

### 边界与未验证

- **本会话审批策略为关闭**：客户端包无法激活，面板未在本 GUI 实际渲染——数据加载与交互逻辑未经真实页面运行验证。
- **动态版 ≠ bundle 版**：动态环境无 `document/window/fetch/navigator` 全局，移植版改用 Slot+React+宿主 RPC；**上游 bundle（`lib/client.js`）仍是原生 DOM 注入实现**，需在真实 upstream dsh web 上实测。
- 未验证：上游 `dsh plugin add dsh-skillhub` 安装链路、bundle 在 upstream dsh 的注入与渲染、安装命令执行（v0.2 路线图）。

### 待办

1. 在跑 upstream dsh 的机器上 `dsh plugin --profile web add github:HBC-Tech-coder/skillhub#path:/plugins/dsh-skillhub`（或 npm 发布后 `dsh-skillhub`）实测面板；
2. 实测通过后再投稿 awesome-dsh-plugin 注册表；
3. 如需在本会话 GUI 查看移植版面板：把审批策略改为"询问"并批准 run-1。

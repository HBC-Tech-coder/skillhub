// dsh-skillhub Host 侧（v0.1 仅占位）。
// v0.1 功能全部在 Client 侧（纯 DOM 面板，无宿主 API 依赖）。
// v0.2 路线图：注册 model tool `skillhub_search`（调用 hub /api/search）、
//   同源 loopback 安装端点（执行 dsh plugin add，需真实宿主服务验证后再启用）。
export default function apply(ctx) {
  // 占位：保持 bundle 的 host 入口有效。
  return {};
}

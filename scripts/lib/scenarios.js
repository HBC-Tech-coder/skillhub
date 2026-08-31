// SkillHub 功能场景体系（v1）：按"用户想干什么"分类，而不是按名字/生态。
// - zh/en：场景名；intents：静态意图词表（无 LLM 时的语义搜索回退）。
// - entries 通过 `scenarios: string[]` 挂多个场景。
// 站点与服务器共用此表；构建时输出到 site/scenarios.json。
const SCENARIOS = {
  'content-social': { zh: '新媒体运营', en: 'Social Content', intents: ['公众号', '小红书', '抖音', 'b站', 'bilibili', '自媒体', '新媒体', '内容运营', '宣发', '涨粉', '分发', 'wechat', 'xiaohongshu', 'social media', 'content ops', 'tiktok'] },
  'video-download': { zh: '视频下载·去水印', en: 'Video Download', intents: ['下载', '无水印', '去水印', '视频下载', '搬运', 'download', 'watermark', 'no watermark', 'video download'] },
  'trends-monitor': { zh: '热点抓取·舆情', en: 'Trends & Monitoring', intents: ['热点', '热榜', '舆情', '监控', '趋势', '热搜', '情报', 'hot topics', 'trending', 'monitoring', 'news', 'sentiment'] },
  'copywriting': { zh: '文案·脚本', en: 'Copywriting', intents: ['文案', '标题', '口播稿', '脚本', '写作', '改写', 'copywriting', 'headline', 'script', 'writing'] },
  'video-edit': { zh: '短视频剪辑', en: 'Video Editing', intents: ['剪辑', '短视频', '卡点', '混剪', '剪映', 'editing', 'short video', 'reels'] },
  'voice-tts': { zh: '配音·口播', en: 'Voice & TTS', intents: ['配音', '口播', '语音', 'tts', '旁白', 'voiceover', 'narration', 'speech'] },
  'marketing': { zh: '营销自动化', en: 'Marketing', intents: ['营销', '推广', '引流', '获客', '转化', '私域', 'marketing', 'promotion', 'leads', 'growth'] },
  'design': { zh: '设计·UI', en: 'Design', intents: ['设计', 'ui', '海报', '配色', '原型', '换肤', '落地页', 'design', 'poster', 'palette', 'prototype', 'landing page'] },
  'dev-coding': { zh: '编程·开发', en: 'Coding & Dev', intents: ['编程', '代码', '开发', '插件', 'mcp', 'agent', '调试', '审查', 'coding', 'plugin', 'debug', 'review', 'developer'] },
  'memory-knowledge': { zh: '记忆·知识库', en: 'Memory & Knowledge', intents: ['记忆', '知识库', '上下文', '检索', 'rag', 'memory', 'knowledge', 'context', 'retrieval'] },
  'workflow': { zh: '工作流·自动化', en: 'Workflow', intents: ['工作流', '自动化', '任务', '看板', '会议', '日程', 'workflow', 'automation', 'task', 'kanban', 'meeting'] },
  'accounts': { zh: '账号管理', en: 'Accounts', intents: ['账号', '注册', '多开', 'account', 'register'] },
  'learn': { zh: '教程·学习', en: 'Learning', intents: ['教程', '学习', '指南', '入门', '蓝皮书', '速查', 'tutorial', 'guide', 'learning', 'course'] },
  'fun': { zh: '娱乐', en: 'Fun', intents: ['宠物', '娱乐', '好玩', '桌面宠物', 'pet', 'fun', 'mascot'] },
  'ecommerce': { zh: '电商', en: 'E-commerce', intents: ['电商', '商品图', '详情页', '淘宝', '带货', '店铺', 'ecommerce', 'product image', 'listing'] },
  'agents-roles': { zh: '角色·人设', en: 'Roles & Personas', intents: ['角色', '人设', '专家', '数字人', '人格', 'persona', 'roles', 'expert'] },
  'science-research': { zh: '科研·学术', en: 'Science & Research', intents: ['科研', '学术', '论文', '科学', 'nature', 'paper', 'research', 'science', 'scientist', '绘图'] },
  'security': { zh: '安全·审计', en: 'Security', intents: ['安全', '渗透', '审计', '漏洞', 'security', 'cybersecurity', 'pentest', 'audit', 'att&ck'] },
};

// 意图词 → 场景 id（构建时由 SCENARIOS 反查生成）
function intentIndex() {
  const idx = {};
  for (const [id, s] of Object.entries(SCENARIOS)) {
    for (const w of s.intents) {
      (idx[w] = idx[w] || []).push(id);
    }
  }
  return idx;
}

module.exports = { SCENARIOS, intentIndex };

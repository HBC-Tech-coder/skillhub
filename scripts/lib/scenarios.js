// SkillHub 功能场景体系（v2）：按「用户想干什么 + 用户是谁」分类。
// group: profession=按职位 / task=按任务 / feature=按功能
// zh/en：场景名；intents：静态意图词表（无 LLM 时的语义搜索回退）。
const SCENARIOS = {
  // —— 按职位 ——
  'content-social': { group: 'profession', zh: '新媒体运营', en: 'Social Media Ops', intents: ['公众号', '小红书', '抖音', 'b站', 'bilibili', '自媒体', '新媒体', '内容运营', '宣发', '涨粉', '分发', 'wechat', 'xiaohongshu', 'social media', 'content ops', 'tiktok'] },
  accounting: { group: 'profession', zh: '会计·财务', en: 'Accounting & Finance', intents: ['会计', '财务', '记账', '发票', '报税', '财报', 'accounting', 'finance', 'bookkeeping', 'invoice', 'tax'] },
  legal: { group: 'profession', zh: '律师·法务', en: 'Legal', intents: ['律师', '法务', '法律', '合同', '诉讼', '合规', 'legal', 'lawyer', 'contract', 'compliance'] },
  'science-research': { group: 'profession', zh: '科研·学术', en: 'Science & Research', intents: ['科研', '学术', '论文', '科学', 'nature', 'paper', 'research', 'science', 'scientist', '绘图'] },
  education: { group: 'profession', zh: '教师·教育', en: 'Teaching & Education', intents: ['教师', '老师', '教育', '备课', '教案', '教材', 'teaching', 'teacher', 'lesson', 'courseware'] },
  // —— 按任务 ——
  'video-download': { group: 'task', zh: '视频下载·去水印', en: 'Video Download', intents: ['下载', '无水印', '去水印', '视频下载', '搬运', 'download', 'watermark', 'no watermark', 'video download'] },
  'trends-monitor': { group: 'task', zh: '热点抓取·舆情', en: 'Trends & Monitoring', intents: ['热点', '热榜', '舆情', '监控', '趋势', '热搜', '情报', 'hot topics', 'trending', 'monitoring', 'news', 'sentiment'] },
  copywriting: { group: 'task', zh: '文案·脚本', en: 'Copywriting', intents: ['文案', '标题', '口播稿', '脚本', '写作', '改写', 'copywriting', 'headline', 'script', 'writing'] },
  'video-edit': { group: 'task', zh: '短视频剪辑', en: 'Video Editing', intents: ['剪辑', '短视频', '卡点', '混剪', '剪映', 'editing', 'short video', 'reels'] },
  'voice-tts': { group: 'task', zh: '配音·口播', en: 'Voice & TTS', intents: ['配音', '口播', '语音', 'tts', '旁白', 'voiceover', 'narration', 'speech'] },
  marketing: { group: 'task', zh: '营销自动化', en: 'Marketing', intents: ['营销', '推广', '引流', '获客', '转化', '私域', 'marketing', 'promotion', 'leads', 'growth'] },
  travel: { group: 'task', zh: '出国旅行', en: 'Travel Abroad', intents: ['旅行', '旅游', '出国', '行程', '签证', '机票', '酒店', 'travel', 'trip', 'itinerary', 'visa', 'flight'] },
  quant: { group: 'task', zh: '量化交易·投资', en: 'Quant & Investing', intents: ['量化', '交易', '投资', '炒股', '策略', '回测', 'freqtrade', 'quant', 'trading', 'invest', 'backtest', 'crypto'] },
  job: { group: 'task', zh: '求职·招聘', en: 'Job & Hiring', intents: ['求职', '招聘', '简历', '面试', '简历优化', 'job', 'resume', 'interview', 'hiring'] },
  ecommerce: { group: 'task', zh: '电商', en: 'E-commerce', intents: ['电商', '商品图', '详情页', '淘宝', '带货', '店铺', 'ecommerce', 'product image', 'listing'] },
  accounts: { group: 'task', zh: '账号管理', en: 'Accounts', intents: ['账号', '注册', '多开', 'account', 'register'] },
  // —— 按功能 ——
  design: { group: 'feature', zh: '设计·UI', en: 'Design', intents: ['设计', 'ui', '海报', '配色', '原型', '换肤', '落地页', 'design', 'poster', 'palette', 'prototype', 'landing page'] },
  'dev-coding': { group: 'feature', zh: '编程·开发', en: 'Coding & Dev', intents: ['编程', '代码', '开发', '插件', 'mcp', 'agent', '调试', '审查', 'coding', 'plugin', 'debug', 'review', 'developer'] },
  'memory-knowledge': { group: 'feature', zh: '记忆·知识库', en: 'Memory & Knowledge', intents: ['记忆', '知识库', '上下文', '检索', 'rag', 'memory', 'knowledge', 'context', 'retrieval'] },
  workflow: { group: 'feature', zh: '工作流·自动化', en: 'Workflow', intents: ['工作流', '自动化', '任务', '看板', '会议', '日程', 'workflow', 'automation', 'task', 'kanban', 'meeting'] },
  security: { group: 'feature', zh: '安全·审计', en: 'Security', intents: ['安全', '渗透', '审计', '漏洞', 'security', 'cybersecurity', 'pentest', 'audit', 'att&ck'] },
  'agents-roles': { group: 'feature', zh: '角色·人设', en: 'Roles & Personas', intents: ['角色', '人设', '专家', '数字人', '人格', 'persona', 'roles', 'expert'] },
  learn: { group: 'feature', zh: '教程·学习', en: 'Learning', intents: ['教程', '学习', '指南', '入门', '蓝皮书', '速查', 'tutorial', 'guide', 'learning', 'course'] },
  fun: { group: 'feature', zh: '娱乐', en: 'Fun', intents: ['宠物', '娱乐', '好玩', '桌面宠物', 'pet', 'fun', 'mascot'] },
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

// 场景 → 默认分类（LLM 打标自动收录时用；人工投稿仍自选 category）
const CATEGORY_BY_SCENARIO = {
  'content-social': 'workflow', accounting: 'tools', legal: 'tools',
  'video-download': 'tools', 'trends-monitor': 'tools',
  copywriting: 'workflow', 'video-edit': 'tools', 'voice-tts': 'voice',
  marketing: 'workflow', travel: 'tools', quant: 'dev', job: 'tools',
  design: 'ui', 'dev-coding': 'dev', 'memory-knowledge': 'memory',
  workflow: 'workflow', accounts: 'tools', learn: 'docs', fun: 'fun',
  ecommerce: 'tools', 'agents-roles': 'identity', 'science-research': 'skill', security: 'security', education: 'docs',
};

module.exports = { SCENARIOS, intentIndex, CATEGORY_BY_SCENARIO };

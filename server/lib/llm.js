// DeepSeek API 客户端（零依赖）。环境变量：
//   DEEPSEEK_API_KEY  必需；未配置时 available()=false，所有调用方优雅降级。
//   DEEPSEEK_BASE_URL 可选，默认 https://api.deepseek.com
const https = require('https');

function available() {
  return !!process.env.DEEPSEEK_API_KEY;
}

function baseUrl() {
  return (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
}

// messages: [{role, content}]；json=true 时强制 JSON 输出（prompt 需声明"只输出 JSON"）。
async function chat(messages, opts = {}) {
  if (!available()) throw new Error('DEEPSEEK_API_KEY not configured');
  const { json = false, temperature = 0.7, maxTokens = 2048 } = opts;
  const body = JSON.stringify({
    model: 'deepseek-chat',
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  });
  const u = new URL(baseUrl() + '/chat/completions');
  const text = await new Promise((resolve, reject) => {
    const req = https.request({
      host: u.hostname,
      port: u.port || 443,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + process.env.DEEPSEEK_API_KEY,
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ': ' + data.slice(0, 300)));
        resolve(data);
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => req.destroy(new Error('timeout')));
    req.write(body);
    req.end();
  });
  const j = JSON.parse(text);
  const content = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  if (!json) return content;
  // 容错：剥离可能的 markdown 围栏
  const m = content.match(/\{[\s\S]*\}/);
  return JSON.parse(m ? m[0] : content);
}

module.exports = { available, chat };

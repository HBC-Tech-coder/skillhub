// GitHub API 辅助（零依赖，仅 GET）。
// 注意：未认证限速 10 次/分钟；设置 GITHUB_TOKEN 后 30 次/分钟。
const https = require('https');

function ghGet(pathname, token) {
  return new Promise((resolve, reject) => {
    const req = https.get({
      host: 'api.github.com',
      path: pathname,
      headers: {
        'User-Agent': 'skillhub-crawler',
        Accept: 'application/vnd.github+json',
        ...(token ? { Authorization: 'Bearer ' + token } : {}),
      },
    }, (res) => {
      let body = '';
      res.on('data', (d) => { body += d; });
      res.on('end', () => {
        if (res.statusCode === 403 || res.statusCode === 429) return reject(new Error('rate limited (HTTP ' + res.statusCode + ')'));
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode + ': ' + body.slice(0, 200)));
        try { resolve(JSON.parse(body)); } catch (e) { reject(new Error('bad json: ' + e.message)); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => req.destroy(new Error('timeout')));
  });
}

function searchRepos(q, perPage, token) {
  return ghGet('/search/repositories?q=' + encodeURIComponent(q) + '&sort=stars&order=desc&per_page=' + (perPage || 30), token);
}

// 分页拉取：最多 total 条（每页 perPage ≤ 100，GitHub 上限），跨页合并去重。
// 用于"top N"覆盖（如 top 200）；页间 sleep 1.2s 规避搜索限速（认证 30 次/分钟）。
async function searchReposPaged(q, total, token, perPage) {
  perPage = Math.min(perPage || 100, 100);
  const pages = Math.ceil((total || 200) / perPage);
  const seen = new Map();
  for (let page = 1; page <= pages; page++) {
    const res = await ghGet(
      '/search/repositories?q=' + encodeURIComponent(q) +
      '&sort=stars&order=desc&per_page=' + perPage + '&page=' + page,
      token
    );
    const items = res.items || [];
    for (const r of items) if (!seen.has(r.full_name)) seen.set(r.full_name, r);
    if (items.length < perPage) break; // 已是最后一页
    await new Promise((resolve) => setTimeout(resolve, 1200));
  }
  return [...seen.values()];
}

// raw.githubusercontent.com 读取（不计 API 限速）。返回文本，失败返回 ''。
function rawGetText(fullName, file, branch) {
  return new Promise((resolve) => {
    const url = `https://raw.githubusercontent.com/${fullName}/${branch || 'HEAD'}/${file}`;
    const req = https.get(url, { headers: { 'User-Agent': 'skillhub-crawler' } }, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(''); }
      let body = '';
      res.on('data', (d) => { body += d; if (body.length > 300000) req.destroy(); });
      res.on('end', () => resolve(body.slice(0, 300000)));
    });
    req.on('error', () => resolve(''));
    req.setTimeout(20000, () => req.destroy());
  });
}

module.exports = { ghGet, searchRepos, searchReposPaged, rawGetText };

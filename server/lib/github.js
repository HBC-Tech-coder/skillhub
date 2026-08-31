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
        if (res.status === 403 || res.status === 429) return reject(new Error('rate limited (HTTP ' + res.status + ')'));
        if (res.status !== 200) return reject(new Error('HTTP ' + res.status + ': ' + body.slice(0, 200)));
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

module.exports = { ghGet, searchRepos };

/* SkillHub 超管后台前端（无框架，零依赖）。
   流程：登录 → 首次登录强制改密 → 重新登录 → 完整超管权限（概览/API 密钥/自动化管线/推广/安全）。
   提示：GitHub Pages 静态镜像没有后台服务，登录会提示"无法连接后台"属正常。 */
(function () {
  'use strict';
  var app = document.getElementById('app');
  var S = { tab: 'overview', cfg: null, status: null, timer: null };

  if ((localStorage.getItem('skillhub_theme') || '') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function toast(msg, isErr) {
    var el = document.createElement('div');
    el.className = 'toast' + (isErr ? ' err' : '');
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function () { el.classList.add('show'); });
    setTimeout(function () { el.classList.remove('show'); setTimeout(function () { el.remove(); }, 300); }, 3200);
  }
  function api(path, opts) {
    return fetch(path, opts || {}).then(function (res) {
      return res.json().catch(function () { return null; }).then(function (data) {
        return { status: res.status, data: data };
      });
    }).catch(function () { return { status: 0, data: null }; });
  }
  function post(path, body) {
    return api(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
  }

  /* ---------- 密码规则（与 server/lib/admin.js policyErrors 一致） ---------- */
  function policyState(pw) {
    var items = [];
    if (typeof pw !== 'string') pw = '';
    var len = pw.length >= 9;
    items.push({ ok: len, text: '长度至少 9 个字符（超过 8 位）' });
    var kinds = 0;
    if (/[A-Z]/.test(pw)) kinds++;
    if (/[a-z]/.test(pw)) kinds++;
    if (/[0-9]/.test(pw)) kinds++;
    if (/[^A-Za-z0-9]/.test(pw)) kinds++;
    items.push({ ok: kinds >= 3, text: '大写 / 小写 / 数字 / 特殊字符至少 3 类（当前 ' + kinds + '/4）' });
    items.push({ ok: pw !== 'admin888', text: '不能与初始密码相同' });
    return items;
  }
  function policyHTML(pw, extra) {
    var lis = policyState(pw).map(function (i) {
      return '<li class="' + (i.ok ? 'ok' : '') + '">' + esc(i.text) + '</li>';
    });
    if (extra) lis.push('<li class="' + (extra.ok ? 'ok' : '') + '">' + esc(extra.text) + '</li>');
    return '<ul class="plist">' + lis.join('') + '</ul>';
  }

  /* ---------- 视图：登录 ---------- */
  function renderLogin(errMsg, okMsg) {
    stopPoll();
    app.innerHTML =
      '<div class="auth-wrap"><div class="auth-card">' +
      '<h1><span class="logo">技</span>SkillHub 超管后台</h1>' +
      '<div class="sub">登录后管理 API 密钥、自动化管线与推广。首次登录必须修改密码。</div>' +
      '<div class="auth-err' + (errMsg ? ' show' : '') + '" id="aErr">' + esc(errMsg || '') + '</div>' +
      '<div class="auth-ok' + (okMsg ? ' show' : '') + '" id="aOk">' + esc(okMsg || '') + '</div>' +
      '<div class="field"><label>用户名</label><input type="text" id="fUser" value="admin" autocomplete="username"></div>' +
      '<div class="field"><label>密码</label><input type="password" id="fPass" autocomplete="current-password"></div>' +
      '<button class="btn primary" id="bLogin" style="width:100%">登 录</button>' +
      '<div class="admin-note" style="margin-top:12px">登录失败 10 次后同 IP 将被锁定 15 分钟。默认账号 admin / admin888（请立即改密）。</div>' +
      '</div></div>';
    app.dataset.view = 'login';
    document.getElementById('bLogin').addEventListener('click', doLogin);
    document.getElementById('fPass').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(); });
  }
  function doLogin() {
    var u = document.getElementById('fUser').value;
    var p = document.getElementById('fPass').value;
    var btn = document.getElementById('bLogin');
    btn.disabled = true;
    post('/api/panel/login', { user: u, pass: p }).then(function (r) {
      btn.disabled = false;
      if (r.status === 429) return renderLogin((r.data && r.data.error) || '尝试过多');
      if (r.status !== 200 || !r.data || !r.data.ok) return renderLogin((r.data && r.data.error) || '登录失败（静态镜像无后台服务？）');
      if (r.data.mustChange) return renderChange();
      enterPanel();
    });
  }

  /* ---------- 视图：首登改密 ---------- */
  function renderChange(errMsg, details) {
    stopPoll();
    app.innerHTML =
      '<div class="auth-wrap"><div class="auth-card">' +
      '<h1><span class="logo">技</span>首次登录 · 必须修改密码</h1>' +
      '<div class="sub">修改成功后将退出登录，需用新密码重新登录，之后才有完整超管权限。</div>' +
      '<div class="auth-err' + (errMsg ? ' show' : '') + '" id="aErr">' + esc(errMsg || '') + '</div>' +
      '<div class="field"><label>当前密码</label><input type="password" id="cOld" autocomplete="current-password"></div>' +
      '<div class="field"><label>新密码</label><input type="password" id="cNew" autocomplete="new-password"></div>' +
      '<div class="field"><label>确认新密码</label><input type="password" id="cConf" autocomplete="new-password"></div>' +
      '<div id="cPolicy"></div>' +
      '<button class="btn primary" id="bChange" style="width:100%">修改密码并重新登录</button>' +
      '<button class="btn ghost" id="bBack" style="width:100%;margin-top:8px">返回登录</button>' +
      '</div></div>';
    app.dataset.view = 'change';
    var ref = document.getElementById('cPolicy');
    function refresh() {
      var pw = document.getElementById('cNew').value;
      var conf = document.getElementById('cConf').value;
      ref.innerHTML = policyHTML(pw, { ok: pw.length > 0 && pw === conf, text: '两次输入一致' });
    }
    ['cNew', 'cConf'].forEach(function (id) { document.getElementById(id).addEventListener('input', refresh); });
    refresh();
    document.getElementById('bChange').addEventListener('click', function () {
      var oldP = document.getElementById('cOld').value;
      var newP = document.getElementById('cNew').value;
      var conf = document.getElementById('cConf').value;
      if (newP !== conf) return renderChange('两次输入的新密码不一致');
      var btn = document.getElementById('bChange');
      btn.disabled = true;
      post('/api/panel/change-password', { old: oldP, next: newP }).then(function (r) {
        btn.disabled = false;
        if (r.status === 422 && r.data && r.data.details) return renderChange('新密码不符合规则', r.data.details);
        if (r.status !== 200) return renderChange((r.data && r.data.error) || '修改失败');
        renderLogin(null, '密码已更新。请用新密码重新登录。');
      });
    });
    document.getElementById('bBack').addEventListener('click', function () { post('/api/panel/logout', {}); renderLogin(); });
  }

  /* ---------- 面板 ---------- */
  function enterPanel() {
    Promise.all([api('/api/panel/config'), api('/api/panel/status')]).then(function (rs) {
      S.cfg = rs[0].data;
      S.status = rs[1].data;
      if (!S.cfg) return renderLogin('会话已失效，请重新登录');
      renderPanel();
      startPoll();
    });
  }
  function renderPanel() {
    app.innerHTML =
      '<div class="panel-head">' +
      '<span class="logo">技</span><span class="brand">SkillHub 超管后台</span>' +
      '<span class="mini"><span class="pdot"></span>' + esc((S.status && S.status.ok) ? '服务在线' : '服务不可达') + '</span>' +
      '<div class="spacer"></div>' +
      '<button class="btn ghost sm" id="bLogout">退出登录</button>' +
      '</div>' +
      '<nav class="pnav">' +
      '<button data-tab="overview">概览</button>' +
      '<button data-tab="keys">API 密钥</button>' +
      '<button data-tab="pipeline">自动化管线</button>' +
      '<button data-tab="promo">推广</button>' +
      '<button data-tab="security">安全</button>' +
      '</nav>' +
      '<div class="psec" id="s-overview"></div>' +
      '<div class="psec" id="s-keys"></div>' +
      '<div class="psec" id="s-pipeline"></div>' +
      '<div class="psec" id="s-promo"></div>' +
      '<div class="psec" id="s-security"></div>';
    app.dataset.view = 'panel';
    document.getElementById('bLogout').addEventListener('click', function () {
      post('/api/panel/logout', {}).then(function () { renderLogin(); });
    });
    var navs = app.querySelectorAll('.pnav button');
    navs.forEach(function (b) {
      b.addEventListener('click', function () { switchTab(b.dataset.tab); });
    });
    switchTab(S.tab);
  }
  function switchTab(tab) {
    S.tab = tab;
    app.querySelectorAll('.pnav button').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === tab); });
    app.querySelectorAll('.psec').forEach(function (s) { s.classList.remove('on'); });
    var sec = document.getElementById('s-' + tab);
    sec.classList.add('on');
    if (tab === 'overview') renderOverview();
    else if (tab === 'keys') renderKeys();
    else if (tab === 'pipeline') renderPipeline();
    else if (tab === 'promo') renderPromo();
    else renderSecurity();
  }

  /* ---------- 概览 ---------- */
  function renderOverview() {
    var st = S.status || {};
    var cfg = (S.cfg && S.cfg.pipeline) || {};
    var runs = (st.runs || []).slice(0, 30);
    var rows = runs.length
      ? runs.map(function (r) {
        var code = r.code === 0 ? '<span class="ok">0</span>' : (r.code != null ? '<span class="bad">' + esc(r.code) + '</span>' : '—');
        return '<tr><td><code>' + esc(r.task || '') + '</code></td><td>' + esc(r.event || '') + '</td><td>' +
          (r.t ? new Date(r.t).toLocaleString() : '') + '</td><td>' + code + '</td><td class="mini">' + esc(r.reason || r.by || '') + '</td></tr>';
      }).join('')
      : '<tr><td colspan="5" class="mini">暂无运行记录</td></tr>';
    document.getElementById('s-overview').innerHTML =
      '<div class="panel"><h3>📊 服务概览</h3>' +
      '<div class="kv"><b>服务器时间</b><span>' + esc(st.now ? new Date(st.now).toLocaleString() : '—') + '</span></div>' +
      '<div class="kv"><b>数据版本</b><span>' + esc(st.dataUpdated || '—') + ' · ' + esc(st.count != null ? st.count + ' 条' : '—') + '</span></div>' +
      '<div class="kv"><b>每小时同步</b><span>' + (cfg.syncEnabled ? '开启 · 每 ' + esc(cfg.syncIntervalHours) + ' 小时' : '关闭') + '</span></div>' +
      '<div class="kv"><b>每日管线</b><span>' + (cfg.dailyEnabled ? '开启 · ' + esc(cfg.dailyTime) : '关闭') + '</span></div>' +
      '<div class="kv"><b>推广任务</b><span>' + (cfg.promoEnabled ? '开启 · ' + esc(cfg.promoTime) : '关闭') + '</span></div>' +
      '<div class="kv"><b>DeepSeek / GitHub 凭据</b><span>' + (S.cfg && S.cfg.keys ? (S.cfg.keys.deepseek ? '已配置' : '未配置') + ' / ' + (S.cfg.keys.github ? '已配置' : '未配置') : '—') + '</span></div>' +
      '</div>' +
      '<div class="panel"><h3>⚡ 立即执行</h3>' +
      '<div class="mini" style="margin-bottom:8px">点击后任务进入队列，tick 定时器 ≤5 分钟内执行（与现有定时器 flock 互斥，不会重跑）。</div>' +
      '<div class="actions">' +
      '<button class="btn primary sm" data-run="sync">立即同步（构建+推送）</button>' +
      '<button class="btn primary sm" data-run="daily">立即每日管线（爬取→打标→入库→建站）</button>' +
      '<button class="btn primary sm" data-run="promo">立即生成推广草稿</button>' +
      '</div></div>' +
      '<div class="panel"><h3>📜 运行日志（最近 30 条）</h3><table class="rlog"><thead><tr><th>任务</th><th>事件</th><th>时间</th><th>退出码</th><th>备注</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    document.querySelectorAll('[data-run]').forEach(function (b) {
      b.addEventListener('click', function () {
        var t = b.dataset.run;
        b.disabled = true;
        post('/api/panel/run', { task: t }).then(function (r) {
          b.disabled = false;
          if (r.status === 200) toast('已排队：' + t + '，≤5 分钟内执行');
          else toast((r.data && r.data.error) || '排队失败', true);
        });
      });
    });
  }

  /* ---------- API 密钥 ---------- */
  function renderKeys() {
    var keys = (S.cfg && S.cfg.keys) || {};
    document.getElementById('s-keys').innerHTML =
      '<div class="panel"><h3>🔑 API 密钥</h3>' +
      '<div class="mini" style="margin-bottom:10px">保存后立即生效（服务进程内存 + <code>data/.ops/app.env</code>，0600 权限，供定时任务使用；GitHub 公开仓库不会包含任何密钥）。输入框显示掩码，<b>留空不修改</b>，输入新值则替换。</div>' +
      '<div class="field"><label>DeepSeek API Key<span class="hint">用于 AI 打标 / 每日推荐</span></label><input type="password" id="kDeepseek" placeholder="' + esc(keys.deepseek || '未配置') + '"></div>' +
      '<div class="field"><label>GitHub Token<span class="hint">skillhub 仓库 contents:write 权限，用于自动推送</span></label><input type="password" id="kGithub" placeholder="' + esc(keys.github || '未配置') + '"></div>' +
      '<div class="actions"><button class="btn primary" id="bSaveKeys">保存密钥</button></div>' +
      '</div>';
    document.getElementById('bSaveKeys').addEventListener('click', function () {
      var d = document.getElementById('kDeepseek').value;
      var g = document.getElementById('kGithub').value;
      post('/api/panel/config', { keys: { deepseek: d, github: g } }).then(function (r) {
        if (r.status === 200) { S.cfg = r.data.config; toast('密钥已保存'); renderKeys(); }
        else toast((r.data && r.data.error) || '保存失败', true);
      });
    });
  }

  /* ---------- 自动化管线 ---------- */
  function renderPipeline() {
    var p = (S.cfg && S.cfg.pipeline) || {};
    document.getElementById('s-pipeline').innerHTML =
      '<div class="panel"><h3>🤖 自动化管线调度</h3>' +
      '<div class="mini" style="margin-bottom:6px">调度权威 = 这里的配置；系统既有定时器与 5 分钟 tick 都会先按此配置判定，重复触发安全。</div>' +
      '<div class="switchrow"><div><div class="t">每小时同步</div><div class="d">构建数据 + 有变更时推送 GitHub</div></div><label class="switch"><input type="checkbox" id="pSync"' + (p.syncEnabled ? ' checked' : '') + '><span class="sl"></span></label></div>' +
      '<div class="inline2">' +
      '<div class="field"><label>同步间隔（小时）</label><input type="number" id="pInterval" min="1" max="24" value="' + esc(p.syncIntervalHours) + '"></div>' +
      '</div>' +
      '<div class="switchrow"><div><div class="t">每日全自动管线</div><div class="d">爬取 7 生态 → AI 推荐 → AI 打标 → 自动收录 → 构建 → 推送</div></div><label class="switch"><input type="checkbox" id="pDaily"' + (p.dailyEnabled ? ' checked' : '') + '><span class="sl"></span></label></div>' +
      '<div class="inline2">' +
      '<div class="field"><label>每日管线时间</label><input type="time" id="pDailyTime" value="' + esc(p.dailyTime) + '"></div>' +
      '</div>' +
      '<div class="actions"><button class="btn primary" id="bSavePipe">保存管线配置</button></div>' +
      '</div>';
    document.getElementById('bSavePipe').addEventListener('click', function () {
      post('/api/panel/config', {
        pipeline: {
          syncEnabled: document.getElementById('pSync').checked,
          syncIntervalHours: document.getElementById('pInterval').value,
          dailyEnabled: document.getElementById('pDaily').checked,
          dailyTime: document.getElementById('pDailyTime').value,
        },
      }).then(function (r) {
        if (r.status === 200) { S.cfg = r.data.config; toast('管线配置已保存'); renderPipeline(); }
        else toast((r.data && r.data.error) || '保存失败', true);
      });
    });
  }

  /* ---------- 推广 ---------- */
  function renderPromo() {
    var p = (S.cfg && S.cfg.pipeline) || {};
    var drafts = (S.status && S.status.drafts) || [];
    document.getElementById('s-promo').innerHTML =
      '<div class="panel"><h3>📣 推广自动化</h3>' +
      '<div class="switchrow"><div><div class="t">每日推广草稿</div><div class="d">按推广时间生成中英双语草稿文件（人工审阅后发布；系统不会自动外发）</div></div><label class="switch"><input type="checkbox" id="prOn"' + (p.promoEnabled ? ' checked' : '') + '><span class="sl"></span></label></div>' +
      '<div class="inline2"><div class="field"><label>推广时间</label><input type="time" id="prTime" value="' + esc(p.promoTime) + '"></div></div>' +
      '<div class="field"><label>目标渠道<span class="hint">草稿头部备注用，如：微信公众号 / 微博 / 知乎 / X</span></label><input type="text" id="prChannels" value="' + esc(p.promoChannels) + '" placeholder="如：微信公众号、知乎、X"></div>' +
      '<div class="field"><label>文案模板<span class="hint">可选；留空用系统模板。草稿生成时原样插入头部</span></label><textarea id="prTemplate" placeholder="例如：🔥 每日 AI 工具推荐：{标题} …">' + esc(p.promoTemplate) + '</textarea></div>' +
      '<div class="actions"><button class="btn primary" id="bSavePromo">保存推广配置</button><button class="btn ghost" id="bDraftNow">立即生成草稿</button></div>' +
      '</div>' +
      '<div class="panel"><h3>🗂 草稿归档</h3>' +
      (drafts.length ? drafts.map(function (d) {
        return '<div class="draftrow"><span class="nm">' + esc(d) + '</span><button class="btn ghost sm" data-draft="' + esc(d) + '">预览</button></div><pre class="draft-pre" id="draft-' + esc(d) + '"></pre>';
      }).join('') : '<div class="mini">暂无草稿</div>') +
      '</div>';
    document.getElementById('bSavePromo').addEventListener('click', function () {
      post('/api/panel/config', {
        pipeline: {
          promoEnabled: document.getElementById('prOn').checked,
          promoTime: document.getElementById('prTime').value,
          promoChannels: document.getElementById('prChannels').value,
          promoTemplate: document.getElementById('prTemplate').value,
        },
      }).then(function (r) {
        if (r.status === 200) { S.cfg = r.data.config; toast('推广配置已保存'); renderPromo(); }
        else toast((r.data && r.data.error) || '保存失败', true);
      });
    });
    document.getElementById('bDraftNow').addEventListener('click', function () {
      post('/api/panel/run', { task: 'promo' }).then(function (r) {
        if (r.status === 200) toast('已排队生成草稿，≤5 分钟内完成，稍后刷新查看');
        else toast((r.data && r.data.error) || '排队失败', true);
      });
    });
    document.querySelectorAll('[data-draft]').forEach(function (b) {
      b.addEventListener('click', function () {
        var name = b.dataset.draft;
        var pre = document.getElementById('draft-' + name);
        if (pre.classList.contains('show')) { pre.classList.remove('show'); return; }
        api('/api/panel/promo-draft?name=' + encodeURIComponent(name)).then(function (r) {
          if (r.status === 200 && r.data) { pre.textContent = r.data.content; pre.classList.add('show'); }
          else toast((r.data && r.data.error) || '读取失败', true);
        });
      });
    });
  }

  /* ---------- 安全 ---------- */
  function renderSecurity() {
    document.getElementById('s-security').innerHTML =
      '<div class="panel"><h3>🛡 修改密码</h3>' +
      '<div class="mini" style="margin-bottom:10px">修改成功后所有会话（含本机）立即下线，需重新登录。</div>' +
      '<div class="field"><label>当前密码</label><input type="password" id="sOld"></div>' +
      '<div class="field"><label>新密码</label><input type="password" id="sNew"></div>' +
      '<div class="field"><label>确认新密码</label><input type="password" id="sConf"></div>' +
      '<div id="sPolicy"></div>' +
      '<div class="actions"><button class="btn primary" id="bSecChange">修改密码</button><button class="btn danger" id="bSecLogout">退出登录</button></div>' +
      '</div>' +
      '<div class="panel"><h3>ℹ️ 会话说明</h3><div class="mini">会话为 HttpOnly Cookie（12 小时滑动过期），服务器重启后全部失效需重新登录；登录接口有 IP 级限流（15 分钟 10 次）。</div></div>';
    var ref = document.getElementById('sPolicy');
    function refresh() {
      var pw = document.getElementById('sNew').value;
      var conf = document.getElementById('sConf').value;
      ref.innerHTML = policyHTML(pw, { ok: pw.length > 0 && pw === conf, text: '两次输入一致' });
    }
    ['sNew', 'sConf'].forEach(function (id) { document.getElementById(id).addEventListener('input', refresh); });
    refresh();
    document.getElementById('bSecChange').addEventListener('click', function () {
      var oldP = document.getElementById('sOld').value;
      var newP = document.getElementById('sNew').value;
      if (newP !== document.getElementById('sConf').value) return toast('两次输入不一致', true);
      post('/api/panel/change-password', { old: oldP, next: newP }).then(function (r) {
        if (r.status === 200) renderLogin(null, '密码已更新。请用新密码重新登录。');
        else if (r.status === 422 && r.data && r.data.details) toast('新密码不符合规则：' + r.data.details.join('；'), true);
        else toast((r.data && r.data.error) || '修改失败', true);
      });
    });
    document.getElementById('bSecLogout').addEventListener('click', function () {
      post('/api/panel/logout', {}).then(function () { renderLogin(); });
    });
  }

  /* ---------- 轮询 ---------- */
  function startPoll() {
    stopPoll();
    S.timer = setInterval(function () {
      if (app.dataset.view !== 'panel') return;
      api('/api/panel/status').then(function (r) {
        if (r.status === 401) { renderLogin('会话已过期，请重新登录'); return; }
        if (r.status === 200 && r.data && r.data.ok) {
          S.status = r.data;
          if (S.tab === 'overview') renderOverview();
          else if (S.tab === 'promo') renderPromo();
        }
      });
    }, 30000);
  }
  function stopPoll() { if (S.timer) { clearInterval(S.timer); S.timer = null; } }

  /* ---------- boot ---------- */
  api('/api/panel/session').then(function (r) {
    if (r.status === 200 && r.data && r.data.role === 'admin') { enterPanel(); }
    else if (r.status === 200 && r.data && r.data.role === 'mustChange') { renderChange(); }
    else renderLogin();
  });
})();

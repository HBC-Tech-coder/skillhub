/* SkillHub 目录站引擎（零依赖）。数据来自同源 plugins.json。
   特性：生态/分类侧栏筛选、排序、热门榜、亮色/夜间模式、卡片悬停展开、
   #item/<id> 可分享详情链接、移动端适配。 */
(function () {
  'use strict';
  const ECO_COLORS = {
    dsh: '#4d7cfe', workbuddy: '#0aa869', trae: '#f0662f',
    mcp: '#8b5cf6', 'skills-sh': '#d97706', generic: '#64748b',
  };
  const ECO_LABELS = { dsh: 'DSH', workbuddy: 'WorkBuddy', trae: 'TRAE', mcp: 'MCP', 'skills-sh': 'Skills.sh', generic: '通用' };
  const SORTS = {
    stars: (a, b) => ((b.stars ?? -1) - (a.stars ?? -1)) || String(b.added).localeCompare(String(a.added)),
    added: (a, b) => String(b.added).localeCompare(String(a.added)) || ((b.stars ?? -1) - (a.stars ?? -1)),
    name: (a, b) => String(a.name).localeCompare(String(b.name)),
  };
  let DATA = null;
  const state = { q: '', eco: '', cat: '', sort: 'stars' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function ecoColor(id) { return ECO_COLORS[id] || '#64748b'; }
  function ecoLabel(id) { return ECO_LABELS[id] || id; }
  function catName(id) { const c = DATA && DATA.categories && DATA.categories[id]; return c ? (c.zh || c.en || id) : id; }
  function itemEcos(item) { return Array.isArray(item.ecosystems) && item.ecosystems.length ? item.ecosystems.map((e) => e.id) : ['generic']; }
  function installOf(item) { return (item.ecosystems && item.ecosystems[0] && item.ecosystems[0].install) || item.install || ''; }
  function filtered() {
    const list = DATA.plugins.filter((i) => {
      if (state.eco && !itemEcos(i).includes(state.eco)) return false;
      if (state.cat && i.category !== state.cat) return false;
      if (state.q) {
        const hay = (i.name + ' ' + (i.owner || '') + ' ' + (i.author || '') + ' ' + (i.description?.zh || '') + ' ' + (i.description?.en || '') + ' ' + (i.tags || []).join(' ')).toLowerCase();
        if (!hay.includes(state.q.toLowerCase())) return false;
      }
      return true;
    });
    return list.sort(SORTS[state.sort] || SORTS.stars);
  }

  /* ---------- 渲染 ---------- */
  function cardHTML(i) {
    const eco = itemEcos(i)[0];
    const desc = (i.description && (i.description.zh || i.description.en)) || '';
    return `<div class="card" tabindex="0" onclick="openModal('${esc(i.id)}')" onkeydown="if(event.key==='Enter')openModal('${esc(i.id)}')">
      <div class="top">
        <div class="avatar">${esc((i.name || '?')[0].toUpperCase())}</div>
        <div style="min-width:0;flex:1"><div class="name">${esc(i.name)}</div><div class="author">${esc(i.owner || i.author || '')}</div></div>
        <span class="badge" style="background:${ecoColor(eco)}">${esc(ecoLabel(eco))}</span>
      </div>
      <div class="desc">${esc(desc)}</div>
      <div class="extra">
        ${i.description?.en ? `<div class="en">${esc(i.description.en)}</div>` : ''}
        ${(i.tags || []).length ? `<div class="tags">${i.tags.slice(0, 6).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
        <div class="meta">
          ${i.license ? `<span>许可 ${esc(i.license)}</span>` : ''}
          ${i.downloads != null ? `<span>下载 ${i.downloads}</span>` : ''}
          ${i.verified ? '<span>✓ 已核验</span>' : ''}
        </div>
      </div>
      <div class="install"><code>${esc(installOf(i))}</code><button class="copy" onclick="event.stopPropagation();copyCmd('${esc(i.id)}',0,this)">复制</button></div>
      <div class="foot"><span>⭐ ${i.stars ?? '—'}</span><span>${esc(catName(i.category))}</span><span>${esc(i.kind || '')}</span></div>
    </div>`;
  }

  function render() {
    const list = filtered();
    document.getElementById('stCount').textContent = DATA.count;
    document.getElementById('stEco').textContent = new Set(DATA.plugins.flatMap(itemEcos)).size;
    document.getElementById('stCat').textContent = Object.keys(DATA.categories || {}).length;
    document.getElementById('stUpdate').textContent = DATA.updated || '—';
    document.getElementById('resultInfo').textContent = `共 ${list.length} 条${state.q ? ` · “${state.q}”` : ''}`;
    document.getElementById('empty').style.display = list.length ? 'none' : '';
    document.getElementById('grid').innerHTML = list.map(cardHTML).join('');
  }

  function renderFilters() {
    const ecoCount = {};
    const catCount = {};
    DATA.plugins.forEach((i) => {
      itemEcos(i).forEach((k) => { ecoCount[k] = (ecoCount[k] || 0) + 1; });
      catCount[i.category] = (catCount[i.category] || 0) + 1;
    });
    document.getElementById('ecoFilters').innerHTML =
      `<div class="chip${state.eco ? '' : ' on'}" onclick="setEco('')"><span>全部</span><span class="cnt">${DATA.count}</span></div>` +
      Object.entries(ecoCount).map(([k, n]) =>
        `<div class="chip${state.eco === k ? ' on' : ''}" onclick="setEco('${esc(k)}')"><span><span class="dot" style="background:${ecoColor(k)}"></span>${esc(ecoLabel(k))}</span><span class="cnt">${n}</span></div>`).join('');
    document.getElementById('catFilters').innerHTML =
      Object.entries(catCount).map(([k, n]) =>
        `<div class="chip${state.cat === k ? ' on' : ''}" onclick="setCat('${esc(k)}')"><span>${esc(catName(k))}</span><span class="cnt">${n}</span></div>`).join('');
  }

  function renderRank() {
    const ranked = DATA.plugins.filter((i) => i.stars != null).sort((a, b) => b.stars - a.stars).slice(0, 10);
    document.getElementById('rank').innerHTML = ranked.length
      ? ranked.map((i, n) => `<div class="item" onclick="openModal('${esc(i.id)}')"><span class="num">${n + 1}</span><span class="nm">${esc(i.name)}</span><span class="st">⭐${i.stars}</span></div>`).join('')
      : '<p class="note">暂无星标数据（爬虫上线后刷新）</p>';
  }

  function renderSort() {
    document.querySelectorAll('.sort button').forEach((b) => b.classList.toggle('on', b.dataset.sort === state.sort));
  }

  /* ---------- 弹窗与复制 ---------- */
  function openModal(id) {
    const i = DATA.plugins.find((x) => x.id === id);
    if (!i) return;
    const ecos = (i.ecosystems && i.ecosystems.length ? i.ecosystems : [{ id: 'generic', kind: i.kind || 'other', install: i.install || '' }]);
    document.getElementById('modal').innerHTML = `
      <h2>${esc(i.name)} ${ecos.map((e) => `<span class="badge" style="background:${ecoColor(e.id)}">${esc(ecoLabel(e.id))}</span>`).join(' ')}</h2>
      <div class="en">${esc(i.owner || i.author || '')} · ${esc(catName(i.category))} · ${esc(i.kind || '')}${i.verified ? ' · ✓ 已核验' : ''}</div>
      <div class="row"><b>描述</b>${esc(i.description?.zh || '')}</div>
      <div class="row"><b>English</b>${esc(i.description?.en || '')}</div>
      <div class="row"><b>来源</b><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.url)}</a></div>
      <div class="row"><b>星标</b>⭐ ${i.stars ?? '暂无数据'}${i.downloads != null ? ' · 下载 ' + i.downloads : ''}${i.license ? ' · ' + esc(i.license) : ''}</div>
      ${(i.tags || []).length ? `<div class="row"><b>标签</b>${i.tags.map((t) => `<span class="tag">${esc(t)}</span>`).join(' ')}</div>` : ''}
      <div class="row"><b>安装</b></div>
      <div class="ecolist">${ecos.map((e, n) => `<div class="ecoline"><span class="badge" style="background:${ecoColor(e.id)}">${esc(ecoLabel(e.id))}</span><code>${esc(e.install)}</code><button class="copy" onclick="copyCmd('${esc(i.id)}',${n},this)">复制</button></div>`).join('')}</div>
      <button class="close" onclick="closeModal()">关闭</button>`;
    document.getElementById('mbg').style.display = 'flex';
    if (location.hash !== '#item/' + id) history.replaceState(null, '', '#item/' + id);
  }
  function closeModal() {
    document.getElementById('mbg').style.display = 'none';
    if (location.hash.startsWith('#item/')) history.replaceState(null, '', location.pathname + location.search);
  }
  function copyCmd(id, n, btn) {
    const i = DATA.plugins.find((x) => x.id === id);
    const cmd = i.ecosystems && i.ecosystems[n] ? i.ecosystems[n].install : i.install;
    const done = () => { btn.textContent = '已复制'; setTimeout(() => { btn.textContent = '复制'; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(cmd).then(done).catch(() => done());
    else done();
  }

  /* ---------- 主题 ---------- */
  function initTheme() {
    let t = null;
    try { t = localStorage.getItem('skillhub-theme'); } catch (e) { /* ignore */ }
    if (!t) t = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    document.getElementById('themeBtn').textContent = t === 'dark' ? '☀️' : '🌙';
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.getElementById('themeBtn').textContent = next === 'dark' ? '☀️' : '🌙';
    try { localStorage.setItem('skillhub-theme', next); } catch (e) { /* ignore */ }
  }

  window.openModal = openModal;
  window.closeModal = closeModal;
  window.copyCmd = copyCmd;
  window.setEco = (v) => { state.eco = v; renderFilters(); render(); };
  window.setCat = (v) => { state.cat = v; renderFilters(); render(); };

  function bind() {
    const q = document.getElementById('q');
    const hq = document.getElementById('hq');
    const apply = (v) => { state.q = v; render(); };
    q.addEventListener('input', (e) => apply(e.target.value));
    hq.addEventListener('input', (e) => { q.value = e.target.value; apply(e.target.value); });
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    document.querySelectorAll('.sort button').forEach((b) => b.addEventListener('click', () => { state.sort = b.dataset.sort; renderSort(); render(); }));
    document.getElementById('mbg').addEventListener('click', (e) => { if (e.target.id === 'mbg') closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
    window.addEventListener('hashchange', () => {
      const m = location.hash.match(/^#item\/(.+)$/);
      if (m && DATA && DATA.plugins.some((x) => x.id === m[1])) openModal(decodeURIComponent(m[1]));
    });
  }

  async function load() {
    try {
      const res = await fetch('plugins.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA = await res.json();
      if (!Array.isArray(DATA.plugins)) throw new Error('plugins.json 缺少 plugins 数组');
      document.getElementById('footVer').textContent = `数据版本 ${DATA.updated || '?'} · 共 ${DATA.count} 条`;
      const src = DATA.source;
      document.getElementById('srcLink').href = src;
      document.getElementById('srcLink2').href = src;
      renderFilters(); renderSort(); render(); renderRank();
      const m = location.hash.match(/^#item\/(.+)$/);
      if (m && DATA.plugins.some((x) => x.id === m[1])) openModal(decodeURIComponent(m[1]));
    } catch (err) {
      document.getElementById('grid').innerHTML = `<div class="empty">加载 plugins.json 失败：${esc(err.message)}。<br>请先在仓库根目录运行 node scripts/build-plugins.js，并把 data/plugins.json 与 site/ 部署在一起。</div>`;
    }
  }
  initTheme(); bind(); load();
})();

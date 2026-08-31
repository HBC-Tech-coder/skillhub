/* SkillHub 目录站引擎（零依赖）。数据来自同源 plugins.json。 */
(function () {
  'use strict';
  const ECO_COLORS = {
    dsh: '#4d7cfe', workbuddy: '#0aa869', trae: '#f0662f',
    mcp: '#8b5cf6', 'skills-sh': '#d97706', generic: '#64748b',
  };
  let DATA = null;
  const state = { q: '', eco: '', cat: '' };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function ecoColor(id) { return ECO_COLORS[id] || '#64748b'; }
  function catName(id) {
    const c = DATA && DATA.categories && DATA.categories[id];
    return c ? (c.zh || c.en || id) : id;
  }
  function ecoLabel(id) {
    const map = { dsh: 'DSH', workbuddy: 'WorkBuddy', trae: 'TRAE', mcp: 'MCP', 'skills-sh': 'Skills.sh', generic: '通用' };
    return map[id] || id;
  }
  function itemEcos(item) {
    return Array.isArray(item.ecosystems) && item.ecosystems.length ? item.ecosystems.map((e) => e.id) : ['generic'];
  }
  function filtered() {
    return DATA.plugins.filter((i) => {
      if (state.eco && !itemEcos(i).includes(state.eco)) return false;
      if (state.cat && i.category !== state.cat) return false;
      if (state.q) {
        const hay = (i.name + ' ' + (i.owner || '') + ' ' + (i.author || '') + ' ' + (i.description?.zh || '') + ' ' + (i.description?.en || '') + ' ' + (i.tags || []).join(' ')).toLowerCase();
        if (!hay.includes(state.q.toLowerCase())) return false;
      }
      return true;
    });
  }

  function render() {
    const list = filtered();
    document.getElementById('stCount').textContent = DATA.count;
    document.getElementById('stEco').textContent = new Set(DATA.plugins.flatMap(itemEcos)).size;
    document.getElementById('stCat').textContent = Object.keys(DATA.categories || {}).length;
    document.getElementById('stUpdate').textContent = DATA.updated || '—';
    document.getElementById('empty').style.display = list.length ? 'none' : '';
    document.getElementById('grid').innerHTML = list.map((i) => {
      const eco = itemEcos(i)[0];
      const desc = (i.description && (i.description.zh || i.description.en)) || '';
      const install = (i.ecosystems && i.ecosystems[0] && i.ecosystems[0].install) || i.install || '';
      return `<div class="card" onclick="openModal('${esc(i.id)}')">
        <div class="top"><div class="avatar">${esc((i.name || '?')[0].toUpperCase())}</div>
          <div><div class="name">${esc(i.name)}</div><div class="author">${esc(i.owner || i.author || '')}</div></div>
          <span class="badge" style="background:${ecoColor(eco)}">${esc(ecoLabel(eco))}</span></div>
        <div class="desc">${esc(desc)}</div>
        <div class="install"><code>${esc(install)}</code><button class="copy" onclick="event.stopPropagation();copyCmd('${esc(i.id)}',0,this)">复制</button></div>
        <div class="foot"><span>⭐ ${i.stars ?? '—'}</span><span>${esc(catName(i.category))}</span><span>${esc(i.kind || '')}</span><span>${i.verified ? '已核验' : ''}</span></div>
      </div>`;
    }).join('');
  }

  function renderFilters() {
    const ecos = new Set(DATA.plugins.flatMap(itemEcos));
    document.getElementById('ecoFilters').innerHTML =
      `<div class="chip${state.eco ? '' : ' on'}" onclick="setEco('')">全部</div>` +
      [...ecos].map((k) => `<div class="chip${state.eco === k ? ' on' : ''}" onclick="setEco('${esc(k)}')"><span class="dot" style="background:${ecoColor(k)}"></span>${esc(ecoLabel(k))}</div>`).join('');
    const used = new Set(DATA.plugins.map((p) => p.category));
    document.getElementById('catFilters').innerHTML = [...used].map((k) => `<div class="chip${state.cat === k ? ' on' : ''}" onclick="setCat('${esc(k)}')">${esc(catName(k))}</div>`).join('');
  }

  function openModal(id) {
    const i = DATA.plugins.find((x) => x.id === id);
    if (!i) return;
    const ecos = (i.ecosystems && i.ecosystems.length ? i.ecosystems : [{ id: 'generic', kind: i.kind || 'other', install: i.install || '' }]);
    document.getElementById('modal').innerHTML = `
      <h2>${esc(i.name)} ${ecos.map((e) => `<span class="badge" style="background:${ecoColor(e.id)}">${esc(ecoLabel(e.id))}</span>`).join(' ')}</h2>
      <div class="en">${esc(i.description?.en || '')}</div>
      <div class="row"><b>描述</b>${esc(i.description?.zh || '')}</div>
      <div class="row"><b>来源</b><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.url)}</a></div>
      <div class="row"><b>作者</b>${esc(i.owner || i.author || '—')}</div>
      <div class="row"><b>分类</b>${esc(catName(i.category))} · ${esc(i.kind || '')}${i.verified ? ' · 已核验' : ''}</div>
      <div class="row"><b>星标</b>⭐ ${i.stars ?? '暂无数据'}${i.downloads != null ? ' · 下载 ' + i.downloads : ''}</div>
      <div class="row"><b>安装</b></div>
      <div class="ecolist">${ecos.map((e, n) => `<div class="ecoline"><span class="badge" style="background:${ecoColor(e.id)}">${esc(ecoLabel(e.id))}</span><code>${esc(e.install)}</code><button class="copy" onclick="copyCmd('${esc(i.id)}',${n},this)">复制</button></div>`).join('')}</div>
      <button class="close" onclick="document.getElementById('mbg').style.display='none'">关闭</button>`;
    document.getElementById('mbg').style.display = 'flex';
  }

  function copyCmd(id, n, btn) {
    const i = DATA.plugins.find((x) => x.id === id);
    const ec = i.ecosystems && i.ecosystems[n] ? i.ecosystems[n].install : i.install;
    const done = () => { btn.textContent = '已复制'; setTimeout(() => { btn.textContent = '复制'; }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(ec).then(done).catch(() => done());
    else done();
  }

  window.openModal = openModal;
  window.copyCmd = copyCmd;
  window.setEco = (v) => { state.eco = v; renderFilters(); render(); };
  window.setCat = (v) => { state.cat = v; renderFilters(); render(); };

  function bind() {
    const apply = (v) => { state.q = v; render(); };
    const q = document.getElementById('q');
    const hq = document.getElementById('hq');
    q.addEventListener('input', (e) => apply(e.target.value));
    hq.addEventListener('input', (e) => { q.value = e.target.value; apply(e.target.value); });
    document.getElementById('mbg').addEventListener('click', (e) => { if (e.target.id === 'mbg') document.getElementById('mbg').style.display = 'none'; });
  }

  async function load() {
    try {
      const res = await fetch('plugins.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA = await res.json();
      if (!Array.isArray(DATA.plugins)) throw new Error('plugins.json 缺少 plugins 数组');
      document.getElementById('footVer').textContent = `数据版本 ${DATA.updated || '?'} · 共 ${DATA.count} 条`;
      const src = document.getElementById('srcLink');
      if (DATA.source) src.href = DATA.source;
      renderFilters(); render();
    } catch (err) {
      document.getElementById('grid').innerHTML = `<div class="empty">加载 plugins.json 失败：${esc(err.message)}。<br>请先在仓库根目录运行 node scripts/build-plugins.js，并把 data/plugins.json 与 site/ 部署在一起。</div>`;
    }
  }
  bind(); load();
})();

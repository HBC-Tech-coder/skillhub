/* SkillHub 目录站引擎 v3（零依赖）
   特性：意图搜索（自然语言→用途场景）、场景分类主导、双语（中/EN）、夜间模式、
   编辑推荐、热门榜、卡片悬停详情、#item 分享链接、移动端适配。 */
(function () {
  'use strict';
  const ECO_COLORS = {
    dsh: '#4d7cfe', workbuddy: '#0aa869', trae: '#f0662f', mcp: '#8b5cf6',
    'skills-sh': '#d97706', generic: '#64748b',
    'claude-code': '#d97757', codex: '#10a37f', gemini: '#4285f4', cursor: '#7c3aed',
  };
  const ECO_LABELS = {
    dsh: 'DSH', workbuddy: 'WorkBuddy', trae: 'TRAE', mcp: 'MCP', 'skills-sh': 'Skills.sh', generic: '通用/Any',
    'claude-code': 'Claude Code', codex: 'Codex', gemini: 'Gemini', cursor: 'Cursor',
  };
  const STR = {
    zh: {
      heroTitle: '说出你想做的事，找到能干的工具',
      searchPh: '试试：帮我下载无水印的B站、抖音视频的 Skill…',
      stCount: '收录条目', stEco: '生态', stScenes: '用途场景', stUpdate: '最近更新',
      scenes: '按用途找', scenesProfession: '按职位', scenesTask: '按任务', scenesFeature: '按功能', searchBtn: '搜 索',
      eco: '生态', rec: '编辑推荐', recNote: '—— 装了这几个就能…',
      rank: '热门榜', rankNote: '按 GitHub 星标排序（爬虫刷新）', about: '关于技能港',
      aboutTxt: '跨生态插件与技能聚合目录。数据与站点完全开源，列出 ≠ 背书：安装第三方代码前请先查看源码。',
      repo: '数据仓库', submit: '投稿', copy: '复制', copied: '已复制', source: '源码',
      detail: '独立详情页 ↗', noMatch: '没有匹配项，换个说法试试？', verified: '已核验',
      sortStars: '星标', sortNew: '最新', sortName: '名称', results: '共 {n} 条',
      intentHit: '按意图匹配', intentNo: '关键词匹配',
      hotTitle: '大家最近在装', hotNote: '—— 按热度与新鲜度轮播，点击可查看',
      examples: [
        '帮我找能下载无水印 B站、抖音视频的 Skill，最好支持批量下载和字幕',
        '我是做新媒体运营的，每天要盯全网热点、写公众号和小红书文案，该装哪些工具？',
        '有没有能自动抓热点、写口播稿、再一键分发到公众号和 X 的组合？',
        '我想给 Claude Code 加长期记忆和代码库知识图谱，推荐几个？',
      ],
      modalInstall: '安装', modalDesc: '描述', modalEn: 'English', modalSrc: '来源', modalStars: '星标', modalTags: '标签',
    },
    en: {
      heroTitle: 'Say what you need — find the tool that does it',
      searchPh: 'Try: a skill that downloads watermark-free Bilibili videos…',
      stCount: 'Entries', stEco: 'Ecosystems', stScenes: 'Use cases', stUpdate: 'Updated',
      scenes: 'By use case', scenesProfession: 'By profession', scenesTask: 'By task', scenesFeature: 'By capability', searchBtn: 'Search',
      eco: 'Ecosystem', rec: "Editor's Picks", recNote: '— install these to…',
      rank: 'Trending', rankNote: 'Sorted by GitHub stars (crawler refreshed)', about: 'About SkillHub',
      aboutTxt: 'Cross-ecosystem plugin & skill catalog. Open data, open site. Listing ≠ endorsement: read the source before installing third-party code.',
      repo: 'Repository', submit: 'Submit', copy: 'Copy', copied: 'Copied', source: 'Source',
      detail: 'Standalone page ↗', noMatch: 'No matches — try rephrasing?', verified: 'Verified',
      sortStars: 'Stars', sortNew: 'Newest', sortName: 'Name', results: '{n} results',
      intentHit: 'matched by intent', intentNo: 'keyword match',
      hotTitle: 'Trending now', hotNote: '— rotating by popularity & freshness, click to view',
      examples: [
        'Find me a skill that downloads watermark-free Bilibili / Douyin videos, ideally with batch mode and subtitles',
        'I run social media accounts — what should I install to track trends and draft WeChat / Xiaohongshu posts daily?',
        'Is there a combo that grabs hot topics, writes voiceover scripts, and publishes to WeChat and X automatically?',
        'I want long-term memory plus a codebase knowledge graph for Claude Code — what do you recommend?',
      ],
      modalInstall: 'Install', modalDesc: 'About', modalEn: '中文', modalSrc: 'Source', modalStars: 'Stars', modalTags: 'Tags',
    },
  };
  const SORTS = {
    stars: (a, b) => ((b.stars ?? -1) - (a.stars ?? -1)) || String(b.added).localeCompare(String(a.added)),
    added: (a, b) => String(b.added).localeCompare(String(a.added)) || ((b.stars ?? -1) - (a.stars ?? -1)),
    name: (a, b) => String(a.name).localeCompare(String(b.name)),
  };
  let DATA = null;        // plugins.json
  let SCEN = null;        // scenarios.json（含意图词表）
  let RECS = null;        // recommendations.json
  let HOT = null;         // hot.json（热门速览）
  let lang = 'zh';
  let hotPage = 0;
  let hotTimer = null;
  let hotPausedUntil = 0;
  const state = { q: '', eco: '', scene: '', sort: 'stars', tab: 'profession' };
  const TAB_INFO = [
    { id: 'profession', icon: '💼', color: '#4d7cfe', labelKey: 'scenesProfession' },
    { id: 'task', icon: '🎯', color: '#f0662f', labelKey: 'scenesTask' },
    { id: 'feature', icon: '⚙️', color: '#8b5cf6', labelKey: 'scenesFeature' },
    { id: 'eco', icon: '🌐', color: '#0aa869', labelKey: 'eco' },
  ];
  let rotationTimer = null;
  let rotatePausedUntil = 0;

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function t(k) { return (STR[lang] && STR[lang][k]) || k; }
  function ecoColor(id) { return ECO_COLORS[id] || '#64748b'; }
  function ecoLabel(id) { return ECO_LABELS[id] || id; }
  function catName(id) { const c = DATA && DATA.categories && DATA.categories[id]; return c ? (c[lang] || c.zh || c.en || id) : id; }
  function sceneName(id) { const s = SCEN && SCEN.scenarios && SCEN.scenarios[id]; return s ? (s[lang] || s.zh || id) : id; }
  function itemEcos(item) { return Array.isArray(item.ecosystems) && item.ecosystems.length ? item.ecosystems.map((e) => e.id) : ['generic']; }
  function installOf(item) { return (item.ecosystems && item.ecosystems[0] && item.ecosystems[0].install) || item.install || ''; }
  function descOf(item) { return (item.description && (item.description[lang] || item.description.zh || item.description.en)) || ''; }

  /* ---------- 意图检索 ---------- */
  function intentHits(q) {
    if (!SCEN || !SCEN.intents || !q) return {};
    const lq = q.toLowerCase();
    const hits = {};
    for (const [w, ids] of Object.entries(SCEN.intents)) {
      if (lq.includes(w.toLowerCase())) for (const id of ids) hits[id] = (hits[id] || 0) + 1;
    }
    return hits;
  }
  function filtered() {
    const hits = intentHits(state.q);
    const scored = DATA.plugins.map((i) => {
      let score = 0;
      for (const s of i.scenarios || []) if (hits[s]) score += hits[s];
      return { i, score };
    });
    let list = scored.filter((x) => {
      if (state.eco && !itemEcos(x.i).includes(state.eco)) return false;
      if (state.scene && !(x.i.scenarios || []).includes(state.scene)) return false;
      if (!state.q) return true;
      if (x.score > 0) return true;
      const hay = (x.i.name + ' ' + (x.i.owner || '') + ' ' + (x.i.author || '') + ' ' + (x.i.description?.zh || '') + ' ' + (x.i.description?.en || '') + ' ' + (x.i.tags || []).join(' ')).toLowerCase();
      return hay.includes(state.q.toLowerCase());
    });
    list.sort((a, b) => (b.score - a.score) || SORTS[state.sort](a.i, b.i));
    return { list: list.map((x) => x.i), intent: Object.keys(hits).length > 0 };
  }

  /* ---------- 渲染 ---------- */
  function cardHTML(i) {
    const eco = itemEcos(i)[0];
    const desc = descOf(i);
    return `<div class="card" tabindex="0" onclick="openModal('${esc(i.id)}')" onkeydown="if(event.key==='Enter')openModal('${esc(i.id)}')">
      <div class="top">
        <div class="avatar">${esc((i.name || '?')[0].toUpperCase())}</div>
        <div style="min-width:0;flex:1"><div class="name">${esc(i.name)}</div><div class="author">${esc(i.owner || i.author || '')}</div></div>
        <span class="badge" style="background:${ecoColor(eco)}">${esc(ecoLabel(eco))}</span>
      </div>
      <div class="desc">${esc(desc)}</div>
      <div class="extra">
        ${i.description && i.description[lang === 'zh' ? 'en' : 'zh'] ? `<div class="en">${esc(i.description[lang === 'zh' ? 'en' : 'zh'])}</div>` : ''}
        ${(i.scenarios || []).length ? `<div class="tags">${i.scenarios.slice(0, 4).map((s) => `<span class="tag">${esc(sceneName(s))}</span>`).join('')}</div>` : ''}
        <div class="meta">
          ${i.license ? `<span>${lang === 'zh' ? '许可' : 'License'} ${esc(i.license)}</span>` : ''}
          ${i.downloads != null ? `<span>${lang === 'zh' ? '下载' : 'Downloads'} ${i.downloads}</span>` : ''}
          ${i.verified ? '<span>✓ ' + esc(t('verified')) + '</span>' : ''}
        </div>
      </div>
      <div class="install"><code>${esc(installOf(i))}</code><button class="copy" onclick="event.stopPropagation();copyCmd('${esc(i.id)}',0,this)">${esc(t('copy'))}</button></div>
      <div class="foot"><span>⭐ ${i.stars ?? '—'}</span><span>${esc(catName(i.category))}</span><span>${esc(i.kind || '')}</span></div>
    </div>`;
  }

  function render() {
    const { list, intent } = filtered();
    document.getElementById('stCount').textContent = DATA.count;
    document.getElementById('stEco').textContent = new Set(DATA.plugins.flatMap(itemEcos)).size;
    document.getElementById('stScenes').textContent = SCEN ? Object.keys(SCEN.scenarios).length : '—';
    document.getElementById('stUpdate').textContent = DATA.updated || '—';
    const info = t('results').replace('{n}', list.length);
    document.getElementById('resultInfo').textContent = state.q ? `${info} · ${t(intent ? 'intentHit' : 'intentNo')}` : info;
    document.getElementById('empty').style.display = list.length ? 'none' : '';
    document.getElementById('grid').innerHTML = list.map(cardHTML).join('');
  }

  function renderFilters() {
    document.getElementById('tabbar').innerHTML = TAB_INFO.map((tb) => {
      const on = state.tab === tb.id;
      return `<div class="tabbtn${on ? ' on' : ''}" data-tab="${tb.id}"${on ? ` style="--tabcolor:${tb.color}"` : ''}>
        <span class="tabico">${tb.icon}</span><span>${esc(t(tb.labelKey))}</span>
      </div>`;
    }).join('');
    document.querySelectorAll('.tabbtn').forEach((el) => el.addEventListener('click', () => setTab(el.dataset.tab)));
    const box = document.getElementById('tabChips');
    if (state.tab === 'eco') {
      const ecoCount = {};
      DATA.plugins.forEach((i) => itemEcos(i).forEach((k) => { ecoCount[k] = (ecoCount[k] || 0) + 1; }));
      box.innerHTML =
        `<div class="chip${state.eco ? '' : ' on'}" onclick="setEco('')"><span>${lang === 'zh' ? '全部' : 'All'}</span><span class="cnt">${DATA.count}</span></div>` +
        Object.entries(ecoCount).map(([k, n]) =>
          `<div class="chip${state.eco === k ? ' on' : ''}" onclick="setEco('${esc(k)}')"><span><span class="dot" style="background:${ecoColor(k)}"></span>${esc(ecoLabel(k))}</span><span class="cnt">${n}</span></div>`).join('');
      return;
    }
    if (!SCEN) return;
    const count = {};
    DATA.plugins.forEach((i) => (i.scenarios || []).forEach((s) => { count[s] = (count[s] || 0) + 1; }));
    const entries = Object.entries(SCEN.scenarios).filter(([, s]) => s.group === state.tab);
    box.innerHTML =
      `<div class="chip${state.scene ? '' : ' on'}" onclick="setScene('')"><span>${lang === 'zh' ? '全部' : 'All'}</span><span class="cnt">${DATA.count}</span></div>` +
      entries.map(([k, s]) =>
        `<div class="chip${state.scene === k ? ' on' : ''}" onclick="setScene('${esc(k)}')"><span>${s.icon || ''} ${esc(lang === 'zh' ? s.zh : s.en)}</span><span class="cnt">${count[k] || 0}</span></div>`).join('');
  }

  function setTab(v, fromRotation) {
    if (state.tab !== v) { state.tab = v; state.scene = ''; state.eco = ''; }
    if (!fromRotation) rotatePausedUntil = Date.now() + 20000;
    renderFilters(); render();
  }
  function startRotation() {
    if (rotationTimer) return;
    rotationTimer = setInterval(() => {
      if (Date.now() < rotatePausedUntil) return;
      const i = TAB_INFO.findIndex((t) => t.id === state.tab);
      setTab(TAB_INFO[(i + 1) % TAB_INFO.length].id, true);
    }, 5000);
  }

  function renderRecs() {
    if (!RECS || !RECS.entries) { document.getElementById('recBlock').style.display = 'none'; return; }
    document.getElementById('recBlock').style.display = '';
    document.getElementById('recGrid').innerHTML = RECS.entries.map((r) => `
      <div class="reccard">
        <div class="rectitle">${esc(lang === 'zh' ? r.title : (r.titleEn || r.title))}</div>
        <div class="rectext">${esc(lang === 'zh' ? r.text : (r.textEn || r.text))}</div>
        <div class="recitems">${r.itemIds.map((id) => {
          const i = DATA.plugins.find((x) => x.id === id);
          return i ? `<span class="recitem" onclick="openModal('${esc(id)}')">${esc(i.name)}</span>` : '';
        }).join('')}</div>
      </div>`).join('');
  }

  /* ---------- 热门速览（两行 × 一批，慢速轮播） ---------- */
  function hotCols() {
    const w = window.innerWidth || 1200;
    return w >= 980 ? 6 : (w >= 640 ? 4 : 3);
  }
  function renderHot() {
    const box = document.getElementById('hotBlock');
    const strip = document.getElementById('hotStrip');
    if (!HOT || !HOT.items || !HOT.items.length) { box.style.display = 'none'; return; }
    const items = HOT.items.map((id) => DATA.plugins.find((x) => x.id === id)).filter(Boolean);
    if (!items.length) { box.style.display = 'none'; return; }
    box.style.display = '';
    const size = hotCols() * 2;
    const pages = Math.max(1, Math.ceil(items.length / size));
    hotPage = hotPage % pages;
    const view = items.slice(hotPage * size, hotPage * size + size);
    strip.style.gridTemplateColumns = `repeat(${hotCols()}, 1fr)`;
    strip.innerHTML = view.map((i) => {
      let ico = '';
      if (SCEN && i.scenarios && i.scenarios[0] && SCEN.scenarios[i.scenarios[0]]) ico = SCEN.scenarios[i.scenarios[0]].icon || '';
      return `<div class="hotitem" onclick="openModal('${esc(i.id)}')"><span class="hi-ico">${ico}</span><span class="hi-name">${esc(i.name)}</span><span class="hi-star">⭐${i.stars ?? '—'}</span></div>`;
    }).join('');
  }
  function startHotRotation() {
    if (hotTimer) return;
    hotTimer = setInterval(() => {
      if (Date.now() < hotPausedUntil) return;
      hotPage++;
      const strip = document.getElementById('hotStrip');
      if (strip) { strip.classList.remove('fadein'); void strip.offsetWidth; strip.classList.add('fadein'); }
      renderHot();
    }, 12000);
  }

  function renderRank() {
    const ranked = DATA.plugins.filter((i) => i.stars != null).sort((a, b) => b.stars - a.stars).slice(0, 10);
    document.getElementById('rank').innerHTML = ranked.length
      ? ranked.map((i, n) => `<div class="item" onclick="openModal('${esc(i.id)}')"><span class="num">${n + 1}</span><span class="nm">${esc(i.name)}</span><span class="st">⭐${i.stars}</span></div>`).join('')
      : `<p class="note">${lang === 'zh' ? '暂无星标数据（爬虫上线后刷新）' : 'No star data yet'}</p>`;
  }

  function renderSort() {
    document.querySelectorAll('.sort button').forEach((b) => b.classList.toggle('on', b.dataset.sort === state.sort));
  }

  /* ---------- 弹窗 / 复制 ---------- */
  function openModal(id) {
    const i = DATA.plugins.find((x) => x.id === id);
    if (!i) return;
    const ecos = (i.ecosystems && i.ecosystems.length ? i.ecosystems : [{ id: 'generic', kind: i.kind || 'other', install: i.install || '' }]);
    document.getElementById('modal').innerHTML = `
      <h2>${esc(i.name)} ${ecos.map((e) => `<span class="badge" style="background:${ecoColor(e.id)}">${esc(ecoLabel(e.id))}</span>`).join(' ')}</h2>
      <div class="en">${esc(i.owner || i.author || '')} · ${esc(catName(i.category))} · ${esc(i.kind || '')}${i.verified ? ' · ✓ ' + esc(t('verified')) : ''}</div>
      <div class="row"><b>${esc(t('modalDesc'))}</b>${esc(i.description?.zh || '')}</div>
      <div class="row"><b>${esc(t('modalEn'))}</b>${esc(i.description?.en || '')}</div>
      <div class="row"><b>${esc(t('modalSrc'))}</b><a href="${esc(i.url)}" target="_blank" rel="noopener">${esc(i.url)}</a></div>
      <div class="row"><b>${esc(t('modalStars'))}</b>⭐ ${i.stars ?? '—'}${i.downloads != null ? ' · ' + i.downloads : ''}${i.license ? ' · ' + esc(i.license) : ''}</div>
      ${(i.scenarios || []).length ? `<div class="row"><b>${esc(t('scenes'))}</b>${i.scenarios.map((s) => `<span class="tag">${esc(sceneName(s))}</span>`).join(' ')}</div>` : ''}
      ${(i.tags || []).length ? `<div class="row"><b>${esc(t('modalTags'))}</b>${i.tags.map((x) => `<span class="tag">${esc(x)}</span>`).join(' ')}</div>` : ''}
      <div class="row"><b>${esc(t('modalInstall'))}</b></div>
      <div class="ecolist">${ecos.map((e, n) => `<div class="ecoline"><span class="badge" style="background:${ecoColor(e.id)}">${esc(ecoLabel(e.id))}</span><code>${esc(e.install)}</code><button class="copy" onclick="copyCmd('${esc(i.id)}',${n},this)">${esc(t('copy'))}</button></div>`).join('')}</div>
      <div class="row"><b>${esc(t('detail'))}</b><a href="items/${esc(i.id)}.html">${esc(t('detail'))}</a></div>
      <button class="close" onclick="closeModal()">${lang === 'zh' ? '关闭' : 'Close'}</button>`;
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
    const done = () => { btn.textContent = t('copied'); setTimeout(() => { btn.textContent = t('copy'); }, 1200); };
    if (navigator.clipboard) navigator.clipboard.writeText(cmd).then(done).catch(() => done());
    else done();
  }

  /* ---------- 主题 / 语言 ---------- */
  function initTheme() {
    let th = null;
    try { th = localStorage.getItem('skillhub-theme'); } catch (e) { /* ignore */ }
    if (!th) th = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = th;
    document.getElementById('themeBtn').textContent = th === 'dark' ? '☀️' : '🌙';
  }
  function toggleTheme() {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.getElementById('themeBtn').textContent = next === 'dark' ? '☀️' : '🌙';
    try { localStorage.setItem('skillhub-theme', next); } catch (e) { /* ignore */ }
  }
  function setLang(l) {
    lang = l;
    document.getElementById('langBtn').textContent = l === 'zh' ? 'EN' : '中文';
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    const q = document.getElementById('q');
    if (!state.q) q.placeholder = t('searchPh');
    renderExamples();
    try { localStorage.setItem('skillhub-lang', l); } catch (e) { /* ignore */ }
    renderFilters(); render(); renderRecs(); renderRank();
  }
  function renderExamples() {
    document.getElementById('examples').innerHTML = STR[lang].examples.map((ex) => `<span class="exchip" onclick="runExample('${esc(ex)}')">${esc(ex)}</span>`).join('');
  }

  window.openModal = openModal;
  window.closeModal = closeModal;
  window.copyCmd = copyCmd;
  window.setEco = (v) => { state.eco = v; rotatePausedUntil = Date.now() + 20000; renderFilters(); render(); };
  window.setScene = (v) => { state.scene = v; rotatePausedUntil = Date.now() + 20000; renderFilters(); render(); };
  window.setTab = setTab;
  window.runExample = (ex) => { state.q = ex; document.getElementById('q').value = ex; render(); scrollToResults(); };
  function scrollToResults() {
    state.q = document.getElementById('q').value;
    render();
    const el = document.getElementById('resultInfo');
    if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function bind() {
    const q = document.getElementById('q');
    q.addEventListener('input', (e) => { state.q = e.target.value; render(); });
    q.addEventListener('keydown', (e) => { if (e.key === 'Enter') scrollToResults(); });
    document.getElementById('searchBtn').addEventListener('click', scrollToResults);
    // 用户交互时暂停 tab 自动轮播 20 秒；热门速览交互暂停 30 秒
    ['tabbar', 'tabChips', 'q', 'examples'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('pointerdown', () => { rotatePausedUntil = Date.now() + 20000; });
    });
    const hotStripEl = document.getElementById('hotStrip');
    if (hotStripEl) hotStripEl.addEventListener('pointerdown', () => { hotPausedUntil = Date.now() + 30000; });
    window.addEventListener('resize', () => renderHot());
    document.getElementById('themeBtn').addEventListener('click', toggleTheme);
    document.getElementById('langBtn').addEventListener('click', () => setLang(lang === 'zh' ? 'en' : 'zh'));
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
      const dataset = (typeof window !== 'undefined' && window.SKILLHUB_DATASET) || 'plugins.json';
      const recFile = (typeof window !== 'undefined' && window.SKILLHUB_RECS) || 'recommendations.json';
      const hotFile = (typeof window !== 'undefined' && window.SKILLHUB_HOT) || 'hot.json';
      const [res, resS, resR, resH] = await Promise.all([
        fetch(dataset, { cache: 'no-store' }),
        fetch('scenarios.json', { cache: 'no-store' }).catch(() => null),
        fetch(recFile, { cache: 'no-store' }).catch(() => null),
        fetch(hotFile, { cache: 'no-store' }).catch(() => null),
      ]);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      DATA = await res.json();
      if (!Array.isArray(DATA.plugins)) throw new Error('plugins.json 缺少 plugins 数组');
      if (resS && resS.ok) SCEN = await resS.json();
      if (resR && resR.ok) RECS = await resR.json();
      if (resH && resH.ok) HOT = await resH.json();
      document.getElementById('footVer').textContent = `${lang === 'zh' ? '数据版本' : 'Data'} ${DATA.updated || '?'} · ${DATA.count} ${lang === 'zh' ? '条' : 'entries'}`;
      const src = DATA.source;
      document.getElementById('srcLink').href = src;
      document.getElementById('srcLink2').href = src;
      try { lang = localStorage.getItem('skillhub-lang') || 'zh'; } catch (e) { /* ignore */ }
      setLang(lang);
      renderSort();
      renderHot();
      startRotation();
      startHotRotation();
      const m = location.hash.match(/^#item\/(.+)$/);
      if (m && DATA.plugins.some((x) => x.id === m[1])) openModal(decodeURIComponent(m[1]));
    } catch (err) {
      document.getElementById('grid').innerHTML = `<div class="empty">加载 plugins.json 失败：${esc(err.message)}</div>`;
    }
  }
  initTheme(); bind(); load();
})();

// dsh-skillhub Client 侧（v0.1）：页面右下角「技」悬浮按钮 -> 搜索面板。
// 纯 DOM + fetch，零框架依赖；registry URL 可配置（config.registryUrl）。
// 面板：搜索、生态/分类筛选、卡片（名称/描述/星标/安装命令复制）、外部链接。

const REGISTRY_DEFAULT = 'https://hub.hibcglobal.com/plugins.json';
const REGISTRY_FALLBACKS = [
  'https://hbc-tech-coder.github.io/skillhub/plugins.json',
  'https://raw.githubusercontent.com/HBC-Tech-coder/skillhub/main/data/plugins.json',
];

const ECO = {
  dsh: { label: 'DSH', color: '#4d7cfe' },
  workbuddy: { label: 'WorkBuddy', color: '#0aa869' },
  trae: { label: 'TRAE', color: '#f0662f' },
  mcp: { label: 'MCP', color: '#8b5cf6' },
};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

export default function apply(ctx) {
  const cfg = (ctx && ctx.config) || {};
  const sources = [cfg.registryUrl, ...REGISTRY_FALLBACKS].filter(Boolean);

  let data = null;
  let panel = null;
  let listEl = null;
  let state = { q: '', eco: '', cat: '' };

  function css() {
    if (document.getElementById('skillhub-style')) return;
    const st = document.createElement('style');
    st.id = 'skillhub-style';
    st.textContent = `
#skillhub-fab{position:fixed;right:18px;bottom:18px;z-index:2147483000;width:44px;height:44px;border-radius:12px;
 background:linear-gradient(135deg,#5b5bd6,#8b5cf6);color:#fff;font:700 17px/44px sans-serif;text-align:center;
 cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.25);user-select:none}
#skillhub-panel{position:fixed;right:18px;bottom:74px;z-index:2147483001;width:min(420px,calc(100vw - 36px));
 max-height:min(640px,calc(100vh - 100px));display:none;flex-direction:column;background:#fff;border:1px solid #e5e7eb;
 border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.22);overflow:hidden;font:14px/1.5 -apple-system,"Segoe UI","PingFang SC",sans-serif;color:#111827}
#skillhub-panel .hd{padding:12px 14px;border-bottom:1px solid #e5e7eb;background:#f7f8fa}
#skillhub-panel .hd input{width:100%;padding:8px 12px;border:1px solid #e5e7eb;border-radius:9px;outline:none;font:inherit}
#skillhub-panel .chips{padding:8px 12px 0;display:flex;gap:6px;flex-wrap:wrap}
#skillhub-panel .chip{padding:3px 10px;border:1px solid #e5e7eb;border-radius:999px;font-size:12px;color:#6b7280;cursor:pointer;user-select:none}
#skillhub-panel .chip.on{background:#111827;color:#fff;border-color:#111827}
#skillhub-panel .list{overflow:auto;padding:10px 12px;flex:1}
#skillhub-panel .card{border:1px solid #e5e7eb;border-radius:10px;padding:10px 12px;margin-bottom:8px}
#skillhub-panel .card .t{display:flex;gap:8px;align-items:center}
#skillhub-panel .card .n{font-weight:600;font-size:14px}
#skillhub-panel .card .b{font-size:10.5px;color:#fff;padding:1px 7px;border-radius:999px;margin-left:auto;white-space:nowrap}
#skillhub-panel .card .d{color:#6b7280;font-size:12.5px;margin:4px 0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
#skillhub-panel .card .c{display:flex;gap:6px;align-items:center;background:#f3f4f6;border:1px solid #e5e7eb;border-radius:7px;padding:4px 8px;font-family:ui-monospace,Consolas,monospace;font-size:11.5px}
#skillhub-panel .card .c code{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#374151}
#skillhub-panel .card .c button{background:#5b5bd6;color:#fff;border:none;border-radius:5px;padding:2px 8px;font-size:11px;cursor:pointer}
#skillhub-panel .err{padding:16px;color:#b91c1c;font-size:13px}
#skillhub-panel .meta{padding:6px 14px;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11.5px;background:#f7f8fa}
#skillhub-panel a{color:#5b5bd6;text-decoration:none}`;
    document.head.appendChild(st);
  }

  function el(html) {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }

  function installOf(item) {
    if (item.ecosystems && item.ecosystems.length) return item.ecosystems[0].install || item.install;
    return item.install || '';
  }

  function render() {
    if (!data || !listEl) return;
    const items = data.plugins.filter((i) => {
      const ecos = (i.ecosystems || []).map((e) => e.id);
      if (state.eco && !ecos.includes(state.eco)) return false;
      if (state.cat && i.category !== state.cat) return false;
      if (state.q) {
        const hay = [i.name, i.owner, i.author, i.description?.zh, i.description?.en, (i.tags || []).join(' ')].join(' ').toLowerCase();
        if (!hay.includes(state.q.toLowerCase())) return false;
      }
      return true;
    });
    listEl.innerHTML = items.slice(0, 40).map((i) => {
      const eco = (i.ecosystems && i.ecosystems[0] && i.ecosystems[0].id) || 'dsh';
      const e = ECO[eco] || ECO.dsh;
      return `<div class="card">
        <div class="t"><span class="n">${esc(i.name)}</span><span class="b" style="background:${e.color}">${e.label}</span></div>
        <div class="d">${esc(i.description?.zh || i.description?.en || '')}</div>
        <div class="c"><code>${esc(installOf(i))}</code><button data-id="${esc(i.id)}">复制</button></div>
        <div class="t" style="margin-top:5px;font-size:11.5px;color:#9ca3af"><span>⭐ ${i.stars ?? '—'}</span><a href="${esc(i.url)}" target="_blank" rel="noopener">源码</a></div>
      </div>`;
    }).join('') || `<div class="err">没有匹配项</div>`;
    listEl.querySelectorAll('button[data-id]').forEach((b) => {
      b.addEventListener('click', () => {
        const item = data.plugins.find((x) => x.id === b.dataset.id);
        const cmd = installOf(item);
        const done = () => { b.textContent = '已复制'; setTimeout(() => { b.textContent = '复制'; }, 1200); };
        if (navigator.clipboard) navigator.clipboard.writeText(cmd).then(done).catch(() => done());
        else done();
      });
    });
  }

  function chips() {
    const ecos = new Set((data.plugins || []).flatMap((i) => (i.ecosystems || []).map((e) => e.id)));
    const cats = new Set((data.plugins || []).map((i) => i.category));
    return `<div class="chips"><div class="chip${state.eco ? '' : ' on'}" data-eco="">全部</div>` +
      [...ecos].map((k) => `<div class="chip${state.eco === k ? ' on' : ''}" data-eco="${esc(k)}">${esc((ECO[k] || { label: k }).label)}</div>`).join('') +
      `</div><div class="chips">` +
      [...cats].map((k) => `<div class="chip${state.cat === k ? ' on' : ''}" data-cat="${esc(k)}">${esc(k)}</div>`).join('') + `</div>`;
  }

  function open() {
    css();
    if (!panel) {
      panel = el(`<div id="skillhub-panel">
        <div class="hd"><input id="skillhub-q" placeholder="搜索插件 / 技能（名称、描述、标签）…"></div>
        <div id="skillhub-chips"></div>
        <div class="list" id="skillhub-list"><div class="err">正在加载 ${esc((cfg.registryUrl || sources[0]))} …</div></div>
        <div class="meta" id="skillhub-meta">SkillHub 技能港 · 复制命令后自行安装 · 第三方代码请先看源码</div>
      </div>`);
      const fab = el(`<div id="skillhub-fab" title="技能港 SkillHub">技</div>`);
      fab.addEventListener('click', () => { panel.style.display = panel.style.display === 'flex' ? 'none' : 'flex'; });
      document.body.appendChild(panel);
      document.body.appendChild(fab);
      listEl = document.getElementById('skillhub-list');
      panel.querySelector('#skillhub-q').addEventListener('input', (ev) => { state.q = ev.target.value; render(); });
      panel.querySelector('#skillhub-chips').addEventListener('click', (ev) => {
        const c = ev.target.closest('.chip');
        if (!c) return;
        if ('eco' in c.dataset) state.eco = c.dataset.eco;
        else if ('cat' in c.dataset) state.cat = c.dataset.cat;
        panel.querySelector('#skillhub-chips').innerHTML = chips();
        render();
      });
      load();
    }
    panel.style.display = 'flex';
  }

  async function load() {
    let lastErr = null;
    for (const src of sources) {
      try {
        const res = await fetch(src, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const j = await res.json();
        if (!Array.isArray(j.plugins)) throw new Error('缺少 plugins 数组');
        data = j;
        const meta = document.getElementById('skillhub-meta');
        if (meta) meta.textContent = `SkillHub 技能港 · ${data.count} 条 · 更新 ${data.updated || '?'} · 来源 ${src}`;
        if (panel) panel.querySelector('#skillhub-chips').innerHTML = chips();
        render();
        return;
      } catch (err) { lastErr = err; }
    }
    if (listEl) listEl.innerHTML = `<div class="err">加载失败：${esc(lastErr && lastErr.message)}<br>可检查网络或配置 config.registryUrl</div>`;
  }

  // 打开入口：立即在页面右下角注入悬浮按钮（v0.1 不依赖任何 Slot）。
  ctx.effect(() => {
    if (typeof document === 'undefined') return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(open, 300), { once: true });
    } else {
      setTimeout(open, 300);
    }
  });
}

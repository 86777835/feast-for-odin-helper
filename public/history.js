import { COLOR_ZH } from './logic.js';

const COLORS = { red: 'var(--p-red)', blue: 'var(--p-blue)', yellow: 'var(--p-yellow)', black: 'var(--p-black)' };
const CATS = [
  { k: 'sea', n: '航海', c: 'var(--c-sea)' }, { k: 'land', n: '探索', c: 'var(--c-land)' },
  { k: 'build', n: '房屋', c: 'var(--c-build)' }, { k: 'herd', n: '牛羊', c: 'var(--c-herd)' },
  { k: 'job', n: '职业', c: 'var(--c-job)' }, { k: 'wealth', n: '财富', c: 'var(--c-wealth)' }
];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const por = (p, cls) => `<span class="por ${cls}" style="--c:${COLORS[p.id]}"><img src="img/${p.id}.jpg" alt=""></span>`;
const pname = p => p.name || `${COLOR_ZH[p.id]}玩家`;
const when = t => new Date(t).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });

function game(g) {
  const ps = g.players;
  const max = Math.max(1, ...ps.map(p => CATS.reduce((a, c) => a + Math.max(0, p[c.k]), 0)));
  return `<details class="card game">
    <summary><div class="gh"><b>${esc(g.code)}</b><span>${when(g.ended)} · ${ps.length} 人${g.rounds === 7 ? '标准局' : '快速局'}</span></div>
      <div class="gp">${ps.map(p => `<span class="${p.place === 1 ? 'win' : ''}">${por(p, 'xs')}<i>${esc(pname(p))}</i><em>${p.total}</em></span>`).join('')}</div></summary>
    <div class="gd rk">${ps.map(p => `
      <div class="row"><div class="stepn">${p.place}</div>${por(p, 'sm')}
        <div class="who"><div class="nm">${esc(pname(p))} <span class="fg" style="display:inline">${p.name ? COLOR_ZH[p.id] : ''}</span></div>
          <div class="stack">${CATS.map(c => `<i style="width:${Math.max(0, p[c.k]) / max * 100}%;background:${c.c}"></i>`).join('')}</div>
          <div class="parts">${CATS.filter(c => p[c.k]).map(c => `<em style="background:${c.c}"></em>${c.n} ${p[c.k]}`).join(' ')}${p.minus ? ` <span class="mn">扣分 −${p.minus}</span>` : ''}</div></div>
        <div class="tot">${p.total}</div></div>`).join('')}</div>
  </details>`;
}

async function load(q) {
  const box = document.getElementById('games');
  box.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const r = await fetch('/api/games' + (q ? '?q=' + encodeURIComponent(q) : ''));
    if (!r.ok) throw new Error(r.status);
    const list = await r.json();
    box.innerHTML = list.length ? list.map(game).join('') : `<div class="empty">${q ? '没有找到相关对局' : '暂无记录'}</div>`;
  } catch {
    box.innerHTML = '<div class="empty">加载失败，请稍后重试</div>';
  }
}

document.getElementById('search').addEventListener('submit', e => { e.preventDefault(); load(document.getElementById('q').value.trim()); });
load('');

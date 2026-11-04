// Occupation card lookup: search by number or name. Gists are our own short summaries, not the card text.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const TYPE = { immediate: ['立即', 'ty-y'], anytime: ['随时', 'ty-b'], each: ['每次', 'ty-r'], assoon: ['一旦', 'ty-g'] };
const FILTERS = [['all', '全部'], ['A', 'A 组'], ['B', 'B 组'], ['C', 'C 组'], ['start', '起始卡'], ['banned', '挪威禁用']];
let cards = [], filter = 'all';

function card(c) {
  const [tn, tc] = TYPE[c.type] || ['', ''];
  return `<div class="card oc">
    <div class="oh"><b class="no">${esc(c.no)}</b><span class="nm">${esc(c.zh || c.en)}${c.zh ? `<small>${esc(c.en)}</small>` : ''}</span>
      <span class="pt">${c.pts > 0 ? '+' : ''}${c.pts}<small>分</small></span></div>
    <div class="tags">${tn ? `<i class="${tc}">${tn}</i>` : ''}${c.start ? '<i>起始卡</i>' : ''}${c.set === 'norwegians' ? '<i>挪威扩展</i>' : ''}${c.banned ? '<i class="ban">挪威扩展禁用</i>' : ''}</div>
    <p>${esc(c.gist)}</p>${c.note ? `<p class="cn">说明：${esc(c.note)}</p>` : ''}</div>`;
}

function show() {
  const q = document.getElementById('q').value.trim().toLowerCase().replace(/\s+/g, '');
  const list = cards.filter(c => (filter === 'all' || c.deck === filter || (filter === 'start' && c.start) || (filter === 'banned' && c.banned))
    && (!q || c.no.toLowerCase() === q || c.no.replace(/\D/g, '') === q   // "39" or "39c" finds 39C
      || c.en.toLowerCase().replace(/\s+/g, '').includes(q) || (c.zh || '').includes(q) || c.gist.includes(q)));
  document.getElementById('filters').innerHTML = FILTERS.map(([k, n]) => `<button class="chip${k === filter ? ' on' : ''}" data-f="${k}">${n}</button>`).join('');
  document.getElementById('cards').innerHTML = list.length ? list.slice(0, 80).map(card).join('') + (list.length > 80 ? `<div class="empty">还有 ${list.length - 80} 张，请输入卡号或名称缩小范围</div>` : '')
    : '<div class="empty">没有找到这张卡</div>';
}

document.getElementById('search').addEventListener('submit', e => { e.preventDefault(); show(); document.getElementById('q').blur(); });
document.getElementById('q').addEventListener('input', show);
document.getElementById('filters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; show(); } });
fetch('cards.json').then(r => r.json()).then(j => { cards = j; show(); })
  .catch(() => { document.getElementById('cards').innerHTML = '<div class="empty">加载失败，请稍后重试</div>'; });

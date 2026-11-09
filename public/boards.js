// Board guide: a photo of each board with tappable spots; a spot opens its effect. Data: boards/boards.json.
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const GROUPS = ['行动版图', '探索版图', '部落版图', '房屋与工棚'];
let boards = [], cur = null;
const $ = s => document.querySelector(s);

function pick(id) {
  cur = boards.find(b => b.id === id) || boards[0];
  history.replaceState(null, '', '#' + cur.id);
  render();
}

function spotLine(s) {
  return [s.area, s.col ? `第 ${s.col} 列` : '', s.vikings ? `${s.vikings} 个维京人` : ''].filter(Boolean).join(' · ');
}

function render() {
  const b = cur;
  $('#groups').innerHTML = GROUPS.filter(g => boards.some(x => x.group === g))
    .map(g => `<button class="chip${g === b.group ? ' on' : ''}" data-g="${g}">${g}</button>`).join('');
  $('#pick').innerHTML = boards.filter(x => x.group === b.group)
    .map(x => `<button class="chip${x === b ? ' on' : ''}" data-id="${x.id}">${esc(x.title)}</button>`).join('');
  $('#pick .chip.on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const areas = [...new Set(b.spots.map(s => s.area || ''))];
  $('#board').innerHTML = `
    ${b.summary ? `<p class="note">${esc(b.summary)}</p>` : ''}
    <div class="bd-img"><img src="boards/${esc(b.img)}" alt="${esc(b.title)}">
      ${b.spots.map((s, i) => `<button class="bd-spot" data-i="${i}" style="left:${s.rect[0]}%;top:${s.rect[1]}%;width:${s.rect[2]}%;height:${s.rect[3]}%" aria-label="${esc(s.name)}"></button>`).join('')}</div>
    <p class="bd-credit">点版图上的格子看效果 · 照片：${b.credit?.url ? `<a href="${esc(b.credit.url)}" target="_blank" rel="noopener">${esc(b.credit.by || '来源')}</a>` : esc(b.credit?.by || '')}</p>
    ${b.info?.length ? `<table class="st bd-info"><tbody>${b.info.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}</tbody></table>` : ''}
    <h2 class="h">所有格子<small>${b.spots.length} 个</small></h2>
    ${areas.map(a => `${a ? `<h3 class="fq-cat">${esc(a)}</h3>` : ''}<div class="list">${b.spots.map((s, i) => [s, i]).filter(([s]) => (s.area || '') === a).map(([s, i]) => `
      <button class="card bd-row" data-i="${i}"><b>${esc(s.name)}</b><small>${esc(spotLine(s))}</small><span>${esc(s.text)}</span></button>`).join('')}</div>`).join('')}`;
}

function sheet(i) {
  const s = cur.spots[i];
  document.querySelectorAll('.bd-spot.on').forEach(x => x.classList.remove('on'));
  document.querySelector(`.bd-spot[data-i="${i}"]`)?.classList.add('on');
  $('#sheet').innerHTML = `<div class="mask" data-close></div><div class="sheet bd-sheet">
    <h3>${esc(s.name)}</h3><div class="hint">${esc(spotLine(s))}</div>
    <p>${esc(s.text)}</p>${s.note ? `<p class="cn">${esc(s.note)}</p>` : ''}
    ${s.src ? `<p class="cn">出处：${esc(s.src)}</p>` : ''}
    <button class="btn ghost" data-close>关闭</button></div>`;
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-g],[data-id],[data-i],[data-close]'); if (!t) return;
  if (t.dataset.g) pick(boards.find(b => b.group === t.dataset.g).id);
  else if (t.dataset.id) pick(t.dataset.id);
  else if (t.dataset.i) sheet(+t.dataset.i);
  else { $('#sheet').innerHTML = ''; document.querySelectorAll('.bd-spot.on').forEach(x => x.classList.remove('on')); }
});

addEventListener('hashchange', () => { if (boards.length && location.hash.slice(1) !== cur?.id) pick(location.hash.slice(1)); });
fetch('boards/boards.json').then(r => r.json()).then(j => { boards = j.boards; pick(location.hash.slice(1)); })
  .catch(() => { $('#board').innerHTML = '<div class="empty">加载失败，请稍后重试</div>'; });

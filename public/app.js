import { COLOR_ORDER, COLOR_ZH, PHASES, activePhases, turnOrder, usesPassOrder, recordsPasses, num, parts, results, THING_PTS, CROWN_PTS } from './logic.js';
import { phaseInfo } from './phases.js';

const COLORS = { red: 'var(--p-red)', blue: 'var(--p-blue)', yellow: 'var(--p-yellow)', black: 'var(--p-black)' };
const CATS = [
  { k: 'sea', n: '航海', c: 'var(--c-sea)' }, { k: 'land', n: '探索', c: 'var(--c-land)' },
  { k: 'build', n: '房屋', c: 'var(--c-build)' }, { k: 'herd', n: '牛羊', c: 'var(--c-herd)' },
  { k: 'job', n: '职业', c: 'var(--c-job)' }, { k: 'wealth', n: '财富', c: 'var(--c-wealth)' }
];
// Score pad rows, top to bottom. list: one value per item; neg: points lost (typed as a positive number).
// quick: keypad shortcut buttons; allow: the only values an item can have (anything else is flagged).
const FIELD_BASE = {
  ship: { n: '船只', hint: '港湾里的每艘船：捕鲸船 3 · 商船 5 · 长船 8。移民的船记在「移民」，这里不再算', list: true,
    quick: [['捕鲸船', 3], ['商船', 5], ['长船', 8]], allow: [3, 5, 8] },
  emig: { n: '移民', hint: '每艘移民船：商船 18 · 长船 21', list: true, quick: [['商船', 18], ['长船', 21]], allow: [18, 21] },
  expl: { n: '探索版图', hint: '每块已拿到的探索版图：右上角盾牌分值', list: true },
  house: { n: '工棚房屋', hint: '工棚 8 · 石屋 10 · 长屋 17', list: true, quick: [['工棚', 8], ['石屋', 10], ['长屋', 17]], allow: [8, 10, 17] },
  animal: { n: '羊和牛', hint: '只算畜栏里的：羊 2（怀孕 3）· 牛 3（怀孕 4），逐只相加', list: true,
    quick: [['羊', 2], ['怀孕羊', 3], ['牛', 3], ['怀孕牛', 4]], allow: [2, 3, 4] },
  job: { n: '职业卡牌', hint: '每张已打出的职业卡牌：右上角分值（可为负数）', list: true },
  silver: { n: '银币', hint: '供应区的银币总数（放在版图和房屋上的不算）' },
  income: { n: '最终收入', hint: '最后一轮的收入：只有当时没领成银币才记在这里，否则会和「银币」重复计分' },
  crown: { n: '王冠', hint: '' },
  mHome: { n: '部落版图', hint: '部落版图上没盖住的负分格：扣分合计（填正数）', neg: true },
  mExpl: { n: '探索版图', hint: '探索版图上没盖住的负分格：扣分合计（填正数）', neg: true },
  mHouse: { n: '工棚房屋', hint: '工棚、石屋、长屋上没盖住的负分格：扣分合计（填正数）', neg: true },
  thing: { n: '庭之惩罚', hint: '庭之惩罚的个数（每个 −3）', neg: true }
};
// Values that cannot occur on the score pad (a ship is worth 3, 5 or 8, …), or an income that may be counted twice.
function warnOf(id, key) {
  const f = FIELD[key], d = (S.score[id] || {})[key];
  if (f.allow && Array.isArray(d)) { const bad = d.filter(v => !f.allow.includes(v)); if (bad.length) return `${bad.join('、')} 不是有效的${f.n}分值（只能是 ${f.allow.join('、')}）`; }
  if (key === 'income' && num(d) > 0) return '确认最后一轮的收入没有领成银币，否则不要再填这里';
  return '';
}
// With the Norwegians (its rulebook p.6): horses and pigs count as animals, victory point tokens go with occupations,
// the artisan shed with sheds and houses. Artisan shed and small emigration values are printed on their tiles, so not checked.
const FIELD_NOR = {
  ...FIELD_BASE,
  emig: { ...FIELD_BASE.emig, hint: '每艘移民船：商船 18 · 长船 21；小移民（捕鲸船）按板块上印的分值', allow: null },
  house: { ...FIELD_BASE.house, hint: '工棚 8 · 石屋 10 · 长屋 17，再加手工工棚的分值', allow: null },
  animal: { n: '动物', hint: '只算畜栏和供应区里的：羊 2（怀孕 3）· 牛 3（怀孕 4）· 马 6（怀孕 8）· 猪 1', list: true,
    quick: [['羊', 2], ['怀孕羊', 3], ['牛', 3], ['怀孕牛', 4], ['马', 6], ['怀孕马', 8], ['猪', 1]], allow: [1, 2, 3, 4, 6, 8] },
  job: { ...FIELD_BASE.job, hint: '已打出的职业卡牌分值（可为负），再加胜利点标记 4/3/2', quick: [['胜利点', 2], ['胜利点', 3], ['胜利点', 4]] },
  mHouse: { ...FIELD_BASE.mHouse, hint: '工棚、石屋、长屋和手工工棚上没盖住的负分格：扣分合计（填正数）' }
};
let FIELD = FIELD_BASE;
const ROWS = ['ship', 'emig', 'expl', 'house', 'animal', 'job', 'silver', 'income', 'crown', 'mHome', 'mExpl', 'mHouse', 'thing'];
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} }
};

let code = cleanCode(new URLSearchParams(location.search).get('r'));
let S = null, noRoom = false, online = false, ws = null, queue = [], retry = 0;
const ui = { tab: store.get('odin-tab') || 'flow', sheet: null, err: '', busy: false, rooms: null, rn: false, saving: false, all: false };   // rn: rename inputs shown on the results tab; all: every phase's detail open

// Rooms this phone has been in, newest first. Kept on the phone so they don't depend on the public list.
function mine() {
  try { const v = JSON.parse(store.get('odin-mine')); if (Array.isArray(v)) return v; } catch {}
  return [];
}
const remember = c => store.set('odin-mine', JSON.stringify([c, ...mine().filter(x => x !== c)].slice(0, 8)));
const forget = c => store.set('odin-mine', JSON.stringify(mine().filter(x => x !== c)));
function ago(t) {
  const m = Math.floor((Date.now() - t) / 60000);
  return m < 1 ? '刚刚' : m < 60 ? `${m} 分钟前` : m < 1440 ? `${Math.floor(m / 60)} 小时前` : `${Math.floor(m / 1440)} 天前`;
}

// Lobby list on the start page, refreshed while it is showing.
async function loadRooms() {
  if (code) return;
  try { const r = await fetch('/api/rooms'); if (r.ok) { ui.rooms = await r.json(); render(); } } catch {}
}
setInterval(() => { if (!code && !document.hidden) loadRooms(); }, 8000);
const pending = new Map(); // debounced text inputs: key -> {timer, flush}

function cleanCode(v) { const c = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4); return c.length === 4 ? c : null; }

/* ---------- connection ---------- */
function connect() {
  if (!code) return;
  ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/room/${code}/ws`);
  ws.onopen = () => { retry = 0; online = true; queue.splice(0).forEach(m => ws.send(m)); render(); };
  ws.onmessage = e => {
    if (e.data === 'pong') return;
    const m = JSON.parse(e.data);
    if (m.type === 'state') {
      const drew = S && (m.state.draw || 0) > (S.draw || 0);
      S = m.state; remember(code); render();
      if (drew) playDraw();
    }
    else if (m.type === 'error' && m.error === 'noroom') { noRoom = true; forget(code); ws.close(); render(); }
  };
  ws.onclose = () => {
    online = false; render();
    if (!noRoom && code) setTimeout(connect, Math.min(5000, 400 * 2 ** retry++));
  };
}
setInterval(() => { if (ws && ws.readyState === 1) ws.send('ping'); }, 25000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && code && !noRoom && (!ws || ws.readyState > 1)) { retry = 0; connect(); }
});
function send(action) {
  const m = JSON.stringify({ action });
  if (ws && ws.readyState === 1) ws.send(m); else queue.push(m);
}
function debounced(key, fn, delay = 350) {
  const old = pending.get(key); if (old) clearTimeout(old.timer);
  const entry = { flush() { clearTimeout(entry.timer); pending.delete(key); fn(); } };
  entry.timer = setTimeout(entry.flush, delay);
  pending.set(key, entry);
}
const flushAll = () => [...pending.values()].forEach(p => p.flush());

/* ---------- helpers ---------- */
const P = id => S.players.find(p => p.id === id);
const pname = id => P(id).name || `${COLOR_ZH[id]}玩家`;
const por = (id, cls = '') => `<span class="por ${cls}" style="--c:${COLORS[id]}"><img src="img/${id}.jpg" alt=""></span>`;
const roundsName = R => R === 7 ? '标准 7 轮' : '快速 6 轮';
function toast(t) { const el = $('#toast'); el.innerHTML = `<div class="toast">${esc(t)}</div>`; clearTimeout(toast.t); toast.t = setTimeout(() => el.innerHTML = '', 1800); }

/* ---------- render (DOM morph keeps focus and typed text) ---------- */
function morph(a, b) {
  const ac = [...a.childNodes], bc = [...b.childNodes];
  bc.forEach((y, i) => {
    const x = ac[i];
    if (!x) { a.appendChild(y); return; }
    if (x.nodeType !== y.nodeType || x.nodeName !== y.nodeName || (x.nodeType === 1 && x.getAttribute('data-k') !== y.getAttribute('data-k'))) { a.replaceChild(y, x); return; }
    if (x.nodeType !== 1) { if (x.nodeValue !== y.nodeValue) x.nodeValue = y.nodeValue; return; }
    for (const at of [...x.attributes]) if (!y.hasAttribute(at.name)) x.removeAttribute(at.name);
    for (const at of [...y.attributes]) if (x.getAttribute(at.name) !== at.value) x.setAttribute(at.name, at.value);
    if (x.tagName === 'INPUT') {
      const v = y.getAttribute('value') ?? '';
      if (x !== document.activeElement && !pending.has(x.dataset.pk) && x.value !== v) x.value = v;
      return;
    }
    if ('disabled' in x) x.disabled = y.hasAttribute('disabled');
    morph(x, y);
  });
  while (a.childNodes.length > bc.length) a.removeChild(a.lastChild);
}
function render() {
  FIELD = S?.nor ? FIELD_NOR : FIELD_BASE;
  const t = document.createElement('div');
  t.innerHTML = view();
  morph($('#app'), t);
  $('#sheet').innerHTML = ui.sheet ? sheetView() : '';
}

function view() {
  if (!code) return landing();
  if (noRoom) return `${hero()}<div class="wrap"><h2 class="h">房间 ${code} 不存在</h2><p class="note">房间码可能输错了，或者房间已失效。</p><button class="btn" data-act="leave">返回首页</button></div>`;
  if (!S) return `${hero()}<div class="wrap"><h2 class="h">正在连接房间 ${code}…</h2></div>`;
  return bar() + `<div class="wrap" data-k="stage-${S.stage === 'setup' ? 'setup' : 'play'}">` + (S.stage === 'setup' ? setupView() : playView()) + '</div>';
}
const hero = () => `<div class="hero" data-k="hero"><div class="en">奥丁的盛宴</div><h1>奥丁的盛宴小助手</h1><div class="orn"></div></div><div class="band"></div>`;
const bar = () => `<div class="bar" data-k="bar"><span class="ttl">奥丁的盛宴</span>
  <button class="room" data-act="share"><small>房间</small>${code}<small>邀请</small></button><span class="conn ${online ? 'on' : ''}" title="${online ? '已连接' : '重新连接中'}"></span></div>`;

function landing() {
  const rooms = ui.rooms;
  const stageText = r => r.stage === 'setup' ? '准备中' : r.stage === 'over' ? '已结束' : `第 ${r.round} / ${r.rounds} 轮`;
  const my = mine();
  const tag = c => my.includes(c) ? '<em>我的</em>' : '';
  // my rooms first (stable sort keeps the server's order otherwise), then my rooms the public list no longer shows
  const listed = rooms && rooms.slice().sort((a, b) => my.includes(b.code) - my.includes(a.code));
  const unlisted = rooms ? my.filter(c => !rooms.some(r => r.code === c)) : [];
  const roomList = rooms === null ? '<div class="empty">加载中…</div>' : listed.length + unlisted.length ? listed.map(r => `
      <button class="card lobby" data-act="rejoin" data-code="${r.code}" data-k="lb-${r.code}">
        <span class="lc">${r.code}${tag(r.code)}</span>
        <span class="lp">${r.players.map(p => `<span class="por xs" style="--c:${COLORS[p.id]}"><img src="img/${p.id}.jpg" alt=""></span>`).join('')}</span>
        <span class="ls"><b class="st st-${r.stage}">${stageText(r)}</b><small>${r.online ? `<i class="od on"></i>${r.online} 人在线` : ago(r.updated)}</small></span>
      </button>`).join('') + unlisted.map(c => `
      <button class="card lobby" data-act="rejoin" data-code="${c}" data-k="lb-${c}">
        <span class="lc">${c}${tag(c)}</span><span class="lp"></span><span class="ls"><small>点击进入</small></span>
      </button>`).join('') : '<div class="empty">暂无进行中的房间</div>';
  return `<div class="hero-art cover" data-k="hero"><img src="img/cover-bg.jpg" alt=""><img class="cv" src="img/cover.jpg" alt="《奥丁的盛宴》封面"><div class="ht">
      <div class="hz">奥丁的盛宴小助手</div><div class="hs">跟着流程走 · 计分不费神</div></div></div>
    <div class="wrap" data-k="landing">
    <div class="card start">
      <button class="btn" data-act="create" ${ui.busy ? 'disabled' : ''}>创建新房间</button>
      <div class="or">或输入房间码加入</div>
      <div class="join"><input id="joinCode" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="房间码"><button class="btn navy" data-act="join">加入</button></div>
      ${ui.err ? `<div class="err">${esc(ui.err)}</div>` : ''}
    </div>
    <div class="tiles">
      <a class="card tile" href="guide"><span class="ti"><img src="img/rules-poster.jpg" alt=""></span><span><b>新手教程</b>图文 + 常见问题</span></a>
      <a class="card tile" href="history"><span class="ti rec">录</span><span><b>往期对局</b>战绩与成绩参照</span></a>
      <a class="card tile wide" href="cards"><span class="ti rec">职</span><span><b>职业卡速查</b>按卡号或卡名查要点</span></a>
    </div>
    <h2 class="h">房间<small>${rooms && rooms.length ? `${rooms.length} 个` : ''}</small></h2>
    <div class="list">${roomList}</div>
    <footer>非官方玩家工具</footer></div>`;
}

function setupView() {
  const used = S.players.slice(0, S.n).map(p => p.id);
  return `
    <h2 class="h">玩家人数</h2>
    <div class="chips">${[1, 2, 3, 4].map(k => `<button class="chip${k === S.n ? ' on' : ''}" data-act="n" data-n="${k}">${k} 人</button>`).join('')}</div>
    <h2 class="h">游戏长度</h2>
    <div class="chips">${[7, 6].map(k => `<button class="chip${k === S.rounds ? ' on' : ''}" data-act="rounds" data-r="${k}">${roundsName(k)}</button>`).join('')}</div>
    <h2 class="h">规则选项</h2>
    <div class="chips">
      <button class="chip${S.nor ? ' on' : ''}" data-act="opt" data-key="nor" data-on="${!S.nor}">挪威扩展</button>
      ${S.n >= 3 ? `<button class="chip${S.passOrder ? ' on' : ''}" data-act="opt" data-key="passOrder" data-on="${!S.passOrder}">停手顺序轮序</button>` : ''}
    </div>
    ${S.nor ? '<p class="note">挪威扩展：换用扩展的行动版图和探索版图，流程提示和计分表会加上马、猪、胜利点标记和手工工棚。</p>' : ''}
    ${S.passOrder && S.n >= 3 ? '<p class="note">停手顺序轮序（扩展设计师的规则，《丹麦人》的正式规则）：最后停手的人当起始玩家，其余人按停手先后倒过来排，越早停手下一轮越晚行动。第 1 轮仍从起始玩家起顺时针。</p>' : ''}
    <h2 class="h">座位与颜色<small>按顺时针排列</small></h2>
    <div class="list">${S.players.slice(0, S.n).map((p, i) => `
      <div class="card row" data-k="seat-${i}">
        <div class="stepn">${i + 1}</div>
        ${por(p.id)}
        <div class="who">
          <input class="pn" data-pk="name-${i}" data-name="${i}" value="${esc(p.name)}" placeholder="玩家名" maxlength="12" enterkeyhint="done">
          <div class="dots">${COLOR_ORDER.map(c => `<button class="dot${c === p.id ? ' on' : ''}" style="--c:${COLORS[c]}" data-act="color" data-i="${i}" data-c="${c}" ${c !== p.id && used.includes(c) ? 'disabled' : ''} aria-label="${COLOR_ZH[c]}"></button>`).join('')}
            ${S.n > 1 ? `<button class="fst${S.start === p.id ? ' on' : ''}" data-act="first" data-id="${p.id}">${S.start === p.id ? '起始玩家' : '设为起始'}</button>` : ''}</div>
        </div>
        <button class="ib" data-act="move" data-i="${i}" data-j="${i - 1}" ${i === 0 ? 'disabled' : ''} aria-label="上移">↑</button>
        <button class="ib" data-act="move" data-i="${i}" data-j="${i + 1}" ${i === S.n - 1 ? 'disabled' : ''} aria-label="下移">↓</button>
      </div>`).join('')}</div>
    ${S.n > 1 ? '<button class="btn ghost" data-act="draw">随机抽起始玩家</button>' : '<p class="note">单人游戏：每轮都是你先行动，跳过「决定起始玩家」阶段。准备方式见教程「单人游戏」。</p>'}
    <button class="btn" data-act="begin">开始游戏</button>`;
}

function playView() {
  const tabs = [['flow', '流程'], ['score', '计分'], ['mvp', '结算']];
  if (!tabs.some(t => t[0] === ui.tab)) ui.tab = 'flow';
  return `<div class="tabs">${tabs.map(([k, n]) => `<button class="tab${ui.tab === k ? ' on' : ''}" data-act="tab" data-tab="${k}">${n}</button>`).join('')}</div>
    ${status()}${banner()}
    <div data-k="tab-${ui.tab}">${ui.tab === 'flow' ? flowTab() : ui.tab === 'score' ? scoreTab() : mvpTab()}</div>`;
}

function status() {
  if (S.stage === 'over') return `<div class="status"><span class="medal">终</span><div><div class="t">游戏结束</div><div class="s">宴会阶段后立即结束，开始终局计分</div></div></div>`;
  const ph = PHASES.find(p => p.k === S.phase);
  const pips = Array.from({ length: S.rounds }, (_, i) => `<i class="${i + 1 < S.round ? 'done' : i + 1 === S.round ? 'cur' : ''}"></i>`).join('');
  return `<div class="status"><span class="medal" style="font-size:21px">${S.round}</span>
    <div><div class="t">第<b>${S.round}</b>/ ${S.rounds} 轮 · ${ph.n}</div><div class="s">${S.round === S.rounds ? '最后一轮：宴会结束后游戏结束' : `阶段 ${S.phase} / 12`}</div></div>
    <div class="pips">${pips}</div></div>`;
}

function banner() {
  if (S.stage === 'over' && ui.tab !== 'mvp')
    return `<div class="banner"><div style="flex:1"><b>游戏结束</b>，请填写终局计分</div><button data-act="goto" data-tab="${ui.tab === 'score' ? 'mvp' : 'score'}">${ui.tab === 'score' ? '看结算' : '去计分'}</button></div>`;
  return '';
}

function flowTab() {
  const order = turnOrder(S);
  const track = `<div class="track"><div class="t">${S.n === 1 ? '单人游戏' : usesPassOrder(S) && S.round > 1 ? '行动顺序 · 按上一轮停手顺序' : '行动顺序 · 从起始玩家起顺时针'}</div><div class="slots">${order.map((id, i) => `
    <div class="slot" data-k="slot-${id}"><div class="o">${i + 1}</div>${por(id)}<div class="n">${esc(pname(id))}</div>${i === 0 && S.n > 1 ? '<span class="m">起始</span>' : ''}</div>`).join('')}</div></div>`;
  if (S.stage === 'over') return track + `<div class="btns"><button class="btn ghost" data-act="undo" ${S.back.length ? '' : 'disabled'}>撤销上一步</button><button class="btn ghost" data-act="reset">重新开局</button></div>`;
  const act = activePhases(S.round, S.rounds, S.n);
  const card = (p, open) => {
    const on = act.includes(p.k), cur = p.k === S.phase, done = on && p.k < S.phase;
    const info = phaseInfo(p.k, S.round, S.rounds, S.n, { nor: S.nor, passOrder: usesPassOrder(S) });
    return `<div class="card ph${cur ? ' cur' : ''}${done ? ' done' : ''}${on ? '' : ' off'}" data-k="ph-${p.k}${open ? '-open' : ''}">
      <div class="phh"><span class="phn">${p.k}</span><b>${p.n}</b><small>${on ? (done ? '已完成' : info.tag || '') : info.skip}</small></div>
      ${open ? `<div class="phb">${info.html}${cur && p.k === 5 && recordsPasses(S) ? passView() : ''}${cur && p.k === 6 ? (usesPassOrder(S) ? nextOrderView() : pickView()) : ''}</div>` : ''}</div>`;
  };
  const isLast = act.at(-1) === S.phase;
  const needPass = S.phase === 5 && recordsPasses(S) && S.passed.length < S.n;
  const need = (S.phase === 6 && S.picked !== S.round) || needPass;
  const label = isLast ? (S.round === S.rounds ? '宴会结束，进入终局计分' : `本轮结束，进入第 ${S.round + 1} 轮`) : `完成「${PHASES.find(p => p.k === S.phase).n}」，下一阶段`;
  return `${track}
    <div class="phs">${card(PHASES.find(p => p.k === S.phase), true)}</div>
    <button class="btn" data-act="next" ${need ? 'disabled' : ''}>${needPass ? '先按顺序点完所有人的停手' : need ? '先选出新的起始玩家' : label}</button>
    <div class="btns"><button class="btn ghost" data-act="undo" ${S.back.length ? '' : 'disabled'}>撤销上一步</button><button class="btn ghost" data-act="reset">重新开局</button></div>
    <h2 class="h">第 ${S.round} 轮的 12 个阶段<small><button class="tbh" data-act="all"><span>${ui.all ? '收起说明' : '展开说明'}</span></button></small></h2>
    <div class="phs">${PHASES.map(p => card(p, ui.all && act.includes(p.k))).join('')}</div>`;
}

function passView() {
  return `<div class="pick">${turnOrder(S).map(id => { const k = S.passed.indexOf(id); return `<button class="${k >= 0 ? 'on' : ''}" data-act="pass" data-id="${id}" ${k >= 0 ? 'disabled' : ''}>${por(id, 'sm')}<span>${esc(pname(id))}${k >= 0 ? ` · 第 ${k + 1} 个停手` : ''}</span></button>`; }).join('')}</div>`;
}
function nextOrderView() {
  return `<div class="pick">${S.nextOrder.map((id, i) => `<button class="${i === 0 ? 'on' : ''}" disabled>${por(id, 'sm')}<span>${i + 1}. ${esc(pname(id))}</span></button>`).join('')}</div>`;
}
function pickView() {
  return `<div class="pick">${turnOrder(S).map(id => `<button class="${S.picked === S.round && S.start === id ? 'on' : ''}" data-act="pick" data-id="${id}">${por(id, 'sm')}<span>${esc(pname(id))}</span></button>`).join('')}</div>`;
}

const meKey = () => `odin-me-${code}`;
const myId = () => { const m = store.get(meKey()); return turnOrder(S).includes(m) ? m : null; };

function scoreTab() {
  const view = ui.view || 'me', me = myId();
  const seg = `<div class="seg">${[['me', '我的计分'], ['all', '全桌总览']].map(([k, n]) => `<button class="${k === view ? 'on' : ''}" data-act="view" data-v="${k}">${n}</button>`).join('')}</div>`;
  if (view === 'me' && !me) return seg + `<h2 class="h">你是哪位玩家？</h2><p class="note">选好后这台手机只填你自己的分数，其他人在各自手机上填，结果实时汇总。</p>
    <div class="pick me">${turnOrder(S).map(id => `<button data-act="me" data-id="${id}">${por(id, 'sm')}<span>${esc(pname(id))}</span></button>`).join('')}</div>`;
  return seg + (view === 'me' ? myScore(me) : fullTable());
}

function cellBtn(id, key) {
  if (key === 'crown') return `<button class="cell ${S.crown === id ? 'crown' : 'empty'}" data-act="crown" data-id="${id}">${S.crown === id ? `+${CROWN_PTS}` : '无'}</button>`;
  const d = (S.score[id] || {})[key], warn = warnOf(id, key) ? ' warn' : '';
  if (FIELD[key].list) { const t = (d || []).reduce((a, b) => a + b, 0); return `<button class="cell ${d && d.length ? '' : 'empty'}${warn}" data-act="cell" data-id="${id}" data-key="${key}">${d && d.length ? t : '加'}</button>`; }
  const filled = d !== undefined && d !== '';
  const bad = filled && num(d) === null;
  const neg = FIELD[key].neg && filled && !bad && num(d) > 0;
  return `<button class="cell ${filled ? '' : 'empty'} ${bad ? 'bad' : ''} ${neg ? 'neg' : ''}${warn}" data-act="cell" data-id="${id}" data-key="${key}">${filled ? (neg ? '−' : '') + esc(d) : '0'}</button>`;
}
const rowName = k => `${FIELD[k].n}${k === 'thing' ? `<small>每个 −${THING_PTS}</small>` : k === 'crown' ? `<small>英格兰 +${CROWN_PTS}</small>` : ''}`;

function myScore(id) {
  const p = parts(S, id);
  const item = k => {
    const w = warnOf(id, k), d = (S.score[id] || {})[k];
    const detail = FIELD[k].list && d && d.length > 1 ? `<div class="ms-ex">${d.map((v, i) => (i ? (v < 0 ? ' − ' : ' + ') : v < 0 ? '−' : '') + Math.abs(v)).join('')}</div>` : '';
    return `<div class="card ms" data-k="ms-${k}"><div class="ms-t"><b>${rowName(k)}</b><div class="ms-h">${k === 'crown' ? '全场只有一个，点一下表示在你手上' : FIELD[k].hint}</div>${detail}${w ? `<div class="ms-w">${esc(w)}</div>` : ''}</div>${cellBtn(id, k)}</div>`;
  };
  const others = turnOrder(S).filter(o => o !== id).map(o => { const q = parts(S, o); return `<span>${por(o, 'xs')}${esc(pname(o))} <b>${q ? q.total : '—'}</b></span>`; }).join('');
  return `<div class="ms-who">${por(id, 'sm')}<div><b>${esc(pname(id))}</b><small>只填你自己的分数</small></div><button class="tbh" data-act="me" data-id=""><span>换人</span></button></div>
    <h2 class="h">得分</h2><div class="list">${ROWS.slice(0, 9).map(item).join('')}</div>
    <h2 class="h">扣分</h2><div class="list">${ROWS.slice(9).map(item).join('')}</div>
    <div class="ms-tot card"><span>我的合计</span><b data-tt="${id}">${p ? p.total : '—'}</b></div>
    <div class="ms-others">${others}</div>`;
}

function fullTable() {
  const order = turnOrder(S);
  const row = k => `<tr data-k="sr-${k}"><th>${rowName(k)}</th>${order.map(id => `<td>${cellBtn(id, k)}</td>`).join('')}</tr>`;
  const tots = order.map(id => parts(S, id));
  const warns = order.flatMap(id => ROWS.map(k => warnOf(id, k) && `${pname(id)} · ${FIELD[k].n}：${warnOf(id, k)}`)).filter(Boolean);
  const head = t => `<tr class="grp" data-k="g-${t}"><td colspan="${order.length + 1}">${t}</td></tr>`;
  return `<table class="sc"><thead><tr><th></th>${order.map(id => `<th><div class="pv">${por(id, 'xs')}<span>${esc(pname(id))}</span></div></th>`).join('')}</tr></thead>
    <tbody>${head('得分')}${ROWS.slice(0, 9).map(row).join('')}${head('扣分')}${ROWS.slice(9).map(row).join('')}
    <tr data-k="sr-total"><th>合计</th>${order.map((id, i) => `<td class="tt" data-tt="${id}">${tots[i] ? tots[i].total : '—'}</td>`).join('')}</tr></tbody></table>
    ${warns.map(w => `<p class="note">${esc(w)}</p>`).join('')}
    <p class="legend">船只、探索版图、房屋、羊和牛、职业卡牌逐项输入（如 3+5+8），合计自动相加；扣分项填正数，自动扣除。没手机的玩家可以由别人在这里代填。</p>`;
}

function mvpTab() {
  const R = results(S);
  if (R.error) return `<p class="note">计分里有无效数字，请先到「计分」修正。</p>`;
  const top = R.rows.filter(r => r.place === 1);
  const champ = top[0];
  const maxSum = Math.max(1, ...R.rows.map(r => CATS.reduce((a, c) => a + Math.max(0, r[c.k]), 0)));
  return `<div id="shot">
    <div class="mvp" style="margin-top:8px">
      <div class="crown">${top.length > 1 ? '并 列 第 一' : 'M V P · 奥 丁 座 上 宾'}</div>
      ${por(champ.id)}
      <div class="nm">${top.map(r => esc(pname(r.id))).join(' · ')}</div>
      <div class="fg">${top.map(r => COLOR_ZH[r.id]).join(' · ')} · ${roundsName(S.rounds)}${S.nor ? ' · 挪威扩展' : ''}</div>
      <div class="pts">${champ.total}<small>分</small></div>
    </div>
    <div class="btns sv" data-html2canvas-ignore><button class="btn ghost" data-act="rn">${ui.rn ? '收起改名' : '修改玩家名'}</button><button class="btn navy" data-act="save" ${ui.saving ? 'disabled' : ''}>${ui.saving ? '正在生成…' : '保存结算长图'}</button></div>
    ${ui.rn ? `<div class="card" data-k="rn" data-html2canvas-ignore style="margin-top:8px;padding:2px 10px 8px">${turnOrder(S).map(id => { const i = S.players.findIndex(p => p.id === id); return `<div class="tb">${por(id, 'xs')}<input class="pn" data-pk="name-${i}" data-name="${i}" value="${esc(P(id).name)}" placeholder="玩家名" maxlength="12" enterkeyhint="done"></div>`; }).join('')}</div>` : ''}
    ${top.length > 1 ? '<p class="note" data-html2canvas-ignore>同分不再比较，按规则书并列获胜。</p>' : ''}
    <h2 class="h">排名与得分构成</h2>
    <div class="list rk">${R.rows.map(r => `
      <div class="card row" data-k="rk-${r.id}"><div class="stepn">${r.place}</div>${por(r.id, 'sm')}
        <div class="who"><div class="nm">${esc(pname(r.id))}</div>
          <div class="stack">${CATS.map(c => `<i style="width:${Math.max(0, r[c.k]) / maxSum * 100}%;background:${c.c}"></i>`).join('')}</div>
          <div class="parts">${CATS.filter(c => r[c.k]).map(c => `<em style="background:${c.c}"></em>${c.n} ${r[c.k]}`).join(' ')}${r.minus ? ` <span class="mn">扣分 −${r.minus}</span>` : ''}</div></div>
        <div class="tot">${r.total}</div></div>`).join('')}</div>
    <h2 class="h">成就</h2>
    <div class="achs">${R.ach.map(a => `
      <div class="card ach" data-k="ach-${a.k}"><span class="medal">${a.ch}</span><div style="min-width:0"><div class="an">${a.name}</div><div class="ad">${a.desc}</div>
        <div class="aw">${a.who.map(id => por(id, 'xs')).join('')}${a.who.length === 1 ? `<span class="fg" style="align-self:center;margin-left:3px">${esc(pname(a.who[0]))}</span>` : ''}</div></div></div>`).join('')}</div></div>`;
}

/* ---------- results as one long image ---------- */
const loadScript = src => new Promise((ok, fail) => {
  if (window.html2canvas) return ok();
  const el = document.createElement('script');
  el.src = src; el.onload = ok; el.onerror = () => fail(new Error('截图组件加载失败'));
  document.head.appendChild(el);
});
// Renders the results tab (without buttons, inputs and notes) under a header naming the room and date.
async function saveImage() {
  ui.saving = true; render();
  try {
    await loadScript('vendor/html2canvas.min.js');
    const canvas = await window.html2canvas($('#shot'), {
      scale: Math.max(2, window.devicePixelRatio || 1), backgroundColor: '#efe6cf',
      onclone: doc => {
        const c = doc.getElementById('shot');
        c.style.cssText = 'margin:0 -14px;padding:18px 14px 14px';   // grow outward so the content keeps its on-screen width
        c.insertAdjacentHTML('afterbegin', `<div style="text-align:center;padding-bottom:6px"><div style="font:900 22px var(--serif);color:var(--red);letter-spacing:4px">奥丁的盛宴</div>
          <div style="font:500 12px var(--sans);color:var(--ink2);margin-top:4px">终局结算 · 房间 ${code} · ${new Date().toLocaleDateString('zh-CN')}</div></div>`);
        c.insertAdjacentHTML('beforeend', `<div style="text-align:center;font:500 11px var(--sans);color:var(--ink2);margin-top:16px">奥丁的盛宴小助手 · ${location.host}</div>`);
      }
    });
    showImage(canvas.toDataURL('image/jpeg', 0.92));
  } catch (e) { toast('生成长图失败：' + e.message); }
  ui.saving = false; render();
}
function showImage(url) {
  const el = document.createElement('div');
  el.className = 'shotv';
  el.innerHTML = `<div class="sv-top"><span>长按图片保存到相册</span><a href="${url}" download="奥丁的盛宴结算-${code}.jpg">下载</a><button type="button">关闭</button></div><img src="${url}" alt="结算长图">`;
  el.querySelector('button').onclick = () => el.remove();
  document.body.appendChild(el);
}

/* ---------- start player draw (plays on every phone when someone draws) ---------- */
const BAG_SVG = `<svg viewBox="0 0 120 130" width="120" height="130" aria-hidden="true">
  <path d="M40 34C26 50 10 66 10 94c0 24 20 32 50 32s50-8 50-32c0-28-16-44-30-60z" fill="#7b5a36"/>
  <path d="M40 34C26 50 10 66 10 94c0 24 20 32 50 32" fill="none" stroke="#5c4127" stroke-width="3" stroke-dasharray="5 4"/>
  <path d="M42 30 32 8l14 9 6-13 8 12 8-12 6 13 14-9-10 22z" fill="#8c6a42"/><path d="M38 33h44l-3 8H41z" fill="#4e3620"/>
  <circle cx="60" cy="88" r="17" fill="none" stroke="#e6c97d" stroke-width="3"/>
  <path d="M60 76v24M60 76l8 7M60 84l8 7" fill="none" stroke="#e6c97d" stroke-width="3" stroke-linecap="round"/></svg>`;
const DRAW_START_MS = 1100, DRAW_STEP_MS = 650, DRAW_HOLD_MS = 1500;
function playDraw() {
  const order = turnOrder(S);
  document.getElementById('draw')?.remove();
  const el = document.createElement('div');
  el.id = 'draw'; el.className = 'draw';
  el.style.setProperty('--start', DRAW_START_MS + 'ms'); el.style.setProperty('--step', DRAW_STEP_MS + 'ms');
  el.innerHTML = `<div class="dr-box"><div class="dr-t">抽起始玩家</div>
    <div class="dr-slots">${order.map((id, i) => `<div class="dr-s${i === 0 ? ' first' : ''}" style="--d:${(order.length - 1) / 2 - i};--i:${i}">
      ${por(id)}<b>${i === 0 ? '起始' : i + 1}</b><i>${esc(pname(id))}</i></div>`).join('')}</div>
    <div class="dr-bag">${BAG_SVG}</div><div class="dr-skip">点击任意处跳过</div></div>`;
  el.addEventListener('click', () => el.remove());
  document.body.appendChild(el);
  const end = DRAW_START_MS + order.length * DRAW_STEP_MS + DRAW_HOLD_MS;
  setTimeout(() => el.classList.add('out'), end);
  setTimeout(() => el.remove(), end + 400);
}

/* ---------- keypad sheet ---------- */
function sheetView() {
  const s = ui.sheet, f = FIELD[s.key];
  return `<div class="mask" data-act="close"></div><div class="sheet">
    <h3>${esc(pname(s.id))} · ${f.neg ? '扣分 · ' : ''}${f.n}</h3><div class="hint">${f.hint}</div>
    <div class="disp"><div class="ex">${esc(exprText(s)) || '&nbsp;'}</div><div class="cur">= ${exprTotal(s)}</div></div>
    ${f.quick ? `<div class="quick">${f.quick.map(([n, v]) => `<button data-act="q" data-v="${v}">${n} <b>${v}</b></button>`).join('')}</div>` : ''}
    <div class="keys">
      <button data-act="k" data-k="7">7</button><button data-act="k" data-k="8">8</button><button data-act="k" data-k="9">9</button><button class="op" data-act="k" data-k="+">+</button>
      <button data-act="k" data-k="4">4</button><button data-act="k" data-k="5">5</button><button data-act="k" data-k="6">6</button><button class="op" data-act="k" data-k="-">−</button>
      <button data-act="k" data-k="1">1</button><button data-act="k" data-k="2">2</button><button data-act="k" data-k="3">3</button>
      <button class="ok" data-act="k" data-k="ok">完成</button>
      <button class="fn" data-act="k" data-k="clr">清空</button><button data-act="k" data-k="0">0</button><button class="fn" data-act="k" data-k="bs">⌫</button>
    </div></div>`;
}

// Calculator: committed signed terms, then the operator being typed (op) and its digits (cur).
const exprTotal = s => s.terms.reduce((a, b) => a + b, 0) + (s.cur ? (s.op === '-' ? -1 : 1) * Number(s.cur) : 0);
function exprText(s) {
  let out = s.terms.map((t, i) => (i === 0 ? (t < 0 ? '−' : '') : t < 0 ? ' − ' : ' + ') + Math.abs(t)).join('');
  if (s.cur || s.opShown) out += (s.terms.length ? (s.op === '-' ? ' − ' : ' + ') : s.op === '-' ? '−' : '') + s.cur;
  return out;
}

function keypad(k) {
  const s = ui.sheet, f = FIELD[s.key];
  const commit = () => { if (s.cur !== '') { s.terms.push((s.op === '-' ? -1 : 1) * Number(s.cur)); s.cur = ''; } };
  if (/^\d$/.test(k)) { if (s.cur.length < 3) s.cur = (s.cur === '0' ? '' : s.cur) + k; }
  else if (k === '+' || k === '-') { commit(); s.op = k; s.opShown = true; }
  else if (k === 'bs') {
    if (s.cur) s.cur = s.cur.slice(0, -1);
    else if (s.opShown) s.opShown = false;
    else if (s.terms.length) { const t = s.terms.pop(); s.cur = String(Math.abs(t)); s.op = t < 0 ? '-' : '+'; s.opShown = t < 0 || s.terms.length > 0; }
  }
  else if (k === 'clr') { s.terms = []; s.cur = ''; s.op = '+'; s.opShown = false; }
  else if (k.startsWith('q')) { commit(); s.terms.push(Number(k.slice(1))); s.op = '+'; s.opShown = false; }
  else if (k === 'ok') {
    const empty = !s.terms.length && s.cur === '';
    commit();
    const value = f.list ? s.terms : empty ? '' : String(s.terms.reduce((a, b) => a + b, 0));
    send({ t: 'score', id: s.id, key: s.key, value });
    ui.sheet = null;
  }
  render();
}

/* ---------- events ---------- */
async function createRoom() {
  ui.busy = true; ui.err = ''; render();
  try {
    const r = await fetch('/api/room', { method: 'POST' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || '创建失败');
    enterRoom(j.code);
  } catch (e) { ui.err = '创建房间失败：' + e.message; }
  ui.busy = false; render();
}
function enterRoom(c) {
  code = c; noRoom = false; S = null; ui.err = '';
  history.replaceState(null, '', '/?r=' + c);
  connect(); render();
}
function leave() {
  code = null; S = null; noRoom = false; if (ws) { ws.onclose = null; ws.close(); }
  history.replaceState(null, '', '/'); ui.rooms = null; render(); loadRooms();
}
async function share() {
  const url = `${location.origin}/?r=${code}`;
  const text = `奥丁的盛宴小助手｜跟着流程走，计分不费神\n邀请你加入《奥丁的盛宴》房间 ${code}，点开链接就能和大家同步流程与计分（无需下载）：`;
  if (navigator.share) { try { await navigator.share({ title: '奥丁的盛宴 · 房间 ' + code, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast('邀请已复制，发给朋友即可'); } catch { toast('房间码 ' + code); }
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]'); if (!t || t.disabled) return;
  const d = t.dataset;
  switch (d.act) {
    case 'create': createRoom(); break;
    case 'join': { const c = cleanCode($('#joinCode').value); if (c) enterRoom(c); else { ui.err = '请输入 4 位房间码'; render(); } break; }
    case 'rejoin': enterRoom(d.code); break;
    case 'leave': leave(); break;
    case 'share': share(); break;
    case 'n': send({ t: 'setN', n: +d.n }); break;
    case 'rounds': send({ t: 'rounds', rounds: +d.r }); break;
    case 'color': send({ t: 'player', i: +d.i, color: d.c }); break;
    case 'first': send({ t: 'first', id: d.id }); break;
    case 'move': flushAll(); send({ t: 'move', i: +d.i, j: +d.j }); break;
    case 'draw': flushAll(); send({ t: 'draw' }); break;
    case 'begin': flushAll(); send({ t: 'begin' }); break;
    case 'tab': ui.tab = d.tab; store.set('odin-tab', d.tab); render(); window.scrollTo(0, 0); break;
    case 'goto': ui.tab = d.tab; render(); window.scrollTo(0, 0); break;
    case 'all': ui.all = !ui.all; render(); break;
    case 'rn': ui.rn = !ui.rn; render(); break;
    case 'save': if (!ui.saving) saveImage(); break;
    case 'next': send({ t: 'next', round: S.round, phase: S.phase }); break;
    case 'pick': send({ t: 'pick', round: S.round, id: d.id }); break;
    case 'pass': send({ t: 'pass', round: S.round, id: d.id }); break;
    case 'opt': send({ t: 'opt', key: d.key, on: d.on === 'true' }); break;
    case 'undo': send({ t: 'undo' }); break;
    case 'reset': if (confirm('重新开局？本房间的流程和计分都会清空，所有人同步。')) send({ t: 'reset' }); break;
    case 'crown': send({ t: 'crown', id: S.crown === d.id ? null : d.id }); break;
    case 'cell': {
      const f = FIELD[d.key], v = (S.score[d.id] || {})[d.key];
      const n0 = f.list ? null : num(v, -999);
      ui.sheet = f.list
        ? { id: d.id, key: d.key, terms: [...(v || [])], cur: '', op: '+', opShown: (v || []).length > 0 }
        : { id: d.id, key: d.key, terms: [], cur: n0 ? String(Math.abs(n0)) : '', op: n0 < 0 ? '-' : '+', opShown: n0 < 0 };
      render(); break;
    }
    case 'k': keypad(d.k); break;
    case 'q': keypad('q' + d.v); break;
    case 'view': ui.view = d.v; render(); break;
    case 'me': store.set(meKey(), d.id); ui.view = 'me'; render(); window.scrollTo(0, 0); break;
    case 'close': ui.sheet = null; render(); break;
  }
});

document.addEventListener('input', e => {
  const el = e.target, d = el.dataset;
  if (d.name !== undefined) debounced(d.pk, () => send({ t: 'player', i: +d.name, name: el.value }));
});
document.addEventListener('focusout', e => { const k = e.target.dataset?.pk; if (k) pending.get(k)?.flush(); });
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && e.target.id === 'joinCode') document.querySelector('[data-act="join"]').click();
  if (e.key === 'Enter' && e.target.dataset?.pk) e.target.blur();
});

render();
connect();
loadRooms();

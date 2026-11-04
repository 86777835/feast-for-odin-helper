// Game rules shared by the room server (Durable Object) and the page.
// A Feast for Odin rulebook (Z-Man English edition; Chinese terms from the Game Harbor Chinese edition): 7 rounds (long game) or 6 (short game), 12 phases per round.

export const COLOR_ORDER = ['red', 'blue', 'yellow', 'black'];
export const COLOR_ZH = { red: '红色', blue: '蓝色', yellow: '黄色', black: '黑色' };

// The 12 phases of a round (rulebook p.8–11). `when(round, rounds, n)` says whether it happens this round.
const last = (r, R) => r === R;
export const EXPLORE_ROUNDS = { 7: [3, 4, 5, 6], 6: [2, 3, 4, 5] };   // phase 3: turn one exploration board each
export const EXPLORE_TURNS = ['设得兰群岛 → 熊岛', '法罗群岛 → 巴芬岛', '冰岛 → 拉布拉多半岛', '格陵兰岛 → 纽芬兰岛'];
export const PHASES = [
  { k: 1, n: '增加维京人', when: () => true },
  { k: 2, n: '收获', when: () => true },
  { k: 3, n: '翻转探索版图', when: (r, R) => EXPLORE_ROUNDS[R].includes(r) },
  { k: 4, n: '抽取武器卡', when: () => true },
  { k: 5, n: '行动', when: () => true },
  { k: 6, n: '决定起始玩家', when: (r, R, n) => n > 1 && !last(r, R) },
  { k: 7, n: '收入', when: () => true },
  { k: 8, n: '动物繁殖', when: () => true },
  { k: 9, n: '宴会', when: () => true },
  { k: 10, n: '奖励', when: (r, R) => !last(r, R) },
  { k: 11, n: '山脉板块', when: (r, R) => !last(r, R) },
  { k: 12, n: '取回维京人', when: (r, R) => !last(r, R) }
];
export const activePhases = (r, R, n) => PHASES.filter(p => p.when(r, R, n)).map(p => p.k);

// Score fields. List fields hold one value per item (ship, board, card…); `neg` fields are points lost, entered as a positive number.
export const LIST_KEYS = ['ship', 'emig', 'expl', 'house', 'animal', 'job'];
export const NUM_KEYS = ['silver', 'income', 'mHome', 'mExpl', 'mHouse', 'thing'];
export const NEG_KEYS = ['mHome', 'mExpl', 'mHouse'];
export const THING_PTS = 3;    // each Thing Penalty (庭之惩罚): −3
export const CROWN_PTS = 2;    // English Crown special tile: +2

export function initialState() {
  return {
    v: 0, stage: 'setup', n: 4, rounds: 7,
    players: COLOR_ORDER.map(c => ({ id: c, name: '' })),
    start: 'red', round: 1, phase: 1, picked: 0, firsts: [], back: [],
    nor: false, passOrder: false, order: [], passed: [], nextOrder: [],   // Norwegians expansion; pass-order turn order variant
    score: {}, crown: null
  };
}

// Whole number ≥ min (≤ 9999); empty counts as 0; anything else is null.
export function num(v, min = 0) {
  if (v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= 9999 ? n : null;
}

const clone = o => JSON.parse(JSON.stringify(o));
export const seated = S => S.players.slice(0, S.n);
// Clockwise from the start player: the order in which players place Vikings.
const clockwise = S => { const s = seated(S), i = Math.max(0, s.findIndex(p => p.id === S.start)); return [...s.slice(i), ...s.slice(0, i)].map(p => p.id); };
// With the pass-order variant (expansion designer's rule, official in The Danes) the order is kept explicitly:
// the start player first, then the others in reverse order of passing.
export const usesPassOrder = S => S.passOrder && S.n >= 3;
export const turnOrder = S => usesPassOrder(S) && S.stage !== 'setup' && S.order?.length === S.n ? S.order : clockwise(S);
// Phase 6 happens this round and the variant is on: passes must be recorded in phase 5.
export const recordsPasses = S => usesPassOrder(S) && activePhases(S.round, S.rounds, S.n).includes(6);
const cleanText = (v, max) => String(v ?? '').replace(/[\u0000-\u001f]/g, '').slice(0, max);
const BACK_MAX = 40;   // undo steps kept
const flow = S => ({ stage: S.stage, round: S.round, phase: S.phase, start: S.start, picked: S.picked, firsts: S.firsts,
  order: S.order, passed: S.passed, nextOrder: S.nextOrder });

// Applies one action. Returns the new state, or null when the action is invalid or stale.
export function reduce(s, a) {
  if (!a || typeof a !== 'object') return null;
  const S = clone(s);
  const done = () => { S.v = s.v + 1; return S; };
  const ids = () => seated(S).map(p => p.id);

  switch (a.t) {
    case 'setN':
      if (S.stage !== 'setup' || ![1, 2, 3, 4].includes(a.n)) return null;
      S.n = a.n;
      if (!ids().includes(S.start)) S.start = S.players[0].id;
      return done();

    case 'rounds':
      if (S.stage !== 'setup' || ![6, 7].includes(a.rounds)) return null;
      S.rounds = a.rounds; return done();

    case 'player': {
      const p = S.players[a.i]; if (!p || a.i >= S.n) return null;
      if (S.stage !== 'setup' && a.color !== undefined) return null;   // after the start only names can change
      if (a.name !== undefined) p.name = cleanText(a.name, 12).trim();
      if (a.color !== undefined) {
        const other = S.players.find(o => o.id === a.color);
        if (!other || (other !== p && S.players.indexOf(other) < S.n)) return null;
        if (S.start === p.id) S.start = a.color;
        other.id = p.id; p.id = a.color;
      }
      return done();
    }

    case 'opt':     // setup: Norwegians expansion on/off, pass-order variant on/off
      if (S.stage !== 'setup' || !['nor', 'passOrder'].includes(a.key) || typeof a.on !== 'boolean') return null;
      S[a.key] = a.on; return done();

    case 'move': {
      const { i, j } = a;
      if (S.stage !== 'setup' || ![i, j].every(k => Number.isInteger(k) && k >= 0 && k < S.n)) return null;
      [S.players[i], S.players[j]] = [S.players[j], S.players[i]];
      return done();
    }

    case 'first':   // setup: choose the start player by hand
      if (S.stage !== 'setup' || !ids().includes(a.id)) return null;
      S.start = a.id; return done();

    case 'draw':    // setup: random start player (rulebook p.8); every phone plays the draw
      if (S.stage !== 'setup' || S.n < 2) return null;
      S.start = ids()[Math.floor(Math.random() * S.n)];
      S.draw = (s.draw || 0) + 1;
      return done();

    case 'begin':
      if (S.stage !== 'setup') return null;
      Object.assign(S, { stage: 'play', gid: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),   // names this game in the archive
        round: 1, phase: 1, picked: 0, firsts: [S.start], back: [], score: {}, crown: null, passed: [], nextOrder: [] });
      S.order = clockwise(S);   // round 1: clockwise from the random start player
      return done();

    case 'next': {
      // round/phase guard: a stale phone (or a double tap) cannot skip a phase.
      if (S.stage !== 'play' || a.round !== S.round || a.phase !== S.phase) return null;
      if (S.phase === 6 && S.picked !== S.round) return null;   // say who becomes start player first
      if (S.phase === 5 && recordsPasses(S) && S.passed.length !== S.n) return null;   // record every pass first
      S.back = [...S.back.slice(1 - BACK_MAX), flow(s)];
      if (S.phase === 5 && recordsPasses(S)) {   // the last to pass placed Vikings last: start player; the rest in reverse pass order
        S.start = S.passed.at(-1); S.picked = S.round; S.nextOrder = S.passed.slice().reverse();
      }
      const act = activePhases(S.round, S.rounds, S.n);
      const after = act.find(k => k > S.phase);
      if (after) { S.phase = after; return done(); }
      if (S.round === S.rounds) { S.stage = 'over'; return done(); }
      S.round += 1; S.phase = activePhases(S.round, S.rounds, S.n)[0];
      S.firsts = [...S.firsts, S.start];
      S.order = usesPassOrder(S) ? S.nextOrder : clockwise(S); S.passed = []; S.nextOrder = [];
      return done();
    }

    case 'pass':    // pass-order variant, phase 5: this player has passed (stopped placing Vikings)
      if (S.stage !== 'play' || S.phase !== 5 || a.round !== S.round || !recordsPasses(S) || !ids().includes(a.id) || S.passed.includes(a.id)) return null;
      S.back = [...S.back.slice(1 - BACK_MAX), flow(s)];
      S.passed = [...S.passed, a.id];
      return done();

    case 'pick':    // phase 6: the player who placed Vikings last becomes start player
      if (S.stage !== 'play' || S.phase !== 6 || a.round !== S.round || !ids().includes(a.id) || usesPassOrder(S)) return null;
      if (S.picked !== S.round) S.back = [...S.back.slice(1 - BACK_MAX), flow(s)];
      S.start = a.id; S.picked = S.round;
      return done();

    case 'undo': {
      if (!S.back.length) return null;
      Object.assign(S, S.back.pop());   // flow only: scores stay
      return done();
    }

    case 'score': {
      if (S.stage === 'setup' || !ids().includes(a.id) || ![...LIST_KEYS, ...NUM_KEYS].includes(a.key)) return null;
      let v = a.value;
      if (LIST_KEYS.includes(a.key)) {
        if (!Array.isArray(v) || v.length > 60 || !v.every(x => Number.isInteger(x) && x >= -99 && x <= 99)) return null;
      } else v = cleanText(v, 6);
      (S.score[a.id] ||= {})[a.key] = v;
      return done();
    }

    case 'crown':   // only one English Crown: giving it to someone takes it from everyone else
      if (S.stage === 'setup' || (a.id !== null && !ids().includes(a.id))) return null;
      S.crown = a.id; return done();

    case 'reset':
      Object.assign(S, { stage: 'setup', round: 1, phase: 1, picked: 0, firsts: [], back: [], score: {}, crown: null, order: [], passed: [], nextOrder: [] });
      return done();
  }
  return null;
}

/* ---------- scoring ---------- */
const sum = a => (a || []).reduce((x, y) => x + y, 0);

// One player's score parts, or null if a number field is invalid.
export function parts(S, id) {
  const d = S.score[id] || {};
  const n = {};
  for (const k of NUM_KEYS) { n[k] = num(d[k]); if (n[k] === null) return null; }
  const p = {
    ship: sum(d.ship), emig: sum(d.emig), expl: sum(d.expl), house: sum(d.house), animal: sum(d.animal), job: sum(d.job),
    silver: n.silver, income: n.income, crown: S.crown === id ? CROWN_PTS : 0,
    minus: n.mHome + n.mExpl + n.mHouse + n.thing * THING_PTS, thing: n.thing,
    ships: (d.ship || []).length + (d.emig || []).length, boards: (d.expl || []).length
  };
  p.total = p.ship + p.emig + p.expl + p.house + p.animal + p.job + p.silver + p.income + p.crown - p.minus;
  return p;
}

// Final standings (ties share the place: the rulebook declares multiple winners), score groups and achievements.
export function results(S) {
  const rows = [];
  for (const id of turnOrder(S)) {
    const p = parts(S, id);
    if (!p) return { error: true };
    rows.push({ id, ...p, sea: p.ship + p.emig, land: p.expl, build: p.house, herd: p.animal, wealth: p.silver + p.income + p.crown,
      firsts: S.firsts.filter(x => x === id).length });
  }
  const sorted = rows.slice().sort((a, b) => b.total - a.total);
  sorted.forEach((r, i) => { const p = sorted[i - 1]; r.place = p && p.total === r.total ? p.place : i + 1; });

  const best = (val, opts = {}) => {
    const vs = rows.map(val);
    const max = Math.max(...vs);
    if (!(max > (opts.min ?? 0)) || (rows.length > 1 && vs.every(v => v === max))) return [];
    return rows.filter((r, i) => vs[i] === max).map(r => r.id);
  };
  const played = S.firsts.length > 0 && S.n > 1;
  const ach = [
    { k: 'mvp', ch: '冠', name: '奥丁座上宾', desc: '最终排名第一', who: sorted.filter(r => r.place === 1).map(r => r.id) },
    { k: 'sea', ch: '船', name: '海上霸主', desc: '船只与移民得分最高', who: best(r => r.sea) },
    { k: 'land', ch: '岛', name: '远方探险家', desc: '探索版图得分最高', who: best(r => r.land) },
    { k: 'build', ch: '屋', name: '筑屋能手', desc: '工棚和房屋得分最高', who: best(r => r.build) },
    { k: 'herd', ch: '牧', name: '牛羊满圈', desc: '羊和牛得分最高', who: best(r => r.herd) },
    { k: 'job', ch: '职', name: '百业精通', desc: '职业卡牌得分最高', who: best(r => r.job) },
    { k: 'wealth', ch: '银', name: '富甲一方', desc: '银币、最终收入与王冠合计最高', who: best(r => r.wealth) },
    { k: 'tidy', ch: '净', name: '寸土不空', desc: '扣分最少', who: best(r => -r.minus, { min: -Infinity }) },
    { k: 'first', ch: '先', name: '先手专业户', desc: '当起始玩家的轮数最多', who: played ? best(r => r.firsts) : [] },
    { k: 'crown', ch: '冕', name: '王冠在手', desc: '持有英格兰王冠', who: S.crown && rows.some(r => r.id === S.crown) ? [S.crown] : [] }
  ].filter(a => a.who.length);
  return { rows: sorted, ach };
}

// What the archive keeps for a finished game: standings and score groups. Null while a score field is invalid.
export function gameRecord(S) {
  const R = results(S);
  if (R.error) return null;
  return {
    gid: S.gid, rounds: S.rounds, nor: !!S.nor,
    players: R.rows.map(r => {
      const p = S.players.find(x => x.id === r.id);
      return { id: r.id, name: p.name, place: r.place, total: r.total, sea: r.sea, land: r.land, build: r.build, herd: r.herd, job: r.job, wealth: r.wealth, minus: r.minus };
    })
  };
}

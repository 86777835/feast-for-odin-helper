import { DurableObject } from 'cloudflare:workers';
import { initialState, reduce, gameRecord, COLOR_ZH } from '../public/logic.js';
import GUIDE from '../tools/讲解稿.md';
import FAQ from '../tools/faq.json';
import CARDS from '../public/cards.json';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const newCode = () => Array.from({ length: 4 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === '/api/room' && req.method === 'POST') {
      for (let i = 0; i < 6; i++) {
        const code = newCode();
        const res = await env.ROOM.get(env.ROOM.idFromName(code)).fetch('https://room/init', { method: 'POST', body: code });
        if (res.ok) return Response.json({ code });
      }
      return Response.json({ error: '暂时无法创建房间，请重试' }, { status: 503 });
    }

    if (url.pathname === '/api/chat' && req.method === 'POST') return chat(req, env);
    if (url.pathname === '/api/chat-log' && req.method === 'POST') {   // a reply the page lost mid-way (see chat.js)
      console.log('chat client error', (await req.text()).slice(0, 300), req.headers.get('user-agent')?.slice(-60), req.cf?.colo);
      return new Response(null, { status: 204 });
    }
    if (url.pathname === '/api/rooms' && req.method === 'GET') return lobby(env).fetch('https://lobby/list');
    if (url.pathname === '/api/games' && req.method === 'GET') return archive(env).fetch('https://archive/list' + url.search);
    if (url.pathname === '/api/stats' && req.method === 'GET') return archive(env).fetch('https://archive/stats' + url.search);

    const m = url.pathname.match(/^\/api\/room\/([A-Z0-9]{4})\/ws$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('需要 WebSocket 连接', { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName(m[1])).fetch(req);
    }

    return new Response('Not found', { status: 404 });
  },

  async scheduled(event, env) { await checkDeepSeek(env); }
};

// Rules assistant: answers from the tutorial script and FAQ (both written from the official rulebook) via DeepSeek.
// Tried in order. The next one answers when the one before is overloaded, queueing, erroring, unreachable or stalls mid-answer;
// the log records which one answered (also sent to the page as an x-chat-fallback header or a reset event mid-stream).
// The Cloudflare model runs on Workers AI (free plan), so it still works when DeepSeek's own servers are overloaded.
const CHAT_MODELS = [
  { id: 'deepseek-flash', name: 'DeepSeek V4.1 Flash' },
  { id: '@cf/qwen/qwen3.8-27b', name: 'Qwen3.8 27B (Cloudflare)' },
  { id: 'deepseek-v4-pro', name: 'DeepSeek V4 Pro' }
];
const FIRST_DATA_MS = 9000;   // three models × 9 s stays under the page's 30 s wait
const STALL_MS = 8000;        // an answer that pauses this long mid-way is dropped and asked again of the next model
// Hourly check (cron): when DeepSeek doesn't answer, Qwen goes first until the next check.
const DEEPSEEK_DOWN = 'deepseek-down';   // KV key; expires on its own a little after the next hourly check
const ORDER = { normal: [0, 1, 2], deepseekDown: [1, 0, 2] };   // indexes into CHAT_MODELS

async function checkDeepSeek(env) {
  const fails = [];
  const o = await openModel(0, env, [{ role: 'user', content: '你好' }], fails);
  if (o) {
    o.reader.cancel().catch(() => {});
    await env.CHAT_STATE.delete(DEEPSEEK_DOWN);
    console.log('deepseek check: ok');
  } else {
    await env.CHAT_STATE.put(DEEPSEEK_DOWN, JSON.stringify({ at: new Date().toISOString(), fails }), { expirationTtl: 3900 });
    console.log('deepseek check: down, Qwen first for the next hour', fails.join('/'));
  }
}
const CHAT_SYSTEM = `你是「奥丁规则助手」，帮玩家解答桌游《奥丁的盛宴》（A Feast for Odin）的规则问题，也可以解释本网站「奥丁的盛宴小助手」怎么用。

回答要求：
- 只依据下面的「讲解稿」和「常见问题」作答，它们整理自官方规则书，术语采用中文版用词（部落版图、庭之广场、庭之惩罚、工棚、铁矿等）。资料里没有的内容，直接说资料里没有、建议翻规则书或附录，或问桌上的老玩家，不要编造规则。
- 单张职业卡：只依据末尾「本次问题可能涉及的职业卡」一节（来自本站「职业卡速查」）。玩家说的卡名可能和本站译名不完全一样（比如说「牛奶工」，本站有「挤奶工」和「送奶工」），就把列出的候选都简单说明，请玩家对照卡号确认。如果没有这一节，或者里面没有玩家问的那张卡，就回答「本站职业卡速查里没认出这张卡，可以告诉我卡号（印在卡的右下角，比如 39C），或者看卡面和附录」，到此为止，绝不自己猜测或编造卡的效果。
- 你不能联网搜索，被要求联网时说明只能依据本站资料。
- 与本游戏无关的问题，礼貌说明你只解答《奥丁的盛宴》的规则。
- 用简体中文，简短直接：先给结论，再补一两句理由或例子。可以用短列表，不要用表格和标题。

本网站怎么用：一桌人进同一个房间，手机实时同步。开局选人数（1–4 人）、标准模式 7 轮或快速模式 6 轮、是否用挪威扩展、是否用停手顺序轮序（3 人以上），再填名字、选颜色，按顺时针排座位，可以随机抽起始玩家。「流程」页按 12 个阶段逐步提示每一轮该做什么：在「决定起始玩家」阶段点选最后放维京人的玩家；开了停手顺序轮序时，在行动阶段按先后点停手的人，下一轮顺序自动排好；点错可以撤销。「计分」页有「我的计分」（每人选好自己是谁，只填自己的分数，有快捷按钮，填了不可能的分值会提醒）和「全桌总览」（整张表，可以替没手机的人代填）。「结算」页显示排名、得分构成和成就，同分并列获胜，可以改玩家名、保存结算长图。「往期对局」可以搜索，还有按人数和局长统计的成绩参照。

# 讲解稿
${GUIDE}

# 常见问题
${FAQ.map(f => `【${f.cat}】问：${f.q}\n答：${f.a}`).join('\n\n')}`;

// Single occupation cards: the cards a question names (by number like "39C", or by Chinese / English name, allowing a
// one-character difference such as 牛奶工 → 挤奶工 / 送奶工) go into that request's prompt, not the whole list.
const CARD_TYPE = { immediate: '立即生效（黄）', anytime: '随时可用（蓝）', each: '每次触发（红）', assoon: '一旦满足时触发一次（绿）' };
const cardNum = c => parseInt(c.no, 10);
function commonRun(a, b) {   // length of the longest common substring
  let best = 0;
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
    let k = 0; while (a[i + k] && a[i + k] === b[j + k]) k++;
    if (k > best) best = k;
  }
  return best;
}
function cardsFor(text) {
  const q = text.replace(/\s+/g, ''), lq = q.toLowerCase(), score = new Map();
  const hit = (c, v) => score.set(c, Math.max(score.get(c) || 0, v));
  // numbers count only with a deck letter (39C) or a word saying it is a card number, so "第 4 列" is not card 4
  for (const m of q.matchAll(/(\d{1,3})([abcABC])(?![a-zA-Z])/g)) for (const c of CARDS) if (cardNum(c) === +m[1] && c.deck.toLowerCase() === m[2].toLowerCase()) hit(c, 10);
  for (const m of q.matchAll(/(?:卡号|编号|#|No\.?)(\d{1,3})|(\d{1,3})号卡/gi)) for (const c of CARDS) if (cardNum(c) === +(m[1] || m[2])) hit(c, 10);
  for (const c of CARDS) {
    if (c.zh && q.includes(c.zh)) hit(c, 9);
    else if (c.zh && c.zh.length >= 3) { const r = commonRun(q, c.zh); if (r >= 2 && r >= c.zh.length - 1) hit(c, 4 + r); }
    if (c.en.length >= 4 && lq.includes(c.en.toLowerCase().replace(/\s+/g, ''))) hit(c, 9);
  }
  return [...score].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([c]) => c);
}
const cardSection = cards => !cards.length ? '' : `

# 本次问题可能涉及的职业卡（摘自本站「职业卡速查」，要点是本站的概括，不是卡面原文）
按卡名自动匹配，可能不相关：玩家问的是一般规则时忽略这一节，不要提这些卡。
${cards.map(c => `- ${c.no}「${c.zh}」${c.en}：${c.deck} 组${c.start ? '起始卡' : ''}，${CARD_TYPE[c.type] || ''}，终局 ${c.pts} 分。要点：${c.gist}${c.note ? ` 说明：${c.note}` : ''}${c.banned ? ' 〔官方禁用名单（迷你扩展 2，适用于挪威扩展）〕' : ''}`).join('\n')}`;

async function chat(req, env) {
  if (!env.DEEPSEEK_API_KEY) return Response.json({ error: '规则助手还没有配置好，请稍后再试' }, { status: 503 });
  const { success } = await env.CHAT_LIMIT.limit({ key: req.headers.get('cf-connecting-ip') || 'local' });
  if (!success) return Response.json({ error: '问得有点快，请过一分钟再问' }, { status: 429 });
  let msgs;
  try { msgs = (await req.json()).messages; } catch { msgs = null; }
  const valid = Array.isArray(msgs) && msgs.length > 0 && msgs.length <= 20 && msgs.at(-1).role === 'user' && msgs.at(-1).content?.length <= 500
    && msgs.every(m => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string' && m.content.trim() && m.content.length <= 3000);
  if (!valid) return Response.json({ error: '问题格式不对，请刷新页面再试' }, { status: 400 });
  console.log('chat question', JSON.stringify(msgs.at(-1).content));   // what players ask, for the usage brief
  const cards = cardsFor(msgs.filter(m => m.role === 'user').slice(-2).map(m => m.content).join('\n'));
  if (cards.length) console.log('chat cards', cards.map(c => c.no).join(','));
  const messages = [{ role: 'system', content: CHAT_SYSTEM + cardSection(cards) }, ...msgs.slice(-10).map(m => ({ role: m.role, content: m.content }))];
  const fails = [];   // HTTP status, 0 = unreachable or error, 'queue' = no answer started in time or stalled
  const order = await env.CHAT_STATE.get(DEEPSEEK_DOWN) ? ORDER.deepseekDown : ORDER.normal;
  let cur = await firstAnswer(order, 0, env, messages, fails);
  if (!cur) return Response.json({ error: chatFailed(fails) }, { status: 502 });
  const enc = new TextEncoder(), dec = new TextDecoder();
  const event = o => enc.encode(`data: ${JSON.stringify(o)}\n\n`);
  let lastData = Date.now();
  const body = new ReadableStream({
    start(c) { cur.head.forEach(v => c.enqueue(v)); },
    async pull(c) {
      // Keep-alive comments don't count as progress: only data lines do.
      let timer, r;
      const stall = new Promise(ok => { timer = setTimeout(() => ok('stall'), Math.max(0, lastData + STALL_MS - Date.now())); });
      try { r = await Promise.race([cur.reader.read(), stall]); } catch (e) { r = 'broken'; console.log('chat model broke mid-answer', CHAT_MODELS[cur.i].id, String(e).slice(0, 200)); }
      clearTimeout(timer);
      if (r === 'stall' || r === 'broken') {
        if (r === 'stall') console.log(`chat model stalled ${STALL_MS / 1000}s mid-answer`, CHAT_MODELS[cur.i].id);
        fails.push(r === 'stall' ? 'queue' : 0);
        cur.reader.cancel().catch(() => {});
        const next = await firstAnswer(order, cur.k + 1, env, messages, fails);
        if (!next) { c.enqueue(event({ error: chatFailed(fails) })); return c.close(); }
        cur = next; lastData = Date.now();
        c.enqueue(event({ reset: CHAT_MODELS[cur.i].name }));   // the page drops the partial answer and starts over
        cur.head.forEach(v => c.enqueue(v));
        return;
      }
      if (r.done) return c.close();
      if (dec.decode(r.value, { stream: true }).includes('data:')) lastData = Date.now();
      c.enqueue(r.value);
    },
    cancel() { cur.reader.cancel().catch(() => {}); }
  });
  const h = { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache' };
  if (cur.i) h['x-chat-fallback'] = CHAT_MODELS[cur.i].name;
  return new Response(body, { headers: h });
}

const chatFailed = fails => fails.some(f => f === 503 || f === 429 || f === 'queue')   // overloaded / throttled / queueing
  ? 'AI 服务器都在忙，请过一两分钟再问' : `规则助手暂时不可用（${fails.join('/')}），请稍后再试`;

// The first model from position `from` in `order` that starts answering:
// { k: position, i: index into CHAT_MODELS, reader, head (chunks read so far) }, or null.
async function firstAnswer(order, from, env, messages, fails) {
  for (let k = from; k < order.length; k++) {
    const i = order[k], o = await openModel(i, env, messages, fails);
    if (o) { if (i) console.log('chat fallback answered', CHAT_MODELS[i].id); return { k, i, ...o }; }
  }
  return null;
}

// Starts model i and waits up to FIRST_DATA_MS for its first data line. An overloaded DeepSeek may accept the request
// and then only send keep-alive comments while it waits in a queue. On failure, logs it, adds to `fails`, returns null.
async function openModel(i, env, messages, fails) {
  const { id } = CHAT_MODELS[i];
  const model = id.startsWith('@cf/') ? env.CHAT_CF_MODEL || id : id;   // CHAT_CF_MODEL: set only by the local tests
  const base = env.DEEPSEEK_BASE || 'https://api.deepseek.com';         // DEEPSEEK_BASE: set only by the local tests
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), FIRST_DATA_MS);
  const late = new Promise((_, no) => ctl.signal.addEventListener('abort', () => no(new Error('timeout'))));
  let reader;
  try {
    let stream;
    if (model.startsWith('@cf/')) {
      stream = await Promise.race([env.AI.run(model, { messages, stream: true, max_tokens: 900, temperature: 0.3, chat_template_kwargs: { enable_thinking: false } }), late]);
    } else {
      const r = await fetch(`${base}/chat/completions`, {
        method: 'POST', signal: ctl.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${env.DEEPSEEK_API_KEY}` },
        body: JSON.stringify({ model, stream: true, thinking: { type: 'disabled' }, max_tokens: 900, temperature: 0.3, messages })
      });
      if (!r.ok) { clearTimeout(timer); fails.push(r.status); console.log('chat model error', model, r.status, (await r.text()).slice(0, 500)); return null; }
      stream = r.body;
    }
    reader = stream.getReader();
    const dec = new TextDecoder(), head = [];
    let seen = '';
    while (!seen.includes('data:')) {
      const { done, value } = await Promise.race([reader.read(), late]);
      if (done) break;
      head.push(value); seen += dec.decode(value, { stream: true });
    }
    clearTimeout(timer);
    if (!seen.includes('data:')) { fails.push(502); console.log('chat model empty reply', model); return null; }
    return { reader, head };
  } catch (e) {
    clearTimeout(timer); reader?.cancel().catch(() => {});
    const queued = ctl.signal.aborted;
    fails.push(queued ? 'queue' : 0);
    console.log('chat model', queued ? `queued over ${FIRST_DATA_MS / 1000}s` : 'failed', model, String(e).slice(0, 300));
    return null;
  }
}

const lobby = env => env.LOBBY.get(env.LOBBY.idFromName('lobby'));
const archive = env => env.ARCHIVE.get(env.ARCHIVE.idFromName('archive'));
const LIST_SETUP_IDLE_MS = 30 * 60 * 1000;        // a room whose game hasn't started stays listed this long after everyone leaves
const LIST_GAME_IDLE_MS = 7 * 24 * 3600 * 1000;   // a started or finished game stays listed this long after its last activity

// Lobby: one Durable Object holding a short summary of every recently active room.
export class Lobby extends DurableObject {
  async fetch(req) {
    const rooms = (await this.ctx.storage.get('rooms')) || {};
    const now = Date.now();
    if (req.method === 'POST') { const r = await req.json(); rooms[r.code] = { ...r, updated: now }; }
    for (const [c, r] of Object.entries(rooms)) {
      if (now - r.updated > LIST_GAME_IDLE_MS || (r.stage === 'setup' && r.online === 0 && now - r.updated > LIST_SETUP_IDLE_MS)) delete rooms[c];
    }
    await this.ctx.storage.put('rooms', rooms);
    if (req.method === 'POST') return new Response('ok');
    return Response.json(Object.values(rooms).sort((a, b) => b.online - a.online || b.updated - a.updated).slice(0, 30));
  }
}

// Archive: one Durable Object holding every finished game, keyed by game id (ids start with the start time, so key order = newest last).
export class Archive extends DurableObject {
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/put') {
      const r = await req.json(), key = 'g:' + r.gid;
      const old = await this.ctx.storage.get(key);
      await this.ctx.storage.put(key, { ...r, ended: old?.ended ?? Date.now() });
      return new Response('ok');
    }
    if (url.pathname === '/del') { await this.ctx.storage.delete('g:' + await req.text()); return new Response('ok'); }
    if (url.pathname === '/stats') return Response.json(await this.stats((url.searchParams.get('name') || '').trim().toLowerCase()));
    // list: newest first, optionally filtered by room code, player name or color name; searches the latest 1000 games
    const q = (url.searchParams.get('q') || '').trim().toLowerCase();
    const all = await this.ctx.storage.list({ prefix: 'g:', reverse: true, limit: 1000 });
    const out = [];
    for (const g of all.values()) {
      if (!q || g.code.toLowerCase() === q || g.players.some(p => p.name.toLowerCase().includes(q) || COLOR_ZH[p.id].includes(q))) out.push(g);
      if (out.length >= 50) break;
    }
    return Response.json(out);
  }

  // Score references per player count × game length over the latest 1000 games: average score, average winning score, best score;
  // with a player name, that player's own games, best and average too.
  async stats(name) {
    const all = await this.ctx.storage.list({ prefix: 'g:', reverse: true, limit: 1000 });
    const groups = {};
    const avg = a => a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null;
    for (const g of all.values()) {
      const k = `${g.players.length}-${g.rounds}-${!!g.nor}`;
      const G = groups[k] ||= { n: g.players.length, rounds: g.rounds, nor: !!g.nor, games: 0, all: [], wins: [], best: null, mine: [] };
      G.games++;
      for (const p of g.players) {
        G.all.push(p.total);
        if (p.place === 1) G.wins.push(p.total);
        if (!G.best || p.total > G.best.total) G.best = { total: p.total, name: p.name, id: p.id, ended: g.ended };
        if (name && p.name.toLowerCase() === name) G.mine.push(p.total);
      }
    }
    return Object.values(groups).sort((a, b) => a.n - b.n || b.rounds - a.rounds || a.nor - b.nor).map(G => ({
      n: G.n, rounds: G.rounds, nor: G.nor, games: G.games, avg: avg(G.all), avgWin: avg(G.wins), best: G.best,
      me: name ? { games: G.mine.length, best: G.mine.length ? Math.max(...G.mine) : null, avg: avg(G.mine) } : null
    }));
  }
}

// One room = one Durable Object holding the shared game state.
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
    ctx.blockConcurrencyWhile(async () => {
      this.s = (await ctx.storage.get('s')) ?? null;
      this.code = (await ctx.storage.get('code')) ?? null;
    });
  }

  async fetch(req) {
    if (new URL(req.url).pathname === '/init') {
      if (this.s) return new Response('exists', { status: 409 });
      this.s = initialState();
      this.code = await req.text();
      await this.ctx.storage.put({ s: this.s, code: this.code });
      await this.report();
      return new Response('ok');
    }
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.send(JSON.stringify(this.s ? { type: 'state', state: this.view() } : { type: 'error', error: 'noroom' }));
    if (this.s) await this.report();
    return new Response(null, { status: 101, webSocket: client });
  }

  view() { return { ...this.s, prev: !!this.s.prev }; }

  async webSocketMessage(ws, msg) {
    if (!this.s || typeof msg !== 'string' || msg.length > 8000) return;
    let action; try { ({ action } = JSON.parse(msg)); } catch { return; }
    const next = reduce(this.s, action);
    if (!next) { ws.send(JSON.stringify({ type: 'state', state: this.view() })); return; }  // rejected: resync sender
    const before = this.s;
    this.s = next;
    await this.ctx.storage.put('s', next);
    const out = JSON.stringify({ type: 'state', state: this.view() });
    for (const w of this.ctx.getWebSockets()) { try { w.send(out); } catch {} }
    await this.record(before, action);
    await this.report();
  }

  async webSocketClose(ws, code) {
    try { ws.close(code, 'closed'); } catch {}
    if (this.s) await this.report(ws);
  }

  // Keep the archive in step with a finished game: update it on every change while the game is over,
  // and drop it when the final settle is undone. Games started before game ids existed are not archived.
  async record(before, action) {
    const s = this.s;
    if (s.stage === 'over' && s.gid) {
      const rec = gameRecord(s);
      if (rec) await archive(this.env).fetch('https://archive/put', { method: 'POST', body: JSON.stringify({ ...rec, code: this.code }) });
    } else if (before.stage === 'over' && action.t === 'undo' && before.gid) {
      await archive(this.env).fetch('https://archive/del', { method: 'POST', body: before.gid });
    }
  }

  // Tell the lobby who is here and how far the game is.
  async report(leaving) {
    if (!this.code) return;   // rooms made before the lobby existed
    const s = this.s;
    const online = this.ctx.getWebSockets().filter(w => w !== leaving && w.readyState === WebSocket.OPEN).length;
    const summary = { code: this.code, stage: s.stage, round: s.round, rounds: s.rounds, online,
      players: s.players.slice(0, s.n).map(p => ({ id: p.id, name: p.name })) };
    try { await lobby(this.env).fetch('https://lobby/update', { method: 'POST', body: JSON.stringify(summary) }); } catch {}
  }
}

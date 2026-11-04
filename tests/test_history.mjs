// Past-games archive + landing layout. Plays a 2-player short game over the room WebSocket, then checks
// /api/games and the history page, undo/redo/reset behavior, and that create/join stay on screen with many rooms.
// Usage: node tests/test_history.mjs <base-url> <shots-dir> [--many-rooms | --live]
// The full run leaves an archived game behind, so run it against a local `wrangler dev`.
// --live stops after the undo check, so the test game's record is removed again (safe on the live site).
import { chromium } from 'playwright-core';
const [base, out, flag] = process.argv.slice(2);
const many = flag === '--many-rooms', live = flag === '--live';
const api = p => new URL(p, base).href;
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const games = async q => (await fetch(api('/api/games' + (q ? '?q=' + encodeURIComponent(q) : '')))).json();

const { code } = await (await fetch(api('/api/room'), { method: 'POST' })).json();
const ws = new WebSocket(api(`/api/room/${code}/ws`).replace(/^http/, 'ws'));
let S = null; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'state') S = m.state; };
await new Promise(r => ws.onopen = r);
const send = async action => { const v = S?.v ?? -1; ws.send(JSON.stringify({ action })); for (let i = 0; i < 100 && !(S && S.v > v); i++) await wait(30); };
await wait(300);
const name = '测试' + code;
await send({ t: 'setN', n: 2 });
await send({ t: 'rounds', rounds: 6 });
await send({ t: 'player', i: 0, name });
await send({ t: 'player', i: 1, name: '对手' });
await send({ t: 'begin' });
eq('game id set at start', typeof S.gid, 'string');
let steps = 0;
while (S.stage === 'play' && steps < 100) {
  if (S.phase === 6 && S.picked !== S.round) await send({ t: 'pick', round: S.round, id: S.players[S.round % 2].id });
  await send({ t: 'next', round: S.round, phase: S.phase }); steps++;
}
eq('2-player short game: 6 rounds of phases', [S.stage, steps], ['over', 11 + 12 * 4 + 7]);
const [p1, p2] = S.players.slice(0, 2).map(p => p.id);
await send({ t: 'score', id: p1, key: 'ship', value: [8, 5] });
await send({ t: 'score', id: p1, key: 'silver', value: '20' });
await send({ t: 'score', id: p1, key: 'thing', value: '1' });
await send({ t: 'score', id: p2, key: 'job', value: [3, -1] });
await send({ t: 'score', id: p2, key: 'mHome', value: '5' });
let g;
for (let i = 0; i < 20 && !(g?.players[0].total === 30 && g?.players[1].total === -3); i++) { await wait(300); g = (await games(code))[0]; }   // archive write lands after the broadcast
eq('archived by room code', g?.code, code);
eq('winner first', [g?.players[0].name, g?.players[0].total, g?.players[0].place, g?.players[0].sea, g?.players[0].minus], [name, 30, 1, 13, 3]);
eq('runner-up', [g?.players[1].name, g?.players[1].total, g?.players[1].job], ['对手', -3, 2]);
eq('short game recorded', g?.rounds, 6);
eq('search by player name', (await games(name)).some(x => x.gid === g.gid), true);
eq('search by color', (await games({ red: '红', blue: '蓝', yellow: '黄', black: '黑' }[p2])).some(x => x.gid === g.gid), true);
eq('search miss', (await games('不存在的玩家xyz')).length, 0);
const stats = async name => (await fetch(api('/api/stats' + (name ? '?name=' + encodeURIComponent(name) : '')))).json();
{ const g2 = (await stats(name)).find(x => x.n === 2 && x.rounds === 6);
  eq('stats: 2-player short game group has this player', [g2?.games >= 1, g2?.me], [true, { games: 1, best: 30, avg: 30 }]); }

const b = await chromium.launch({ channel: 'chrome' });
const page = await (await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
await page.goto(base); await page.click('a[href="history"]'); await page.waitForSelector('.game');
await page.fill('#q', name); await page.click('#search button'); await wait(600);
eq('history page search shows 1 game', await page.$$eval('.game', x => x.length), 1);
eq('score references show this player', (await page.textContent('.st')).includes('最高 30'), true);
eq('summary winner score', await page.textContent('.game .gp .win em'), '30');
eq('summary says short game', (await page.textContent('.game .gh span')).includes('2 人快速局'), true);
await page.screenshot({ path: out + '/h_list.png' });
await page.click('.game summary'); await wait(200);
eq('details rows', await page.$$eval('.game .gd .row', x => x.length), 2);
await page.screenshot({ path: out + '/h_open.png' });

await send({ t: 'undo' }); await wait(400);
eq('undo the last phase removes record', (await games(code)).length, 0);
if (live) { await send({ t: 'reset' }); ws.close();   // back to setup so the room leaves the public list
  await b.close(); eq('no page errors', errs, []); console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0); }
await send({ t: 'next', round: S.round, phase: S.phase }); await wait(400);
eq('ending again restores record with scores', (await games(code))[0]?.players[0].total, 30);
await send({ t: 'reset' }); await wait(400);
eq('reset keeps record', (await games(code)).length, 1);
ws.close();

if (many) {
  for (let i = 0; i < 12; i++) { const r = await (await fetch(api('/api/room'), { method: 'POST' })).json(); const w = new WebSocket(api(`/api/room/${r.code}/ws`).replace(/^http/, 'ws')); await new Promise(res => w.onopen = res); }
  await wait(500);
}
await page.goto(base); await page.waitForSelector('.lobby'); await wait(300);
const box = async sel => (await page.$(sel)).boundingBox();
const bottom = Math.max(...await Promise.all(['[data-act="create"]', '[data-act="join"]', 'a[href="history"]'].map(async s => { const r = await box(s); return r.y + r.height; })));
eq('create/join/history on first screen', bottom <= 667, true);
console.log('rooms listed:', await page.$$eval('.lobby', x => x.length), 'lowest button bottom:', Math.round(bottom));
await page.screenshot({ path: out + '/h_landing.png' });
// occupation lookup
await page.goto(api('/cards')); await page.waitForSelector('.oc');
eq('all 190 cards loaded (80 shown first)', [await page.$$eval('.oc', c => c.length), (await page.textContent('.cards')).includes('还有 110 张')], [80, true]);
await page.fill('#q', '39'); await wait(200);
eq('number search finds 39C', await page.$$eval('.oc .no', c => c.map(x => x.textContent)), ['39C']);
await page.fill('#q', ''); await page.click('[data-f="banned"]'); await wait(200);
eq('8 cards banned with the Norwegians', await page.$$eval('.oc', c => c.length), 8);
await page.screenshot({ path: out + '/h_cards.png' });
eq('no page errors', errs, []);
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);

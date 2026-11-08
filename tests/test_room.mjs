// Two phones in one room play a full 3-player long game (7 rounds × 12 phases), then score it.
// Usage: node tests/test_room.mjs <baseUrl> <outDir>
import { chromium } from 'playwright-core';
const [,, BASE, OUT] = process.argv;
const b = await chromium.launch({ channel: 'chrome' });
const mk = async () => {
  const ctx = await b.newContext({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.errs = [];
  p.on('pageerror', e => p.errs.push(String(e))); p.on('console', m => m.type() === 'error' && p.errs.push(m.text()));
  return p;
};
const A = await mk(), B = await mk();
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shot = (p, n, full = false) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
const trackOrder = p => p.$$eval('.slot', s => s.map(x => x.dataset.k.replace('slot-', '')));
const statusText = p => p.textContent('.status .t');
const offPhases = p => p.$$eval('.phs:last-of-type .ph.off', l => l.map(x => +x.dataset.k.slice(3)));

await A.goto(BASE); await wait(600); await shot(A, '00_landing');
await A.click('[data-act="create"]');
await A.waitForURL(/\?r=[A-Z0-9]{4}/);
const url = A.url(); console.log('room', url);
await B.goto(url); await B.waitForSelector('.chip');

// setup sync
await A.click('[data-act="n"][data-n="3"]'); await wait(300);
eq('B sees 3 seats', await B.$$eval('[data-k^="seat-"]', r => r.length), 3);
eq('long game by default', await B.textContent('[data-act="rounds"].on'), '标准 7 轮');
await A.fill('[data-name="0"]', '阿斯'); await wait(700);
eq('B sees name', await B.inputValue('[data-name="0"]'), '阿斯');
await B.fill('[data-name="1"]', '芙蕾雅'); await B.fill('[data-name="2"]', '托尔'); await B.press('[data-name="2"]', 'Enter'); await wait(500);
await B.click('[data-act="color"][data-i="1"][data-c="black"]'); await wait(400);
eq('A sees seat 2 turned black', await A.getAttribute('[data-k="seat-1"] .por img', 'src'), 'img/black.jpg');
eq('A keeps own name', await A.inputValue('[data-name="0"]'), '阿斯');
await A.click('[data-act="first"][data-id="yellow"]'); await wait(400);
eq('B sees start player on seat 3', await B.textContent('[data-k="seat-2"] .fst'), '起始玩家');
eq('start player: link to the hub finger chooser', (await B.textContent('[data-act="order"]')).includes('手指轮盘'), true);
await shot(A, '01_setup', true);
await B.click('[data-act="begin"]'); await A.waitForSelector('.status');
eq('A status', await statusText(A), '第1/ 7 轮 · 增加维京人');
const seats = ['red', 'black', 'yellow'];
const start0 = (await trackOrder(A))[0];
const rot = id => { const i = seats.indexOf(id); return [...seats.slice(i), ...seats.slice(0, i)]; };
eq('track runs clockwise from the start player', await trackOrder(B), rot(start0));
eq('round 1 skips phase 3 only', await offPhases(A), [3]);
await shot(A, '02_round1');

// play every phase; phones alternate; at phase 6 the "last to place" player is picked
let picks = [], steps = 0;
for (let guard = 0; guard < 120; guard++) {
  const p = guard % 2 ? A : B, other = guard % 2 ? B : A;
  const st = await statusText(p);
  if (st === '游戏结束') break;
  const [, round, name] = st.match(/^第(\d+)\/ 7 轮 · (.+)$/);
  if (name === '决定起始玩家') {
    eq(`round ${round}: next waits for a pick`, await p.isDisabled('[data-act="next"]'), true);
    const who = seats[(+round) % 3];
    await p.click(`[data-act="pick"][data-id="${who}"]`); await wait(300);
    picks.push(who);
  }
  if (+round === 3 && name === '翻转探索版图') eq('round 3 turns Shetland', (await p.textContent('.ph.cur small')).trim(), '设得兰群岛 → 熊岛');
  if (+round === 7 && name === '增加维京人') { eq('last round skips 3, 6, 10–12', await offPhases(p), [3, 6, 10, 11, 12]); await shot(p, '03_last_round', true); }
  if (+round === 2 && name === '收获') {   // both phones tap at once: counted once
    const tap = q => q.evaluate(() => document.querySelector('[data-act="next"]').click());
    await Promise.all([tap(A), tap(B)]); await wait(400);
    eq('double tap advances one phase', await statusText(other), '第2/ 7 轮 · 抽取武器卡');
    steps++; continue;
  }
  const before = await statusText(other);
  await p.click('[data-act="next"]'); steps++;
  for (let i = 0; i < 20 && (await statusText(other)) === before; i++) await wait(100);
  if (name === '取回维京人') eq(`round ${+round + 1} starts with ${picks.at(-1)}`, (await trackOrder(other))[0], picks.at(-1));
}
eq('77 phases in a 3-player long game', steps, 77);
for (let i = 0; i < 20 && (await statusText(B)) !== '游戏结束'; i++) await wait(100);
eq('game over on B', await statusText(B), '游戏结束');
await shot(B, '04_over');

// scoring with the keypad: A fills red, B fills black and yellow
const keyIn = async (p, id, key, seq) => {
  await p.click(`[data-act="cell"][data-id="${id}"][data-key="${key}"]`);
  for (const k of seq) await p.click(k[0] === 'q' ? `[data-act="q"][data-v="${k.slice(1)}"]` : `[data-act="k"][data-k="${k}"]`);
  await wait(250);
};
// A scores only itself (red) in "my scoring"; B fills the other two columns in the full table
await A.click('[data-act="tab"][data-tab="score"]'); await B.click('[data-act="tab"][data-tab="score"]');
eq('A asked who it is', (await A.textContent('h2.h')).includes('你是哪位玩家'), true);
await A.click('[data-act="me"][data-id="red"]'); await B.click('[data-act="view"][data-v="all"]'); await wait(200);
eq('my scoring shows only red', await A.$$eval('[data-act="cell"]', c => [...new Set(c.map(x => x.dataset.id))]), ['red']);
await keyIn(A, 'red', 'ship', ['q3', 'q5', 'q8', 'ok']);                // 16 via quick-add buttons
eq('quick-add terms', (await A.textContent('[data-k="ms-ship"] .ms-ex')).trim(), '3 + 5 + 8');
await keyIn(A, 'red', 'animal', ['5', 'ok']);
eq('impossible animal value flagged', (await A.textContent('[data-k="ms-animal"] .ms-w')).includes('只能是 2、3、4'), true);
await keyIn(A, 'red', 'animal', ['clr', 'ok']);
eq('flag gone after fixing', await A.$('[data-k="ms-animal"] .ms-w'), null);
await keyIn(A, 'red', 'expl', ['1', '6', 'ok']);                         // 16
await keyIn(A, 'red', 'house', ['1', '7', 'ok']);                        // 17
await keyIn(A, 'red', 'job', ['2', '+', '3', '-', '1', 'ok']);           // 4
await keyIn(A, 'red', 'silver', ['1', '2', 'ok']);                       // 12
await keyIn(A, 'red', 'mHome', ['4', 'ok']);                             // −4
await keyIn(A, 'red', 'thing', ['1', 'ok']);                             // −3   → 58
await A.click('[data-act="cell"][data-id="red"][data-key="ship"]'); await wait(200); await shot(A, '05_keypad'); await A.click('[data-act="k"][data-k="ok"]');
await keyIn(B, 'black', 'emig', ['2', '1', '+', '1', '8', 'ok']);        // 39
await keyIn(B, 'black', 'animal', ['2', '+', '3', '+', '4', 'ok']);     // 9
await keyIn(B, 'black', 'income', ['5', 'ok']);                         // 5
await keyIn(B, 'black', 'mExpl', ['6', 'ok']);                          // −6   → 47
await B.click('[data-act="crown"][data-id="black"]'); await wait(300);  // +2   → 49
await keyIn(B, 'yellow', 'ship', ['8', '+', '8', 'ok']);                  // 16
await keyIn(B, 'yellow', 'house', ['1', '0', '+', '8', 'ok']);            // 18
await keyIn(B, 'yellow', 'silver', ['2', '0', 'ok']);                     // 20
await keyIn(B, 'yellow', 'mHouse', ['2', 'ok']);                          // −2   → 52
await B.click('[data-act="crown"][data-id="yellow"]'); await wait(300);  // crown moves: black 47, yellow 54
await wait(300);
await keyIn(B, 'yellow', 'income', ['4', 'ok']); eq('final income reminder in the full table', (await B.textContent('.note')).includes('没有领成银币'), true);
await keyIn(B, 'yellow', 'income', ['clr', 'ok']);
eq('my total shown on A', (await A.textContent('.ms-tot b')).trim(), '58');
await A.click('[data-act="view"][data-v="all"]'); await wait(200);
const rowTotals = async p => Object.fromEntries(await p.$$eval('td.tt', ts => ts.map(t => [t.dataset.tt, t.textContent])));
eq('totals same on both phones', await rowTotals(A), await rowTotals(B));
{ const t = await rowTotals(B); eq('totals', [t.red, t.black, t.yellow], ['58', '47', '54']); }
eq('crown held by one player only', await A.$$eval('.cell.crown', c => c.map(x => x.dataset.id)), ['yellow']);
eq('negative shown with minus', (await A.textContent('[data-act="cell"][data-id="red"][data-key="mHome"]')).trim(), '−4');
await shot(B, '06_score', true);

await B.click('[data-act="tab"][data-tab="mvp"]'); await A.click('[data-act="tab"][data-tab="mvp"]'); await wait(400);
eq('MVP is 阿斯 (red)', (await B.textContent('.mvp .nm')).trim(), '阿斯');
eq('ranking totals', await B.$$eval('.rk .row', rs => rs.map(r => r.querySelector('.tot').textContent)), ['58', '54', '47']);
const achs = await B.$$eval('.ach .an', a => a.map(x => x.textContent));
console.log('achievements', achs.join(' / '));
eq('sea lord is black (39 vs 16/16)', await B.$$eval('[data-k="ach-sea"] .fg', f => f.map(x => x.textContent)), ['芙蕾雅']);
eq('crown achievement', achs.includes('王冠在手'), true);
await shot(B, '07_mvp', true);

// reconnect keeps state
await A.reload(); await A.waitForSelector('.status'); await wait(300);
eq('A after reload still over', await statusText(A), '游戏结束');
eq('A after reload mvp', (await A.textContent('.mvp .nm')).trim(), '阿斯');

console.log(fails ? `${fails} FAILED` : 'ALL PASS', [...A.errs, ...B.errs].length ? '\nERRORS:\n' + [...A.errs, ...B.errs].join('\n') : '');
await b.close();

// Extra checks: 4 players, small screens, join by code, bad room, undo, offline, invalid score, tie, rename, long image, reset,
// plus a solo game and a short game. Usage: node tests/test_room2.mjs <baseUrl> <outDir>
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [,, BASE, OUT] = process.argv;
const b = await chromium.launch({ channel: 'chrome' });
const mk = async (w, h) => {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage(); p.ctx = ctx; p.errs = []; p.h = h;
  p.on('pageerror', e => p.errs.push(String(e))); p.on('console', m => m.type() === 'error' && p.errs.push(m.text()));
  p.on('dialog', d => d.accept());
  return p;
};
const A = await mk(375, 667), B = await mk(390, 760), C = await mk(360, 740);   // iPhone SE, iPhone, Android
let fails = 0; const issues = [];
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) { fails++; issues.push(name); } console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };
const wait = ms => new Promise(r => setTimeout(r, ms));
const shot = (p, n, full = false) => p.screenshot({ path: `${OUT}/${n}.png`, fullPage: full });
const status = p => p.textContent('.status .t');
const fitsScreen = async (p, sel) => { const bx = await p.locator(sel).first().boundingBox(); return bx ? Math.round(bx.y + bx.height) : -1; };
const until = async (p, want) => { for (let i = 0; i < 30 && (await status(p)) !== want; i++) await wait(100); return status(p); };
// One phase forward from phone p (picks the first listed player at phase 6); waits until phone q shows it.
const step = async (p, q = p) => {
  const before = await status(q);
  if (await p.isDisabled('[data-act="next"]')) { await p.click('[data-act="pick"]'); await wait(300); }
  await p.click('[data-act="next"]');
  for (let i = 0; i < 30 && (await status(q)) === before; i++) await wait(100);
};

// bad room code
await A.goto(BASE); await A.fill('#joinCode', 'zzzz'); await A.click('[data-act="join"]'); await wait(1500);
eq('unknown room message', (await A.textContent('h2.h')).includes('不存在'), true);
await A.click('[data-act="leave"]'); await wait(300);
eq('back to landing', await A.isVisible('[data-act="create"]'), true);

// create + join by code + join by link + join from the lobby list
await A.click('[data-act="create"]'); await A.waitForURL(/\?r=/);
const code = new URL(A.url()).searchParams.get('r'); console.log('room', code);
await C.goto(BASE); await C.fill('#joinCode', code.toLowerCase()); await C.press('#joinCode', 'Enter'); await C.waitForSelector('.chip');
await B.goto(A.url()); await B.waitForSelector('.chip');
const D = await mk(390, 760); await D.goto(BASE); await D.waitForSelector(`[data-code="${code}"]`, { timeout: 15000 });
eq('lobby lists the room with players online', (await D.textContent(`[data-code="${code}"]`)).includes('在线'), true);
await D.click(`[data-code="${code}"]`); await D.waitForSelector('.chip');
eq('D joined from list', new URL(D.url()).searchParams.get('r'), code);
await D.ctx.close();
eq('C joined by typed code', new URL(C.url()).searchParams.get('r'), code);

// 3 players: seat 1 takes the unused black; the start player marker goes with the seat
await A.click('[data-act="n"][data-n="3"]'); await wait(400);
eq('seat 1 starts by default', await B.textContent('[data-k="seat-0"] .fst'), '起始玩家');
await C.click('[data-act="color"][data-i="0"][data-c="black"]'); await wait(500);
eq('seat 1 is black on A', await A.getAttribute('[data-k="seat-0"] .por img', 'src'), 'img/black.jpg');
eq('start player stays on seat 1', await A.textContent('[data-k="seat-0"] .fst'), '起始玩家');
await A.click('[data-act="n"][data-n="4"]'); await wait(400);
eq('4 seats on C', await C.$$eval('[data-k^="seat-"]', r => r.length), 4);
eq('red freed for seat 4', await C.getAttribute('[data-k="seat-3"] .por img', 'src'), 'img/red.jpg');
const names = ['老张', '小李', '阿美', '大刘'];
for (let i = 0; i < 4; i++) await [A, B, C, A][i].fill(`[data-name="${i}"]`, names[i]);
await A.press('[data-name="3"]', 'Enter'); await wait(900);
eq('names synced to B', await Promise.all([0, 1, 2, 3].map(i => B.inputValue(`[data-name="${i}"]`))), names);
await B.click('[data-act="first"][data-id="yellow"]'); await wait(400);
await shot(A, '01_setup4_se');
await C.click('[data-act="begin"]'); await A.waitForSelector('.status'); await wait(400);
const order = await A.$$eval('.slot', s => s.map(x => x.dataset.k.slice(5)));
eq('order starts at yellow, clockwise', order, ['yellow', 'red', 'black', 'blue']);

// one-screen checks
const bottomA = await fitsScreen(A, '[data-act="next"]');
console.log('SE 375x667: next button bottom at', bottomA, '(screen 667)');
eq('SE: next button visible without scrolling', bottomA <= 667, true);
eq('Android 360x740: next visible', (await fitsScreen(C, '[data-act="next"]')) <= 740, true);
await shot(A, '02_round1_se'); await shot(C, '02_round1_android');

// undo several steps, including a start-player pick
for (let i = 0; i < 4; i++) await step([A, B, C][i % 3], A);
eq('at phase 6', await status(B), '第1/ 7 轮 · 决定起始玩家');
await shot(A, '02b_pick_se');
eq('SE: pick buttons and next on screen', (await fitsScreen(A, '[data-act="next"]')) <= 667, true);
await B.click('[data-act="pick"][data-id="blue"]'); await wait(400);
eq('pick shown on A', await A.getAttribute('[data-act="pick"][data-id="blue"]', 'class'), 'on');
await C.click('[data-act="undo"]'); await wait(400);
eq('undo clears the pick', [await status(A), await A.isDisabled('[data-act="next"]'), await A.$$eval('.pick .on', x => x.length)], ['第1/ 7 轮 · 决定起始玩家', true, 0]);
await A.click('[data-act="undo"]'); await wait(300); await A.click('[data-act="undo"]'); await wait(400);
eq('two more undos', await status(C), '第1/ 7 轮 · 抽取武器卡');
await step(A); await step(B, A);
await B.click('[data-act="pick"][data-id="black"]'); await wait(300); await step(B, A);
eq('picked player starts next round later', await status(A), '第1/ 7 轮 · 收入');

// offline phone catches up after reconnecting
await C.ctx.setOffline(true); await wait(500);
await step(A); await step(A);
await C.ctx.setOffline(false);
eq('offline phone caught up after reconnect', await until(C, '第1/ 7 轮 · 宴会'), '第1/ 7 轮 · 宴会');

// play to the end
for (let i = 0; ; i++) {
  const st = await status(A);
  if (st === '游戏结束') break;
  if (st === '第2/ 7 轮 · 增加维京人') eq('round 2 starts with black', (await A.$$eval('.slot', s => s.map(x => x.dataset.k.slice(5))))[0], 'black');
  if (st === '第7/ 7 轮 · 宴会') { const bt = await fitsScreen(A, '[data-act="next"]'); eq('SE: last-round button on screen', bt <= 667, true); eq('last button label', (await A.textContent('[data-act="next"]')).trim(), '宴会结束，进入终局计分'); await shot(A, '03_last_se'); }
  await step([A, B, C][i % 3], A);
}
eq('game over', await until(C, '游戏结束'), '游戏结束');

// scores: an invalid (negative) penalty is flagged, then two players tie at the top
const fillCell = async (p, id, key, digits) => {
  await p.click(`[data-act="cell"][data-id="${id}"][data-key="${key}"]`);
  for (const k of [...digits, 'ok']) await p.click(`[data-act="k"][data-k="${k}"]`);
  await wait(250);
};
await B.click('[data-act="tab"][data-tab="score"]'); await B.click('[data-act="view"][data-v="all"]');
await B.click('[data-act="cell"][data-id="red"][data-key="ship"]');
await B.click('[data-act="k"][data-k="3"]'); await B.click('[data-act="k"][data-k="+"]');
eq('plus shows right away', (await B.textContent('.disp .ex')).trim(), '3 +');
for (const k of ['8', '-', '5']) await B.click(`[data-act="k"][data-k="${k}"]`);
eq('expression with minus', (await B.textContent('.disp .ex')).trim(), '3 + 8 − 5');
eq('expression total', (await B.textContent('.disp .cur')).trim(), '= 6');
await shot(B, '03b_keypad');
await B.click('[data-act="k"][data-k="clr"]'); await B.click('[data-act="k"][data-k="ok"]'); await wait(300);
await fillCell(B, 'red', 'mHome', ['-', '5']);
eq('negative penalty flagged', (await B.getAttribute('[data-act="cell"][data-id="red"][data-key="mHome"]', 'class')).includes('bad'), true);
await A.click('[data-act="tab"][data-tab="mvp"]'); await wait(400);
eq('results ask to fix the score', (await A.textContent('.note')).includes('无效数字'), true);
await fillCell(B, 'red', 'mHome', ['clr', '5']);
await fillCell(B, 'red', 'expl', ['2', '6', '+', '1', '2']);      // 38 − 5 = 33
await fillCell(B, 'black', 'house', ['1', '7', '+', '1', '0']);  // 27
await fillCell(B, 'black', 'silver', ['6']);                     // 33
await fillCell(B, 'blue', 'animal', ['2', '+', '2']);             // 4
eq('totals in seat order from black', await B.$$eval('td.tt', t => t.map(x => x.textContent)), ['33', '4', '0', '33']);
await shot(B, '04_score_se_like');
await wait(300);
eq('tie shows joint first', (await A.textContent('.mvp .crown')).replace(/\s/g, ''), '并列第一');
eq('both names on the MVP card', (await A.textContent('.mvp .nm')).trim(), '老张 · 大刘');
eq('tie places', await A.$$eval('.rk .stepn', s => s.map(x => x.textContent)), ['1', '1', '3', '4']);
await shot(A, '05_mvp_tie_se');

// names can still change on the results tab (synced and archived); the results save as one long image
await C.click('[data-act="tab"][data-tab="mvp"]'); await wait(300);
await C.click('[data-act="rn"]'); await wait(200);
const rnSel = `[data-k="rn"] [data-name="${await C.getAttribute('[data-k="rn"] input', 'data-name')}"]`;
const oldName = await C.inputValue(rnSel);
await C.fill(rnSel, '改名王'); await C.press(rnSel, 'Enter'); await wait(1200);
eq('rename after the game shows on A', (await A.textContent('.rk')).includes('改名王'), true);
eq('rename reaches the archive', (await (await fetch(new URL('/api/games?q=' + encodeURIComponent('改名王'), BASE))).json()).length > 0, true);
await C.click('[data-act="save"]'); await C.waitForSelector('.shotv img', { timeout: 20000 });
const dim = await C.$eval('.shotv img', i => [i.naturalWidth, i.naturalHeight]);
console.log('long image', dim.join('x'));
eq('long image is tall', dim[1] > dim[0] * 1.5, true);
writeFileSync(`${OUT}/07_long.jpg`, Buffer.from((await C.$eval('.shotv img', i => i.src)).split(',')[1], 'base64'));
await shot(C, '07_save_view');
await C.click('.shotv button');
eq('image view closes', await C.$('.shotv'), null);
await C.fill(rnSel, oldName); await C.press(rnSel, 'Enter'); await wait(1200);

// reset returns everyone to setup with names kept
await B.click('[data-act="tab"][data-tab="flow"]'); await B.click('[data-act="reset"]'); await wait(900);
eq('reset: A back to setup', await A.isVisible('[data-act="begin"]'), true);
eq('reset keeps names', await C.inputValue('[data-name="0"]'), names[0]);

// short game: 6 rounds, exploration boards turn from round 2
await A.click('[data-act="rounds"][data-r="6"]'); await wait(300);
await A.click('[data-act="begin"]'); await A.waitForSelector('.status'); await wait(300);
eq('short game status', await status(B), '第1/ 6 轮 · 增加维京人');
await A.click('[data-act="tab"][data-tab="flow"]');
while ((await status(A)) !== '第2/ 6 轮 · 翻转探索版图') await step(A);
eq('short game: round 2 turns Shetland', (await A.textContent('.ph.cur small')).trim(), '设得兰群岛 → 熊岛');
await B.click('[data-act="reset"]'); await wait(600);

// solo game: no start player draw, phase 6 skipped, solo notes shown
await A.click('[data-act="n"][data-n="1"]'); await wait(300);
await A.click('[data-act="rounds"][data-r="7"]'); await wait(300);
eq('solo: no draw button', await A.$('[data-act="draw"]'), null);
await A.click('[data-act="begin"]'); await A.waitForSelector('.status'); await wait(300);
eq('solo track title', await A.textContent('.track .t'), '单人游戏');
eq('solo skips 3 and 6 in round 1', await A.$$eval('.phs:last-of-type .ph.off', l => l.map(x => +x.dataset.k.slice(3))), [3, 6]);
while ((await status(A)) !== '第1/ 7 轮 · 取回维京人') await step(A);
eq('solo phase 12 note', (await A.textContent('.ph.cur .phb')).includes('等待区'), true);
await shot(A, '08_solo_se');
await A.click('[data-act="reset"]'); await wait(400);

// Norwegians + pass-order variant (4 players): passes recorded in phase 5 set next round's order
const seatIds = ['black', 'blue', 'yellow', 'red'];   // seats set up earlier in this test
await A.click('[data-act="n"][data-n="4"]'); await A.click('[data-act="rounds"][data-r="7"]'); await wait(300);
await A.click('[data-act="opt"][data-key="nor"]'); await B.click('[data-act="opt"][data-key="passOrder"]'); await wait(400);
eq('both options on, seen on C', await C.$$eval('[data-act="opt"].on', b => b.map(x => x.dataset.key)), ['nor', 'passOrder']);
await shot(A, '09_options_se', true);
await A.click('[data-act="begin"]'); await A.waitForSelector('.status'); await wait(300);
await A.click('[data-act="tab"][data-tab="flow"]'); await B.click('[data-act="tab"][data-tab="flow"]');
const ord1 = await A.$$eval('.slot', s => s.map(x => x.dataset.k.slice(5)));
while ((await status(A)) !== '第1/ 7 轮 · 行动') await step(A);
eq('next waits for all passes', await A.isDisabled('[data-act="next"]'), true);
const passes = [ord1[2], ord1[0], ord1[3], ord1[1]];
for (const [i, id] of passes.entries()) { await [A, B][i % 2].click(`[data-act="pass"][data-id="${id}"]`); await wait(300); }
eq('pass numbers shown on B', (await B.textContent('.pick')).includes('第 4 个停手'), true);
await shot(A, '10_passes_se', true);
await step(B, A);
eq('phase 6 needs no pick', [await status(A), await A.isDisabled('[data-act="next"]')], ['第1/ 7 轮 · 决定起始玩家', false]);
eq('next order shown = reverse pass order', await A.$$eval('.pick button > span:last-child', s => s.map(x => x.textContent.replace(/^\d+\. /, ''))), passes.slice().reverse().map(id => names[seatIds.indexOf(id)]));
while ((await status(A)) !== '第1/ 7 轮 · 动物繁殖') await step(A);
eq('Norwegians breeding mentions pigs', (await A.textContent('.ph.cur .phb')).includes('猪'), true);
while ((await status(A)) !== '第2/ 7 轮 · 增加维京人') await step(A);
eq('round 2 order = reverse pass order', await A.$$eval('.slot', s => s.map(x => x.dataset.k.slice(5))), passes.slice().reverse());
await A.click('[data-act="undo"]'); await wait(400);
eq('undo returns to round 1', (await status(A)).startsWith('第1/ 7 轮'), true);
await A.click('[data-act="tab"][data-tab="score"]'); await A.click('[data-act="view"][data-v="all"]'); await wait(200);
eq('animal row renamed', (await A.textContent('[data-k="sr-animal"] th')).trim(), '动物');
await A.click(`[data-act="cell"][data-id="${passes[0]}"][data-key="animal"]`);
eq('horse and pig buttons', await A.$$eval('.quick button', b => b.map(x => x.textContent.trim())), ['羊 2', '怀孕羊 3', '牛 3', '怀孕牛 4', '马 6', '怀孕马 8', '猪 1']);
await A.click('[data-act="q"][data-v="8"]'); await A.click('[data-act="q"][data-v="1"]'); await A.click('[data-act="k"][data-k="ok"]'); await wait(300);
eq('horse + pig accepted without flag', await A.$$eval('.cell.warn', c => c.length), 0);
await A.click('[data-act="tab"][data-tab="flow"]'); await A.click('[data-act="reset"]'); await wait(500);

const errs = [A, B, C].flatMap(p => p.errs).filter(e => !/ERR_INTERNET_DISCONNECTED|WebSocket/.test(e));
console.log(fails ? `${fails} FAILED: ${issues.join('; ')}` : 'ALL PASS', errs.length ? '\nERRORS:\n' + errs.join('\n') : '');
await b.close();

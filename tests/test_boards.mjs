// Board guide: groups, boards, tappable spots and the effect sheet. Usage: node tests/test_boards.mjs <base-url> <shots-dir>
import { chromium } from 'playwright-core';
const [base, out] = process.argv.slice(2);
const api = p => new URL(p, base).href;
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const eq = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };
const data = await (await fetch(api('/boards/boards.json'))).json();
const b = await chromium.launch({ channel: 'chrome' });
const page = await (await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => m.type() === 'error' && errs.push(m.text()));
await page.goto(api('/')); await page.click('a[href="boards"]'); await page.waitForSelector('.bd-img img');
eq('four groups', await page.$$eval('#groups .chip', c => c.map(x => x.textContent)), ['行动版图', '探索版图', '部落版图', '房屋与工棚']);
eq('first board shown with all its spots', await page.$$eval('.bd-spot', s => s.length), data.boards[0].spots.length);
await page.screenshot({ path: out + '/boards_action.png' });
// tap the "移民和职业" area on the Norwegians 3-4 side: the discard-an-occupation space
await page.click('[data-id="nw-action-34"]'); await page.waitForSelector('.bd-img img');
const nw = data.boards.find(x => x.id === 'nw-action-34');
const i = nw.spots.findIndex(s => s.area === '移民和职业' && s.col === 1 && /2 银|2银/.test(s.text));
eq('found the discard space in the data', i >= 0, true);
await page.click(`.bd-spot[data-i="${i}"]`); await page.waitForSelector('.bd-sheet');
eq('sheet shows its effect', (await page.textContent('.bd-sheet')).includes('3'), true);
eq('url names the board', new URL(page.url()).hash, '#nw-action-34');
await page.screenshot({ path: out + '/boards_sheet.png' });
await page.click('.bd-sheet [data-close]'); eq('sheet closes', await page.$('.bd-sheet'), null);
for (const g of ['探索版图', '部落版图', '房屋与工棚']) {
  await page.click(`[data-g="${g}"]`); await page.waitForSelector('.bd-img img');
  const id = new URL(page.url()).hash.slice(1);
  eq(`${g}: spots match data`, await page.$$eval('.bd-spot', s => s.length), data.boards.find(x => x.id === id).spots.length);
}
await page.screenshot({ path: out + '/boards_house.png' });
// every image loads
for (const bd of data.boards) { const r = await fetch(api('/boards/' + bd.img)); if (!r.ok) { fails++; console.log('FAIL image', bd.img, r.status); } }
await page.goto(api('/boards#expl-bear-island')); await page.waitForSelector('.bd-img img');
eq('deep link opens Bear Island', (await page.textContent('#pick .chip.on')).includes('熊岛'), true);
await page.screenshot({ path: out + '/boards_expl.png' });
// bad network: the photo fails twice, then loads on the third try
let tries = 0;
await page.route('**/boards/expl-shetland.jpg*', r => (++tries <= 2 ? r.abort('failed') : r.continue()));
await page.goto(api('/boards#expl-shetland')); await page.waitForSelector('.bd-img img');
await page.waitForFunction(() => { const i = document.querySelector('.bd-img img'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
eq('photo loads after two failures', [tries, await page.$('.bd-load')], [3, null]);
eq('spots there while loading', await page.$$eval('.bd-spot', s => s.length) > 0, true);
// photo never loads: a clear retry button that is not hidden under the spots
await page.unroute('**/boards/expl-shetland.jpg*');
await page.route('**/boards/expl-faroe*.jpg*', r => r.abort('failed'));
await page.goto(api('/boards#expl-faroe-islands')); await page.waitForSelector('[data-reload]', { timeout: 15000 });
await page.screenshot({ path: out + '/boards_failed.png' });
await page.unroute('**/boards/expl-faroe*.jpg*');
await page.click('[data-reload]');
await page.waitForFunction(() => { const i = document.querySelector('.bd-img img'); return i.complete && i.naturalWidth > 0; }, null, { timeout: 15000 });
eq('retry button reloads the photo', await page.$('.bd-load'), null);
errs.splice(0, errs.length, ...errs.filter(e => !/Failed to load resource/.test(e)));   // the aborted requests above
eq('no page errors', errs, []);
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);

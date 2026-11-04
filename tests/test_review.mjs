// Rating card on the results tab. Plays a quick game on local `wrangler dev`, then rates it (hub endpoint mocked, nothing is posted for real).
// Usage: node tests/test_review.mjs <base-url> <shots-dir>
import { chromium } from 'playwright-core';
const [base, out] = process.argv.slice(2);
const api = p => new URL(p, base).href;
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const eq = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };

const { code } = await (await fetch(api('/api/room'), { method: 'POST' })).json();
const ws = new WebSocket(api(`/api/room/${code}/ws`).replace(/^http/, 'ws'));
let S = null; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'state') S = m.state; };
await new Promise(r => ws.onopen = r);
const send = async action => { const v = S?.v ?? -1; ws.send(JSON.stringify({ action })); for (let i = 0; i < 100 && !(S && S.v > v); i++) await wait(30); };
await wait(300);
await send({ t: 'setN', n: 2 }); await send({ t: 'rounds', rounds: 6 });
await send({ t: 'player', i: 0, name: '老张' }); await send({ t: 'player', i: 1, name: '小李' });
await send({ t: 'begin' });
while (S.stage === 'play') {
  if (S.phase === 6 && S.picked !== S.round) await send({ t: 'pick', round: S.round, id: S.players[0].id });
  await send({ t: 'next', round: S.round, phase: S.phase });
}
const [p1, p2] = S.players.slice(0, 2).map(p => p.id);
await send({ t: 'score', id: p1, key: 'silver', value: '20' }); await send({ t: 'score', id: p2, key: 'silver', value: '15' });

const b = await chromium.launch({ channel: 'chrome' });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const posted = [];
await page.route('https://boardgame.leisurecat.cloud/api/reviews', async r => {
  posted.push(JSON.parse(r.request().postData()));
  await r.fulfill({ json: { ok: true, avg: 4, count: 1 }, headers: { 'access-control-allow-origin': '*' } });
});
// this phone picked 小李 on the score tab: the card starts with 小李
await page.goto(api(`/?r=${code}`)); await page.evaluate(([c, id]) => localStorage.setItem('odin-me-' + c, id), [code, p2]);
await page.reload(); await page.waitForSelector('[data-act="tab"][data-tab="mvp"]');
await page.click('[data-act="tab"][data-tab="mvp"]'); await page.waitForSelector('.rv');
eq('"I am" filled from the score tab', await page.getAttribute('[data-act="rv-who"].on', 'data-id'), p2);
eq('send disabled until stars', await page.isDisabled('[data-act="rv-send"]'), true);
eq('card is outside the long image', await page.$('#shot .rv'), null);
await page.click(`[data-act="rv-who"][data-id="${p1}"]`);
await page.click('[data-act="rv-star"][data-n="4"]');
eq('4 stars lit', await page.$$eval('.rv-st button.on', l => l.length), 4);
eq('star label', await page.textContent('.rv-st span'), '好玩');
await page.fill('[data-rv]', '流程提示很省心');
await page.click('[data-act="rv-star"][data-n="5"]');   // a re-render must keep the typed text
eq('text kept across re-render', await page.inputValue('[data-rv]'), '流程提示很省心');
await page.screenshot({ path: out + '/review_form.png' });
await page.click('[data-act="rv-send"]'); await page.waitForSelector('.rv-done');
eq('posted to the hub', [posted.length, posted[0]?.game, posted[0]?.stars, posted[0]?.name, posted[0]?.text, posted[0]?.room], [1, 'odin', 5, '老张', '流程提示很省心', code]);
eq('thanks shown', (await page.textContent('.rv p')).includes('老张'), true);
eq('link to the hub', await page.getAttribute('.rv a.btn', 'href'), 'https://boardgame.leisurecat.cloud');
await page.reload(); await page.waitForSelector('[data-act="tab"]');
await page.click('[data-act="tab"][data-tab="mvp"]'); await page.waitForSelector('.rv');
eq('sent state remembered after reload', !!(await page.$('.rv-done')), true);
await page.click('[data-act="rv-edit"]');
eq('edit restores the form', [await page.$$eval('.rv-st button.on', l => l.length), await page.inputValue('[data-rv]')], [5, '流程提示很省心']);
// a hub error is shown in the card
await page.unroute('https://boardgame.leisurecat.cloud/api/reviews');
await page.route('https://boardgame.leisurecat.cloud/api/reviews', r => r.fulfill({ status: 429, json: { error: '提交太频繁，请稍后再试' }, headers: { 'access-control-allow-origin': '*' } }));
await page.click('[data-act="rv-send"]'); await page.waitForSelector('.rv .err');
eq('hub error shown', (await page.textContent('.rv .err')).trim(), '提交太频繁，请稍后再试');
await page.screenshot({ path: out + '/review_error.png' });
eq('no page errors', errs, []);
ws.close(); await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);

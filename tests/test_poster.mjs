// 「打印」 on the results tab: a 1200×1800 photo poster (3-inch pocket printer) with every player in finishing order.
// Plays a 2-player and a 4-player game on local `wrangler dev` (finished games go to the archive, so never run this
// against the live site); the hub's review endpoint is mocked. Saves both posters as <shots-dir>/poster_2p.jpg, poster_4p.jpg.
// Usage: node tests/test_poster.mjs <base-url> <shots-dir>
import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const [base, out] = process.argv.slice(2);
const api = p => new URL(p, base).href;
const wait = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const eq = (n, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', n, ok ? '' : `got ${JSON.stringify(g)} want ${JSON.stringify(w)}`); };

// plays a whole game over the room's WebSocket and fills in the scores
async function game(names, nor, scores) {
  const { code } = await (await fetch(api('/api/room'), { method: 'POST' })).json();
  const ws = new WebSocket(api(`/api/room/${code}/ws`).replace(/^http/, 'ws'));
  let S = null; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'state') S = m.state; };
  await new Promise(r => ws.onopen = r);
  const send = async action => { const v = S?.v ?? -1; ws.send(JSON.stringify({ action })); for (let i = 0; i < 100 && !(S && S.v > v); i++) await wait(30); };
  await wait(300);
  await send({ t: 'setN', n: names.length }); await send({ t: 'rounds', rounds: 7 });
  if (nor) await send({ t: 'opt', key: 'nor', on: true });
  for (const [i, n] of names.entries()) await send({ t: 'player', i, name: n });
  await send({ t: 'begin' });
  while (S.stage === 'play') {
    if (S.phase === 6 && S.picked !== S.round) await send({ t: 'pick', round: S.round, id: S.players[0].id });
    await send({ t: 'next', round: S.round, phase: S.phase });
  }
  for (const [i, sc] of scores.entries()) for (const [key, value] of Object.entries(sc)) await send({ t: 'score', id: S.players[i].id, key, value });
  ws.close();
  return { code, nor: !!S.nor };
}

const b = await chromium.launch({ channel: 'chrome' });
const errs = [];
async function poster(label, names, nor, scores, want) {
  const { code } = await game(names, nor, scores);
  const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route('https://boardgame.leisurecat.cloud/api/reviews**', r => r.fulfill({ json: { ok: true, reviews: [] }, headers: { 'access-control-allow-origin': '*' } }));
  await page.goto(api(`/?r=${code}`)); await page.waitForSelector('[data-act="tab"][data-tab="mvp"]');
  await page.click('[data-act="tab"][data-tab="mvp"]'); await page.waitForSelector('[data-act="poster"]');
  eq(`${label}: 「打印」 next to the long image`, await page.$$eval('.btns.sv .btn', l => l.map(x => x.textContent)), ['修改玩家名', '保存结算长图', '打印']);
  eq(`${label}: poster art not loaded before 「打印」`, await page.evaluate(() => performance.getEntriesByType('resource').some(e => e.name.includes('poster.jpg'))), false);
  await page.click('[data-act="poster"]');
  await page.waitForSelector('.shotv.poster img', { timeout: 30000 });
  const img = await page.$eval('.shotv.poster img', async i => { await i.decode(); return { w: i.naturalWidth, h: i.naturalHeight, src: i.src }; });
  eq(`${label}: poster is 1200×1800`, [img.w, img.h], [1200, 1800]);
  writeFileSync(`${out}/poster_${label}.jpg`, Buffer.from(img.src.split(',')[1], 'base64'));
  eq(`${label}: tip and file name`, [await page.textContent('.shotv.poster .sv-top span'), await page.getAttribute('.shotv.poster a', 'download')],
    ['长按保存到相册，用打印机 App 选 3 寸相纸打印', `奥丁的盛宴海报-${code}.jpg`]);
  const rows = await page.$$eval('#poster .pp-row', l => l.map(r => [r.querySelector('.pp-rk').textContent, r.querySelector('.pp-nm').textContent, parseInt(r.querySelector('.pp-tot').textContent)]));
  eq(`${label}: every player, in finishing order, with the total`, rows, want);
  eq(`${label}: game details`, (await page.$$eval('#poster .pp-s', l => l.map(x => x.textContent))).map(t => t.endsWith(`房间 ${code}`) || t), [`标准 7 轮${nor ? ' · 挪威扩展' : ''} · ${names.length} 人局`, true]);
  // print safety: everything that matters at least 30 CSS px (60 px printed) inside the edges, no text below the print minimum
  const fit = await page.$eval('#poster', p => {
    const box = p.getBoundingClientRect(), bad = [];
    for (const el of p.querySelectorAll('.pp-head,.pp-row,.pp-f')) {
      const r = el.getBoundingClientRect();
      if (r.left - box.left < 30 || box.right - r.right < 30 || r.top - box.top < 30 || box.bottom - r.bottom < 30) bad.push(el.className);
    }
    for (const el of p.querySelectorAll('.pp-row *, .pp-head *')) {
      if (!el.childNodes.length || ![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
      if (parseFloat(getComputedStyle(el).fontSize) < 20) bad.push(el.className || el.tagName + ':' + el.textContent);
    }
    for (const el of p.querySelectorAll('.pp-row, .pp-nm, .pp-pt')) if (el.scrollWidth > el.clientWidth + 1) bad.push('overflow ' + el.textContent.trim().slice(0, 12));
    // name, total and breakdown never overlap
    for (const r of p.querySelectorAll('.pp-row')) {
      const [nm, tot, pt] = ['.pp-nm', '.pp-tot', '.pp-pt'].map(s => r.querySelector(s).getBoundingClientRect());
      if (nm.right > tot.left + 1 || pt.top < tot.bottom - 12 && pt.right > tot.left) bad.push('overlap ' + r.textContent.trim().slice(0, 12));
    }
    return bad;
  });
  eq(`${label}: 60 px print margin, text at least 40 px, nothing overflows`, fit, []);
  await page.click('.shotv.poster button');
  eq(`${label}: closing removes the poster`, [await page.$('.shotv'), await page.$('#poster')], [null, null]);
  await page.close();
}

await poster('2p', ['阿斯特丽德', '比约恩'], false,
  [{ ship: [5, 8], emig: [18], expl: [12], house: [10], animal: [2, 3, 4], job: [3, 2], silver: '9', mHome: '4', thing: '1' },
   { ship: [8, 8], emig: [21, 18], expl: [16, 8], house: [17], animal: [3], job: [4], silver: '6', mHome: '2' }],
  [['冠', '比约恩', 107], ['2', '阿斯特丽德', 69]]);
await poster('4p', ['老张', '小李', '维京大王哈拉尔', '芙蕾雅'], true,
  [{ ship: [3, 5], emig: [18], expl: [10, 12], house: [8, 10], animal: [2, 2, 3, 6], job: [2, 3], silver: '12', mHome: '3', mExpl: '2', thing: '1' },
   { ship: [8], emig: [21], expl: [16], house: [17], animal: [4, 3], job: [1, -1, 3], silver: '7', mHome: '1' },
   { ship: [8, 8], emig: [21, 21], expl: [16, 12], house: [17], animal: [8, 6], job: [4], silver: '15', thing: '2' },
   { ship: [3], emig: [18], expl: [8], house: [10], animal: [2], job: [2], silver: '5', mHome: '6', thing: '3' }],
  [['冠', '维京大王哈拉尔', 130], ['2', '老张', 88], ['3', '小李', 78], ['4', '芙蕾雅', 33]]);
eq('no page errors', errs, []);
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);

// README screenshots: plays one 4-player game on a fresh local `wrangler dev` and captures each screen.
// Usage: node tools/screenshots.mjs http://localhost:8801/ docs/screenshots
// Run it against an empty local state only: the game it plays is archived.
// The chat shot asks one real question, so the dev server needs a working model (DeepSeek key or Workers AI).
import { chromium } from 'playwright-core';
import { writeFileSync, mkdirSync } from 'node:fs';
const [base, out] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const api = p => new URL(p, base).href;
const wait = ms => new Promise(r => setTimeout(r, ms));

const { code } = await (await fetch(api('/api/room'), { method: 'POST' })).json();
const ws = new WebSocket(api(`/api/room/${code}/ws`).replace(/^http/, 'ws'));
let S = null; ws.onmessage = e => { const m = JSON.parse(e.data); if (m.type === 'state') S = m.state; };
await new Promise(r => ws.onopen = r);
const send = async action => { const v = S?.v ?? -1; ws.send(JSON.stringify({ action })); for (let i = 0; i < 100 && !(S && S.v > v); i++) await wait(30); };
await wait(300);

const b = await chromium.launch({ channel: 'chrome' });
const page = await (await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const shot = n => page.screenshot({ path: `${out}/${n}.jpg`, type: 'jpeg', quality: 82 });

// setup
await send({ t: 'setN', n: 4 });
const names = ['老张', '小李', '阿美', '大刘'];
for (let i = 0; i < 4; i++) await send({ t: 'player', i, name: names[i] });
await page.goto(api(`/?r=${code}`)); await page.waitForSelector('[data-act="begin"]'); await wait(800);
await shot('setup');
await page.click('[data-act="draw"]'); await wait(4200);   // all four drawn
await shot('draw');
await wait(2000);
await send({ t: 'begin' });

// step to round 3's exploration phase, picking a start player each round
const step = async () => {
  if (S.phase === 6 && S.picked !== S.round) await send({ t: 'pick', round: S.round, id: S.players[S.round % 4].id });
  await send({ t: 'next', round: S.round, phase: S.phase });
};
while (!(S.round === 3 && S.phase === 3)) await step();
await page.click('[data-act="tab"][data-tab="flow"]'); await wait(600);
await shot('flow');
while (S.phase !== 6) await step();
await wait(600);
await shot('pick');
while (S.stage !== 'over') await step();

// scores
const sc = {
  red: { ship: [8, 5], emig: [21], expl: [26], house: [17, 10], animal: [3, 2, 2], job: [2, 1, 3], silver: 9, income: 0, mHome: 2, mExpl: 3, mHouse: 0, thing: 0 },
  blue: { ship: [3, 3, 3], emig: [], expl: [16, 12], house: [8], animal: [4, 3, 3, 2], job: [1, 2, -1], silver: 14, income: 0, mHome: 0, mExpl: 5, mHouse: 1, thing: 1 },
  yellow: { ship: [8, 8], emig: [18], expl: [38], house: [10], animal: [], job: [3, 2], silver: 6, income: 0, mHome: 4, mExpl: 6, mHouse: 0, thing: 0 },
  black: { ship: [5], emig: [21, 18], expl: [], house: [17], animal: [3, 2], job: [1, 1, 2, 2], silver: 11, income: 0, mHome: 6, mExpl: 0, mHouse: 2, thing: 0 }
};
for (const [id, d] of Object.entries(sc)) for (const [key, v] of Object.entries(d)) await send({ t: 'score', id, key, value: Array.isArray(v) ? v : String(v) });
await send({ t: 'crown', id: 'yellow' });
await wait(600);

await page.click('[data-act="tab"][data-tab="score"]'); await wait(600);
await shot('score');
await page.click('[data-act="tab"][data-tab="mvp"]'); await wait(800);
await shot('results');
await page.click('[data-act="save"]'); await page.waitForSelector('.shotv img', { timeout: 20000 });
writeFileSync(`${out}/long.jpg`, Buffer.from((await page.$eval('.shotv img', i => i.src)).split(',')[1], 'base64'));
await page.click('.shotv button');

await page.goto(api('/history')); await page.waitForSelector('.game'); await page.click('.game summary'); await wait(500);
await shot('history');
await page.goto(api('/guide')); await wait(1500);
await shot('guide');
await page.goto(api('/guide#faq')); await wait(1000);
await shot('faq');
await page.goto(api('/')); await page.waitForSelector('.lobby'); await wait(1000);
await shot('landing');
await page.click('.cfab'); await page.click('.csug button:nth-of-type(2)');
await page.waitForFunction(() => !document.querySelector('.cin button').disabled, null, { timeout: 60000 }); await wait(500);
await shot('chat');

ws.close(); await b.close();
console.log('room', code, 'done');

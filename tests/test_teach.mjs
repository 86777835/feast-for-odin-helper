// 3-minute teach page: entry on the landing page, every term opens its note, the 「问」 buttons ask the rules
// assistant that exact question, the icon guide, phone width. /api/chat is mocked, so this never asks a real model.
// Usage: node tests/test_teach.mjs <base-url> <shots-dir>   (safe against the live site too: it writes nothing)
import { chromium } from 'playwright-core';
const [base, out] = process.argv.slice(2);
let fails = 0;
const eq = (name, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want); if (!ok) fails++; console.log(ok ? 'PASS' : 'FAIL', name, ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`); };

const b = await chromium.launch({ channel: 'chrome' });
const page = await (await b.newContext({ viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })).newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message));
const asked = [];
await page.route('**/api/chat', async r => {
  const q = JSON.parse(r.request().postData()).messages.at(-1).content; asked.push(q);
  await r.fulfill({ contentType: 'text/event-stream', body: `data: ${JSON.stringify({ choices: [{ delta: { content: `答：${q}` } }] })}\n\ndata: [DONE]\n\n` });
});

await page.goto(base); await page.waitForSelector('.teachgo');
eq('landing shows the teach entry', (await page.textContent('.teachgo b')), '第一次玩？5 分钟讲规则');
await page.click('.teachgo'); await page.waitForSelector('.tpart');
eq('teach page opened', new URL(page.url()).pathname, '/teach');
eq('seven parts plus 遇到再说', await page.$$eval('.tpart h2', l => l.map(h => h.querySelector('span').textContent.replace(/^\S+?(?=[一-龥])/, ''))),
  ['怎么赢', '每一轮', '放维京人', '物品和摆放', '宴会和牛羊', '船、探索、移民', '结束和计分', '先别管，遇到再问']);
const read = await page.$$eval('.tline', l => l.map(p => p.textContent).join(''));
console.log(`  script: ${read.length} characters to read aloud`);
eq('script four to five minutes (under 1300 characters)', read.length < 1300, true);
// every important element is at least named
for (const w of ['部落版图', '负分格', '维京人', '起始玩家驼鹿', '收入斜线', '奖励物品格', '宴会桌', '庭之惩罚', '武器卡', '职业卡', '升级', '捕鲸船', '商船', '长船', '探索', '移民', '工棚', '石屋', '长屋', '山脉板块', '特殊板块', '英格兰王冠'])
  if (!read.includes(w)) { fails++; console.log('FAIL script mentions', w); }
await page.screenshot({ path: out + '/teach_top.png' });

// every term in the script and every icon in the guide opens a note with a name, an icon and both texts
const ids = await page.$$eval('[data-t]', l => [...new Set(l.map(x => x.dataset.t))]);
const bad = [];
for (const id of ids) {
  await page.evaluate(id => document.querySelector(`[data-t="${id}"]`).click(), id);
  const n = await page.$eval('.tsheet', s => ({ open: !s.classList.contains('hidden'), name: s.querySelector('.tshd b')?.textContent, icon: s.querySelector('.tshd img')?.complete !== false && !!s.querySelector('.tshd img'), ps: [...s.querySelectorAll('p')].map(p => p.textContent.length) }));
  if (!n.open || !n.name || !n.icon || n.ps.length !== 2 || n.ps.some(x => x < 8)) bad.push([id, n]);
  await page.click('.tsx');
}
console.log(`  ${ids.length} terms checked`);
eq('every term opens a note with its picture and text', bad, []);
eq('the note closes', await page.$eval('.tsheet', s => s.classList.contains('hidden')), true);
const term = page.locator('.tpart .term').first();
await term.scrollIntoViewIfNeeded(); await term.click();
await page.screenshot({ path: out + '/teach_note.png' });

// asking from a note: closes the note, opens the assistant, sends the question
const nm = await page.textContent('.tshd b');
await page.click('.tsask'); await page.waitForSelector('.cm.a:not(:has(.cdots))');
eq('note → assistant asked about that term', [asked.at(-1), await page.isVisible('.cpanel'), await page.$eval('.tsheet', s => s.classList.contains('hidden'))],
  [`「${nm}」是什么，怎么用？`, true, true]);
await page.screenshot({ path: out + '/teach_ask.png' });
await page.click('.cx');

// a 「问」 button sends exactly its question and the answer shows
const q = await page.$eval('#p2 .tq', x => x.dataset.q);
await page.locator('#p2 .tq').first().click(); await page.waitForFunction(n => document.querySelectorAll('.cm.a').length > n && !document.querySelector('.cm.a:last-child .cdots'), 1);
eq('「问」 sends its question', [asked.at(-1), await page.$$eval('.cm.a', l => l.at(-1).textContent)], [q, `答：${q}`]);
await page.click('.cx');
eq('no button inside a button', await page.$$eval('button button', l => l.length), 0);

// icon guide: every picture loads and has a name
await page.evaluate(() => Promise.all([...document.querySelectorAll('.tic img')].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))));
const tiles = await page.$$eval('.tic', l => l.map(t => [t.dataset.t, t.querySelector('img')?.naturalWidth > 0, t.textContent.trim().length > 0]));
eq('icon guide: every picture loads', tiles.filter(t => !t[1] || !t[2]), []);
console.log(`  icon guide: ${tiles.length} icons`);
await page.locator('#icons').scrollIntoViewIfNeeded(); await page.screenshot({ path: out + '/teach_icons.png' });

eq('no sideways scrolling at 375 px', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
eq('「去建房间」 goes to the landing page', await page.getAttribute('.tgo', 'href'), '/');
eq('link to the board guide', await page.$$eval('.tgo', l => l.map(a => a.getAttribute('href'))), ['/', 'boards']);
eq('no page errors', errs, []);
await b.close();
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);

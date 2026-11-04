// Usage: node tests/test_nav.mjs http://localhost:8893/ <shots-dir>
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright-core';
const [base = 'http://localhost:8893/', out = '/tmp/claude-501/codex_tasks/shots'] = process.argv.slice(2);
assert.ok(['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Run only against local service');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await page.route('https://boardgame.leisurecat.cloud/**', r => r.fulfill({ json: {} }));
  const check = async text => {
    const nav = page.locator('.back-nav');
    await nav.waitFor({ state: 'visible' });
    assert.equal(await nav.textContent(), text);
    await page.evaluate(() => window.scrollTo(0, 0));
    const issues = await nav.evaluate(el => {
      const a = el.getBoundingClientRect(), bad = [];
      if (a.height < 36 || a.left < 0 || a.top < 0 || a.right > innerWidth || a.bottom > innerHeight) bad.push('size/visibility');
      if (document.documentElement.scrollWidth > innerWidth) bad.push('horizontal overflow');
      for (const other of document.querySelectorAll('a,button,input,select,textarea,summary,.ttl,.conn,.hero h1,.ht')) {
        if (other === el || el.contains(other)) continue;
        const b = other.getBoundingClientRect();
        if (b.width && b.height && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) bad.push(other.outerHTML.slice(0, 120));
      }
      return bad;
    });
    assert.deepEqual(issues, []);
  };
  await page.goto(base);
  await check('‹ 全部游戏');
  assert.equal(await page.locator('.back-nav').getAttribute('href'), 'https://boardgame.leisurecat.cloud');
  await page.screenshot({ path: `${out}/nav_odin_landing.png` });
  await page.click('[data-act="create"]');
  await page.waitForSelector('[data-act="begin"]');
  const code = new URL(page.url()).searchParams.get('r');
  await page.click('[data-act="n"][data-n="1"]');
  await page.waitForSelector('[data-act="n"][data-n="1"].on');
  await page.fill('[data-name="0"]', '导航测试');
  await page.press('[data-name="0"]', 'Enter');
  const rejoin = async () => {
    await check('‹ 首页');
    await page.click('.back-nav');
    await check('‹ 全部游戏');
    assert.equal(new URL(page.url()).search, '');
    await page.click(`[data-act="rejoin"][data-code="${code}"]`);
    await page.waitForSelector('.bar');
  };
  await rejoin();
  assert.equal(await page.inputValue('[data-name="0"]'), '导航测试');
  assert.equal(await page.locator('[data-act="n"].on').textContent(), '1 人');
  await page.screenshot({ path: `${out}/nav_odin_room.png` });
  await page.click('[data-act="begin"]');
  await page.waitForSelector('.status');
  await page.click('[data-act="next"]');
  await page.waitForFunction(() => document.querySelector('.status .t').textContent.includes('收获'));
  const status = await page.locator('.status .t').textContent();
  await rejoin();
  assert.equal(await page.locator('.status .t').textContent(), status);
  for (const tab of ['score', 'mvp', 'flow']) {
    await page.click(`[data-act="tab"][data-tab="${tab}"]`);
    await check('‹ 首页');
  }
  for (let i = 0; i < 90 && await page.locator('[data-act="next"]').count(); i++) {
    const before = await page.locator('.status .t').textContent();
    await page.click('[data-act="next"]');
    await page.waitForFunction(t => document.querySelector('.status .t').textContent !== t, before);
  }
  assert.equal(await page.locator('.status .t').textContent(), '游戏结束');
  await page.click('[data-act="tab"][data-tab="mvp"]');
  await check('‹ 首页');
  assert.equal(await page.locator('#shot .back-nav').count(), 0);
  await rejoin();
  assert.equal(await page.locator('.status .t').textContent(), '游戏结束');
  console.log('PASS landing, setup, play, scoring, results and preserved room state');
  for (const path of ['guide.html', 'history.html', 'cards.html']) {
    await page.goto(new URL(path, base).href);
    await check('‹ 返回');
    assert.equal(await page.locator('.back-nav').getAttribute('href'), '/');
    if (path === 'guide.html') await page.screenshot({ path: `${out}/nav_odin_guide.png` });
    await page.click('.back-nav');
    await check('‹ 全部游戏');
    console.log(`PASS ${path} return link and mobile geometry`);
  }
  console.log('ALL PASS');
} finally { await browser.close(); }

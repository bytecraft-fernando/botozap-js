import assert from 'node:assert/strict';
import AxeBuilder from '@axe-core/playwright';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const destination = fileURLToPath(new URL('../web/screenshots/', import.meta.url));
await mkdir(destination, { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1200, height: 960 }, deviceScaleFactor: 1, timezoneId: 'America/Sao_Paulo' });
  const page = await context.newPage();
  async function verify(inline = false) {
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    assert.deepEqual(result.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })), [], 'WCAG AA');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'No horizontal overflow');
    if (inline) {
      const count = await page.locator('#app button').evaluateAll(buttons => buttons.filter(b => b.getClientRects().length > 0).length);
      assert.ok(count <= 2, `Inline has ${count} actions`);
    }
  }
  for (const theme of ['light', 'dark']) {
    for (const state of ['draft', 'confirming', 'sending', 'accepted', 'rejected', 'uncertain', 'closed']) {
      await page.goto(`http://127.0.0.1:4173/?mode=inline&state=${state}&theme=${theme}`);
      await page.waitForSelector('html[data-demo-ready=true]');
      await verify(true);
      await page.locator('#app').screenshot({ path: `${destination}/card-${state}-${theme}.png` });
    }
    for (const [device, width, height] of [['desktop', 1200, 960], ['mobile', 390, 844]]) {
      await page.setViewportSize({ width, height });
      await page.goto(`http://127.0.0.1:4173/?mode=radar&theme=${theme}`);
      await page.waitForSelector('html[data-demo-ready=true]');
      await verify();
      await page.screenshot({ path: `${destination}/radar-${device}-${theme}.png`, fullPage: true });
      // Record the actual narrow viewport too, to inspect the composer overlay.
      if (device === 'mobile') {
        await page.locator('#draft').scrollIntoViewIfNeeded();
        await page.screenshot({ path: `${destination}/radar-mobile-composer-${theme}.png` });
      }
    }
    await page.setViewportSize({ width: 1200, height: 960 });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4173/?mode=inline&theme=dark');
  await page.waitForSelector('html[data-demo-ready=true]');
  await verify(true);
  await page.locator('#app').screenshot({ path: `${destination}/card-mobile-dark.png` });
} finally { await browser.close(); }
console.log(`Screenshots: ${destination}`);

// Usage: PLAYWRIGHT_BROWSERS_PATH=/tmp/pw/browsers node verify.mjs <explainer.html> [outDir]
// Run from a directory where `playwright` is installed (see SKILL.md "Verify").
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

// ESM resolves bare imports relative to this file, which lives in the skills dir, so load from cwd.
const { chromium } = createRequire(path.join(process.cwd(), 'noop.js'))('playwright');

const file = path.resolve(process.argv[2] || '');
const out = path.resolve(process.argv[3] || '/tmp/rfc-explainer-shots');
if (!fs.existsSync(file)) { console.error('File not found:', file); process.exit(2); }
fs.mkdirSync(out, { recursive: true });

const url = 'file://' + file;
const errors = [];
const shots = [];
const browser = await chromium.launch();

async function exercise(page) {
  for (const phase of await page.$$('.scrub-phase')) await phase.click();
  for (const box of await page.$$('[data-widget=sim]')) {
    const chips = await box.$$('.chip');
    for (const chip of chips) {
      await chip.click();
      const next = await box.$('button.primary');
      for (let i = 0; i < 50 && !(await next.isDisabled()); i++) await next.click();
    }
    if (chips[0]) await chips[0].click();
    const next = await box.$('button.primary');
    for (let i = 0; i < 50 && !(await next.isDisabled()); i++) await next.click();
  }
  for (const col of (await page.$$('.col')).slice(0, 3)) await col.hover();
  for (const q of await page.$$('.q')) { const b = await q.$('button'); if (b) await b.click(); }
  await page.waitForTimeout(350);
}

for (const scheme of ['light', 'dark']) {
  for (const [label, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, colorScheme: scheme });
    page.on('pageerror', e => errors.push(`[${scheme}/${label}] ${e.message}`));
    page.on('console', m => m.type() === 'error' && errors.push(`[${scheme}/${label}] console: ${m.text()}`));
    await page.goto(url);
    await exercise(page);

    const missing = await page.$$eval('.callout.red strong', els => els.filter(e => e.textContent.includes('Missing widget config')).length);
    if (missing) errors.push(`[${scheme}/${label}] ${missing} widget(s) missing config`);
    const leftovers = await page.evaluate(() => (document.body.innerText.match(/\{\{[^}]+\}\}/g) || []).slice(0, 5));
    if (leftovers.length) errors.push(`[${scheme}/${label}] unreplaced placeholders: ${leftovers.join(', ')}`);

    if (label === 'desktop') {
      const p = path.join(out, `${scheme}-hero.png`); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: p }); shots.push(p);
      for (const id of await page.$$eval('main > section[id]', s => s.map(x => x.id))) {
        const p = path.join(out, `${scheme}-${id}.png`);
        await page.locator('#' + id).screenshot({ path: p }); shots.push(p);
      }
    } else {
      const p = path.join(out, `${scheme}-mobile.png`); await page.screenshot({ path: p, fullPage: false }); shots.push(p);
      const ids = await page.$$eval('[data-widget]', w => w.map(x => x.closest('section')?.id).filter(Boolean));
      for (const id of [...new Set(ids)]) {
        const q = path.join(out, `${scheme}-mobile-${id}.png`);
        await page.locator('#' + id).screenshot({ path: q }); shots.push(q);
      }
    }
    await page.close();
  }
}

// Toggle override persists and flips the theme.
const page = await browser.newPage({ colorScheme: 'light' });
await page.goto(url);
await page.click('nav [data-theme-toggle]');
const theme = await page.evaluate(() => document.documentElement.dataset.theme);
if (theme !== 'dark') errors.push(`theme toggle did not switch to dark (got ${theme})`);
await page.reload();
const persisted = await page.evaluate(() => document.documentElement.dataset.theme);
if (persisted !== 'dark') errors.push('theme choice did not persist across reload');

const reviewCount = await page.$$eval('#review-index li', l => l.length);
const noteCount = await page.$$eval('.rnote[id]', l => l.length);
if (reviewCount !== noteCount) errors.push(`review index has ${reviewCount} items but there are ${noteCount} .rnote[id] blocks`);

await browser.close();
console.log(JSON.stringify({ errors, reviewNotes: noteCount, screenshots: shots.length, outDir: out }, null, 2));
process.exit(errors.length ? 1 : 0);

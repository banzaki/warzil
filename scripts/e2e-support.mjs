// "Apoie o WARZIL" end-to-end check on desktop and phone: the modal opens and
// closes, the QR image loads, and both copy buttons put the right text on the
// clipboard (and the fallback works without the async clipboard API); the footer
// contact link points to the owner's WhatsApp.
// Needs Chrome and a build with VITE_SUPPORT_PIX=on (e.g. staging).
// Usage: node scripts/e2e-support.mjs <screenshotDir> <baseUrl>
import { chromium } from 'playwright-core';

const { PIX } = await import(new URL('../src/game/support.js', import.meta.url));
const [OUT, BASE] = process.argv.slice(2);
const origin = new URL(BASE).origin;
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--renderer-process-limit=1'] });
const results = [];
const check = (name, ok) => results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}`);

for (const [label, opts] of [
  ['desktop', { viewport: { width: 1280, height: 800 } }],
  ['mobile', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }],
]) {
  const ctx = await browser.newContext(opts);
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.screenshot({ path: `${OUT}/home-${label}.png`, fullPage: true });
  const contact = await page.getByRole('link', { name: 'Fale com o criador' }).evaluate((a) => [a.href, a.target]);
  check(`${label}: "Fale com o criador" opens WhatsApp in a new tab`, contact[0] === 'https://wa.me/5511924915082' && contact[1] === '_blank');
  await page.getByRole('button', { name: /Apoie o WARZIL/ }).click();
  await page.waitForSelector('.support-card');
  const qrOk = await page
    .waitForFunction(() => {
      const img = document.querySelector('.support-qr');
      return img.complete && img.naturalWidth > 0;
    }, null, { timeout: 10000 })
    .then(() => true, () => false);
  check(`${label}: modal opens, QR image loads`, qrOk);
  await page.getByRole('button', { name: 'Copiar Pix Copia e Cola' }).click();
  await page.getByRole('button', { name: /Copiado/ }).waitFor();
  check(`${label}: "Copia e Cola" copies the full payload`, (await page.evaluate(() => navigator.clipboard.readText())) === PIX.payload);
  await page.getByRole('button', { name: 'Copiar chave Pix' }).click();
  await page.getByRole('button', { name: /Chave copiada/ }).waitFor();
  check(`${label}: key button copies the key`, (await page.evaluate(() => navigator.clipboard.readText())) === PIX.key);
  const overflow = await page.evaluate(() => {
    const r = document.querySelector('.support-card').getBoundingClientRect();
    return r.left < 0 || r.right > window.innerWidth;
  });
  check(`${label}: modal fits the screen`, !overflow);
  await page.screenshot({ path: `${OUT}/support-${label}.png` });
  await page.keyboard.press('Escape');
  check(`${label}: Esc closes`, !(await page.$('.support-card')));
  await page.getByRole('button', { name: /Apoie o WARZIL/ }).click();
  await page.getByRole('button', { name: 'Fechar' }).click();
  check(`${label}: ✕ closes`, !(await page.$('.support-card')));
  await ctx.close();
}

// Fallback: no async clipboard API (older browsers, embedded webviews).
{
  const ctx = await browser.newContext();
  await ctx.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined });
    window.__copied = null;
    const exec = document.execCommand.bind(document);
    document.execCommand = (cmd, ...rest) => {
      if (cmd === 'copy') {
        window.__copied = document.activeElement?.value ?? null;
        return true;
      }
      return exec(cmd, ...rest);
    };
  });
  const page = await ctx.newPage();
  await page.goto(BASE);
  await page.getByRole('button', { name: /Apoie o WARZIL/ }).click();
  await page.getByRole('button', { name: 'Copiar Pix Copia e Cola' }).click();
  await page.getByRole('button', { name: /Copiado/ }).waitFor();
  check('fallback: copies through a hidden text field', (await page.evaluate(() => window.__copied)) === PIX.payload);
  await ctx.close();
}

console.log(results.join('\n'));
await browser.close();

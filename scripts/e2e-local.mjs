// Local multiplayer (hotseat) end-to-end test in one browser page: sets up the
// seats through the menu, plays a whole match tapping the board for every person
// (the CPU seats play by themselves), confirms each hand-over, then a rematch.
// Also takes home-screen shots on desktop and phone. Needs Chrome installed.
// Usage:
//   node scripts/e2e-local.mjs <screenshotDir> <baseUrl> <seats>
//   seats: comma list of candidate:who, who = a nickname or "cpu"
//   e.g. node scripts/e2e-local.mjs ./shots http://localhost:4173/ lula:Ana,flavio:Beto,cury:cpu
import { chromium } from 'playwright-core';

const { ADJACENCY, FACTIONS } = await import(new URL('../src/game/data.js', import.meta.url));
const IDS = Object.keys(FACTIONS);
const [OUT, BASE, seatsArg] = process.argv.slice(2);
const seats = seatsArg.split(',').map((s) => {
  const [faction, who] = s.split(':');
  return { faction, human: who !== 'cpu', nick: who === 'cpu' ? '' : who };
});
const tag = `local${seats.length}h${seats.filter((s) => s.human).length}`;
const log = (...a) => console.log(...a);
const errors = [];

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--renderer-process-limit=1'] });
const settings = () => localStorage.setItem('warzil-settings', JSON.stringify({ aiSpeed: 'veryFast', analytics: false }));

// ---------- Home on a phone ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await ctx.addInitScript(settings);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`mobile pageerror: ${e.message}`));
  await page.goto(BASE);
  await page.waitForSelector('.mode-main');
  await page.screenshot({ path: `${OUT}/home-mobile.png`, fullPage: true });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  const taps = await page.$$eval('.mode-big', (els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
  log('mobile home: horizontal overflow', overflow, 'px | big buttons heights', taps.join(','));
  await ctx.close();
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(settings);
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

// ---------- Home on desktop ----------
await page.goto(BASE);
await page.waitForSelector('.mode-main');
await page.screenshot({ path: `${OUT}/home-desktop.png`, fullPage: true });
const cards = await page.$$eval('.mode-big, .modes .mode-card', (els) => els.map((e) => `${e.className.split(' ').at(-1)}:${Math.round(e.getBoundingClientRect().height)}`));
log('desktop home card heights:', cards.join(' '));

// ---------- Local setup ----------
await page.getByRole('button', { name: /Jogar local/ }).click();
await page.getByRole('radio', { name: String(seats.length) }).click();
for (let i = 0; i < seats.length; i++) {
  const row = page.locator('.local-seat').nth(i);
  await row.locator('select').selectOption(seats[i].faction);
}
// Second pass: a candidate can only be picked once it is free.
for (let i = 0; i < seats.length; i++) {
  const row = page.locator('.local-seat').nth(i);
  await row.locator('select').selectOption(seats[i].faction);
  await row.getByRole('radio', { name: seats[i].human ? 'Pessoa' : 'CPU' }).click();
  if (seats[i].human) await row.locator('.local-nick').fill(seats[i].nick);
}
await page.screenshot({ path: `${OUT}/${tag}-seats.png`, fullPage: true });
await page.getByRole('button', { name: /Continuar/ }).click();
await page.getByRole('button', { name: /Sortear a ordem/ }).click();
await page.waitForSelector('.map');

// ---------- Board helpers ----------
const tap = (id) => page.locator(`path.state[data-id="${id}"]`).dispatchEvent('click');
const board = () =>
  page.$$eval('path.state', (els, ids) => Object.fromEntries(els.map((e) => [e.dataset.id, { owner: ids.find((id) => e.classList.contains(id)), n: Number(e.getAttribute('aria-label').split(': ')[1].split(' ')[0]) }])), IDS);
const over = () => page.$('.overlay .end-card').then(Boolean);
const current = () => page.$eval('.sidebar .panel', (e) => [...e.classList].find((c) => c !== 'panel'));
const myTurn = async () => ((await page.textContent('.panel-title').catch(() => '')) ?? '').includes('Sua vez');

async function playTurn(me) {
  const phase = (await page.textContent('.phase')).trim();
  let b = await board();
  const enemies = (id) => ADJACENCY[id].filter((x) => b[x].owner !== me);
  if (phase === 'Comício') {
    const front = Object.keys(b).filter((id) => b[id].owner === me && enemies(id).length).sort((x, y) => b[y].n - b[x].n);
    await page.getByRole('radio', { name: 'Tudo por toque' }).click({ timeout: 5000 });
    await tap(front[0] ?? Object.keys(b).find((id) => b[id].owner === me));
    await page.getByRole('button', { name: /Concluir comício/ }).click();
    return 'rally';
  }
  if (phase !== 'Batalha') return 'wait';
  for (let a = 0; a < 25; a++) {
    if (await over()) return 'over';
    b = await board();
    let best = null;
    for (const from of Object.keys(b)) {
      if (b[from].owner !== me || b[from].n < 3) continue;
      for (const to of enemies(from)) if (b[from].n - b[to].n >= 2 && (!best || b[from].n - b[to].n > best.m)) best = { from, to, m: b[from].n - b[to].n };
    }
    if (!best) break;
    await tap(best.from);
    await tap(best.to);
    if (await over()) return 'over';
    if (await page.$('button:has-text("Tudo ou nada")')) await page.getByRole('button', { name: /Tudo ou nada/ }).click({ timeout: 5000 });
    if (await over()) return 'over';
    if (await page.$('button:has-text("Confirmar")')) await page.getByRole('button', { name: /^Confirmar/ }).click({ timeout: 5000 });
  }
  if (await over()) return 'over';
  await page.getByRole('button', { name: /Ir para movimentação/ }).click();
  await page.getByRole('button', { name: /Encerrar turno/ }).click();
  return 'battle';
}

// ---------- Match ----------
const handoffs = [];
let leaks = 0;
let turns = 0;
const t0 = Date.now();
while (Date.now() - t0 < 420000 && !(await over())) {
  if (await page.$('.draw-overlay')) {
    await page.waitForTimeout(200);
    continue;
  }
  const handoff = await page.$('.overlay.handoff');
  if (handoff) {
    const text = (await handoff.textContent()).replace(/\s+/g, ' ');
    // While the hand-over is up, nothing on the board can be tapped.
    const blocked = await page.evaluate(() => {
      const map = document.querySelector('.map').getBoundingClientRect();
      const hit = document.elementFromPoint(map.x + map.width / 2, map.y + map.height / 2);
      return Boolean(hit?.closest('.overlay.handoff'));
    });
    if (!blocked) leaks++;
    if (!handoffs.length) await page.screenshot({ path: `${OUT}/${tag}-handoff.png` });
    handoffs.push(text.match(/vez de (.*?)\./)?.[1]);
    await page.getByRole('button', { name: 'Estou pronto' }).click({ timeout: 5000 });
    continue;
  }
  if ((await myTurn()) && !(await page.$('.overlay.handoff'))) {
    const me = await current();
    if ((await playTurn(me)) !== 'wait') turns++;
    if (turns === 2) await page.screenshot({ path: `${OUT}/${tag}-play.png` });
  } else await page.waitForTimeout(150);
}
await page.waitForSelector('.overlay .end-card', { timeout: 60000 });
log(`human turns ${turns}, hand-overs ${handoffs.length}, board visible behind a hand-over: ${leaks}`);
log('hand-over sequence:', handoffs.slice(0, 8).join(' | '), handoffs.length > 8 ? '…' : '');
log('end:', (await page.textContent('#end-title')).trim(), '|', (await page.textContent('.end-stats')).trim());
await page.waitForTimeout(800); // let the end card finish its entrance
await page.screenshot({ path: `${OUT}/${tag}-end.png` });

// ---------- Rematch: same seats, new draw ----------
await page.getByRole('button', { name: /Revanche/ }).click();
await page.waitForFunction(() => !document.querySelector('.end-card') && /Rodada 1/.test(document.querySelector('.round')?.textContent ?? ''), null, { timeout: 15000 });
const drawn = await page.$$eval('.draw-pick', (els) => els.length).catch(() => 0);
log('rematch: back to round 1, order draw shown with', drawn, 'candidates');
log('ERRORS:', errors.length ? errors : 'none');
await browser.close();

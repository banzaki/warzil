// Online end-to-end test: N independent browser contexts (separate storage =
// separate people) play one room through the real server and check that every
// client shows the same server-confirmed board after each turn.
// Needs Chrome installed. Usage:
//   node scripts/e2e-online.mjs <screenshotDir> <baseUrl> <candidates comma list> [aiCount]
//   e.g. node scripts/e2e-online.mjs ./shots https://warzil.qbbruno.workers.dev/ lula,flavio 0
import { chromium } from 'playwright-core';

const { ADJACENCY, FACTIONS } = await import(new URL('../src/game/data.js', import.meta.url));
const IDS = Object.keys(FACTIONS);
const [OUT, BASE, picksArg, aiArg = '0'] = process.argv.slice(2);
const picks = picksArg.split(',');
const aiCount = Number(aiArg);
const NICKS = ['Ana', 'Beto', 'Caio', 'Duda'];
const tag = `on${picks.length}h${aiCount}ai`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const errors = [];
const players = [];
for (let i = 0; i < picks.length; i++) {
  const mobile = i === 1;
  const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 800 }, isMobile: mobile, hasTouch: mobile });
  await ctx.addInitScript(() => localStorage.setItem('warzil-settings', JSON.stringify({ aiSpeed: 'veryFast' })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${NICKS[i]} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/WebSocket/.test(m.text()) && errors.push(`${NICKS[i]} console: ${m.text()}`));
  const rec = { i, nick: NICKS[i], faction: picks[i], ctx, page, mobile, frames: [] };
  const watch = (pg) => pg.on('websocket', (ws) => ws.on('framereceived', (f) => rec.frames.push([Date.now(), String(f.payload).slice(0, 40)])));
  watch(page);
  rec.watch = watch;
  players.push(rec);
}
const [host] = players;
const log = (...a) => console.log(...a);
const over = (p) => p.page.$('.overlay .end-card').then(Boolean);

// ---------- Lobby ----------
await host.page.goto(BASE);
await host.page.getByRole('button', { name: 'Jogar com amigos' }).click();
await host.page.getByLabel('Seu apelido').fill(host.nick);
await host.page.getByRole('button', { name: /Criar sala/ }).click();
await host.page.waitForSelector('.invite-link');
const link = (await host.page.textContent('.invite-link')).trim();
const code = link.split('sala=')[1];
log('room created:', code, link);
for (const p of players.slice(1)) {
  await p.page.goto(link);
  await p.page.getByLabel('Seu apelido').fill(p.nick);
  await p.page.getByRole('button', { name: `Entrar na sala ${code}` }).click();
  await p.page.waitForSelector('.lobby-players');
}
// Unique candidates: the second player tries the host's candidate first.
for (const p of players) await p.page.locator(`.lobby-picks .sim-pick.${p.faction}`).click();
await players[1].page.waitForTimeout(500);
const hostPickDisabled = await players[1].page.locator(`.lobby-picks .sim-pick.${host.faction}`).isDisabled();
log('candidate taken by host is disabled for others:', hostPickDisabled);
if (aiCount) await host.page.getByRole('radio', { name: `+${aiCount} IA` }).click();
await host.page.waitForTimeout(500);
await host.page.screenshot({ path: `${OUT}/${tag}-lobby-host.png`, fullPage: true });
await players[1].page.screenshot({ path: `${OUT}/${tag}-lobby-guest.png`, fullPage: true });
await host.page.getByRole('button', { name: /Começar com/ }).click();
for (const p of players) await p.page.waitForSelector('.map', { timeout: 15000 });
log('match started on all clients');

// ---------- Board helpers ----------
const board = (p) =>
  p.page.$$eval('path.state', (els, ids) => Object.fromEntries(els.map((e) => [e.dataset.id, { owner: ids.find((id) => e.classList.contains(id)), n: Number(e.getAttribute('aria-label').split(': ')[1].split(' ')[0]) }])), IDS);
const snap = async (p) => JSON.stringify(await board(p)) + (await p.page.textContent('.round'));
async function inSync(timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const all = await Promise.all(players.map(snap));
    if (all.every((s) => s === all[0])) return true;
    await players[0].page.waitForTimeout(100);
  }
  return false;
}
const tap = (p, id) => p.page.locator(`path.state[data-id="${id}"]`).dispatchEvent('click');
// Wait until the server's answer to the last action is on screen (board, phase or panel changed).
const screenState = (p) => p.page.evaluate(() => [...document.querySelectorAll('path.state')].map((e) => e.getAttribute('aria-label')).join() + '|' + (document.querySelector('.phase')?.textContent ?? '') + '|' + (document.querySelector('.panel-body')?.textContent ?? ''));
async function afterServer(p, before, timeout = 6000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if ((await screenState(p)) !== before) return true;
    await p.page.waitForTimeout(60);
  }
  return false;
}
const myTurn = async (p) => ((await p.page.textContent('.panel-title').catch(() => '')) ?? '').includes('Sua vez');

async function playTurn(p) {
  const me = p.faction;
  const phase = (await p.page.textContent('.phase')).trim();
  let b = await board(p);
  const enemies = (id) => ADJACENCY[id].filter((x) => b[x].owner !== me);
  if (phase === 'Comício') {
    const front = Object.keys(b).filter((id) => b[id].owner === me && enemies(id).length).sort((x, y) => b[y].n - b[x].n);
    await p.page.getByRole('radio', { name: 'Tudo por toque' }).click({ timeout: 5000 });
    await tap(p, front[0] ?? Object.keys(b).find((id) => b[id].owner === me));
    await p.page.waitForFunction(() => /Concluir comício/.test(document.body.innerText), null, { timeout: 8000 });
    const beforeRally = await screenState(p);
    await p.page.getByRole('button', { name: /Concluir comício/ }).click();
    await afterServer(p, beforeRally);
    return 'rally';
  }
  if (phase !== 'Batalha') return 'wait';
  for (let a = 0; a < 25; a++) {
    if (await over(p)) return 'over';
    b = await board(p);
    let best = null;
    for (const from of Object.keys(b)) {
      if (b[from].owner !== me || b[from].n < 3) continue;
      for (const to of enemies(from)) if (b[from].n - b[to].n >= 2 && (!best || b[from].n - b[to].n > best.m)) best = { from, to, m: b[from].n - b[to].n };
    }
    if (!best) break;
    await tap(p, best.from);
    let before = await screenState(p);
    await tap(p, best.to); // first roll goes to the server
    await afterServer(p, before);
    if (await over(p)) return 'over';
    if (await p.page.$('button:has-text("Tudo ou nada")')) {
      before = await screenState(p);
      await p.page.getByRole('button', { name: /Tudo ou nada/ }).click({ timeout: 5000 });
      await afterServer(p, before);
    }
    if (await over(p)) return 'over';
    if (await p.page.$('button:has-text("Confirmar")')) {
      before = await screenState(p);
      await p.page.getByRole('button', { name: /^Confirmar/ }).click({ timeout: 5000 });
      await afterServer(p, before);
    }
  }
  if (await over(p)) return 'over';
  await p.page.getByRole('button', { name: /Ir para movimentação/ }).click();
  await p.page.waitForFunction(() => /Encerrar turno/.test(document.body.innerText), null, { timeout: 8000 });
  const beforeEnd = await screenState(p);
  await p.page.getByRole('button', { name: /Encerrar turno/ }).click();
  await afterServer(p, beforeEnd);
  return 'battle';
}

// ---------- Match ----------
let syncChecks = 0;
let syncFails = 0;
let turns = 0;
let reconnected = null;
const t0 = Date.now();
while (Date.now() - t0 < 420000) {
  if (await over(host)) break;
  let acted = false;
  for (const p of players) {
    if (await over(p)) break;
    if (await myTurn(p)) {
      let r;
      try {
        r = await playTurn(p);
      } catch (e) {
        for (const q of players) {
          await q.page.screenshot({ path: `${OUT}/${tag}-FAIL-${q.nick}.png` }).catch(() => {});
          const info = await q.page.evaluate(() => [document.querySelector('.conn-banner')?.textContent ?? 'no banner', document.querySelector('.panel-title')?.textContent, document.querySelector('.online-toast')?.textContent ?? 'no toast'].join(' | ')).catch(() => 'closed');
          console.log('FAIL state', q.nick, q.mobile ? '(mobile)' : '', ':', info);
        }
        for (const q of players) {
          const recent = q.frames.filter(([t]) => Date.now() - t < 5000);
          console.log('frames in last 5 s for', q.nick, ':', recent.length, recent.slice(-3).map((x) => x[1]).join(' / '));
          const churn = await q.page.evaluate(() => new Promise((res) => { let n = 0; const target = document.querySelector('.sidebar') ?? document.body; const mo = new MutationObserver((m) => (n += m.reduce((s, r) => s + r.removedNodes.length, 0))); mo.observe(target, { childList: true, subtree: true }); setTimeout(() => { mo.disconnect(); res(n); }, 2000); })).catch(() => 'closed');
          console.log('nodes removed in 2 s under sidebar for', q.nick, ':', churn);
        }
        console.log('FAIL turn', turns, 'player', p.nick, 'reconnected?', JSON.stringify(reconnected), e.message.slice(0, 900));
        throw e;
      }
      if (r !== 'wait') {
        acted = true;
        turns++;
        syncChecks++;
        if (!(await inSync())) syncFails++;
        if (turns === 1) {
          await p.page.screenshot({ path: `${OUT}/${tag}-play-${p.nick}.png` });
          await players[(p.i + 1) % players.length].page.screenshot({ path: `${OUT}/${tag}-watch.png` });
        }
      }
    }
  }
  // Reconnection test once: the mobile player reloads mid-match.
  if (!reconnected && turns >= 4) {
    const p = players[1];
    await p.page.close();
    await host.page.waitForTimeout(1500);
    const dropped = await host.page.$eval(`.player-chip.${p.faction}`, (e) => e.textContent).catch(() => '?');
    p.page = await p.ctx.newPage();
    p.watch(p.page);
    p.page.on('pageerror', (e) => errors.push(`${p.nick} pageerror: ${e.message}`));
    await p.page.goto(BASE);
    await p.page.waitForSelector('.map', { timeout: 15000 });
    const chip = await p.page.$eval('.hud .player-chip', (e) => e.textContent);
    reconnected = { sameCandidate: chip.includes('(você)') && chip.includes(FACTIONS[p.faction].name), inSync: await inSync(), hostSaw: dropped.slice(0, 40) };
    log('reconnect:', JSON.stringify(reconnected));
  }
  if (!acted) await host.page.waitForTimeout(200);
}

for (const p of players) await p.page.waitForSelector('.overlay .end-card', { timeout: 60000 });
const titles = await Promise.all(players.map((p) => p.page.textContent('#end-title')));
const stats = await Promise.all(players.map((p) => p.page.textContent('.end-stats')));
log('end titles:', titles.map((t, i) => `${players[i].nick}: ${t.trim()}`).join(' | '));
log('same result on every client:', new Set(stats.map((s) => s.trim())).size === 1, '|', stats[0].trim());
log(`turns ${turns}, sync checks ${syncChecks}, out of sync ${syncFails}`);
await host.page.screenshot({ path: `${OUT}/${tag}-end-host.png` });
await players[1].page.screenshot({ path: `${OUT}/${tag}-end-guest.png` });

// ---------- Rematch in the same room ----------
const guestWaits = await players[1].page.$('text=Aguardando o anfitrião');
await host.page.getByRole('button', { name: /Revanche na sala/ }).click();
for (const p of players) await p.page.waitForFunction(() => !document.querySelector('.overlay .end-card') && /Rodada 1/.test(document.querySelector('.round')?.textContent ?? ''), null, { timeout: 15000 });
log('rematch: guest saw waiting message:', Boolean(guestWaits), '| all back to round 1, in sync:', await inSync());
log('ERRORS:', errors.length ? errors : 'none');
await browser.close();

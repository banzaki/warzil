// Product analytics check in a real browser, with PostHog replaced by an
// intercepted fake host: every event the page sends is captured and inspected.
// Build first with a fake key/host, then serve it:
//   VITE_POSTHOG_KEY=phc_test VITE_POSTHOG_HOST=https://ph.test npx vite build --mode staging && npx vite preview --port 4173
//   node scripts/e2e-analytics.mjs http://localhost:4173/
import { chromium } from 'playwright-core';

const { ADJACENCY, FACTIONS } = await import(new URL('../src/game/data.js', import.meta.url));
const IDS = Object.keys(FACTIONS);
const BASE = process.argv[2];
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--disable-gpu', '--renderer-process-limit=1'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
await ctx.addInitScript(() => {
  if (!localStorage.getItem('warzil-settings')) localStorage.setItem('warzil-settings', JSON.stringify({ aiSpeed: 'veryFast' }));
});
const events = [];
const raw = [];
await ctx.route('https://ph.test/**', async (route) => {
  const body = route.request().postData() ?? '';
  raw.push(body);
  try {
    for (const e of JSON.parse(body).batch ?? []) events.push(e);
  } catch {
    // ignore
  }
  await route.fulfill({ status: 200, body: '{"status":1}' });
});
const page = await ctx.newPage();
const named = (n) => events.filter((e) => e.event === n);
const settle = () => page.waitForTimeout(2600); // the page flushes every 2 s

// ---------- Visit with campaign tags ----------
await page.goto(`${BASE}?utm_source=tiktok&utm_campaign=trailer01`);
await page.waitForSelector('.mode-main');
await settle();
const pv = named('$pageview')[0];
check('pageview with UTM tags', pv?.properties.utm_source === 'tiktok' && pv?.properties.utm_campaign === 'trailer01');
check('URL sent without the query string', pv?.properties.$current_url === new URL(BASE).origin + '/');

// ---------- Solo: start, then back to the menu (abandoned) ----------
await page.getByRole('button', { name: /Jogar sozinho/ }).click();
await page.getByRole('button', { name: /Jogar de Lula/ }).click();
await page.getByRole('button', { name: /Sortear a ordem/ }).click();
await page.waitForTimeout(5000);
await page.getByRole('button', { name: /Voltar ao menu/ }).click();
await settle();
const ms = named('match_started').at(-1);
check('mode_selected solo', named('mode_selected').some((e) => e.properties.mode === 'solo'));
check('solo match_started with candidate and setup', ms?.properties.mode === 'solo' && ms.properties.candidate === 'lula' && ms.properties.humans === 1 && ms.properties.ai === 1 && Boolean(ms.properties.armies));
const ab = named('match_abandoned').at(-1);
check('leaving mid-match = match_abandoned (menu) with time split', ab?.properties.reason === 'menu' && ab.properties.match_id === ms?.properties.match_id && typeof ab.properties.waiting_s === 'number', JSON.stringify(ab?.properties && { active: ab.properties.active_s, waiting: ab.properties.waiting_s, total: ab.properties.duration_s }));

// ---------- Support modal ----------
await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(BASE).origin });
await page.getByRole('button', { name: /Voltar/ }).last().click(); // candidate step -> home
await page.getByRole('button', { name: /Apoie o WARZIL/ }).click();
await page.getByRole('button', { name: 'Copiar chave Pix' }).click();
await page.getByRole('button', { name: 'Fechar' }).click();
await settle();
check('support_opened and support_copy_key', named('support_opened').length === 1 && named('support_copy_key')[0]?.properties.copied === true);

// ---------- Local match to the end, then a rematch ----------
await page.getByRole('button', { name: /Jogar local/ }).click();
await page.getByRole('radio', { name: '3' }).click();
const seats = [
  ['lula', 'Pessoa', 'Ana'],
  ['flavio', 'Pessoa', 'Beto'],
  ['cury', 'CPU', ''],
];
for (let pass = 0; pass < 2; pass++)
  for (let i = 0; i < seats.length; i++) {
    const row = page.locator('.local-seat').nth(i);
    await row.locator('select').selectOption(seats[i][0]);
    if (pass) {
      await row.getByRole('radio', { name: seats[i][1] }).click();
      if (seats[i][2]) await row.locator('.local-nick').fill(seats[i][2]);
    }
  }
await page.getByRole('button', { name: /Continuar/ }).click();
await page.getByRole('button', { name: /Sortear a ordem/ }).click();
await page.waitForSelector('.map');

const tap = (id) => page.locator(`path.state[data-id="${id}"]`).dispatchEvent('click');
const board = () =>
  page.$$eval('path.state', (els, ids) => Object.fromEntries(els.map((e) => [e.dataset.id, { owner: ids.find((id) => e.classList.contains(id)), n: Number(e.getAttribute('aria-label').split(': ')[1].split(' ')[0]) }])), IDS);
const over = () => page.$('.overlay .end-card').then(Boolean);
async function playTurn(me) {
  const phase = (await page.textContent('.phase')).trim();
  let b = await board();
  if (phase === 'Comício') {
    const front = Object.keys(b).filter((id) => b[id].owner === me && ADJACENCY[id].some((x) => b[x].owner !== me)).sort((x, y) => b[y].n - b[x].n);
    await page.getByRole('radio', { name: 'Tudo por toque' }).click();
    await tap(front[0] ?? Object.keys(b).find((id) => b[id].owner === me));
    await page.getByRole('button', { name: /Concluir comício/ }).click();
    return;
  }
  if (phase !== 'Batalha') return;
  for (let a = 0; a < 25; a++) {
    if (await over()) return;
    b = await board();
    let best = null;
    for (const from of Object.keys(b)) {
      if (b[from].owner !== me || b[from].n < 3) continue;
      for (const to of ADJACENCY[from].filter((x) => b[x].owner !== me)) if (b[from].n - b[to].n >= 2 && (!best || b[from].n - b[to].n > best.m)) best = { from, to, m: b[from].n - b[to].n };
    }
    if (!best) break;
    await tap(best.from);
    await tap(best.to);
    if (await over()) return;
    if (await page.$('button:has-text("Tudo ou nada")')) await page.getByRole('button', { name: /Tudo ou nada/ }).click();
    if (await over()) return;
    if (await page.$('button:has-text("Confirmar")')) await page.getByRole('button', { name: /^Confirmar/ }).click();
  }
  if (await over()) return;
  await page.getByRole('button', { name: /Ir para movimentação/ }).click();
  await page.getByRole('button', { name: /Encerrar turno/ }).click();
}
const t0 = Date.now();
while (Date.now() - t0 < 420000 && !(await over())) {
  if (await page.$('.draw-overlay')) await page.waitForTimeout(200);
  else if (await page.$('.overlay.handoff')) await page.getByRole('button', { name: 'Estou pronto' }).click({ timeout: 5000 });
  else if (((await page.textContent('.panel-title').catch(() => '')) ?? '').includes('Sua vez') && !(await page.$('.overlay.handoff'))) {
    await playTurn(await page.$eval('.sidebar .panel', (e) => [...e.classList].find((c) => c !== 'panel'))).catch(() => {});
  } else await page.waitForTimeout(150);
}
await page.waitForSelector('.overlay .end-card');
await settle();
const done = named('match_completed').at(-1);
check(
  'local match_completed with result, rounds and time split',
  done?.properties.mode === 'local' && ['human_won', 'cpu_won'].includes(done.properties.result) && done.properties.rounds > 0 && done.properties.active_s > 0 && done.properties.humans === 2,
  JSON.stringify(done?.properties && { result: done.properties.result, rounds: done.properties.rounds, total: done.properties.duration_s, active: done.properties.active_s, waiting: done.properties.waiting_s, idle: done.properties.idle_s }),
);
await page.getByRole('button', { name: /Revanche/ }).click();
await page.waitForSelector('.draw-overlay', { state: 'detached', timeout: 15000 });
if (await page.waitForSelector('.overlay.handoff', { timeout: 3000 }).catch(() => null)) await page.getByRole('button', { name: 'Estou pronto' }).click();
await page.getByRole('button', { name: /Voltar ao menu/ }).click();
await settle();
check('rematch_started + new match_started (rematch: true)', named('rematch_started').length === 1 && named('match_started').at(-1)?.properties.rematch === true);
check('one completed record per match (no duplicates)', new Set(named('match_completed').map((e) => e.properties.match_id)).size === named('match_completed').length);

// ---------- Privacy ----------
const all = JSON.stringify(events);
check('same anonymous id and UUIDv7 session on every event', new Set(events.map((e) => e.distinct_id)).size === 1 && events.every((e) => /^[0-9a-f]{8}-[0-9a-f]{4}-7/.test(e.properties.$session_id)));
check('no nicknames, Pix data or person profiles', !/"Ana"|"Beto"|a5da07d0|br\.gov\.bcb/.test(all) && events.every((e) => e.properties.$process_person_profile === false));

// ---------- Opt-out ----------
const before = events.length;
await page.locator('.start-gear .gear').click();
await page.getByRole('radio', { name: 'Desativadas' }).click();
await page.getByRole('button', { name: 'Pronto' }).click();
await page.getByRole('button', { name: /Voltar/ }).last().click(); // local setup -> home
await page.getByRole('button', { name: /Jogar sozinho/ }).click();
await settle();
check('turning statistics off stops sending', events.length === before);
await page.reload();
await page.waitForSelector('.mode-main');
await settle();
check('…and it stays off after a reload', events.length === before);

console.log(results.join('\n'));
console.log('events captured:', events.length, '| by name:', JSON.stringify(Object.fromEntries([...new Set(events.map((e) => e.event))].map((n) => [n, named(n).length]))));
await browser.close();

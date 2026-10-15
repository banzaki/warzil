// PostHog setup and checks for the WARZIL project, through PostHog's REST API.
// Needs a personal API key (scopes: project:read, query:read, insight:write,
// dashboard:write) stored alone in a file OUTSIDE the repository; the key is
// read from that file and never printed.
// Usage:
//   node scripts/posthog-dashboard.mjs <keyFile> check            privacy settings + events received (last 2 days)
//   node scripts/posthog-dashboard.mjs <keyFile> create           builds the "WARZIL — Product Analytics" dashboard
//   node scripts/posthog-dashboard.mjs <keyFile> verify [env]     runs every dashboard query for one env (default staging)
import { readFileSync } from 'node:fs';

const [keyFile, action = 'check', verifyEnv = 'staging'] = process.argv.slice(2);
const API = 'https://eu.posthog.com';
const KEY = readFileSync(keyFile, 'utf8').trim();
const DASHBOARD = 'WARZIL — Product Analytics';

async function api(path, body, method = body ? 'POST' : 'GET') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function project() {
  const list = await api('/api/projects/');
  const all = list.results ?? list;
  const p = all.find((x) => /warzil/i.test(x.name)) ?? all[0];
  if (!p) throw new Error('no project visible to this key');
  return api(`/api/projects/${p.id}/`);
}

const hogql = (pid, query) => api(`/api/projects/${pid}/query/`, { query: { kind: 'HogQLQuery', query } }).then((r) => r.results);

// ---------- Dashboard definition ----------

const envIs = (env) => [{ type: 'event', key: 'env', operator: 'exact', value: [env] }];
const prop = (key, value, operator = 'exact') => ({ type: 'event', key, operator, value });
const played = prop('mode', ['simulation'], 'is_not'); // humans playing, not "Simular guerra"
const ev = (event, name, extra = {}) => ({ kind: 'EventsNode', event, name: event, custom_name: name, ...extra });
const last30 = { date_from: '-30d' };

function insights(env) {
  const base = { dateRange: last30, properties: envIs(env), filterTestAccounts: false };
  const trends = (series, trendsFilter = {}, more = {}) => ({ kind: 'TrendsQuery', interval: 'day', ...base, series, trendsFilter: { display: 'ActionsLineGraph', ...trendsFilter }, ...more });
  const funnel = (steps, funnelsFilter = {}) => ({
    kind: 'FunnelsQuery',
    ...base,
    series: steps,
    funnelsFilter: { funnelWindowInterval: 1, funnelWindowIntervalUnit: 'day', funnelOrderType: 'ordered', funnelVizType: 'steps', ...funnelsFilter },
  });
  return [
    {
      name: 'Funil: visita → modo → partida → conclusão → revanche',
      description: 'Pessoas (navegadores) que passaram por cada etapa no mesmo dia. Online: início e resultado vêm do servidor.',
      source: funnel([
        ev('$pageview', 'Visita'),
        ev('mode_selected', 'Modo escolhido'),
        ev('match_started', 'Partida iniciada'),
        ev('match_completed', 'Partida concluída'),
        ev('rematch_started', 'Revanche'),
      ]),
    },
    {
      name: '1. Visitantes por dia',
      description: 'Navegadores únicos por dia e total de visitas (abrir o site conta 1 visita).',
      source: trends([ev('$pageview', 'Visitantes únicos', { math: 'dau' }), ev('$pageview', 'Visitas')]),
    },
    {
      name: '2. Partidas iniciadas por dia',
      description: 'Partidas distintas (uma partida online com 3 pessoas conta 1), por modo.',
      source: trends([ev('match_started', 'Partidas', { math: 'hogql', math_hogql: 'count(distinct properties.match_id)' })], { display: 'ActionsBar' }, { breakdownFilter: { breakdown: 'mode', breakdown_type: 'event' } }),
    },
    {
      name: '3. Conversão visita → partida iniciada (por dia)',
      description: '% de quem abriu o site e começou uma partida no mesmo dia.',
      source: funnel([ev('$pageview', 'Visita'), ev('match_started', 'Partida iniciada')], { funnelVizType: 'trends' }),
    },
    {
      name: '4. Popularidade dos modos',
      description: 'Partidas iniciadas por modo nos últimos 30 dias (online conta por jogador).',
      source: trends([ev('match_started', 'Partidas iniciadas')], { display: 'ActionsPie' }, { breakdownFilter: { breakdown: 'mode', breakdown_type: 'event' } }),
    },
    {
      name: '5. Candidatos mais escolhidos',
      description: 'Candidato escolhido em "Jogar sozinho" e no online (o Desafio do dia tem candidato fixo; o local fica de fora).',
      source: trends([ev('match_started', 'Escolhas', { properties: [prop('mode', ['solo', 'online'])] })], { display: 'ActionsBarValue' }, { breakdownFilter: { breakdown: 'candidate', breakdown_type: 'event' } }),
    },
    {
      name: '6. Duração das partidas (minutos)',
      description: 'Média e mediana da duração total das partidas concluídas por pessoas (sem "Simular guerra").',
      source: trends(
        [ev('match_completed', 'Média (s)', { math: 'avg', math_property: 'duration_s', properties: [played] }), ev('match_completed', 'Mediana (s)', { math: 'median', math_property: 'duration_s', properties: [played] })],
        { formulas: ['A / 60', 'B / 60'] },
      ),
    },
    {
      name: '7. Tempo ativo × tempo de espera (média, segundos)',
      description: 'Ativo = vez da pessoa com interação no último minuto. Espera = vez dos outros. Aba em segundo plano e ociosidade não contam como tempo ativo.',
      source: trends(
        [
          ev('match_completed', 'Ativo (solo/local/desafio)', { math: 'avg', math_property: 'active_s', properties: [played] }),
          ev('match_completed', 'Espera (solo/local/desafio)', { math: 'avg', math_property: 'waiting_s', properties: [played] }),
          ev('online_match_time', 'Ativo (online)', { math: 'avg', math_property: 'active_s' }),
          ev('online_match_time', 'Espera (online)', { math: 'avg', math_property: 'waiting_s' }),
        ],
        { display: 'ActionsBar' },
        { interval: 'week' },
      ),
    },
    {
      name: '8. Taxa de conclusão e de abandono (%)',
      description: 'Concluídas e abandonadas ÷ iniciadas (sem "Simular guerra").',
      source: trends(
        [ev('match_started', 'Iniciadas', { properties: [played] }), ev('match_completed', 'Concluídas', { properties: [played] }), ev('match_abandoned', 'Abandonadas', { properties: [played] })],
        { formulas: ['B / A * 100', 'C / A * 100'] },
        { interval: 'week' },
      ),
    },
    {
      name: '8b. Abandonos por motivo',
      description: 'menu = voltou ao menu; page_closed = fechou a aba; left_room = saiu da sala online; replaced = começou outra partida.',
      source: trends([ev('match_abandoned', 'Abandonos', { properties: [played] })], { display: 'ActionsBarValue' }, { breakdownFilter: { breakdown: 'reason', breakdown_type: 'event' } }),
    },
    {
      name: '9. Taxa de revanche (%)',
      description: 'Revanches ÷ partidas concluídas por pessoas.',
      source: trends([ev('match_completed', 'Concluídas', { properties: [played] }), ev('rematch_started', 'Revanches')], { formulas: ['B / A * 100'] }, { interval: 'week' }),
    },
    {
      name: '10. Jogadores que retornam (retenção semanal)',
      description: 'De quem visitou numa semana, quantos % voltaram nas semanas seguintes. Conta navegadores: limpar dados ou trocar de aparelho vira "novo".',
      source: {
        kind: 'RetentionQuery',
        ...base,
        dateRange: { date_from: '-8w' },
        retentionFilter: {
          period: 'Week',
          totalIntervals: 8,
          retentionType: 'retention_first_time',
          targetEntity: { id: '$pageview', name: '$pageview', type: 'events' },
          returningEntity: { id: '$pageview', name: '$pageview', type: 'events' },
        },
      },
    },
    {
      name: '11a. Origem do tráfego (site de origem)',
      description: 'Domínio de onde a visita veio ($direct = digitou o endereço ou abriu por app).',
      source: trends([ev('$pageview', 'Visitas')], { display: 'ActionsBarValue' }, { breakdownFilter: { breakdown: '$referring_domain', breakdown_type: 'event' } }),
    },
    {
      name: '11b. Campanhas (utm_source / utm_campaign)',
      description: 'Use links como warzil.com.br/?utm_source=tiktok&utm_campaign=trailer01 para separar cada divulgação.',
      source: trends(
        [ev('$pageview', 'Visitas')],
        { display: 'ActionsBarValue' },
        { breakdownFilter: { breakdowns: [{ property: 'utm_source', type: 'event' }, { property: 'utm_campaign', type: 'event' }] } },
      ),
    },
    {
      name: '12. Erros e desconexões',
      description: 'Falhas de script no navegador, quedas e reconexões no online, saídas no meio da partida.',
      source: trends(
        [
          ev('app_error', 'Erros de script'),
          ev('online_disconnected', 'Desconexões online'),
          ev('online_reconnected', 'Reconexões online'),
          ev('match_abandoned', 'Saiu da sala / fechou a aba', { properties: [prop('reason', ['left_room', 'page_closed'])] }),
        ],
        { display: 'ActionsBar' },
      ),
    },
  ];
}

// ---------- Actions ----------

const p = await project();
console.log(`project: ${p.name} (id ${p.id}, ${API})`);

if (action === 'check') {
  const flags = ['anonymize_ips', 'autocapture_opt_out', 'session_recording_opt_in', 'heatmaps_opt_in', 'surveys_opt_in', 'capture_console_log_opt_in', 'capture_performance_opt_in', 'autocapture_exceptions_opt_in', 'autocapture_web_vitals_opt_in'];
  console.log('privacy settings:', JSON.stringify(Object.fromEntries(flags.map((f) => [f, p[f]]))));
  const rows = await hogql(
    p.id,
    `select event, properties.env, properties.source, count(), uniq(distinct_id), countIf(properties.$ip != ''), countIf(properties.$geoip_country_code != '')
     from events where timestamp > now() - interval 2 day group by 1, 2, 3 order by 2, 1`,
  );
  console.log('event | env | source | count | ids | with IP | with country');
  for (const r of rows) console.log(r.join(' | '));
  const dup = await hogql(
    p.id,
    `select event, count() from (select event, distinct_id, properties.match_id as m, count() as n from events
     where timestamp > now() - interval 2 day and event in ('match_started', 'match_completed', 'match_abandoned', 'rematch_started', 'online_match_time') and m != ''
     group by event, distinct_id, m having n > 1) group by event`,
  );
  console.log('duplicated (same browser, same match, same event):', dup.length ? JSON.stringify(dup) : 'none');
}

if (action === 'create') {
  const existing = (await api(`/api/projects/${p.id}/dashboards/?limit=200`)).results.find((d) => d.name === DASHBOARD && !d.deleted);
  if (existing) {
    console.log(`dashboard already exists: ${API}/project/${p.id}/dashboard/${existing.id} (nothing created)`);
  } else {
    const dash = await api(`/api/projects/${p.id}/dashboards/`, {
      name: DASHBOARD,
      description: 'Dados reais de jogadores (env = production). Testes do staging ficam de fora. Online: início e resultado vêm do servidor.',
    });
    let ok = 0;
    for (const it of insights('production')) {
      try {
        await api(`/api/projects/${p.id}/insights/`, { name: it.name, description: it.description, query: { kind: 'InsightVizNode', source: it.source }, dashboards: [dash.id], saved: true });
        ok++;
      } catch (e) {
        console.log('FAILED', it.name, '-', e.message);
      }
    }
    console.log(`dashboard: ${API}/project/${p.id}/dashboard/${dash.id} — ${ok} insights`);
  }
}

if (action === 'verify') {
  for (const it of insights(verifyEnv)) {
    try {
      const r = await api(`/api/projects/${p.id}/query/`, { query: { ...it.source, dateRange: { date_from: '-2d' } } });
      const res = r.results ?? [];
      const summary = res.slice(0, 6).map((x) => (Array.isArray(x) ? `${x.length} steps: ${x.map((s) => s.count).join('→')}` : `${x.custom_name ?? x.label ?? x.name ?? x.breakdown_value ?? ''}=${x.count ?? x.aggregated_value ?? x.values?.length ?? ''}`));
      console.log(`OK   ${it.name}: ${summary.join(' | ') || 'no rows'}`);
    } catch (e) {
      console.log(`FAIL ${it.name}: ${e.message}`);
    }
  }
}

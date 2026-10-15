import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import BrazilMap from './BrazilMap.jsx';
import Caricature from './Caricature.jsx';
import Coach from './Coach.jsx';
import { CampaignLog, DiceTray, EventBanner, PlayerChip, RegionsPanel, RollPanel, SpeechBubble, useGameSounds } from './BoardParts.jsx';
import SettingsButton from './SettingsPanel.jsx';
import ShareSheet from './ShareSheet.jsx';
import SupportButton from './SupportButton.jsx';
import { cardModel } from '../game/share.js';
import QuantityPicker from './QuantityPicker.jsx';
import OrderDraw from './OrderDraw.jsx';
import { FACTIONS, STATES, STATE_IDS } from '../game/data.js';
import {
  attackTargets,
  canAttack,
  canFortify,
  attackerDiceCount,
  defenderDiceCount,
  fortifyTargets,
  movableTroops,
  roundOrder,
} from '../game/engine.js';
import { applyAction } from '../game/actions.js';
import { aiStep } from '../game/ai.js';
import { REINFORCE_AMOUNT } from '../game/settings.js';
import { aiDelay } from '../game/pace.js';
import { formatDailyKey } from '../game/daily.js';
import { needsHandoff, viewerOf } from '../game/hotseat.js';
import { abandonMatch, capture, completeMatch, noteProgress } from '../game/analytics.js';
import { newClock, tick } from '../game/matchClock.js';
import Handoff from './Handoff.jsx';
import { DISCLAIMER, PHASE_HELP, PHASE_NAMES, VICTORY_TITLES, createLinePicker, defeatLine, describeEvent, fill } from '../game/texts.js';

const EMPTY = new Set();

// Time split of the running match (see matchClock.js), sampled once a second.
function useMatchClock(running, myTurn, round) {
  const clock = useRef(newClock());
  const lastInput = useRef(Date.now());
  const state = useRef({ myTurn, round });
  state.current = { myTurn, round };
  useEffect(() => {
    const onInput = () => {
      lastInput.current = Date.now();
    };
    const kinds = ['pointerdown', 'keydown', 'wheel', 'touchstart'];
    kinds.forEach((k) => window.addEventListener(k, onInput, { passive: true }));
    return () => kinds.forEach((k) => window.removeEventListener(k, onInput));
  }, []);
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => {
      clock.current = tick(clock.current, { visible: document.visibilityState === 'visible', myTurn: state.current.myTurn, now: Date.now(), lastInputAt: lastInput.current });
      noteProgress(state.current.round, clock.current);
    }, 1000);
    return () => clearInterval(timer);
  }, [running]);
  return clock;
}

// Online: this player's time split, sent once per match (the room reports the result).
function sendOnlineTime(matchRef, round, clock, reason) {
  if (!matchRef) return;
  const key = `warzil-time-${matchRef}`;
  try {
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
  } catch {
    // ignore
  }
  capture('online_match_time', { mode: 'online', match_id: matchRef, reason, round_reached: round, active_s: clock.active, waiting_s: clock.waiting, idle_s: clock.idle, hidden_s: clock.hidden });
}

// online (optional): { game, me, names, isHost, dispatch, onRematch, onLeave } for a
// server-run room. Without it the match is local (solo, daily, vs. AI).
// hotseat (optional): { humans, names } when friends share this device; the board
// is shown from the point of view of whoever is playing (or played last).
// match: analytics record of a local match (solo, daily, hotseat); online rooms report their own.
export default function GameScreen({ initialGame, onRematch, onChangeCandidate, prefs, onMatchEnd, dailyRecord, online, hotseat, match }) {
  const [localGame, setLocalGame] = useState(initialGame);
  // Online: which state is selected/targeted is local to this screen.
  const [localSel, setLocalSel] = useState({ selected: null, target: null });
  // Hotseat: the last person who confirmed "Estou pronto".
  const [readyFor, setReadyFor] = useState(null);
  // Memoized so the AI timer below is not restarted by unrelated re-renders.
  const hotseatGame = useMemo(() => hotseat && { ...localGame, human: viewerOf(localGame, hotseat.humans), playerNames: hotseat.names }, [localGame, hotseat]);
  const game = online
    ? { ...online.game, human: online.me, playerNames: online.names, selected: localSel.selected, target: localSel.target }
    : (hotseatGame ?? localGame);

  // Every move goes through applyAction: locally for solo games, to the server online.
  const act = (action) => {
    if (!online) {
      setLocalGame((g) => applyAction(g, action));
    } else if (action.kind === 'select') {
      setLocalSel({ selected: action.id ?? null, target: null });
    } else if (action.kind === 'target') {
      setLocalSel((sel) => ({ ...sel, target: action.id ?? null }));
    } else {
      online.dispatch(action);
    }
  };

  // The turn-order draw is shown once, when a match starts (not after a reload mid-match).
  const [drawOpen, setDrawOpen] = useState(() => game.round === 1 && game.turn === 0 && !(game.rallyPlacements?.length > 0));
  const closeDraw = useCallback(() => setDrawOpen(false), []);

  // Online: after each server update, keep the origin/target the engine left
  // (so "Atacar" again works), and clear it when it is someone else's turn.
  const serverGame = online?.game;
  useEffect(() => {
    if (!serverGame) return;
    const mine = serverGame.current === online.me;
    setLocalSel(mine ? { selected: serverGame.selected, target: serverGame.target } : { selected: null, target: null });
  }, [serverGame]);
  const { settings } = prefs;
  const [placeAmount, setPlaceAmount] = useState(REINFORCE_AMOUNT[settings.reinforce]);
  const [placeTarget, setPlaceTarget] = useState(null);
  const [placeCount, setPlaceCount] = useState(1);
  const [occupyTotal, setOccupyTotal] = useState(0);
  const [moveAmount, setMoveAmount] = useState(1);
  // One picker per match: remembers recent lines so jokes don't repeat back to back.
  const [choose] = useState(createLinePicker);
  useGameSounds(game);

  // Report the result once (daily challenge records).
  const reported = useRef(false);
  useEffect(() => {
    if (!online && game.phase === 'over' && !reported.current) {
      reported.current = true;
      onMatchEnd?.(game);
    }
  }, [game, onMatchEnd]);

  const isHumanTurn = game.current === game.human && game.phase !== 'over';
  const human = game.human;
  const rivals = game.factions.filter((f) => f !== human);

  // Analytics: completed once, or abandoned when leaving before the end.
  const clock = useMatchClock(game.phase !== 'over', isHumanTurn && !drawOpen, game.round);
  const latest = useRef(game);
  latest.current = game;
  const matchRef = online?.matchRef;
  useEffect(() => {
    if (game.phase !== 'over') return;
    if (online) {
      sendOnlineTime(matchRef, game.round, clock.current, 'over');
    } else if (match) {
      const result = hotseat
        ? hotseat.humans.includes(game.winner) ? 'human_won' : 'cpu_won'
        : game.winner === game.human ? 'win' : 'loss';
      completeMatch(match, { result, winner: game.winner, rounds: game.round }, clock.current);
    }
  }, [game.phase]);
  useEffect(
    () => () => {
      if (online) sendOnlineTime(matchRef, latest.current.round, clock.current, 'left');
      else abandonMatch(match, latest.current.round, clock.current, 'menu');
    },
    [],
  );

  // The AI plays one visible step at a time; the wait grows with what just
  // happened (a conquest or an elimination gets a beat to be noticed).
  const seenLogId = useRef(game.log[0]?.id ?? 0);
  useEffect(() => {
    // Online, the server plays the AI. Locally it waits for the order draw to close.
    if (online || drawOpen || game.current === game.human || game.phase === 'over') return undefined;
    const delay = aiDelay(game, seenLogId.current, settings.aiSpeed);
    const timer = setTimeout(() => {
      seenLogId.current = game.log[0]?.id ?? 0;
      setLocalGame((g) => aiStep(g));
    }, delay);
    return () => clearTimeout(timer);
  }, [game, settings.aiSpeed, drawOpen]);

  // Each new rally starts from the configured mode, so a "Tudo" picked last
  // round never silently dumps every reinforcement on the next tap.
  const myRally = game.phase === 'reinforce' && game.current === human;
  useEffect(() => {
    if (myRally) {
      setPlaceAmount(REINFORCE_AMOUNT[settings.reinforce]);
      setPlaceTarget(null);
    }
  }, [myRally, game.round, settings.reinforce]);

  // Sensible defaults whenever a choice opens up.
  useEffect(() => {
    if (game.pendingOccupy) setOccupyTotal(game.pendingOccupy.max);
  }, [game.pendingOccupy]);
  useEffect(() => {
    if (game.phase === 'fortify' && game.selected) setMoveAmount(movableTroops(game, game.selected));
  }, [game.phase, game.selected, game.target]);

  const { clickable, highlighted } = useMemo(() => {
    const click = new Set();
    let high = new Set();
    if (isHumanTurn) {
      const mine = STATE_IDS.filter((id) => game.owner[id] === human);
      if (game.phase === 'reinforce') mine.forEach((id) => click.add(id));
      if (game.phase === 'attack') {
        mine.filter((id) => attackTargets(game, id).length > 0).forEach((id) => click.add(id));
        if (game.selected) high = new Set(attackTargets(game, game.selected));
      }
      if (game.phase === 'fortify') {
        mine.filter((id) => fortifyTargets(game, id).length > 0).forEach((id) => click.add(id));
        if (game.selected) high = new Set(fortifyTargets(game, game.selected));
      }
      high.forEach((id) => click.add(id));
    }
    return { clickable: click, highlighted: high };
  }, [game, human, isHumanTurn]);

  const onSelect = (id) => {
    if (!isHumanTurn) return;
    const mine = game.owner[id] === human;
    switch (game.phase) {
      case 'reinforce':
        // Nothing left to place (e.g. the AI placed it while covering): no message
        // to send, so the server never answers "Jogada não permitida".
        if (!mine || game.reinforcements <= 0) break;
        if (placeAmount === 'picker') {
          setPlaceTarget(id);
          setPlaceCount(Math.min(placeCount, game.reinforcements) || 1);
        } else {
          act({ kind: 'place', id, amount: placeAmount === 'all' ? game.reinforcements : placeAmount });
        }
        break;
      case 'attack':
        // Tapping a glowing enemy rolls the dice right away; the selection stays for the next roll.
        if (game.selected && canAttack(game, game.selected, id)) act({ kind: 'attack', from: game.selected, to: id });
        else if (mine && id === game.selected) act({ kind: 'select', id: null });
        else if (mine && attackTargets(game, id).length > 0) act({ kind: 'select', id });
        break;
      case 'fortify':
        if (game.selected && canFortify(game, game.selected, id)) act({ kind: 'target', id });
        else if (mine && id === game.selected) act({ kind: 'select', id: null });
        else if (mine && fortifyTargets(game, id).length > 0) act({ kind: 'select', id });
        break;
      default:
        break;
    }
  };

  const name = (f) => FACTIONS[f].name;
  const stateName = (id) => STATES[id].name;

  // ---------- Action panel ----------
  let panel = null;
  const iAmOut = game.eliminated.includes(human);
  if (online && iAmOut && game.phase !== 'over') {
    panel = (
      <div className="panel-body">
        <p>🏴 Você foi eliminado. Acompanhe a guerra até o fim: a revanche vem depois.</p>
      </div>
    );
  } else if (!isHumanTurn && game.phase !== 'over') {
    const who = game.playerNames?.[game.current];
    panel = (
      <div className="panel-body thinking">
        <span className="spinner" aria-hidden="true" />
        {name(game.current)}
        {who ? ` (${who})` : ''} está {game.phase === 'attack' ? 'atacando' : game.phase === 'reinforce' ? 'no comício, distribuindo reforços' : 'armando a próxima'}…
      </div>
    );
  } else if (game.phase === 'reinforce') {
    panel = (
      <div className="panel-body">
        <p className="big-number">
          <span>{game.reinforcements}</span> {game.reinforcements === 1 ? 'reforço para colocar' : 'reforços para colocar'}
        </p>
        <div className="chips" role="radiogroup" aria-label="Tropas por toque">
          {[1, 5, 'all', 'picker'].map((n) => (
            <button
              key={n}
              role="radio"
              aria-checked={placeAmount === n}
              className={`chip ${placeAmount === n ? 'on' : ''}`}
              onClick={() => {
                setPlaceAmount(n);
                setPlaceTarget(null);
              }}
            >
              {n === 'all' ? 'Tudo por toque' : n === 'picker' ? 'Escolher' : `+${n} por toque`}
            </button>
          ))}
        </div>
        {placeAmount === 'all' && game.reinforcements > 0 && <p className="hint warn-text">Atenção: o próximo toque coloca todos os {game.reinforcements} reforços.</p>}
        {placeAmount === 'picker' &&
          (placeTarget && game.reinforcements > 0 ? (
            <>
              <QuantityPicker
                label={`Quantos em ${stateName(placeTarget)}?`}
                min={1}
                max={game.reinforcements}
                value={Math.min(placeCount, game.reinforcements)}
                onChange={setPlaceCount}
              />
              <button
                className="btn primary"
                onClick={() => {
                  act({ kind: 'place', id: placeTarget, amount: Math.min(placeCount, game.reinforcements) });
                  setPlaceTarget(null);
                }}
              >
                Colocar {Math.min(placeCount, game.reinforcements)} em {stateName(placeTarget)}
              </button>
            </>
          ) : (
            game.reinforcements > 0 && <p className="hint">Toque num estado seu para escolher a quantidade.</p>
          ))}
        <div className="buttons rally-undo">
          <button className="btn ghost" onClick={() => act({ kind: 'undo' })} disabled={!game.rallyPlacements.length}>
            ↶ Desfazer
          </button>
          <button className="btn ghost" onClick={() => act({ kind: 'resetRally' })} disabled={!game.rallyPlacements.length}>
            Recomeçar
          </button>
        </div>
        <button className="btn primary" onClick={() => act({ kind: 'finishRally' })} disabled={game.reinforcements > 0}>
          {game.reinforcements > 0 ? `Faltam ${game.reinforcements}` : 'Concluir comício ✓'}
        </button>
        {game.round === 1 && game.openingBonus?.[human] > 0 && (
          <p className="hint small">Inclui +{game.openingBonus[human]} de compensação de abertura (você começou com menos).</p>
        )}
        {game.round === 1 && game.positionBonus?.[human] > 0 && (
          <p className="hint small">
            Inclui +{game.positionBonus[human]} por jogar em {game.factions.indexOf(human) + 1}º (quem ataca depois recebe reforço extra no 1º comício).
          </p>
        )}
        <p className="hint small">
          {game.round === 1
            ? `Rodada 1: todos fazem o comício antes de qualquer ataque. Ordem sorteada: ${game.factions.map(name).join(' → ')}.`
            : 'Seu turno: comício, batalha e movimentação.'}
        </p>
      </div>
    );
  } else if (game.phase === 'attack') {
    const from = game.selected;
    const ready = from && game.target && canAttack(game, from, game.target);
    const myDice = from ? attackerDiceCount(game.troops[from]) : 0;
    panel = (
      <div className="panel-body">
        {ready ? (
          <>
            <p className="matchup">
              <b className={human}>{stateName(from)} ({game.troops[from]})</b>
              <span className="vs">x</span>
              <b className={game.owner[game.target]}>{stateName(game.target)} ({game.troops[game.target]})</b>
            </p>
            <p className="dice-info">
              🎲 {myDice} contra {defenderDiceCount(game.troops[game.target])} · toque no inimigo ou:
            </p>
            <div className="buttons">
              <button className="btn primary" onClick={() => act({ kind: 'attack', from, to: game.target })}>
                🎲 Atacar
              </button>
              <button className="btn warn" onClick={() => act({ kind: 'blitz', from, to: game.target })}>
                ⚡ Tudo ou nada
              </button>
            </div>
          </>
        ) : (
          <p className="hint">
            {from
              ? `Origem: ${stateName(from)} (${game.troops[from]}). Toque num inimigo brilhando para rolar ${myDice} ${myDice === 1 ? 'dado' : 'dados'}.`
              : PHASE_HELP.attack}
          </p>
        )}
        <button className="btn ghost" onClick={() => act({ kind: 'endAttack' })}>
          Ir para movimentação →
        </button>
      </div>
    );
  } else if (game.phase === 'occupy') {
    const { from, to, min, max } = game.pendingOccupy;
    panel = (
      <div className="panel-body">
        <p>
          🎉 Você conquistou <b>{fill('{o_state}', { state: to })}</b>!
        </p>
        <QuantityPicker label="Quantos exércitos entram?" min={min} max={max} value={occupyTotal} onChange={setOccupyTotal} />
        <p className="hint">
          Mínimo {min} (dados do último ataque). {stateName(from)} fica com {game.troops[from] + min - occupyTotal}.
        </p>
        <button className="btn primary" onClick={() => act({ kind: 'occupy', total: occupyTotal })}>
          Confirmar {occupyTotal}
        </button>
      </div>
    );
  } else if (game.phase === 'fortify') {
    const from = game.selected;
    const ready = from && game.target && canFortify(game, from, game.target);
    panel = (
      <div className="panel-body">
        {ready ? (
          <>
            <p>
              De <b>{stateName(from)}</b> para <b>{stateName(game.target)}</b>
            </p>
            <QuantityPicker
              label="Quantos exércitos deseja enviar?"
              min={1}
              max={movableTroops(game, from)}
              value={moveAmount}
              onChange={setMoveAmount}
            />
            <div className="buttons">
              <button className="btn primary" onClick={() => act({ kind: 'fortify', from, to: game.target, amount: moveAmount })}>
                Mover {moveAmount}
              </button>
              <button className="btn ghost" onClick={() => act({ kind: 'select', id: null })}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <p className="hint">
            {from
              ? `${stateName(from)} pode enviar até ${movableTroops(game, from)}${game.received?.[from] ? ` (os ${game.received[from]} que chegaram ficam)` : ''}. Escolha um estado vizinho seu; o que sobrar pode ir para outro vizinho.`
              : PHASE_HELP.fortify}
          </p>
        )}
        <button className="btn ghost" onClick={() => act({ kind: 'endTurn' })}>
          Encerrar turno →
        </button>
      </div>
    );
  }

  // End of match: either someone holds the whole map ('victory') or the human
  // lost their last state while rivals remain ('knockout').
  const finalEvent = game.log.find((e) => e.type === 'victory' || e.type === 'knockout');
  const humanWon = game.winner === human;
  const finalLoser = humanWon || hotseat ? game.eliminated.at(-1) : human;
  const loserFaces = humanWon || hotseat ? game.factions.filter((f) => f !== game.winner) : [human];
  const handoff = hotseat && !drawOpen && needsHandoff(localGame, hotseat.humans, readyFor);

  return (
    <div className={`game theme-${human}`}>
      {drawOpen && (
        <OrderDraw
          order={game.factions}
          names={online ? online.names : (hotseat?.names ?? {})}
          you={online ? online.me : hotseat ? null : game.human}
          bonus={game.positionBonus}
          onDone={closeDraw}
        />
      )}
      {handoff && <Handoff faction={game.current} name={hotseat.names[game.current]} onReady={() => setReadyFor(game.current)} />}
      <header className={`hud ${rivals.length > 1 ? 'multi' : ''}`}>
        <PlayerChip game={game} faction={human} />
        <div className="round">
          <span className="logo small">
            WAR<span className="logo-zil">ZIL</span>
          </span>
          <span>
            Rodada {game.round} <SettingsButton {...prefs} />
          </span>
          <span className="opener">ordem: {roundOrder(game).filter((f) => !game.eliminated.includes(f)).map(name).join(' → ')}</span>
        </div>
        {rivals.length === 1 ? (
          <PlayerChip game={game} faction={rivals[0]} />
        ) : (
          <div className="rivals">
            {rivals.map((f) => (
              <PlayerChip key={f} game={game} faction={f} compact />
            ))}
          </div>
        )}
      </header>

      <div className="board">
        <section className="map-wrap">
          <BrazilMap
            game={game}
            clickable={clickable}
            highlighted={highlighted}
            spent={game.phase === 'fortify' ? new Set(Object.keys(game.movedOut ?? {}).filter((id) => movableTroops(game, id) === 0)) : EMPTY}
            onSelect={onSelect}
          />
          <EventBanner game={game} choose={choose} />
          <DiceTray game={game} at="map" />
          <SpeechBubble game={game} choose={choose} />
        </section>

        <aside className="sidebar">
          <div className={`panel ${game.current}`}>
            <div className="panel-title">
              <span className={`turn-dot ${game.current}`} />
              {isHumanTurn ? 'Sua vez' : `Vez de ${name(game.current)}`}
              {game.phase !== 'over' && <span className="phase">{PHASE_NAMES[game.phase]}</span>}
            </div>
            {isHumanTurn && game.phase === 'reinforce' && <p className="hint">{PHASE_HELP.reinforce}</p>}
            <Coach game={game} me={isHumanTurn && !handoff ? human : null} />
            {panel}
            {/* Phones: the dice pop up right above the action panel, where the player is looking. */}
            <DiceTray game={game} at="panel" />
          </div>

          <RollPanel game={game} />
          <CampaignLog game={game} choose={choose} />
          <RegionsPanel game={game} />

          <button className="btn ghost quit" onClick={online ? online.onLeave : onChangeCandidate}>
            {online ? '⟲ Sair da sala' : '⟲ Voltar ao menu'}
          </button>
          <p className="disclaimer">{DISCLAIMER}</p>
        </aside>
      </div>

      {game.phase === 'over' && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="end-title">
          <div className={`end-card ${game.winner}`}>
            <div className="end-faces">
              <Caricature who={game.winner} mood="happy" size={130} className="winner-face" />
              {loserFaces.map((f) => (
                <Caricature key={f} who={f} mood="sad" size={loserFaces.length > 1 ? 56 : 84} className="loser-face" />
              ))}
            </div>
            <h2 id="end-title">
              {hotseat ? (hotseat.names[game.winner] ? VICTORY_TITLES.local.replace('{who}', hotseat.names[game.winner]) : VICTORY_TITLES.localCpu) : humanWon ? VICTORY_TITLES.win : VICTORY_TITLES.lose}
            </h2>
            <p className="end-quote">“{describeEvent(finalEvent, choose).text}”</p>
            <p className="end-sub">{defeatLine(finalLoser, finalEvent.seed, choose)}</p>
            <p className="end-stats">
              {finalEvent.type === 'victory'
                ? `${name(game.winner)} levou os 27 estados em ${game.round} rodadas.`
                : `${name(game.winner)} tirou ${name(human)} do mapa na rodada ${game.round}.`}
            </p>
            {game.daily && dailyRecord && (
              <p className="end-daily">
                📅 Desafio do dia {formatDailyKey(game.daily)}
                <br />
                Tentativas: {dailyRecord.attempts} · Vitórias: {dailyRecord.wins} · Melhor: {dailyRecord.bestRounds ? `${dailyRecord.bestRounds} rodadas` : '—'}
              </p>
            )}
            {online ? (
              <div className="buttons">
                {online.isHost ? (
                  <button className="btn primary" onClick={online.onRematch} autoFocus>
                    🔁 Revanche na sala
                  </button>
                ) : (
                  <p className="hint">Aguardando o anfitrião chamar a revanche…</p>
                )}
                <button className="btn ghost" onClick={online.onLeave}>
                  Sair da sala
                </button>
              </div>
            ) : (
              <div className="buttons">
                <button className="btn primary" onClick={onRematch} autoFocus>
                  🔁 {game.daily ? 'Tentar de novo' : 'Revanche'}
                </button>
                <button className="btn ghost" onClick={onChangeCandidate}>
                  {hotseat ? 'Trocar jogadores' : 'Trocar candidato'}
                </button>
              </div>
            )}
            <ShareSheet model={cardModel(game, { quote: describeEvent(finalEvent, choose).text })} />
            <SupportButton className="support-end" />
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { nextHeldEvent } from '../game/highlights.js';
import BrazilMap from './BrazilMap.jsx';
import Caricature from './Caricature.jsx';
import OrderDraw from './OrderDraw.jsx';
import { CampaignLog, EventBanner, PlayerChip, RegionsPanel, RollPanel, SpeechBubble, useGameSounds } from './BoardParts.jsx';
import SettingsButton from './SettingsPanel.jsx';
import ShareSheet from './ShareSheet.jsx';
import { cardModel } from '../game/share.js';
import { FACTIONS } from '../game/data.js';
import { roundOrder } from '../game/engine.js';
import { PHASE_NAMES, createLinePicker, describeEvent } from '../game/texts.js';
import {
  SIM_SPEEDS,
  createSimulation,
  leaderOf,
  restartSimulation,
  setSpeed,
  simulationDelay,
  stepSimulation,
  togglePause,
} from '../game/simulation.js';

const EMPTY = new Set();
const SIM_NOTE = 'Competição fictícia entre personagens do jogo. Não é previsão eleitoral.';
// Minimum time a line stays in the bubble, whatever the speed.
const HOLD_MS = 2600;

// Keeps the speech bubble on one event long enough to read it; more important
// events (eliminations, regions, lead changes) may take over earlier.
function useHeldEvent(log) {
  const [held, setHeld] = useState({ event: log[0] ?? null, at: Date.now() });
  const latestId = log[0]?.id;
  useEffect(() => {
    const evaluate = () =>
      setHeld((h) => {
        const event = nextHeldEvent({ shown: h.event, shownAt: h.at, log, now: Date.now(), holdMs: HOLD_MS });
        return event === h.event ? h : { event, at: Date.now() };
      });
    evaluate();
    // Re-check when the current line's time is up, even if nothing new happens.
    const timer = setTimeout(evaluate, HOLD_MS + 50);
    return () => clearTimeout(timer);
  }, [latestId]);
  return held.event;
}

// "Simular guerra": every candidate is played by the computer; the viewer only watches.
export default function SimulationScreen({ factions, onMenu, prefs }) {
  const [sim, setSim] = useState(() => createSimulation(factions, Math.random, 1, prefs.settings.armies));
  const [choose, setChoose] = useState(createLinePicker);
  const { game } = sim;
  useGameSounds(game);
  // Order draw at the start of each simulation; the match waits for it.
  const [drawFor, setDrawFor] = useState(game);
  const drawOpen = drawFor === game && game.turn === 0;
  const heldEvent = useHeldEvent(game.log);
  const name = (f) => FACTIONS[f].name;

  useEffect(() => {
    if (drawOpen || sim.paused || sim.stalled || game.phase === 'over') return undefined;
    const timer = setTimeout(() => setSim((s) => stepSimulation(s)), simulationDelay(sim));
    return () => clearTimeout(timer);
  }, [sim, game.phase, drawOpen]);

  const restart = () => {
    const next = restartSimulation(sim);
    setSim(next);
    setDrawFor(next.game);
    setChoose(() => createLinePicker());
  };

  const leader = leaderOf(game);
  const over = game.phase === 'over';
  const victory = over ? game.log.find((e) => e.type === 'victory') : null;

  return (
    <div className="game sim">
      {drawOpen && <OrderDraw order={game.factions} bonus={game.positionBonus} onDone={() => setDrawFor(null)} />}
      <header className="hud multi sim-hud">
        <div className="round">
          <span className="logo small">
            WAR<span className="logo-zil">ZIL</span>
          </span>
          <span>
            🎬 Simulação · Rodada {game.round} <SettingsButton {...prefs} />
          </span>
          <span className="opener">ordem: {roundOrder(game).filter((f) => !game.eliminated.includes(f)).map(name).join(' → ')}</span>
        </div>
        <div className="rivals">
          {game.factions.map((f) => (
            <PlayerChip key={f} game={game} faction={f} compact />
          ))}
        </div>
      </header>

      <div className="board">
        <section className="map-wrap">
          <BrazilMap game={game} clickable={EMPTY} highlighted={EMPTY} spent={EMPTY} onSelect={() => {}} />
          <EventBanner game={game} choose={choose} />
          <SpeechBubble game={game} choose={choose} event={heldEvent} />
        </section>

        <aside className="sidebar">
          <div className={`panel sim-controls ${game.current}`}>
            <div className="panel-title">
              <span className={`turn-dot ${game.current}`} />
              {over ? 'Fim da simulação' : `Vez de ${name(game.current)}`}
              {!over && <span className="phase">{PHASE_NAMES[game.phase]}</span>}
            </div>
            {leader && !over && (
              <p className="sim-leader">
                🏆 Líder: <b className={leader.faction}>{name(leader.faction)}</b> com {leader.states} estados
              </p>
            )}
            <div className="buttons">
              <button className="btn primary" onClick={() => setSim(togglePause)} disabled={over}>
                {sim.paused ? '▶ Continuar' : '⏸ Pausar'}
              </button>
              <button className="btn ghost" onClick={restart}>
                🔄 Nova distribuição
              </button>
            </div>
            <div className="chips" role="radiogroup" aria-label="Velocidade">
              {SIM_SPEEDS.map((v) => (
                <button
                  key={v}
                  role="radio"
                  aria-checked={sim.speed === v}
                  className={`chip ${sim.speed === v ? 'on' : ''}`}
                  onClick={() => setSim((s) => setSpeed(s, v))}
                >
                  {v}x
                </button>
              ))}
            </div>
          </div>

          <RollPanel game={game} />
          <RegionsPanel game={game} />
          <CampaignLog game={game} choose={choose} />

          <button className="btn ghost quit" onClick={onMenu}>
            ⟲ Voltar ao menu
          </button>
          <p className="disclaimer">{SIM_NOTE}</p>
        </aside>
      </div>

      {over && victory && (
        <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="end-title">
          <div className={`end-card ${game.winner}`}>
            <div className="end-faces">
              <Caricature who={game.winner} mood="happy" size={130} className="winner-face" />
              {game.factions
                .filter((f) => f !== game.winner)
                .map((f) => (
                  <Caricature key={f} who={f} mood="sad" size={game.factions.length > 2 ? 56 : 84} className="loser-face" />
                ))}
            </div>
            <h2 id="end-title">{name(game.winner)} vence a simulação!</h2>
            <p className="end-quote">“{describeEvent(victory, choose).text}”</p>
            <p className="end-stats">
              Duração: {game.round} rodadas e {game.rollCount ?? 0} rolagens de dados.
              <br />
              Ordem de eliminação: {game.eliminated.map(name).join(' → ')}
            </p>
            <p className="end-sub">{SIM_NOTE}</p>
            <div className="buttons">
              <button className="btn primary" onClick={restart} autoFocus>
                🔁 Simular de novo
              </button>
              <button className="btn ghost" onClick={onMenu}>
                Voltar ao menu
              </button>
            </div>
            <ShareSheet model={cardModel(game, { quote: describeEvent(victory, choose).text })} />
          </div>
        </div>
      )}
    </div>
  );
}

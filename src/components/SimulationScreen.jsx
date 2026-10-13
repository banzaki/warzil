import { useEffect, useState } from 'react';
import BrazilMap from './BrazilMap.jsx';
import Caricature from './Caricature.jsx';
import { CampaignLog, PlayerChip, RegionsPanel, RollPanel, SpeechBubble } from './BoardParts.jsx';
import { FACTIONS } from '../game/data.js';
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

// "Simular guerra": every candidate is played by the computer; the viewer only watches.
export default function SimulationScreen({ factions, onMenu }) {
  const [sim, setSim] = useState(() => createSimulation(factions));
  const [choose, setChoose] = useState(createLinePicker);
  const { game } = sim;
  const name = (f) => FACTIONS[f].name;

  useEffect(() => {
    if (sim.paused || sim.stalled || game.phase === 'over') return undefined;
    const timer = setTimeout(() => setSim((s) => stepSimulation(s)), simulationDelay(sim));
    return () => clearTimeout(timer);
  }, [sim, game.phase]);

  const restart = () => {
    setSim((s) => restartSimulation(s));
    setChoose(() => createLinePicker());
  };

  const leader = leaderOf(game);
  const over = game.phase === 'over';
  const victory = over ? game.log.find((e) => e.type === 'victory') : null;

  return (
    <div className="game sim">
      <header className="hud multi sim-hud">
        <div className="round">
          <span className="logo small">
            WAR<span className="logo-zil">ZIL</span>
          </span>
          <span>🎬 Simulação · Rodada {game.round}</span>
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
          <SpeechBubble game={game} choose={choose} />
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
          </div>
        </div>
      )}
    </div>
  );
}

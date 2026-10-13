import { useState } from 'react';
import Caricature from './Caricature.jsx';
import SettingsButton from './SettingsPanel.jsx';
import { EXTRA_CANDIDATES, MAX_FACTIONS, PROTAGONISTS } from '../game/data.js';
import { CANDIDATES, DISCLAIMER } from '../game/texts.js';
import { formatDailyKey } from '../game/daily.js';

const ARMY_LABELS = [
  [1, '1 por estado'],
  [2, '2'],
  [3, '3'],
  ['mixed', 'Misturado (1–5)'],
];
const armyLabel = (mode) => (mode === 'mixed' ? 'misturados (1–5)' : `${mode} por estado`);

const MAX_INVITES = MAX_FACTIONS - PROTAGONISTS.length;

const ALL_CANDIDATES = [...PROTAGONISTS, ...EXTRA_CANDIDATES];

// invited: extra candidates joining Lula and Flávio (0-2). onPick(human, rivals).
// onSimulate(factions): start an AI-vs-AI simulation with 2-4 candidates.
export default function StartScreen({ invited, onInvitedChange, deal, onDealChange, onPick, onSimulate, prefs, daily }) {
  const [showMore, setShowMore] = useState(invited.length > 0);
  const [showSim, setShowSim] = useState(false);
  const [simPicks, setSimPicks] = useState(PROTAGONISTS);
  const toggleSim = (id) =>
    setSimPicks((picks) => (picks.includes(id) ? picks.filter((f) => f !== id) : [...picks, id]));
  const participants = [...PROTAGONISTS, ...invited];
  const pick = (id) => onPick(id, participants.filter((f) => f !== id));
  const toggle = (id) =>
    onInvitedChange(invited.includes(id) ? invited.filter((f) => f !== id) : [...invited, id]);

  return (
    <main className="start">
      <div className="start-gear">
        <SettingsButton {...prefs} />
      </div>
      <header className="start-header">
        <h1 className="logo">
          WAR<span className="logo-zil">ZIL</span>
        </h1>
        <p className="subtitle">A Guerra dos Votos</p>
        <p className="tagline">27 estados. Dados, tretas e nenhuma diplomacia.</p>
      </header>

      <h2 className="choose">Escolha seu candidato</h2>
      {invited.length > 0 && (
        <p className="match-size">
          Partida com {participants.length} candidatos: {participants.map((f) => CANDIDATES[f].name).join(', ')}
        </p>
      )}
      <div className="candidates">
        {PROTAGONISTS.map((id) => (
          <button key={id} className={`candidate-card ${id}`} onClick={() => pick(id)}>
            <Caricature who={id} mood="happy" size={130} />
            <span className="candidate-name">{CANDIDATES[id].name}</span>
            <span className="candidate-title">{CANDIDATES[id].title}</span>
            <span className="candidate-pitch">{CANDIDATES[id].pitch}</span>
            <span className="candidate-cta">Jogar de {CANDIDATES[id].name}</span>
          </button>
        ))}
      </div>

      <div className="deal-choice">
        <span>Exércitos iniciais:</span>
        <div className="chips" role="radiogroup" aria-label="Exércitos iniciais">
          {ARMY_LABELS.map(([value, label]) => (
            <button
              key={String(value)}
              role="radio"
              aria-checked={prefs.settings.armies === value}
              className={`chip ${prefs.settings.armies === value ? 'on' : ''}`}
              onClick={() => prefs.onChange({ ...prefs.settings, armies: value })}
            >
              {label}
            </button>
          ))}
        </div>
        {prefs.settings.armies === 'mixed' && <small>De 1 a 5 por estado, com o mesmo total de exércitos para todos.</small>}
      </div>

      {invited.length === 0 && (
        <div className="deal-choice">
          <span>Distribuição inicial:</span>
          <div className="chips" role="radiogroup" aria-label="Distribuição inicial">
            {[
              ['random', 'Aleatória'],
              ['polarized', 'Brasil Polarizado'],
            ].map(([value, label]) => (
              <button key={value} role="radio" aria-checked={deal === value} className={`chip ${deal === value ? 'on' : ''}`} onClick={() => onDealChange(value)}>
                {label}
              </button>
            ))}
          </div>
          {deal === 'polarized' && (
            <small>
              Cenário fictício: Lula começa concentrado no Norte/Nordeste e Flávio no Centro-Sul. O lado Norte/Nordeste recebe +2 ou +3
              reforços no primeiro comício para compensar o território mais espalhado. Não é retrato do eleitorado.
            </small>
          )}
        </div>
      )}

      <details className="more" open={showMore} onToggle={(e) => setShowMore(e.currentTarget.open)}>
        <summary>{showMore ? '− Menos candidatos' : '+ Mais candidatos'}</summary>
        <p className="more-hint">Convide até {MAX_INVITES} para uma partida com 3 ou 4 candidatos. Os adversários são da CPU.</p>
        <ul className="extras">
          {EXTRA_CANDIDATES.map((id) => {
            const on = invited.includes(id);
            const full = !on && invited.length >= MAX_INVITES;
            return (
              <li key={id} className={`extra ${id} ${on ? 'on' : ''}`}>
                <Caricature who={id} mood={on ? 'happy' : 'neutral'} size={56} />
                <span className="extra-text">
                  <b>{CANDIDATES[id].name}</b>
                  <small>{CANDIDATES[id].title}</small>
                </span>
                <span className="extra-actions">
                  <button className="chip" aria-pressed={on} disabled={full} onClick={() => toggle(id)}>
                    {on ? 'Convidado ✓' : 'Convidar'}
                  </button>
                  {on && (
                    <button className="chip on" onClick={() => pick(id)}>
                      Jogar de {CANDIDATES[id].name}
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </details>

      <section className="daily-card">
        <div className="daily-head">
          <strong>📅 Desafio do dia · {formatDailyKey(daily.challenge.key)}</strong>
          <small>
            Mesmo começo para todo mundo hoje (exércitos {armyLabel(daily.challenge.armies)}). Vença no menor número de rodadas.
          </small>
        </div>
        <div className="daily-lineup">
          {daily.challenge.factions.map((f, i) => (
            <span key={f} className={`daily-face ${f}`}>
              <Caricature who={f} mood={i === 0 ? 'happy' : 'neutral'} size={i === 0 ? 48 : 36} />
              <small>{i === 0 ? `Você: ${CANDIDATES[f].name}` : CANDIDATES[f].name}</small>
            </span>
          ))}
        </div>
        <p className="daily-stats">
          Tentativas hoje: {daily.record.attempts} · Vitórias: {daily.record.wins} · Melhor:{' '}
          {daily.record.bestRounds ? `${daily.record.bestRounds} rodadas` : '—'}
        </p>
        <button className="btn primary daily-play" onClick={daily.onPlay}>
          {daily.record.attempts ? 'Tentar de novo' : 'Jogar o desafio'}
        </button>
      </section>

      <details className="more sim-setup" open={showSim} onToggle={(e) => setShowSim(e.currentTarget.open)}>
        <summary>{showSim ? '− Fechar simulação' : '🎬 Simular guerra (IA x IA)'}</summary>
        <p className="more-hint">Escolha de 2 a {MAX_FACTIONS} candidatos e assista o computador jogar.</p>
        <div className="sim-picks">
          {ALL_CANDIDATES.map((id) => {
            const on = simPicks.includes(id);
            return (
              <button
                key={id}
                className={`sim-pick ${id} ${on ? 'on' : ''}`}
                aria-pressed={on}
                disabled={!on && simPicks.length >= MAX_FACTIONS}
                onClick={() => toggleSim(id)}
              >
                <Caricature who={id} mood={on ? 'happy' : 'neutral'} size={44} />
                <span>{CANDIDATES[id].name}</span>
              </button>
            );
          })}
        </div>
        <button
          className="btn primary sim-start"
          disabled={simPicks.length < 2}
          onClick={() => onSimulate(ALL_CANDIDATES.filter((id) => simPicks.includes(id)))}
        >
          ▶ Iniciar simulação ({simPicks.length})
        </button>
      </details>

      <section className="how">
        <h3>Como jogar</h3>
        <ol>
          <li><b>Comício:</b> coloque seus reforços. Errou? Dá para desfazer. Na 1ª rodada, todos fazem o comício antes de qualquer ataque.</li>
          <li><b>Batalha:</b> ataque vizinhos quantas vezes quiser, com até 3 dados. Empate é da defesa.</li>
          <li><b>Movimentação:</b> cada estado envia exércitos uma vez por turno. Quem chega não sai de novo.</li>
        </ol>
        <p>
          Da 2ª rodada em diante, cada candidato faz o turno completo: comício, batalha e movimentação. Quem abre a partida é sorteado e a vez de abrir
          passa adiante a cada rodada. Domine uma região inteira para ganhar bônus. Seja o último candidato no mapa para vencer.
        </p>
      </section>

      <footer className="disclaimer">
        {DISCLAIMER}
        <br />
        Mapa:{' '}
        <a href="https://github.com/VictorCazanave/svg-maps" target="_blank" rel="noreferrer">
          svg-maps
        </a>{' '}
        de Victor Cazanave (CC BY 4.0).
      </footer>
    </main>
  );
}

import { useState } from 'react';
import Caricature from './Caricature.jsx';
import SettingsButton from './SettingsPanel.jsx';
import SupportButton from './SupportButton.jsx';
import { CONTACT_URL } from '../game/support.js';
import { capture } from '../game/analytics.js';
import PrivacyLink from './PrivacyLink.jsx';

const pickMode = (mode) => capture('mode_selected', { mode });
import { EXTRA_CANDIDATES, MAX_FACTIONS, PROTAGONISTS } from '../game/data.js';
import { CANDIDATES, DISCLAIMER } from '../game/texts.js';
import { formatDailyKey } from '../game/daily.js';
import { MIN_LOCAL_HUMANS, NICK_MAX, validSeats } from '../game/hotseat.js';

const ARMY_LABELS = [
  [1, '1 por estado'],
  [2, '2'],
  [3, '3'],
  ['mixed', 'Misturado (1–5)'],
];
const armyLabel = (mode) => (mode === 'mixed' ? 'misturados, de 1 a 5' : `${mode} por estado`);

const ALL_CANDIDATES = [...PROTAGONISTS, ...EXTRA_CANDIDATES];
const name = (id) => CANDIDATES[id].name;

// Default opponents for a match of `size`: the protagonists first, then the others.
const defaultRivals = (human, size) => ALL_CANDIDATES.filter((f) => f !== human).slice(0, size - 1);

const isDuelLulaFlavio = (human, rivals) => rivals.length === 1 && [human, rivals[0]].sort().join() === 'flavio,lula';

// Menu in steps: 1) mode, 2) candidate, 3) match settings, 4) start (the game
// screen opens with the turn-order draw). `step` comes from App so "Trocar
// candidato" can come back straight to step 2.
// onPick(human, rivals) starts a solo match; onSimulate(factions) an AI-vs-AI one.
// localSeats/onLocalSeatsChange/onLocal(seats, deal): local multiplayer on this device.
export default function StartScreen({
  step: initialStep = 'mode',
  rivals,
  onRivalsChange,
  deal,
  onDealChange,
  onPick,
  onSimulate,
  onOnline,
  localSeats,
  onLocalSeatsChange,
  onLocal,
  prefs,
  daily,
}) {
  const [step, setStep] = useState(initialStep);
  const [human, setHuman] = useState(null);
  const [showMore, setShowMore] = useState(false);
  const [simPicks, setSimPicks] = useState(PROTAGONISTS);

  const chooseCandidate = (id) => {
    setHuman(id);
    // Keep the previous opponents when they still make sense, otherwise the default duel.
    const kept = rivals.filter((f) => f !== id);
    onRivalsChange(kept.length ? kept : defaultRivals(id, 2));
    setStep('setup');
  };
  const lineupSize = rivals.length + 1;
  const setSize = (size) => onRivalsChange([...rivals, ...defaultRivals(human, MAX_FACTIONS).filter((f) => !rivals.includes(f))].slice(0, size - 1));
  const toggleRival = (id) => {
    if (rivals.includes(id)) {
      if (rivals.length > 1) onRivalsChange(rivals.filter((f) => f !== id));
    } else if (lineupSize < MAX_FACTIONS) onRivalsChange([...rivals, id]);
  };
  const polarizedOk = human && isDuelLulaFlavio(human, rivals);
  const toggleSim = (id) => setSimPicks((picks) => (picks.includes(id) ? picks.filter((f) => f !== id) : [...picks, id]));

  // Local multiplayer seats: each one a different candidate, a person or the CPU.
  const seats = localSeats ?? [];
  const setSeat = (i, change) => onLocalSeatsChange(seats.map((s, k) => (k === i ? { ...s, ...change } : s)));
  const setLocalSize = (size) => {
    const free = ALL_CANDIDATES.filter((f) => !seats.some((s) => s.faction === f));
    const added = free.slice(0, Math.max(0, size - seats.length)).map((faction) => ({ faction, human: true, nick: '' }));
    onLocalSeatsChange([...seats, ...added].slice(0, size));
  };
  const localHumans = seats.filter((s) => s.human).length;
  const localPolarizedOk = seats.length === 2 && isDuelLulaFlavio(seats[0].faction, [seats[1].faction]);

  // Shared by the solo and local setups.
  const armiesChoice = (
    <div className="deal-choice">
      <span>Exércitos iniciais</span>
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
  );
  const dealChoice = (ok) => (
    <div className="deal-choice">
      <span>Distribuição dos estados</span>
      <div className="chips" role="radiogroup" aria-label="Distribuição inicial">
        {[
          ['random', 'Aleatória'],
          ['polarized', 'Brasil Polarizado'],
        ].map(([value, label]) => (
          <button
            key={value}
            role="radio"
            aria-checked={(ok ? deal : 'random') === value}
            disabled={value === 'polarized' && !ok}
            className={`chip ${(ok ? deal : 'random') === value ? 'on' : ''}`}
            onClick={() => onDealChange(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {!ok ? (
        <small>Brasil Polarizado vale só para o duelo Lula x Flávio.</small>
      ) : (
        deal === 'polarized' && (
          <small>
            Cenário fictício: Lula começa concentrado no Norte/Nordeste e Flávio no Centro-Sul. O lado Norte/Nordeste recebe +2 ou +3 reforços no primeiro
            comício para compensar o território mais espalhado. Não é retrato do eleitorado.
          </small>
        )
      )}
    </div>
  );

  const header = (compact) => (
    <header className={`start-header ${compact ? 'compact' : ''}`}>
      <h1 className="logo">
        WAR<span className="logo-zil">ZIL</span>
      </h1>
      {!compact && (
        <>
          <p className="subtitle">A Guerra dos Votos</p>
          <p className="tagline">27 estados. Dados, tretas e nenhuma diplomacia.</p>
        </>
      )}
    </header>
  );

  const back = (to, label = '← Voltar') => (
    <button className="btn ghost step-back" onClick={() => setStep(to)}>
      {label}
    </button>
  );

  const footer = (
    <footer className="disclaimer">
      {DISCLAIMER}
      <br />
      Mapa:{' '}
      <a href="https://github.com/VictorCazanave/svg-maps" target="_blank" rel="noreferrer">
        svg-maps
      </a>{' '}
      de Victor Cazanave (CC BY 4.0).
      <span className="contact">
        <a href={CONTACT_URL} target="_blank" rel="noreferrer">
          Fale com o criador
        </a>
        <small>Feedback, sugestões, parcerias e propostas comerciais.</small>
      </span>
      <PrivacyLink />
    </footer>
  );

  // ---------- 1) Mode ----------
  if (step === 'mode') {
    return (
      <main className="start">
        <div className="start-gear">
          <SettingsButton {...prefs} />
        </div>
        {header(false)}

        <div className="mode-main">
          <button
            className="mode-big solo"
            onClick={() => {
              pickMode('solo');
              setStep('candidate');
            }}
          >
            <span className="mode-faces">
              <Caricature who="lula" mood="happy" size={64} />
              <Caricature who="flavio" mood="happy" size={64} />
            </span>
            <strong>Jogar sozinho</strong>
            <small>Contra a CPU, com 2 a 4 candidatos</small>
          </button>
          {onLocal && (
            <button
              className="mode-big local"
              onClick={() => {
                pickMode('local');
                setStep('local');
              }}
            >
              <span className="mode-icon" aria-hidden="true">
                👥
              </span>
              <strong>Jogar local</strong>
              <small>2 a 4 pessoas no mesmo aparelho</small>
            </button>
          )}
          {onOnline && (
            <button
              className="mode-big online"
              onClick={() => {
                pickMode('online');
                onOnline();
              }}
            >
              <span className="mode-icon" aria-hidden="true">
                🌐
              </span>
              <strong>Jogar online</strong>
              <small>Sala privada com amigos pelo link. Sem cadastro.</small>
            </button>
          )}
        </div>

        <div className="modes">
          <section className="mode-card daily-card">
            <strong>📅 Desafio do dia · {formatDailyKey(daily.challenge.key)}</strong>
            <small>Mesmo começo para todo mundo hoje. Vença no menor número de rodadas.</small>
            <span className="daily-lineup">
              {daily.challenge.factions.map((f, i) => (
                <Caricature key={f} who={f} mood={i === 0 ? 'happy' : 'neutral'} size={30} />
              ))}
              <small>
                Você: {name(daily.challenge.factions[0])} · exércitos {armyLabel(daily.challenge.armies)}
              </small>
            </span>
            {daily.record.attempts > 0 && (
              <small className="daily-stats">
                Hoje: {daily.record.attempts} {daily.record.attempts === 1 ? 'tentativa' : 'tentativas'} · {daily.record.wins}{' '}
                {daily.record.wins === 1 ? 'vitória' : 'vitórias'}
                {daily.record.bestRounds ? ` · melhor: ${daily.record.bestRounds} rodadas` : ''}
              </small>
            )}
            <button
              className="btn primary mode-play daily-play"
              onClick={() => {
                pickMode('daily');
                daily.onPlay();
              }}
            >
              {daily.record.attempts ? 'Tentar de novo' : 'Jogar o desafio'}
            </button>
          </section>

          <section className="mode-card sim-card">
            <strong>🎬 Simular guerra — IA x IA</strong>
            <small>Escolha de 2 a {MAX_FACTIONS} candidatos e assista o computador jogar.</small>
            <button
              className="btn primary mode-play"
              onClick={() => {
                pickMode('simulation');
                setStep('sim');
              }}
            >
              Montar a simulação
            </button>
          </section>
        </div>

        <div className="mode-links">
          <button className="btn ghost" onClick={() => setStep('how')}>
            📖 Como jogar
          </button>
          <SettingsButton {...prefs} label="⚙️ Configurações" />
        </div>
        <div className="support-row">
          <SupportButton />
        </div>
        {footer}
      </main>
    );
  }

  // ---------- 2) Candidate ----------
  if (step === 'candidate') {
    return (
      <main className="start">
        <div className="start-gear">
          <SettingsButton {...prefs} />
        </div>
        {header(true)}
        <p className="step-label">Passo 1 de 2</p>
        <h2 className="choose">Escolha seu candidato</h2>
        <div className="candidates">
          {PROTAGONISTS.map((id) => (
            <button key={id} className={`candidate-card ${id}`} onClick={() => chooseCandidate(id)}>
              <Caricature who={id} mood="happy" size={130} />
              <span className="candidate-name">{name(id)}</span>
              <span className="candidate-title">{CANDIDATES[id].title}</span>
              <span className="candidate-pitch">{CANDIDATES[id].pitch}</span>
              <span className="candidate-cta">Jogar de {name(id)}</span>
            </button>
          ))}
        </div>

        {/* Extra candidates: a big, inviting button right under the two protagonists. */}
        <section className="more-candidates">
          <button className={`more-toggle ${showMore ? 'open' : ''}`} aria-expanded={showMore} onClick={() => setShowMore(!showMore)}>
            <span className="more-faces">
              {EXTRA_CANDIDATES.map((id) => (
                <Caricature key={id} who={id} mood="happy" size={40} />
              ))}
            </span>
            <span className="more-label">
              {showMore ? '− Menos candidatos' : '+ Mais candidatos'}
              <small>Jogue de Cury, Renan ou Caiado, ou chame-os como adversários no próximo passo</small>
            </span>
          </button>
          {showMore && (
            <ul className="extras">
              {EXTRA_CANDIDATES.map((id) => (
                <li key={id} className={`extra ${id}`}>
                  <Caricature who={id} mood="happy" size={64} />
                  <span className="extra-text">
                    <b>{name(id)}</b>
                    <small>{CANDIDATES[id].title}</small>
                    <span className="extra-pitch">{CANDIDATES[id].pitch}</span>
                  </span>
                  <span className="extra-actions">
                    <button className="chip on" onClick={() => chooseCandidate(id)}>
                      Jogar de {name(id)}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <div className="step-nav">{back('mode')}</div>
      </main>
    );
  }

  // ---------- 3) Match settings, then 4) start ----------
  if (step === 'setup' && human) {
    return (
      <main className="start">
        <div className="start-gear">
          <SettingsButton {...prefs} />
        </div>
        {header(true)}
        <p className="step-label">Passo 2 de 2</p>
        <h2 className="choose">Configure a partida</h2>

        <section className="match-setup">
          <div className="you-are">
            <Caricature who={human} mood="happy" size={56} />
            <span>
              Você joga de <b>{name(human)}</b>
            </span>
            <button className="btn ghost you-change" onClick={() => setStep('candidate')}>
              Trocar
            </button>
          </div>

          <div className="deal-choice">
            <span>Participantes</span>
            <div className="chips" role="radiogroup" aria-label="Número de participantes">
              {[2, 3, 4].map((size) => (
                <button key={size} role="radio" aria-checked={lineupSize === size} className={`chip ${lineupSize === size ? 'on' : ''}`} onClick={() => setSize(size)}>
                  {size}
                </button>
              ))}
            </div>
            <div className="opponents" role="group" aria-label="Adversários">
              {ALL_CANDIDATES.filter((f) => f !== human).map((id) => {
                const on = rivals.includes(id);
                return (
                  <button
                    key={id}
                    className={`sim-pick ${id} ${on ? 'on' : ''}`}
                    aria-pressed={on}
                    disabled={(!on && lineupSize >= MAX_FACTIONS) || (on && rivals.length === 1)}
                    onClick={() => toggleRival(id)}
                  >
                    <Caricature who={id} mood={on ? 'happy' : 'neutral'} size={44} />
                    <span>{name(id)}</span>
                  </button>
                );
              })}
            </div>
            <small>Adversários da CPU. Toque para trocar quem entra na partida.</small>
          </div>

          {armiesChoice}
          {dealChoice(polarizedOk)}
        </section>

        <button className="btn primary start-match" onClick={() => onPick(human, rivals, polarizedOk ? deal : 'random')}>
          🎲 Sortear a ordem e começar
        </button>
        <div className="step-nav">{back('candidate')}</div>
      </main>
    );
  }

  // ---------- Local multiplayer: 1) seats, 2) match settings ----------
  if (step === 'local') {
    return (
      <main className="start">
        <div className="start-gear">
          <SettingsButton {...prefs} />
        </div>
        {header(true)}
        <p className="step-label">Jogar local · Passo 1 de 2</p>
        <h2 className="choose">Quem vai jogar?</h2>

        <section className="match-setup">
          <div className="deal-choice">
            <span>Participantes</span>
            <div className="chips" role="radiogroup" aria-label="Número de participantes">
              {[2, 3, 4].map((size) => (
                <button key={size} role="radio" aria-checked={seats.length === size} className={`chip ${seats.length === size ? 'on' : ''}`} onClick={() => setLocalSize(size)}>
                  {size}
                </button>
              ))}
            </div>
          </div>

          <ol className="local-seats">
            {seats.map((s, i) => (
              <li key={i} className={`local-seat ${s.faction}`}>
                <Caricature who={s.faction} mood="happy" size={48} />
                <span className="local-seat-fields">
                  <select value={s.faction} aria-label={`Candidato da vaga ${i + 1}`} onChange={(e) => setSeat(i, { faction: e.target.value })}>
                    {ALL_CANDIDATES.map((id) => (
                      <option key={id} value={id} disabled={seats.some((o, k) => k !== i && o.faction === id)}>
                        {name(id)}
                      </option>
                    ))}
                  </select>
                  <span className="chips" role="radiogroup" aria-label={`Quem joga na vaga ${i + 1}`}>
                    <button role="radio" aria-checked={s.human} className={`chip ${s.human ? 'on' : ''}`} onClick={() => setSeat(i, { human: true })}>
                      Pessoa
                    </button>
                    <button role="radio" aria-checked={!s.human} className={`chip ${!s.human ? 'on' : ''}`} onClick={() => setSeat(i, { human: false })}>
                      CPU
                    </button>
                  </span>
                  {s.human && (
                    <input
                      className="local-nick"
                      value={s.nick}
                      maxLength={NICK_MAX}
                      placeholder={`Apelido (opcional) · Jogador ${i + 1}`}
                      aria-label={`Apelido da vaga ${i + 1} (opcional)`}
                      onChange={(e) => setSeat(i, { nick: e.target.value })}
                    />
                  )}
                </span>
              </li>
            ))}
          </ol>
          <small className="local-note">
            {localHumans < MIN_LOCAL_HUMANS
              ? 'Chame pelo menos 2 pessoas. Para jogar só contra a CPU, use “Jogar sozinho”.'
              : 'Todos usam o mesmo aparelho: no fim de cada turno, ele passa para a próxima pessoa.'}
          </small>
        </section>

        <button className="btn primary start-match" disabled={!validSeats(seats)} onClick={() => setStep('local-setup')}>
          Continuar →
        </button>
        <div className="step-nav">{back('mode')}</div>
      </main>
    );
  }

  if (step === 'local-setup') {
    return (
      <main className="start">
        <div className="start-gear">
          <SettingsButton {...prefs} />
        </div>
        {header(true)}
        <p className="step-label">Jogar local · Passo 2 de 2</p>
        <h2 className="choose">Configure a partida</h2>
        <section className="match-setup">
          <div className="local-lineup">
            {seats.map((s, i) => (
              <span key={s.faction} className="daily-face">
                <Caricature who={s.faction} mood="happy" size={44} />
                <small>{s.human ? s.nick.trim() || `Jogador ${i + 1}` : 'CPU'}</small>
              </span>
            ))}
          </div>
          {armiesChoice}
          {dealChoice(localPolarizedOk)}
        </section>
        <button className="btn primary start-match" disabled={!validSeats(seats)} onClick={() => onLocal(seats, localPolarizedOk ? deal : 'random')}>
          🎲 Sortear a ordem e começar
        </button>
        <div className="step-nav">{back('local')}</div>
      </main>
    );
  }

  // ---------- Simulation setup ----------
  if (step === 'sim') {
    return (
      <main className="start">
        {header(true)}
        <section className="mode-card sim-card sim-step">
          <strong>🎬 Simular guerra — IA x IA</strong>
          <small>Escolha de 2 a {MAX_FACTIONS} candidatos e assista o computador jogar.</small>
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
                  <span>{name(id)}</span>
                </button>
              );
            })}
          </div>
          <button className="btn primary sim-start" disabled={simPicks.length < 2} onClick={() => onSimulate(ALL_CANDIDATES.filter((id) => simPicks.includes(id)))}>
            ▶ Iniciar simulação ({simPicks.length})
          </button>
        </section>
        <div className="step-nav">{back('mode')}</div>
      </main>
    );
  }

  // ---------- How to play ----------
  return (
    <main className="start">
      {header(true)}
      <section className="how">
        <h3>Como jogar</h3>
        <ol>
          <li>
            <b>Comício:</b> coloque seus reforços. Errou? Dá para desfazer. Na 1ª rodada, todos fazem o comício antes de qualquer ataque.
          </li>
          <li>
            <b>Batalha:</b> ataque vizinhos quantas vezes quiser, com até 3 dados. Empate é da defesa.
          </li>
          <li>
            <b>Movimentação:</b> cada estado envia exércitos uma vez por turno. Quem chega não sai de novo.
          </li>
        </ol>
        <p>
          A ordem dos turnos é sorteada no início da partida e fica a mesma até o fim. Como quem ataca primeiro tem vantagem, quem vem depois recebe
          alguns reforços extras no primeiro comício (o número aparece no sorteio). Da 2ª rodada em diante, cada candidato faz o turno completo: comício,
          batalha e movimentação. Domine uma região inteira para ganhar bônus. Seja o último candidato no mapa para vencer.
        </p>
      </section>
      <div className="step-nav">{back('mode')}</div>
      {footer}
    </main>
  );
}

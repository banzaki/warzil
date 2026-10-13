import { useEffect, useMemo, useState } from 'react';
import BrazilMap from './BrazilMap.jsx';
import Caricature from './Caricature.jsx';
import { CampaignLog, EventBanner, MuteButton, PlayerChip, RegionsPanel, RollPanel, SpeechBubble, useGameSounds } from './BoardParts.jsx';
import QuantityPicker from './QuantityPicker.jsx';
import { FACTIONS, STATES, STATE_IDS } from '../game/data.js';
import {
  attack,
  attackTargets,
  blitz,
  canAttack,
  canFortify,
  endAttack,
  attackerDiceCount,
  defenderDiceCount,
  endTurn,
  fortify,
  fortifyTargets,
  movableTroops,
  occupy,
  placeTroops,
  selectTarget,
  selectTerritory,
} from '../game/engine.js';
import { aiStep } from '../game/ai.js';
import { DISCLAIMER, PHASE_HELP, PHASE_NAMES, VICTORY_TITLES, createLinePicker, defeatLine, describeEvent, fill } from '../game/texts.js';

const EMPTY = new Set();
const AI_DELAY = { reinforce: 600, attack: 350, occupy: 300, fortify: 300 };
// With more CPU rivals the wait between human turns grows, so each AI step gets faster.
const AI_SPEED = { 2: 1, 3: 0.75, 4: 0.6 };

export default function GameScreen({ initialGame, onRematch, onChangeCandidate }) {
  const [game, setGame] = useState(initialGame);
  const [placeAmount, setPlaceAmount] = useState(1);
  const [occupyTotal, setOccupyTotal] = useState(0);
  const [moveAmount, setMoveAmount] = useState(1);
  // One picker per match: remembers recent lines so jokes don't repeat back to back.
  const [choose] = useState(createLinePicker);
  useGameSounds(game);

  const isHumanTurn = game.current === game.human && game.phase !== 'over';
  const human = game.human;
  const rivals = game.factions.filter((f) => f !== human);

  // The AI plays one visible step at a time.
  useEffect(() => {
    if (game.current === game.human || game.phase === 'over') return undefined;
    const delay = (AI_DELAY[game.phase] ?? 600) * AI_SPEED[game.factions.length];
    const timer = setTimeout(() => setGame((g) => aiStep(g)), delay);
    return () => clearTimeout(timer);
  }, [game]);

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
        if (mine) setGame(placeTroops(game, id, placeAmount === 'all' ? game.reinforcements : placeAmount));
        break;
      case 'attack':
        // Tapping a glowing enemy rolls the dice right away; the selection stays for the next roll.
        if (game.selected && canAttack(game, game.selected, id)) setGame(attack(game, game.selected, id));
        else if (mine && id === game.selected) setGame(selectTerritory(game, null));
        else if (mine && attackTargets(game, id).length > 0) setGame(selectTerritory(game, id));
        break;
      case 'fortify':
        if (game.selected && canFortify(game, game.selected, id)) setGame(selectTarget(game, id));
        else if (mine && id === game.selected) setGame(selectTerritory(game, null));
        else if (mine && fortifyTargets(game, id).length > 0) setGame(selectTerritory(game, id));
        break;
      default:
        break;
    }
  };

  const name = (f) => FACTIONS[f].name;
  const stateName = (id) => STATES[id].name;

  // ---------- Action panel ----------
  let panel = null;
  if (!isHumanTurn && game.phase !== 'over') {
    panel = (
      <div className="panel-body thinking">
        <span className="spinner" aria-hidden="true" />
        {name(game.current)} está {game.phase === 'attack' ? 'atacando' : game.phase === 'reinforce' ? 'convocando a militância' : 'armando a próxima'}…
      </div>
    );
  } else if (game.phase === 'reinforce') {
    panel = (
      <div className="panel-body">
        <p className="big-number">
          <span>{game.reinforcements}</span> {game.reinforcements === 1 ? 'reforço para colocar' : 'reforços para colocar'}
        </p>
        <div className="chips" role="radiogroup" aria-label="Tropas por toque">
          {[1, 5, 'all'].map((n) => (
            <button key={n} className={`chip ${placeAmount === n ? 'on' : ''}`} onClick={() => setPlaceAmount(n)}>
              {n === 'all' ? 'Tudo' : `+${n}`} por toque
            </button>
          ))}
        </div>
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
              <button className="btn primary" onClick={() => setGame(attack(game, from, game.target))}>
                🎲 Atacar
              </button>
              <button className="btn warn" onClick={() => setGame(blitz(game, from, game.target))}>
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
        <button className="btn ghost" onClick={() => setGame(endAttack(game))}>
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
        <button className="btn primary" onClick={() => setGame(occupy(game, occupyTotal))}>
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
              <button className="btn primary" onClick={() => setGame(fortify(game, from, game.target, moveAmount))}>
                Mover {moveAmount}
              </button>
              <button className="btn ghost" onClick={() => setGame(selectTerritory(game, null))}>
                Cancelar
              </button>
            </div>
          </>
        ) : (
          <p className="hint">
            {from
              ? `${stateName(from)} pode enviar até ${movableTroops(game, from)}${game.received[from] ? ` (os ${game.received[from]} recebidos ficam)` : ''}. Escolha um estado vizinho seu.`
              : PHASE_HELP.fortify}
          </p>
        )}
        <button className="btn ghost" onClick={() => setGame(endTurn(game))}>
          Encerrar turno →
        </button>
      </div>
    );
  }

  // End of match: either someone holds the whole map ('victory') or the human
  // lost their last state while rivals remain ('knockout').
  const finalEvent = game.log.find((e) => e.type === 'victory' || e.type === 'knockout');
  const humanWon = game.winner === human;
  const finalLoser = humanWon ? game.eliminated.at(-1) : human;
  const loserFaces = humanWon ? rivals : [human];

  return (
    <div className={`game theme-${human}`}>
      <header className={`hud ${rivals.length > 1 ? 'multi' : ''}`}>
        <PlayerChip game={game} faction={human} />
        <div className="round">
          <span className="logo small">
            WAR<span className="logo-zil">ZIL</span>
          </span>
          <span>
            Rodada {game.round} <MuteButton />
          </span>
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
            spent={game.phase === 'fortify' ? new Set(Object.keys(game.movedOut)) : EMPTY}
            onSelect={onSelect}
          />
          <EventBanner game={game} choose={choose} />
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
            {panel}
          </div>

          <RollPanel game={game} />
          <RegionsPanel game={game} />
          <CampaignLog game={game} choose={choose} />

          <button className="btn ghost quit" onClick={onChangeCandidate}>
            ⟲ Voltar ao menu
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
            <h2 id="end-title">{humanWon ? VICTORY_TITLES.win : VICTORY_TITLES.lose}</h2>
            <p className="end-quote">“{describeEvent(finalEvent, choose).text}”</p>
            <p className="end-sub">{defeatLine(finalLoser, finalEvent.seed, choose)}</p>
            <p className="end-stats">
              {finalEvent.type === 'victory'
                ? `${name(game.winner)} levou os 27 estados em ${game.round} rodadas.`
                : `${name(game.winner)} tirou ${name(human)} do mapa na rodada ${game.round}.`}
            </p>
            <div className="buttons">
              <button className="btn primary" onClick={onRematch} autoFocus>
                🔁 Revanche
              </button>
              <button className="btn ghost" onClick={onChangeCandidate}>
                Trocar candidato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import BrazilMap from './BrazilMap.jsx';
import Caricature from './Caricature.jsx';
import { FACTIONS, REGIONS, STATES, STATE_IDS } from '../game/data.js';
import {
  attack,
  attackTargets,
  blitz,
  calcReinforcements,
  canAttack,
  canFortify,
  controlledRegions,
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
  territoriesOf,
} from '../game/engine.js';
import { aiStep } from '../game/ai.js';
import { DEFEAT_LINES, DISCLAIMER, PHASE_HELP, PHASE_NAMES, VICTORY_TITLES, describeEvent, loseLine } from '../game/texts.js';

const EMPTY = new Set();
const AI_DELAY = { reinforce: 600, attack: 350, occupy: 300, fortify: 300 };

// result[i]: 'win' | 'lose' | 'idle' (a die without a pair)
function Dice({ values, side, result }) {
  return (
    <span className="dice-row">
      {values.map((v, i) => (
        <span key={i} className={`die ${side} ${result[i]}`}>
          {v}
        </span>
      ))}
    </span>
  );
}

function pairResults(roll) {
  const pairs = Math.min(roll.attackerDice.length, roll.defenderDice.length);
  const att = roll.attackerDice.map((v, i) => (i >= pairs ? 'idle' : v > roll.defenderDice[i] ? 'win' : 'lose'));
  const def = roll.defenderDice.map((v, i) => (i >= pairs ? 'idle' : att[i] === 'win' ? 'lose' : 'win'));
  return { att, def };
}

function Stepper({ value, min, max, onChange }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Menos">
        −
      </button>
      <span className="stepper-value">{value}</span>
      <button onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Mais">
        +
      </button>
      <button className="small" onClick={() => onChange(max)} disabled={value >= max}>
        Máx
      </button>
    </div>
  );
}

function PlayerChip({ game, faction }) {
  const lands = territoriesOf(game, faction);
  const troops = lands.reduce((sum, id) => sum + game.troops[id], 0);
  const latest = game.log[0];
  let mood = 'neutral';
  if (latest?.type === 'conquer') mood = latest.faction === faction ? 'happy' : 'sad';
  const active = game.current === faction && game.phase !== 'over';
  return (
    <div className={`player-chip ${faction} ${active ? 'active' : ''}`}>
      <Caricature who={faction} mood={mood} size={52} />
      <div className="player-info">
        <strong>
          {FACTIONS[faction].name}
          {faction === game.human ? ' (você)' : ' (CPU)'}
        </strong>
        <span>
          {lands.length} estados · {troops} exércitos · +{calcReinforcements(game, faction).total}/turno
        </span>
      </div>
    </div>
  );
}

export default function GameScreen({ initialGame, onRematch, onChangeCandidate }) {
  const [game, setGame] = useState(initialGame);
  const [placeAmount, setPlaceAmount] = useState(1);
  const [occupyTotal, setOccupyTotal] = useState(0);
  const [moveAmount, setMoveAmount] = useState(1);

  const isHumanTurn = game.current === game.human && game.phase !== 'over';
  const human = game.human;
  const ai = game.ai;

  // The AI plays one visible step at a time.
  useEffect(() => {
    if (game.current !== game.ai || game.phase === 'over') return undefined;
    const timer = setTimeout(() => setGame((g) => aiStep(g)), AI_DELAY[game.phase] ?? 600);
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

  const speech = game.log[0] ? describeEvent(game.log[0]) : null;

  const recentConquests = game.log.filter((e) => e.type === 'conquer').slice(0, 6);
  const name = (f) => FACTIONS[f].name;
  const stateName = (id) => STATES[id].name;

  // ---------- Action panel ----------
  let panel = null;
  if (!isHumanTurn && game.phase !== 'over') {
    panel = (
      <div className="panel-body thinking">
        <span className="spinner" aria-hidden="true" />
        {name(ai)} está {game.phase === 'attack' ? 'atacando' : game.phase === 'reinforce' ? 'convocando a militância' : 'armando a próxima'}…
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
              <b className={ai}>{stateName(game.target)} ({game.troops[game.target]})</b>
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
              ? `${stateName(from)} (${game.troops[from]}) pronto: toque num inimigo brilhando para rolar ${myDice} ${myDice === 1 ? 'dado' : 'dados'}.`
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
          🎉 Conquistou <b>{stateName(to)}</b>! Quantos exércitos entram?
        </p>
        <Stepper value={occupyTotal} min={min} max={max} onChange={setOccupyTotal} />
        <p className="hint">
          Mínimo {min} (dados do último ataque). {stateName(from)} fica com {game.troops[from] + min - occupyTotal}.
        </p>
        <button className="btn primary" onClick={() => setGame(occupy(game, occupyTotal))}>
          Confirmar
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
              Mover de <b>{stateName(from)}</b> para <b>{stateName(game.target)}</b>:
            </p>
            <Stepper value={moveAmount} min={1} max={movableTroops(game, from)} onChange={setMoveAmount} />
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
              ? `${stateName(from)} pode enviar até ${movableTroops(game, from)}. Escolha um estado vizinho seu.`
              : PHASE_HELP.fortify}
          </p>
        )}
        <button className="btn ghost" onClick={() => setGame(endTurn(game))}>
          Encerrar turno →
        </button>
      </div>
    );
  }

  const roll = game.lastRoll;
  const regionOwners = {
    [human]: controlledRegions(game, human),
    [ai]: controlledRegions(game, ai),
  };

  return (
    <div className={`game theme-${human}`}>
      <header className="hud">
        <PlayerChip game={game} faction={human} />
        <div className="round">
          <span className="logo small">
            WAR<span className="logo-zil">ZIL</span>
          </span>
          <span>Rodada {Math.ceil(game.turn / 2)}</span>
        </div>
        <PlayerChip game={game} faction={ai} />
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
          {speech && (
            <div key={game.log[0]?.id} className={`speech ${speech.speaker}`}>
              {speech.speaker === 'news' ? (
                <span className="news-tag">PLANTÃO</span>
              ) : (
                <Caricature who={speech.speaker} mood="happy" size={40} />
              )}
              <p>{speech.text}</p>
            </div>
          )}
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

          {roll && (
            <div className="panel roll" key={`${roll.from}-${roll.to}-${game.troops[roll.from]}-${game.troops[roll.to]}`}>
              <div className="roll-line">
                <span>⚔️ {stateName(roll.from)}</span>
                <Dice values={roll.attackerDice} side={roll.attacker} result={pairResults(roll).att} />
              </div>
              <div className="roll-line">
                <span>🛡️ {stateName(roll.to)}</span>
                <Dice values={roll.defenderDice} side={roll.attacker === 'lula' ? 'flavio' : 'lula'} result={pairResults(roll).def} />
              </div>
              <p className="roll-result">
                {roll.conquered
                  ? `🎉 ${stateName(roll.to)} conquistado!`
                  : `Ataque −${roll.attackerLoss} · Defesa −${roll.defenderLoss}`}
                {' · empate é da defesa'}
              </p>
            </div>
          )}

          <div className="panel regions">
            <div className="panel-title">Bônus por região</div>
            <ul>
              {Object.entries(REGIONS).map(([key, r]) => {
                const holder = [human, ai].find((f) => regionOwners[f].includes(key));
                return (
                  <li key={key} className={holder ?? ''}>
                    <span>{r.name}</span>
                    <span>{holder ? `${name(holder)} +${r.bonus}` : `+${r.bonus}`}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          {recentConquests.length > 0 && (
            <div className="panel log">
              <div className="panel-title">Diário de campanha</div>
              <ul>
                {recentConquests.map((e) => (
                  <li key={e.id}>
                    <b className={e.faction}>{name(e.faction)}</b> tomou {stateName(e.state)}.{' '}
                    <i>
                      {name(e.loser)}: “{loseLine(e)}”
                    </i>
                  </li>
                ))}
              </ul>
            </div>
          )}

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
              <Caricature who={game.winner === 'lula' ? 'flavio' : 'lula'} mood="sad" size={84} className="loser-face" />
            </div>
            <h2 id="end-title">{game.winner === human ? VICTORY_TITLES.win : VICTORY_TITLES.lose}</h2>
            <p className="end-quote">“{describeEvent(game.log.find((e) => e.type === 'victory')).text}”</p>
            <p className="end-sub">{DEFEAT_LINES[game.winner === 'lula' ? 'flavio' : 'lula']}</p>
            <p className="end-stats">
              {name(game.winner)} levou os 27 estados em {Math.ceil(game.turn / 2)} rodadas.
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

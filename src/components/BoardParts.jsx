// Pieces shared by the player screen and the AI-vs-AI simulation screen.
import { useEffect, useState } from 'react';
import Caricature from './Caricature.jsx';
import { FACTIONS, REGIONS, STATES } from '../game/data.js';
import { calcReinforcements, controlledRegions, territoriesOf } from '../game/engine.js';
import { describeEvent, eliminatorLine, fill, loseLine } from '../game/texts.js';
import { play } from '../game/sound.js';
import { DIARY_TYPES, isHighlight } from '../game/highlights.js';

const name = (f) => FACTIONS[f].name;
const stateName = (id) => STATES[id].name;
// "a Bahia", "o Ceará", "São Paulo"
const withArticle = (id) => fill('{o_state}', { state: id });

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

// compact: smaller chip used for CPU rivals in 3-4 faction matches and in simulations.
export function PlayerChip({ game, faction, compact = false }) {
  const lands = territoriesOf(game, faction);
  const troops = lands.reduce((sum, id) => sum + game.troops[id], 0);
  const latest = game.log[0];
  const out = game.eliminated.includes(faction);
  let mood = out ? 'sad' : 'neutral';
  if (latest?.type === 'conquer' && latest.faction === faction) mood = 'happy';
  if (latest?.type === 'conquer' && latest.loser === faction) mood = 'sad';
  const active = game.current === faction && game.phase !== 'over';
  const classes = `player-chip ${faction} ${active ? 'active' : ''} ${compact ? 'compact' : ''} ${out ? 'out' : ''}`;
  if (compact) {
    return (
      <div className={classes} title={`${name(faction)}: ${lands.length} estados, ${troops} exércitos`}>
        <Caricature who={faction} mood={mood} size={36} />
        <div className="player-info">
          <strong>{name(faction)}</strong>
          <span>{out ? 'fora' : `${lands.length} est. · ${troops}`}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={classes}>
      <Caricature who={faction} mood={mood} size={52} />
      <div className="player-info">
        <strong>
          {name(faction)}
          {faction === game.human ? ' (você)' : ' (CPU)'}
        </strong>
        <span>
          {lands.length} estados · {troops} exércitos · +{calcReinforcements(game, faction).total}/turno
        </span>
      </div>
    </div>
  );
}

// `event` defaults to the latest one; the simulation passes a "held" event instead.
export function SpeechBubble({ game, choose, event = game.log[0] }) {
  if (!event) return null;
  const speech = describeEvent(event, choose);
  if (!speech.text) return null;
  return (
    <div key={event.id} className={`speech ${speech.speaker}`}>
      {speech.speaker === 'news' ? (
        <span className="news-tag">PLANTÃO</span>
      ) : (
        <Caricature who={speech.speaker} mood={event.type === 'eliminated' || event.type === 'regionLost' || event.type === 'bigLoss' ? 'sad' : 'happy'} size={40} />
      )}
      <p>{speech.text}</p>
    </div>
  );
}

export function RollPanel({ game }) {
  const roll = game.lastRoll;
  if (!roll) return null;
  const { att, def } = pairResults(roll);
  return (
    <div className="panel roll" key={roll.id}>
      <div className="roll-line">
        <span>⚔️ {stateName(roll.from)}</span>
        <Dice values={roll.attackerDice} side={roll.attacker} result={att} />
      </div>
      <div className="roll-line">
        <span>🛡️ {stateName(roll.to)}</span>
        <Dice values={roll.defenderDice} side={roll.defender} result={def} />
      </div>
      <p className="roll-result">
        {roll.conquered ? (
          <b className="roll-win">🎉 {name(roll.attacker)} conquistou {withArticle(roll.to)}!</b>
        ) : (
          <>
            <span className={roll.attackerLoss ? 'loss' : ''}>Ataque −{roll.attackerLoss}</span>
            {' · '}
            <span className={roll.defenderLoss ? 'loss' : ''}>Defesa −{roll.defenderLoss}</span>
          </>
        )}
        {' · empate é da defesa'}
      </p>
    </div>
  );
}

export function RegionsPanel({ game }) {
  const owners = Object.fromEntries(game.factions.map((f) => [f, controlledRegions(game, f)]));
  return (
    <div className="panel regions">
      <div className="panel-title">Bônus por região</div>
      <ul>
        {Object.entries(REGIONS).map(([key, r]) => {
          const holder = game.factions.find((f) => owners[f].includes(key));
          return (
            <li key={key} className={holder ?? ''}>
              <span>{r.name}</span>
              <span>{holder ? `${name(holder)} +${r.bonus}` : `+${r.bonus}`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function DiaryRow({ e, choose }) {
  switch (e.type) {
    case 'conquer':
      return (
        <>
          <b className={e.faction}>{name(e.faction)}</b> tomou {withArticle(e.state)}.{' '}
          <i>
            {name(e.loser)}: “{loseLine(e, choose)}”
          </i>
        </>
      );
    case 'region':
      return (
        <>
          🗺️ <b className={e.faction}>{name(e.faction)}</b> domina o {REGIONS[e.region].name}. <i>“{describeEvent(e, choose).text}”</i>
        </>
      );
    case 'regionLost':
      return (
        <>
          <b className={e.faction}>{name(e.faction)}</b> perdeu o controle do {REGIONS[e.region].name}.
        </>
      );
    case 'eliminated':
      return (
        <>
          🏴 <b className={e.loser}>{name(e.loser)}</b> está fora da corrida. <i>“{describeEvent(e, choose).text}”</i>
        </>
      );
    case 'lead':
      return (
        <>
          📈 Virada! <b className={e.faction}>{name(e.faction)}</b> passa {name(e.previous)} e assume a liderança.
        </>
      );
    case 'bigLoss':
      return (
        <>
          💥 <b className={e.faction}>{name(e.faction)}</b> perdeu 3 exércitos de uma vez. <i>“{describeEvent(e, choose).text}”</i>
        </>
      );
    default:
      return (
        <>
          🏆 <b className={e.faction}>{name(e.faction)}</b>: “{describeEvent(e, choose).text}”
        </>
      );
  }
}

// Everything that happened, newest first. Collapsed: the latest few entries;
// expanded: the whole match grouped by round.
export function CampaignLog({ game, choose }) {
  const [full, setFull] = useState(false);
  const entries = game.log.filter((e) => DIARY_TYPES.includes(e.type));
  if (!entries.length) return null;
  const shown = full ? entries : entries.slice(0, 6);
  let lastRound = null;
  return (
    <div className="panel log">
      <div className="panel-title">
        Diário de campanha
        {entries.length > 6 && (
          <button className="log-toggle" onClick={() => setFull(!full)} aria-expanded={full}>
            {full ? 'Mostrar menos' : `Ver tudo (${entries.length})`}
          </button>
        )}
      </div>
      <ul className={full ? 'full' : ''}>
        {shown.map((e) => {
          const header = full && e.round !== lastRound ? <li className="log-round">Rodada {e.round}</li> : null;
          lastRound = e.round;
          return [
            header,
            <li key={e.id} className={isHighlight(e) ? 'highlight' : ''}>
              <DiaryRow e={e} choose={choose} />
            </li>,
          ];
        })}
      </ul>
    </div>
  );
}

// Brief banner over the map when someone is knocked out or a region changes hands.
export function EventBanner({ game, choose }) {
  const event = game.log.slice(0, 4).find((e) => ['eliminated', 'region', 'lead'].includes(e.type));
  if (!event) return null;
  if (event.type === 'lead') {
    return (
      <div key={event.id} className={`event-banner region ${event.faction}`} role="status">
        <strong>
          📈 Virada! {name(event.faction)} assume a liderança
        </strong>
      </div>
    );
  }
  if (event.type === 'eliminated') {
    return (
      <div key={event.id} className={`event-banner eliminated ${event.loser}`} role="status">
        <strong>🏴 {name(event.loser)} está fora da corrida!</strong>
        <span>
          {name(event.faction)}: “{eliminatorLine(event, choose)}”
        </span>
      </div>
    );
  }
  return (
    <div key={event.id} className={`event-banner region ${event.faction}`} role="status">
      <strong>
        🗺️ {name(event.faction)} domina o {REGIONS[event.region].name}! +{REGIONS[event.region].bonus}/turno
      </strong>
    </div>
  );
}

// Sound effects driven by what just happened in the game.
export function useGameSounds(game) {
  const rollId = game.lastRoll?.id;
  const latest = game.log[0];
  useEffect(() => {
    if (rollId) play('dice');
  }, [rollId]);
  useEffect(() => {
    if (!latest) return;
    const map = { conquer: 'conquer', region: 'region', eliminated: 'eliminate', victory: 'victory', knockout: 'defeat' };
    if (map[latest.type]) play(map[latest.type]);
  }, [latest?.id]);
}

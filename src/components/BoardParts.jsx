// Pieces shared by the player screen and the AI-vs-AI simulation screen.
import { useEffect, useState } from 'react';
import Caricature from './Caricature.jsx';
import { FACTIONS, REGIONS, STATES } from '../game/data.js';
import { calcReinforcements, controlledRegions, territoriesOf } from '../game/engine.js';
import { describeEvent, eliminatorLine, fill, loseLine } from '../game/texts.js';
import { isMuted, play, setMuted } from '../game/sound.js';

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

export function SpeechBubble({ game, choose }) {
  const event = game.log[0];
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

export function CampaignLog({ game, choose }) {
  const conquests = game.log.filter((e) => e.type === 'conquer').slice(0, 6);
  if (!conquests.length) return null;
  return (
    <div className="panel log">
      <div className="panel-title">Diário de campanha</div>
      <ul>
        {conquests.map((e) => (
          <li key={e.id}>
            <b className={e.faction}>{name(e.faction)}</b> tomou {withArticle(e.state)}.{' '}
            <i>
              {name(e.loser)}: “{loseLine(e, choose)}”
            </i>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Brief banner over the map when someone is knocked out or a region changes hands.
export function EventBanner({ game, choose }) {
  const event = game.log.slice(0, 4).find((e) => e.type === 'eliminated' || e.type === 'region');
  if (!event) return null;
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

export function MuteButton() {
  const [muted, setMutedState] = useState(isMuted);
  return (
    <button
      className="mute"
      aria-pressed={muted}
      aria-label={muted ? 'Ativar som' : 'Silenciar'}
      title={muted ? 'Ativar som' : 'Silenciar'}
      onClick={() => {
        setMuted(!muted);
        setMutedState(!muted);
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}

import { useEffect } from 'react';
import { FACTIONS, REGIONS, STATES } from '../game/data.js';
import { controlledRegions } from '../game/engine.js';
import { pairResults } from '../game/dice.js';
import { DIARY_TYPES, isHighlight } from '../game/highlights.js';
import { DiaryRow } from './BoardParts.jsx';
import { Die } from './DiceHud.jsx';

// Secondary information in one place, closed by default: the campaign diary
// (with the candidates' lines), every battle with its real dice, and the region
// bonuses. Phones: a bottom sheet over the game. Wide screens: it opens in the
// side column. tab: 'diary' | 'battles' | 'bonus'.
export const INFO_TABS = [
  ['diary', 'Diário'],
  ['battles', 'Batalhas'],
  ['bonus', 'Bônus'],
];

const name = (f) => FACTIONS[f].name;
const stateName = (id) => STATES[id].name;
const lostText = (n) => (n === 0 ? '0' : `−${n}`);

function Diary({ game, choose }) {
  const entries = game.log.filter((e) => DIARY_TYPES.includes(e.type));
  if (!entries.length) return <p className="info-empty">Nada aconteceu ainda. A primeira conquista entra aqui.</p>;
  let lastRound = null;
  return (
    <ul className="info-list diary">
      {entries.map((e) => {
        const header = e.round !== lastRound ? <li key={`r${e.round}-${e.id}`} className="log-round">Rodada {e.round}</li> : null;
        lastRound = e.round;
        return [
          header,
          <li key={e.id} className={isHighlight(e) ? 'highlight' : ''}>
            <DiaryRow e={e} choose={choose} />
          </li>,
        ];
      })}
    </ul>
  );
}

function Battles({ battles, me }) {
  if (!battles.length) return <p className="info-empty">Nenhum ataque ainda. Cada rolagem de dados fica registrada aqui.</p>;
  return (
    <ul className="info-list battles">
      {battles.map((b) => {
        const { att, def } = pairResults(b);
        const a = b.series ? b.series.attackerLoss : b.attackerLoss;
        const d = b.series ? b.series.defenderLoss : b.defenderLoss;
        const who = b.attacker === me ? 'Você' : name(b.attacker);
        return (
          <li key={b.id} className={`battle ${b.attacker === me || b.defender === me ? 'mine' : ''}`}>
            <p className="battle-title">
              <small>R{b.round}</small> <b className={b.attacker}>{who}</b> atacou <b className={b.defender}>{stateName(b.to)}</b> a partir {STATES[b.from].article === 'a' ? 'da' : STATES[b.from].article === 'o' ? 'do' : 'de'} {stateName(b.from)}
              {b.conquered && <span className="battle-won"> · 🎉 conquistou</span>}
            </p>
            <div className="battle-dice">
              <span className="battle-side">
                <small>ATQ</small>
                {b.attackerDice.map((v, i) => (
                  <Die key={i} value={v} side={b.attacker} state={att[i]} />
                ))}
              </span>
              <span className="battle-side">
                <small>DEF</small>
                {b.defenderDice.map((v, i) => (
                  <Die key={i} value={v} side={b.defender} state={def[i]} />
                ))}
              </span>
            </div>
            <p className="battle-result">
              {b.series ? `Tudo ou nada: ${b.series.rolls} rolagens (dados da última) · ` : ''}
              atacante {lostText(a)} · defensor {lostText(d)}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

function Bonus({ game }) {
  const owners = Object.fromEntries(game.factions.map((f) => [f, controlledRegions(game, f)]));
  return (
    <>
      <ul className="info-list bonus">
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
      <p className="hint small">Quem domina uma região inteira ganha esses reforços a mais em todo comício.</p>
    </>
  );
}

export default function MatchInfo({ game, choose, battles, me, tab, onTab, onClose, footer }) {
  useEffect(() => {
    if (!tab) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tab, onClose]);
  if (!tab) return null;
  return (
    <div className="info-sheet">
      <div className="info-scrim" onClick={onClose} aria-hidden="true" />
      <section className="info-card" role="dialog" aria-label="Diário, batalhas e bônus">
        <div className="info-tabs" role="tablist">
          {INFO_TABS.map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? 'on' : ''} onClick={() => onTab(id)}>
              {label}
            </button>
          ))}
          <button className="info-close" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="info-body">
          {tab === 'diary' && <Diary game={game} choose={choose} />}
          {tab === 'battles' && <Battles battles={battles} me={me} />}
          {tab === 'bonus' && <Bonus game={game} />}
        </div>
        {footer && <div className="info-footer">{footer}</div>}
      </section>
    </div>
  );
}

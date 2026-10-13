import brazil from '@svg-maps/brazil';
import { STATES, STATE_IDS } from '../game/data.js';

const PATHS = Object.fromEntries(brazil.locations.map((l) => [l.id, l.path]));
const IDS = Object.keys(PATHS);

const badgeAt = (id) => STATES[id].callout ?? STATES[id].label;

// Short-lived combat feedback, keyed by roll/event id so each one plays once.
function Feedback({ game }) {
  const roll = game.lastRoll;
  const flash = game.log.slice(0, 4).find((e) => e.type === 'region');
  return (
    <g className="feedback" aria-hidden="true">
      {flash && (
        <g key={`region-${flash.id}`} className={`region-flash ${flash.faction}`}>
          {STATE_IDS.filter((id) => STATES[id].region === flash.region).map((id) => (
            <path key={id} d={PATHS[id]} />
          ))}
        </g>
      )}
      {roll?.conquered && <circle key={`ring-${roll.id}`} className={`conquer-ring ${roll.attacker}`} cx={badgeAt(roll.to)[0]} cy={badgeAt(roll.to)[1]} r="12" />}
      {roll &&
        [
          [roll.from, roll.attackerLoss],
          [roll.to, roll.defenderLoss],
        ]
          .filter(([, loss]) => loss > 0)
          .map(([id, loss]) => (
            <text key={`loss-${roll.id}-${id}`} className="float-loss" x={badgeAt(id)[0]} y={badgeAt(id)[1] - 14}>
              −{loss}
            </text>
          ))}
    </g>
  );
}

// spent: states that already made their outgoing move this turn.
export default function BrazilMap({ game, clickable, highlighted, spent, onSelect }) {
  const { owner, troops, selected, target } = game;

  const handleKey = (event, id) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect(id);
    }
  };

  return (
    <svg className="map" viewBox="0 0 660 639" role="group" aria-label="Mapa do Brasil">
      <g className="states">
        {IDS.map((id) => {
          const classes = [
            'state',
            owner[id],
            clickable.has(id) && 'clickable',
            highlighted.has(id) && 'highlighted',
            spent.has(id) && 'spent',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <path
              // Remounting on owner change replays the "conquered" pop animation.
              key={`${id}-${owner[id]}`}
              d={PATHS[id]}
              data-id={id}
              className={classes}
              onClick={() => onSelect(id)}
              tabIndex={clickable.has(id) ? 0 : -1}
              onKeyDown={(e) => handleKey(e, id)}
              aria-label={`${STATES[id].name}: ${troops[id]} exércitos${spent.has(id) ? ', já movimentou' : ''}`}
            >
              <title>{`${STATES[id].name} (${troops[id]})`}</title>
            </path>
          );
        })}
      </g>

      {/* Selection outlines drawn on top so they are never hidden by neighbours */}
      {selected && <path d={PATHS[selected]} className="outline selected" />}
      {target && <path d={PATHS[target]} className="outline target" />}

      <g className="badges">
        {IDS.map((id) => {
          const { label, callout } = STATES[id];
          const [x, y] = callout ?? label;
          return (
            <g key={id} data-badge={id} className={`badge ${owner[id]} ${spent.has(id) ? 'spent' : ''}`} onClick={() => onSelect(id)}>
              {callout && <line x1={label[0]} y1={label[1]} x2={x} y2={y} className="leader" />}
              {callout && <circle cx={label[0]} cy={label[1]} r="2" className="leader-dot" />}
              <circle cx={x} cy={y} r="11" className="pin" />
              <text x={x} y={y} dy="0.36em">
                {troops[id]}
              </text>
              {callout && (
                <text x={x + 14} y={y} dy="0.35em" className="abbr">
                  {id.toUpperCase()}
                </text>
              )}
            </g>
          );
        })}
      </g>

      <Feedback game={game} />
    </svg>
  );
}

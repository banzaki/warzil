import { useEffect } from 'react';
import Caricature from './Caricature.jsx';
import { FACTIONS } from '../game/data.js';

const REVEAL_MS = 550;
const HOLD_MS = 1600;

// Short "drawing numbers" animation for the turn order, which is already
// decided (state.factions). It only shows the result; skipping changes nothing.
export default function OrderDraw({ order, names = {}, onDone }) {
  // Cards appear in a neutral (alphabetical) arrangement, then reveal their number.
  const cards = [...order].sort((a, b) => FACTIONS[a].name.localeCompare(FACTIONS[b].name));
  const total = cards.length * REVEAL_MS + HOLD_MS;

  useEffect(() => {
    const timer = setTimeout(onDone, total);
    return () => clearTimeout(timer);
  }, [onDone, total]);

  return (
    <div className="overlay draw-overlay" role="dialog" aria-modal="true" aria-labelledby="draw-title">
      <div className="draw-card">
        <h2 id="draw-title">🎲 Sorteio da ordem</h2>
        <div className="draw-row">
          {cards.map((f) => {
            const position = order.indexOf(f);
            return (
              <div key={f} className={`draw-pick ${f}`}>
                <Caricature who={f} mood="happy" size={56} />
                <span className="draw-name">
                  {FACTIONS[f].name}
                  {names[f] ? <small> {names[f]}</small> : null}
                </span>
                <span className="draw-number" style={{ animationDelay: `${(position + 1) * REVEAL_MS}ms` }}>
                  {position + 1}º
                </span>
              </div>
            );
          })}
        </div>
        <p className="draw-final" style={{ animationDelay: `${cards.length * REVEAL_MS + 300}ms` }}>
          {order.map((f, i) => `${i + 1}º ${FACTIONS[f].name}`).join('  →  ')}
        </p>
        <button className="btn primary" onClick={onDone} autoFocus>
          Pular
        </button>
      </div>
    </div>
  );
}

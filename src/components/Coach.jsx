import { useEffect, useRef, useState } from 'react';
import { TIPS, TIP_ORDER, loadTutorial, markSeen, saveTutorial, tipFor, tutorialDone } from '../game/tutorial.js';

// First-match tips inside the action panel, one at a time, next to the real
// controls. Never a pop-up and never a pause: the match goes on underneath.
export default function Coach({ game, me }) {
  const [t, setT] = useState(loadTutorial);
  const tip = tutorialDone(t) ? null : tipFor(game, me, t.seen);
  const shown = useRef(null);
  // A tip that was on screen counts as seen once its moment has passed.
  useEffect(() => {
    const before = shown.current;
    if (before && before !== tip) setT((cur) => saveTutorial(markSeen(cur, before)));
    shown.current = tip;
  }, [tip]);
  if (!tip) return null;
  return (
    <div className="coach" role="note" aria-label="Dica">
      <p>
        <span className="coach-step">
          Dica {TIP_ORDER.indexOf(tip) + 1}/{TIP_ORDER.length}
        </span>{' '}
        {TIPS[tip]}
      </p>
      <div className="coach-buttons">
        <button className="btn primary" onClick={() => setT(saveTutorial(markSeen(t, tip)))}>
          Entendi
        </button>
        <button className="btn ghost" onClick={() => setT(saveTutorial({ ...t, off: true }))}>
          Pular tutorial
        </button>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { TIPS, TIP_ORDER, loadTutorial, markSeen, saveTutorial, tipFor, tutorialDone } from '../game/tutorial.js';

// First-match tips: which one applies now ({ tip, ok, skip }). A tip that was on
// screen counts as seen once its moment has passed.
export function useCoach(game, me) {
  const [t, setT] = useState(loadTutorial);
  const tip = tutorialDone(t) ? null : tipFor(game, me, t.seen);
  const shown = useRef(null);
  useEffect(() => {
    const before = shown.current;
    if (before && before !== tip) setT((cur) => saveTutorial(markSeen(cur, before)));
    shown.current = tip;
  }, [tip]);
  return {
    tip,
    ok: () => setT((cur) => saveTutorial(markSeen(cur, tip))),
    skip: () => setT((cur) => saveTutorial({ ...cur, off: true })),
  };
}

// One slim line on top of the action panel; the screen highlights what it is
// about (see the coach-* classes). Never a pop-up and never a pause.
export default function Coach({ coach }) {
  const { tip } = coach;
  if (!tip) return null;
  return (
    <div className="coach" role="note" aria-label="Dica">
      <p>
        <span className="coach-step">
          💡 {TIP_ORDER.indexOf(tip) + 1}/{TIP_ORDER.length}
        </span>{' '}
        {tip === 'rally' && <b>Conquiste o Brasil! </b>}
        {TIPS[tip]}
      </p>
      <span className="coach-buttons">
        <button className="coach-ok" onClick={coach.ok}>
          Entendi
        </button>
        <button className="coach-skip" onClick={coach.skip}>
          Pular tutorial
        </button>
      </span>
    </div>
  );
}

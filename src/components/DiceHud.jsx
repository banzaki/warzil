import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FACTIONS, STATES } from '../game/data.js';
import { pairResults, rollOutcome, rollSummary } from '../game/dice.js';
import { placeHud } from '../game/hudPlace.js';
import { fill } from '../game/texts.js';

// Classic six-sided dice with pips. The face is always the engine's real value:
// the short roll only spins and blurs it, it never shows other numbers.
const PIPS = { 1: ['c'], 2: ['tl', 'br'], 3: ['tl', 'c', 'br'], 4: ['tl', 'tr', 'bl', 'br'], 5: ['tl', 'tr', 'c', 'bl', 'br'], 6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'] };
const AT = { tl: [29, 29], tr: [71, 29], ml: [29, 50], mr: [71, 50], bl: [29, 71], br: [71, 71], c: [50, 50] };

export function Die({ value, side, state = '' }) {
  return (
    <svg className={`die6 ${side} ${state}`} viewBox="0 0 100 100" role="img" aria-label={String(value)}>
      <rect x="5" y="5" width="90" height="90" rx="20" className="die-body" />
      {(PIPS[value] ?? []).map((p) => (
        <circle key={p} cx={AT[p][0]} cy={AT[p][1]} r="9.5" className="pip" />
      ))}
    </svg>
  );
}

export const ROLL_MS = 500;
export const HOLD_MS = 2200;
const REVIEW_MS = 4000;

const reducedMotion = () =>
  document.documentElement.classList.contains('reduce-motion') || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);

// When the pop-up shows: each new exchange rolls (ROLL_MS), then stays HOLD_MS.
// review() shows the last exchange again; close() hides it.
export function useDiceHud(roll) {
  const [view, setView] = useState({ stage: 'hidden', id: null, review: 0 });
  useEffect(() => {
    if (!roll) {
      setView({ stage: 'hidden', id: null, review: 0 });
      return undefined;
    }
    const quick = reducedMotion();
    setView({ stage: quick ? 'shown' : 'rolling', id: roll.id, review: 0 });
    const reveal = quick ? null : setTimeout(() => setView((v) => (v.id === roll.id && v.stage === 'rolling' ? { ...v, stage: 'shown' } : v)), ROLL_MS);
    const hide = setTimeout(() => setView((v) => (v.id === roll.id && !v.review ? { ...v, stage: 'hidden' } : v)), (quick ? 0 : ROLL_MS) + HOLD_MS);
    return () => {
      clearTimeout(reveal);
      clearTimeout(hide);
    };
  }, [roll?.id]);
  useEffect(() => {
    if (!view.review) return undefined;
    const t = setTimeout(() => setView((v) => ({ ...v, stage: 'hidden', review: 0 })), REVIEW_MS);
    return () => clearTimeout(t);
  }, [view.review]);
  const review = useCallback(() => setView((v) => ({ ...v, stage: 'shown', review: Date.now() })), []);
  const close = useCallback(() => setView((v) => ({ ...v, stage: 'hidden', review: 0 })), []);
  return { stage: roll ? view.stage : 'hidden', review, close };
}

const theState = (id) => fill('{o_state}', { state: id });
const rect = (r, o) => r && { x: r.left - o.left, y: r.top - o.top, w: r.width, h: r.height };

// The pop-up over the map, in the free corner farthest from the fight (measured
// on screen, so zoom, rotation and screen size are all handled). Tap to close.
// me: the viewer's faction (null for spectators).
export default function DiceHud({ game, hud, me }) {
  const roll = game.lastRoll;
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  const visible = Boolean(roll) && hud.stage !== 'hidden';

  useLayoutEffect(() => {
    if (!visible) return undefined;
    const el = ref.current;
    const wrap = el?.parentElement;
    if (!wrap) return undefined;
    const place = () => {
      const w = wrap.getBoundingClientRect();
      // Visible part of the map: on screen and above a sticky action panel (phones).
      let bottom = Math.min(w.bottom, window.innerHeight);
      const panel = document.querySelector('.sidebar > .panel');
      if (panel && getComputedStyle(panel).position === 'sticky') {
        const p = panel.getBoundingClientRect();
        if (p.top < bottom && p.left < w.right && p.right > w.left) bottom = Math.max(w.top + 120, p.top);
      }
      const top = Math.max(w.top, 0);
      const area = { x: 0, y: top - w.top, w: w.width, h: Math.max(el.offsetHeight + 16, bottom - top) };
      const pin = (id) => rect(wrap.querySelector(`[data-badge="${id}"] .pin`)?.getBoundingClientRect(), w);
      const grow = (r) => r && { x: r.x - 12, y: r.y - 12, w: r.w + 24, h: r.h + 24 };
      const battle = [pin(roll.from), pin(roll.to)].filter(Boolean).map(grow);
      const zoom = rect(wrap.querySelector('.map-zoom')?.getBoundingClientRect(), w);
      // The speech line (on the map, or right above the panel on phones) is avoided
      // when there is room; when there is not, the dice cover it for a moment.
      const soft = [wrap.querySelector('.speech'), wrap.querySelector('.event-banner'), panel?.querySelector('.speech')]
        .map((e) => rect(e?.getBoundingClientRect(), w))
        .filter((r) => r?.h);
      setPos(placeHud({ area, size: { w: el.offsetWidth, h: el.offsetHeight }, battle, hard: zoom ? [zoom] : [], soft }));
    };
    place();
    let frame = 0;
    const again = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    window.addEventListener('resize', again);
    window.addEventListener('scroll', again, { passive: true });
    const svg = wrap.querySelector('svg.map');
    const watch = svg ? new MutationObserver(again) : null;
    watch?.observe(svg, { attributes: true, attributeFilter: ['viewBox'] });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', again);
      window.removeEventListener('scroll', again);
      watch?.disconnect();
    };
  }, [visible, roll?.id]);

  if (!visible) return null;
  const rolling = hud.stage === 'rolling';
  const { att, def } = pairResults(roll);
  const names = Object.fromEntries(Object.entries(FACTIONS).map(([id, f]) => [id, f.name]));
  const o = rollOutcome(roll, me, names, theState);
  return (
    <div
      ref={ref}
      className={`dice-hud ${hud.stage}`}
      style={pos ? { left: pos.x, top: pos.y } : { visibility: 'hidden' }}
      role="status"
      aria-live="polite"
      aria-label={`${rollSummary(roll).dice}. ${o.result}`}
      onClick={hud.close}
    >
      <div className="hud-row">
        <span className="hud-label">
          ATAQUE<small>{STATES[roll.from].name}</small>
        </span>
        <span className="hud-dice">
          {roll.attackerDice.map((v, i) => (
            <Die key={i} value={v} side={roll.attacker} state={rolling ? 'rolling' : att[i]} />
          ))}
        </span>
      </div>
      <div className="hud-row">
        <span className="hud-label">
          DEFESA<small>{STATES[roll.to].name}</small>
        </span>
        <span className="hud-dice">
          {roll.defenderDice.map((v, i) => (
            <Die key={i} value={v} side={roll.defender} state={rolling ? 'rolling' : def[i]} />
          ))}
        </span>
      </div>
      {/* Kept in the layout while rolling, so the pop-up never changes size. */}
      <div className="hud-result" style={rolling ? { visibility: 'hidden' } : undefined}>
        {o.conquest && <b className="hud-conquest">{o.conquest}</b>}
        <span>{o.result}</span>
        {o.tie && <small>{o.tie}</small>}
        {o.series && <small>{o.series}</small>}
      </div>
    </div>
  );
}

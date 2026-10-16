// Where the dice pop-up goes over the map: the corner of the visible map area
// farthest from the fight, never over the two states in the fight or the zoom
// buttons, and away from the speech line when possible. Works at any zoom,
// orientation or screen size because it is measured on screen every time.
// Rectangles are { x, y, w, h } in the same coordinates as `area`.

const overlap = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
const center = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

// area: visible map; size: { w, h } of the pop-up; battle: rects of the two
// states; hard: rects never to cover (zoom buttons); soft: rects to avoid if possible.
export function placeHud({ area, size, battle = [], hard = [], soft = [], margin = 8 }) {
  const xs = [area.x + margin, area.x + area.w - size.w - margin];
  const ys = [area.y + margin, area.y + area.h - size.h - margin];
  const target = battle.length
    ? { x: battle.reduce((s, r) => s + center(r).x, 0) / battle.length, y: battle.reduce((s, r) => s + center(r).y, 0) / battle.length }
    : center(area);
  let best = null;
  for (const y of ys)
    for (const x of xs) {
      const r = { x, y, w: size.w, h: size.h };
      const c = center(r);
      const blocked = [...battle, ...hard].reduce((s, b) => s + overlap(r, b), 0);
      const covered = soft.reduce((s, b) => s + overlap(r, b), 0);
      const distance = Math.hypot(c.x - target.x, c.y - target.y);
      // Blocking a fight state or a button outweighs everything; then speech; then distance.
      const score = -blocked * 1000 - covered * 10 + distance;
      if (!best || score > best.score) best = { x, y, score };
    }
  return { x: Math.round(best.x), y: Math.round(best.y) };
}

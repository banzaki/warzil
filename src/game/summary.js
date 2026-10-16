// What the other candidates did, in one line each, from the match log: so a
// player who waited through AI or friends' turns sees the outcome at a glance.
// events: log entries; me: the viewer's faction (null for spectators);
// names: faction -> name; regionNames: region -> name ("Sudeste").

const join = (xs) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} e ${xs.at(-1)}`);

export function turnSummary(events, me, names, regionNames) {
  const by = new Map();
  const of = (f) => {
    if (!by.has(f)) by.set(f, { taken: 0, fromMe: 0, regions: [], out: [] });
    return by.get(f);
  };
  for (const e of [...events].sort((a, b) => a.id - b.id)) {
    if (!e.faction || e.faction === me) continue;
    if (e.type === 'conquer') {
      const s = of(e.faction);
      s.taken++;
      if (me && e.loser === me) s.fromMe++;
    } else if (e.type === 'region') of(e.faction).regions.push(regionNames[e.region]);
    else if (e.type === 'eliminated') of(e.faction).out.push(e.loser === me ? 'você' : names[e.loser]);
  }
  const lines = [];
  for (const [f, s] of by) {
    const parts = [];
    if (s.taken) {
      const mine = !s.fromMe ? '' : s.fromMe === s.taken ? (s.taken === 1 ? ' (era seu)' : ' (todos seus)') : ` (${s.fromMe} ${s.fromMe === 1 ? 'seu' : 'seus'})`;
      parts.push(`conquistou ${s.taken} ${s.taken === 1 ? 'estado' : 'estados'}${mine}`);
    }
    if (s.regions.length) parts.push(`dominou o ${join(s.regions)}`);
    if (s.out.length) parts.push(`tirou ${join(s.out)} da disputa`);
    if (parts.length) lines.push(`${names[f]} ${join(parts)}.`);
  }
  return lines;
}

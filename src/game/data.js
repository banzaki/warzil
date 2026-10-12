// Static board data: the 26 states + Federal District, their regions,
// land borders and where to draw each troop badge on the SVG map.
// Map shapes come from @svg-maps/brazil (CC BY 4.0, Victor Cazanave).

export const FACTIONS = {
  lula: { id: 'lula', name: 'Lula', color: 'red' },
  flavio: { id: 'flavio', name: 'Flávio', color: 'blue' },
};

export const opponentOf = (faction) => (faction === 'lula' ? 'flavio' : 'lula');

export const REGIONS = {
  north: { name: 'Norte', bonus: 3 },
  northeast: { name: 'Nordeste', bonus: 4 },
  centerWest: { name: 'Centro-Oeste', bonus: 3 },
  southeast: { name: 'Sudeste', bonus: 3 },
  south: { name: 'Sul', bonus: 2 },
};

// label: [x, y] badge position in map coordinates (area centroid, hand-tuned).
// callout: badge drawn in the ocean with a leader line for tiny coastal states.
export const STATES = {
  ac: { name: 'Acre', region: 'north', label: [55, 227] },
  am: { name: 'Amazonas', region: 'north', label: [145, 147] },
  rr: { name: 'Roraima', region: 'north', label: [197, 55] },
  ap: { name: 'Amapá', region: 'north', label: [344, 64] },
  pa: { name: 'Pará', region: 'north', label: [324, 147] },
  ro: { name: 'Rondônia', region: 'north', label: [174, 253] },
  to: { name: 'Tocantins', region: 'north', label: [401, 240] },
  ma: { name: 'Maranhão', region: 'northeast', label: [448, 165] },
  pi: { name: 'Piauí', region: 'northeast', label: [485, 205] },
  ce: { name: 'Ceará', region: 'northeast', label: [537, 161] },
  rn: { name: 'Rio Grande do Norte', region: 'northeast', label: [583, 173], callout: [632, 160] },
  pb: { name: 'Paraíba', region: 'northeast', label: [578, 193], callout: [638, 188] },
  pe: { name: 'Pernambuco', region: 'northeast', label: [550, 212], callout: [638, 216] },
  al: { name: 'Alagoas', region: 'northeast', label: [584, 230], callout: [632, 244] },
  se: { name: 'Sergipe', region: 'northeast', label: [571, 247], callout: [618, 272] },
  ba: { name: 'Bahia', region: 'northeast', label: [504, 278] },
  mt: { name: 'Mato Grosso', region: 'centerWest', label: [283, 285] },
  ms: { name: 'Mato Grosso do Sul', region: 'centerWest', label: [299, 405] },
  go: { name: 'Goiás', region: 'centerWest', label: [376, 340] },
  df: { name: 'Distrito Federal', region: 'centerWest', label: [409, 330], callout: [425, 306] },
  mg: { name: 'Minas Gerais', region: 'southeast', label: [458, 374] },
  es: { name: 'Espírito Santo', region: 'southeast', label: [521, 392], callout: [556, 395] },
  rj: { name: 'Rio de Janeiro', region: 'southeast', label: [489, 435], callout: [505, 462] },
  sp: { name: 'São Paulo', region: 'southeast', label: [395, 437] },
  pr: { name: 'Paraná', region: 'south', label: [350, 477] },
  sc: { name: 'Santa Catarina', region: 'south', label: [367, 522] },
  rs: { name: 'Rio Grande do Sul', region: 'south', label: [323, 566] },
};

// Real land borders between states (symmetric; verified by tests).
export const ADJACENCY = {
  ac: ['am', 'ro'],
  am: ['ac', 'ro', 'mt', 'pa', 'rr'],
  rr: ['am', 'pa'],
  pa: ['am', 'rr', 'ap', 'ma', 'to', 'mt'],
  ap: ['pa'],
  ro: ['ac', 'am', 'mt'],
  mt: ['ro', 'am', 'pa', 'to', 'go', 'ms'],
  to: ['pa', 'ma', 'pi', 'ba', 'go', 'mt'],
  ma: ['pa', 'to', 'pi'],
  pi: ['ma', 'to', 'ba', 'pe', 'ce'],
  ce: ['pi', 'pe', 'pb', 'rn'],
  rn: ['ce', 'pb'],
  pb: ['rn', 'ce', 'pe'],
  pe: ['pb', 'ce', 'pi', 'ba', 'al'],
  al: ['pe', 'ba', 'se'],
  se: ['al', 'ba'],
  ba: ['se', 'al', 'pe', 'pi', 'to', 'go', 'mg', 'es'],
  go: ['to', 'ba', 'mg', 'ms', 'mt', 'df'],
  df: ['go', 'mg'],
  ms: ['mt', 'go', 'mg', 'sp', 'pr'],
  mg: ['ba', 'go', 'df', 'ms', 'sp', 'rj', 'es'],
  es: ['ba', 'mg', 'rj'],
  rj: ['es', 'mg', 'sp'],
  sp: ['mg', 'rj', 'pr', 'ms'],
  pr: ['sp', 'ms', 'sc'],
  sc: ['pr', 'rs'],
  rs: ['sc'],
};

export const STATE_IDS = Object.keys(STATES);

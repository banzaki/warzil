// All satirical copy lives here (Brazilian Portuguese). Jokes are deliberately
// balanced: each candidate gets roughly the same number of jabs, about public
// personas only. Lines use "{state}" as a subject to avoid gendered prepositions.
import { STATES } from './data.js';

export const DISCLAIMER =
  'Sátira fictícia. Caricaturas originais, falas inventadas. ' +
  'Nenhum apoio a candidato ou partido.';

export const CANDIDATES = {
  lula: {
    name: 'Lula',
    title: 'O Veterano do Churrasco',
    pitch: 'Promete picanha para os 27 estados. Tem discurso para toda ocasião (2 horas cada).',
  },
  flavio: {
    name: 'Flávio',
    title: 'O Herdeiro',
    pitch: 'Herdou o sobrenome, o fã-clube e um grupo da família que não para de apitar.',
  },
};

const QUIPS = {
  start: {
    lula: ['Companheiros! Acende a churrasqueira que tem um país pra ganhar.'],
    flavio: ['Pai, tô ao vivo! Curte e compartilha que tem um país pra ganhar.'],
  },
  turn: {
    lula: [
      'Minha vez. Preparei um discurso curtinho. Três horas, no máximo.',
      'Alguém me traz um cafezinho e um microfone?',
      'Vamos criar o Ministério de Ganhar Esta Rodada.',
    ],
    flavio: [
      'Minha vez. Peraí, só vou postar uma selfie antes.',
      'Rapidinho no grupo da família e já volto.',
      'Estratégia nova: igual à antiga, só que em negrito.',
    ],
  },
  conquer: {
    lula: [
      '{state} agora tem picanha no domingo. Promessa é promessa!',
      '{state} entrou na campanha. O churrasco ganhou mais uma grelha.',
      'Alô, {state}! Seu ministério sai na semana que vem.',
      '{state} ganhou o novo programa Bolsa Churrasco. Verba a definir.',
      '{state} virou depois de um discurso emocionante. Só quatro horas.',
    ],
    flavio: [
      '{state} tá com a gente! Mandando selfie no grupo da família.',
      'Mais um no mapa: {state}. O pai reagiu com três joinhas.',
      '{state} entrou pro time. Adesivo de carro grátis pra todo mundo!',
      'Alô, {state}! Nosso slogan: "Mesmo sobrenome, nova temporada".',
      '{state} mudou de lado após um vídeo viral com trilha sonora suspeita.',
    ],
  },
  lose: {
    lula: [
      'Perder {state} é só uma pausa estratégica pro churrasco.',
      'Caiu {state}? Vamos montar um grupo de trabalho pra discutir.',
    ],
    flavio: [
      'Perdi {state}? Quero recontagem... dos dados.',
      'Caiu {state}. Apagando o post antes que alguém tire print.',
    ],
  },
  victory: {
    lula: [
      'Vitória total! Picanha pra todo mundo... depois da revisão do orçamento.',
      'O Brasil tá vermelho do Oiapoque ao Chuí. Agora, sobre aquele discurso...',
    ],
    flavio: [
      'Vitória total! O grupo da família tem 9 mil mensagens não lidas.',
      'O Brasil tá azul do Oiapoque ao Chuí. Segunda temporada confirmada.',
    ],
  },
};

export const NEWS = [
  'URGENTE: {state} muda de lado após debate acalorado sobre o preço da coxinha.',
  'Pesquisa: {state} tem 48% de indecisos e 52% que só querem o fim dos jingles.',
  '{state} bate recorde de santinho por metro quadrado.',
  'Carros de som de {state} atingem volume detectável do espaço.',
];

export const VICTORY_TITLES = { win: 'Vitória de lavada!', lose: 'Derrota nas urnas!' };

export const DEFEAT_LINES = {
  lula: 'Lula já anuncia a turnê da volta. Ele conhece o caminho.',
  flavio: 'Flávio culpa o algoritmo e pede revanche no grupo da família.',
};

const pick = (list, seed) => list[Math.floor(seed * list.length) % list.length];
const fill = (text, stateId) => text.replace('{state}', stateId ? STATES[stateId].name : '');

// Turns a log event into { speaker, text }.
export function describeEvent(event) {
  switch (event.type) {
    case 'start':
    case 'turn':
    case 'victory':
      return { speaker: event.faction, text: pick(QUIPS[event.type][event.faction], event.seed) };
    case 'conquer':
      if (event.seed < 0.2) return { speaker: 'news', text: fill(pick(NEWS, event.seed * 5), event.state) };
      return { speaker: event.faction, text: fill(pick(QUIPS.conquer[event.faction], event.seed), event.state) };
    default:
      return { speaker: 'news', text: '' };
  }
}

// What the losing side mutters after losing a state.
export function loseLine(event) {
  return fill(pick(QUIPS.lose[event.loser], event.seed), event.state);
}

export const PHASE_HELP = {
  reinforce: 'Toque nos seus estados para colocar reforços.',
  attack: 'Toque num estado seu (2+ exércitos) e depois num inimigo brilhando para rolar os dados.',
  occupy: 'Estado conquistado! Escolha quantos exércitos entram.',
  fortify: 'Toque num estado seu e depois num vizinho seu. Cada estado envia uma vez por turno; quem chega não sai de novo. Tracejado = já moveu.',
};

export const PHASE_NAMES = {
  reinforce: 'Comício',
  attack: 'Batalha',
  occupy: 'Ocupação',
  fortify: 'Movimentação',
};

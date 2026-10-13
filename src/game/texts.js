// All satirical copy lives here (Brazilian Portuguese).
// Rules for every candidate, so nobody gets favoured:
// - the same number of lines of each kind;
// - jokes about public personas only: speaking style, catchphrases, hobbies,
//   home turf. No accusations, health, private family, religion or campaign slogans;
// - "{state}" is used as a subject to avoid gendered prepositions ("a Bahia", "o Ceará").
import { FACTIONS, STATES } from './data.js';

export const DISCLAIMER =
  'Sátira fictícia. Caricaturas originais, falas inventadas. ' +
  'Não é material de campanha. Nenhum apoio a candidato ou partido.';

export const CANDIDATES = {
  lula: {
    name: 'Lula',
    title: 'O Veterano do Palanque',
    pitch: 'Transforma qualquer jogada em metáfora de futebol. Discurso curto? Nunca antes na história deste país.',
  },
  flavio: {
    name: 'Flávio',
    title: 'O Senador Herdeiro',
    pitch: 'Carrega o sobrenome mais famoso do grupo da família. Tenta parecer o moderado da turma.',
  },
  cury: {
    name: 'Cury',
    title: 'O Psiquiatra Best-seller',
    pitch: 'Milhões de livros vendidos. Diagnostica o eleitorado com Síndrome do Pensamento Acelerado.',
  },
  renan: {
    name: 'Renan',
    title: 'O Rei da Live',
    pitch: 'Faz política em live de três horas, corte de 30 segundos e treta com a velha política.',
  },
  caiado: {
    name: 'Caiado',
    title: 'O Doutor do Agro',
    pitch: 'Médico, pecuarista e governador de Goiás. Fala grosso, come pamonha e não abre mão do chapéu.',
  },
};

const QUIPS = {
  start: {
    lula: ['Companheiros e companheiras! O jogo começou e eu tô no aquecimento desde 1980.'],
    flavio: ['Pai, pode avisar o grupo da família: hoje eu jogo como titular.'],
    cury: ['Respire. Antes de conquistar o Brasil, conquiste a si mesmo. Depois o Brasil.'],
    renan: ['Boa noite, chat! Live começando. Hoje a velha política vai tomar um corte.'],
    caiado: ['Bom dia, Brasil! Aqui é na base da ordem: um estado de cada vez, sem enrolação.'],
  },
  turn: {
    lula: [
      'Minha vez. Vou falar rapidinho... três horas, no máximo.',
      'Isso aqui é igual futebol, companheiro: quem não chuta não faz gol.',
      'Nunca antes na história deste país alguém jogou dado tão bem.',
    ],
    flavio: [
      'Minha vez. Antes, um print pro grupo da família.',
      'Calma, gente. Eu sou o moderado da família. Agora: ataque!',
      'O Senado aprovou minha estratégia. Por unanimidade de um voto: o meu.',
    ],
    cury: [
      'Pausa. Gestão da emoção primeiro, ataque depois.',
      'Pensamento acelerado detectado. Vou atacar devagar.',
      'Seja autor da sua história. Eu sou autor de 50 livros e desta rodada.',
    ],
    renan: [
      'Chat, vota aí na enquete: ataco ou ataco?',
      'Ativa o sininho que vem treta com a velha política.',
      'Isso aqui vai render corte. Editor, acorda!',
    ],
    caiado: [
      'Deixa eu ajeitar o chapéu e já resolvo.',
      'Diagnóstico da rodada: falta estado. Tratamento: ataque.',
      'Comigo é assim: ordem primeiro, pamonha depois.',
    ],
  },
  conquer: {
    lula: [
      '{state} agora tem picanha e cervejinha no fim de semana. Promessa é promessa!',
      'Golaço! {state} entrou de cabeça, igual centroavante raiz.',
      '{state} ganhou de presente um discurso de quatro horas.',
      'Alô, {state}! Já marquei uma visita. E mais umas dez viagens pro exterior.',
      '{state} ganhou um programa social novo. O nome a gente decide no churrasco.',
    ],
    flavio: [
      '{state} tá com a gente! Mandando print no grupo da família.',
      'Mais um no mapa: {state}. O pai reagiu com três joinhas.',
      '{state} entrou pro time. Adesivo de carro grátis pra todo mundo!',
      'Alô, {state}! Mesmo sobrenome, nova temporada.',
      '{state} virou no estilo senador: com calma, terno e dado de seis.',
    ],
    cury: [
      '{state} agora pratica gestão da emoção. Três vezes ao dia, depois das refeições.',
      '{state} entrou pro clube do livro. Leitura obrigatória: os meus.',
      '{state} curou a Síndrome do Pensamento Acelerado. Agora só pensa no Cury.',
      'Alô, {state}! O Vendedor de Sonhos chegou. Desconto pra quem levar a coleção.',
      '{state} virou o capítulo 12 do meu próximo best-seller.',
    ],
    renan: [
      '{state} tá com a gente! O chat foi à loucura.',
      '{state} virou meme. E o meme virou voto.',
      'Alô, {state}! Live amanhã às 21h: "Como eu virei {state} com 3 dados".',
      'Mais um no mapa: {state}. O corte de 30 segundos já tá no ar.',
      '{state} mudou de lado depois de uma thread de 47 posts contra a velha política.',
    ],
    caiado: [
      '{state} agora tem rodeio aos sábados e pamonha aos domingos.',
      'Porteira aberta: {state} entrou pra fazenda.',
      '{state} passou no exame clínico: pressão boa e do nosso lado.',
      'Alô, {state}! Chegou a ordem. E o sertanejo também.',
      'Mais um no mapa: {state}. Pode pôr na conta da safra.',
    ],
  },
  lose: {
    lula: [
      'Perdi {state}? Futebol é assim, companheiro. Tem jogo de volta.',
      'Caiu {state}. Vou fazer um discurso sobre isso. Longo.',
    ],
    flavio: [
      'Perdi {state}? Vou ver o que o grupo da família acha.',
      'Caiu {state}. Apagando o post antes que alguém tire print.',
    ],
    cury: [
      'Perder {state} é um convite ao autoconhecimento.',
      'Caiu {state}. Vou transformar a dor em best-seller.',
    ],
    renan: [
      'Perdi {state}? Live de emergência em cinco minutos.',
      'Caiu {state}. Vou gravar um vídeo reagindo à minha própria derrota.',
    ],
    caiado: [
      'Perdi {state}? É só a entressafra.',
      'Caiu {state}. Receitei repouso e contra-ataque.',
    ],
  },
  victory: {
    lula: [
      'Vitória total! Nunca antes na história deste país alguém ganhou de 27 a zero.',
      'O Brasil tá vermelho do Oiapoque ao Chuí. Agora, sobre aquele discurso...',
    ],
    flavio: [
      'Vitória total! O grupo da família tem 9 mil mensagens não lidas.',
      'O Brasil tá azul do Oiapoque ao Chuí. Segunda temporada confirmada.',
    ],
    cury: [
      'Vitória total! O Brasil inteiro agora gerencia as emoções. Inclusive eu.',
      'O Brasil tá roxo do Oiapoque ao Chuí. Lançamento do livro semana que vem.',
    ],
    renan: [
      'Vitória total! Recorde de audiência na live da apuração.',
      'O Brasil tá laranja do Oiapoque ao Chuí. Dá like e compartilha!',
    ],
    caiado: [
      'Vitória total! Pamonha e sertanejo no Brasil inteiro.',
      'O Brasil tá verde do Oiapoque ao Chuí. Safra recorde de votos.',
    ],
  },
  // Said by whoever takes the human player's last state (multi-faction matches).
  knockout: {
    lula: ['Acabou o jogo pra você, companheiro. Mas a gente se vê no segundo turno.'],
    flavio: ['Tchau! Vou postar o print dessa vitória no grupo.'],
    cury: ['Saiu do mapa? Respira. A gente conversa sobre isso na próxima sessão.'],
    renan: ['Saiu do mapa! Valeu pela audiência, deixa o like antes de ir.'],
    caiado: ['Saiu do mapa! Pode voltar pra casa que a porteira tá aberta.'],
  },
};

// Neutral headlines: they never mention a candidate.
export const NEWS = [
  'URGENTE: {state} muda de lado após debate acalorado sobre o preço da coxinha.',
  'Pesquisa: {state} tem 48% de indecisos e 52% que só querem o fim dos jingles.',
  '{state} bate recorde de santinho por metro quadrado.',
  'Carros de som de {state} atingem volume detectável do espaço.',
];

export const VICTORY_TITLES = { win: 'Vitória de lavada!', lose: 'Derrota nas urnas!' };

export const DEFEAT_LINES = {
  lula: 'Lula já marcou a revanche. Ele garante que conhece bem o caminho de volta.',
  flavio: 'Flávio culpa o algoritmo e pede revanche no grupo da família.',
  cury: 'Cury já escreve o livro "Como Perder a Guerra sem Perder a Calma".',
  renan: 'Renan já está ao vivo analisando a própria derrota. Três horas de live.',
  caiado: 'Caiado volta pra fazenda e jura que a próxima safra é dele.',
};

const pick = (list, seed) => list[Math.floor(seed * list.length) % list.length];
const fill = (text, stateId) => text.replaceAll('{state}', stateId ? STATES[stateId].name : '');

// Turns a log event into { speaker, text }.
export function describeEvent(event) {
  switch (event.type) {
    case 'start':
    case 'turn':
    case 'victory':
    case 'knockout':
      return { speaker: event.faction, text: pick(QUIPS[event.type][event.faction], event.seed) };
    case 'eliminated':
      return { speaker: 'news', text: `PLANTÃO: ${FACTIONS[event.loser].name} está fora da corrida!` };
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

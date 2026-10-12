// All satirical copy lives here (Brazilian Portuguese). Jokes are deliberately
// balanced: each candidate gets roughly the same number of jabs, about public
// personas only. Lines use "{state}" as a subject to avoid gendered prepositions.
import { FACTIONS, STATES } from './data.js';

export const DISCLAIMER =
  'Sátira fictícia. Caricaturas originais, falas inventadas. ' +
  'Não é material de campanha. Nenhum apoio a candidato ou partido.';

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
  cury: {
    name: 'Cury',
    title: 'O Psiquiatra Best-seller',
    pitch: 'Promete tratar a ansiedade do país em 27 capítulos. Autógrafo incluso.',
  },
  renan: {
    name: 'Renan',
    title: 'O Rei da Live',
    pitch: 'Faz campanha por live, meme e corte de vídeo. Dorme entre um corte e outro.',
  },
  caiado: {
    name: 'Caiado',
    title: 'O Doutor do Agro',
    pitch: 'Médico, fazendeiro e governador. Receita pro país: botina, rodeio e plantão.',
  },
};

const QUIPS = {
  start: {
    lula: ['Companheiros! Acende a churrasqueira que tem um país pra ganhar.'],
    flavio: ['Pai, tô ao vivo! Curte e compartilha que tem um país pra ganhar.'],
    cury: ['Respira fundo, Brasil. Vamos gerenciar essa emoção juntos.'],
    renan: ['Boa noite, chat! Hoje a live é pra conquistar o Brasil.'],
    caiado: ['Bom dia, Brasil! Laçar estado é que nem laçar boi: paciência e firmeza.'],
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
    cury: [
      'Antes de atacar, um minuto de gestão da emoção.',
      'Esta rodada vai virar capítulo do meu próximo livro.',
      'Calma. Ansiedade não ganha eleição. Dado ganha.',
    ],
    renan: [
      'Ativa o sininho que vem ataque.',
      'Chat, manda nos comentários qual estado eu ataco.',
      'Isso aqui vai render corte. Cadê o editor?',
    ],
    caiado: [
      'Deixa eu ajeitar o chapéu e já ataco.',
      'Diagnóstico da rodada: falta de estado. Tratamento: ataque.',
      'Botina calçada, hora de trabalhar.',
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
    cury: [
      '{state} agora faz terapia em grupo. O grupo somos nós.',
      '{state} entrou pro clube do livro. Leitura obrigatória: o meu.',
      'Alô, {state}! Primeira sessão grátis. As outras também.',
      '{state} virou capítulo 12: "O Vendedor de Votos".',
      '{state} trocou a ansiedade pela esperança. E trocou de lado.',
    ],
    renan: [
      '{state} tá com a gente! O chat foi à loucura.',
      '{state} virou meme. E depois virou voto.',
      'Alô, {state}! Live amanhã às 21h explicando a conquista.',
      'Mais um no mapa: {state}. O corte de 30 segundos já tá no ar.',
      '{state} mudou de lado depois de uma thread de 47 posts.',
    ],
    caiado: [
      '{state} agora tem rodeio aos sábados.',
      'Porteira aberta: {state} entrou pra fazenda.',
      'Alô, {state}! Consulta, vacina e sanfona por conta da casa.',
      '{state} passou no exame clínico: saudável e do nosso lado.',
      'Mais um no mapa: {state}. Pode pôr na conta da safra.',
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
    cury: [
      'Perder {state} é um convite ao autoconhecimento.',
      'Caiu {state}. Vou transformar a dor em best-seller.',
    ],
    renan: [
      'Perdi {state}? Live de emergência em cinco minutos.',
      'Caiu {state}. Vou gravar um vídeo reagindo à minha derrota.',
    ],
    caiado: [
      'Perdi {state}? É só a entressafra.',
      'Caiu {state}. Receitei repouso e contra-ataque.',
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
    cury: [
      'Vitória total! O Brasil inteiro agora gerencia as emoções. Inclusive eu.',
      'O Brasil tá roxo do Oiapoque ao Chuí. Lançamento do livro semana que vem.',
    ],
    renan: [
      'Vitória total! Recorde de audiência na live da apuração.',
      'O Brasil tá laranja do Oiapoque ao Chuí. Dá like e compartilha!',
    ],
    caiado: [
      'Vitória total! Churrasco com sanfona no Brasil inteiro.',
      'O Brasil tá verde do Oiapoque ao Chuí. Safra recorde de votos.',
    ],
  },
  // Said by whoever takes the human player's last state (multi-faction matches).
  knockout: {
    lula: ['Mais um pra conta. Próximo, companheiro!'],
    flavio: ['Tchau! Vou postar o print dessa vitória.'],
    cury: ['Saiu do mapa? Respira. A gente conversa sobre isso na próxima sessão.'],
    renan: ['Saiu do mapa! Valeu pela audiência, deixa o like antes de ir.'],
    caiado: ['Saiu do mapa! Pode voltar pra casa que a porteira tá aberta.'],
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
  cury: 'Cury já escreve o livro "Como Perder a Guerra sem Perder a Calma".',
  renan: 'Renan já está ao vivo analisando a própria derrota. Três horas de live.',
  caiado: 'Caiado volta pra fazenda e jura que a próxima safra é dele.',
};

const pick = (list, seed) => list[Math.floor(seed * list.length) % list.length];
const fill = (text, stateId) => text.replace('{state}', stateId ? STATES[stateId].name : '');

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

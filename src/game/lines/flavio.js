// Flávio — satirical lines. Fictional, not real quotes. See ./README.md for rules and placeholders.
export default {
  card: {
    title: 'O Senador Herdeiro',
    pitch: 'Sobrenome famoso, grupo da família apitando e entrevista coletiva para qualquer conquista.',
  },
  start: [
    'Pai, tô ao vivo! Curte e compartilha que tem um país pra ganhar.',
    'Bom dia, grupo da família! Hoje eu sou titular.',
    'Bom dia, Senado! Hoje a pauta é uma só: o mapa inteiro.',
  ],
  turn: [
    'Minha vez. Peraí, só respondendo o grupo da família.',
    'Coletiva de imprensa: "Não comento estratégia." Ataco logo depois.',
    'Entrevista rápida: sim, vou atacar. Não, não digo onde. Obrigado.',
    'O sobrenome abre porta. Os dados abrem estado.',
    'Aliança nova: quem tiver estado sobrando, me chama no privado.',
    'Estratégia nova: igual à antiga, só que em negrito.',
    'Mandei um áudio de 4 minutos pro grupo explicando o plano. Ninguém ouviu.',
    'A tia do zap aprovou o ataque com três correntes e um bom dia.',
    'Bom dia, grupo da família! Hoje tem ataque, figurinha nova e áudio de 6 minutos.',
  ],
  conquer: [
    '{O_state} tá com a gente! Mandando print no grupo da família.',
    'Mais um no mapa: {o_state}. O pai reagiu com três joinhas.',
    '{O_state} entrou pro time. Adesivo de carro grátis pra todo mundo!',
    'Alô, {state}! Mesmo sobrenome, nova temporada.',
    '{O_state} virou no estilo senador: terno, gravata e dado de seis.',
    '{O_state} mudou de lado após um vídeo viral com trilha sonora suspeita.',
    '{O_state} aderiu! A família inteira mandou figurinha de comemoração.',
    'A assessoria já soltou a nota: {o_state} aderiu à família.',
    'Valores de família chegaram {em_state}. As figurinhas de bom dia também.',
    'Alô, {state}! O sobrenome chegou antes de mim.',
    '{O_state} assinou a ficha de filiação. A tia do zap já espalhou.',
    'Entrevista exclusiva: "Sim, {o_state} tá com a gente. Próxima pergunta."',
  ],
  conquerSpecial: {
    rj: ['Rio de Janeiro: aqui o sobrenome dispensa apresentação.'],
    df: ['Brasília! Conheço os corredores do Senado de olho fechado.'],
    sp: ['São Paulo no time. O grupo da família virou grupo da metrópole.'],
    mg: ['Minas Gerais: tomei um cafezinho, falei baixinho e saí com a aliança assinada.'],
  },
  lose: [
    'Perdi {o_state}? Vou ver o que o grupo da família acha.',
    'Caiu {o_state}. Apagando o post antes que alguém tire print.',
    'Perder {o_state} não tava no roteiro. Quem escreveu esse roteiro?',
    '{O_state} saiu do grupo. Removido por um administrador.',
    'Perdi {o_state}, mas ganhei engajamento. Isso conta, né?',
    'Caiu {o_state}? Nota oficial: foi uma retirada estratégica.',
  ],
  bigLoss: [
    'Três exércitos de uma vez? Quero recontagem... dos dados.',
    'Esse dado tá com viés ideológico, só pode.',
    'Isso foi montagem. Alguém editou esse dado.',
    'Pai, não abre o grupo agora. Confia.',
  ],
  regionGained: [
    'O {region} é todo nosso! O grupo da família virou grupo regional.',
    'Fechamos o {region}. O sobrenome agora tem CEP próprio.',
    'O {region} tá azul. Print, legenda e hashtag. Já foi.',
    'O {region} aderiu à família. Até o primo distante votou.',
  ],
  regionLost: [
    'Perdemos o {region}? Saí do grupo pra pensar.',
    'O {region} caiu. Nota de esclarecimento em breve.',
    'Sem o {region}, o grupo da família perdeu metade dos membros.',
  ],
  eliminates: [
    'Tchau, {rival}! Te removi do grupo.',
    'O {rival} saiu do jogo. Mandei um "kkkk" e uma figurinha de joinha.',
    'O {rival} foi eliminado. A família inteira mandou figurinha.',
  ],
  eliminated: [
    'Saí do mapa, mas o sobrenome continua.',
    'Fui removido do mapa. Vou ver se tem outro grupo.',
  ],
  victory: [
    'Vitória total! O grupo da família tem 9 mil mensagens não lidas.',
    'O Brasil tá azul do Oiapoque ao Chuí. Segunda temporada confirmada.',
    'Ganhei! Pai, pode imprimir e emoldurar esse mapa.',
  ],
  knockout: [
    'Tchau! Vou postar o print dessa vitória no grupo.',
    'Você saiu do mapa. Quer que eu te adicione no grupo da família?',
  ],
  defeat: [
    'Flávio culpa o algoritmo e pede revanche no grupo da família.',
    'Flávio já gravou um vídeo: "A família não desiste". Visualizações: a família.',
  ],
  // v0.6 contextual lines.
  regionGainedSpecial: {
    north: 'O Norte é nosso! Print da Amazônia azul pro grupo da família.',
    northeast: 'Fechei o Nordeste! A assessoria pediu pra eu não comemorar tão alto.',
    centerWest: 'O Centro-Oeste é todo nosso. Até o agro mandou figurinha de parabéns.',
    southeast: 'O Sudeste inteiro! O Rio me ajudou a carregar São Paulo.',
    south: 'O Sul fechado! Já tô sentindo o vento minuano da vitória.',
  },
  streak: [
    'Três seguidos! O grupo da família não para de mandar áudio.',
    'Conquista atrás de conquista. A coletiva vai ser longa hoje.',
  ],
  lastStand: [
    'Último estado e segurou! O sobrenome resiste.',
    'Tô por um fio, mas o grupo da família mandou 300 correntes de força.',
  ],
  underdog: [
    'Achavam que eu tava fora? A temporada ainda não acabou.',
    'Virada! Pai, pode desmarcar o pedido de desculpas.',
  ],
  longVictory: [
    'Ganhei! Levou tantas rodadas que o grupo da família mudou de nome três vezes.',
    'Vitória de maratona. A coletiva de hoje vai ter que ser em dois dias.',
  ],
};

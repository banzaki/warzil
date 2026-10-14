// Lula — satirical lines. Fictional, not real quotes. See ./README.md for rules and placeholders.
export default {
  card: {
    title: 'O Veterano do Palanque',
    pitch: 'Picanha, futebol e aliança com quem aparecer. Já ganhou, já perdeu, já voltou.',
  },
  start: [
    'Companheiros e companheiras! Acende a churrasqueira que hoje tem jogo grande.',
    'Já ganhei eleição, já perdi eleição, já ganhei de novo. Dado não me assusta.',
    'Isso aqui é final de campeonato, companheiro. E eu jogo em casa em qualquer estádio.',
  ],
  turn: [
    'Minha vez. Bola no chão e picanha na brasa.',
    'No sindicato a gente parava a fábrica inteira. Parar um estado é fichinha.',
    'Vou fazer aliança com quem tiver mais exército. Depois a gente vê se combina.',
    'Quem não chuta não faz gol. Quem não ataca não come picanha.',
    'Já negociei com patrão, com deputado e com sogra. Negociar com dado é tranquilo.',
    'Prometo que neste turno cada brasileiro ganha um estado. Ou meio. Depende do orçamento.',
    'Se der certo, foi o time. Se der errado, foi o gramado.',
    'Me lembra 1979: assembleia no estádio, todo mundo de pé. Só que agora são os dados.',
    'Companheiros e companheiras, hoje a campanha chega até o Acre! Alguém confirma que o Acre existe?',
  ],
  conquer: [
    '{O_state} agora tem picanha no domingo. Promessa é promessa!',
    '{O_state} entrou na campanha. O churrasco ganhou mais uma grelha.',
    'Golaço! {O_state} entrou de cabeça, igual centroavante raiz.',
    '{O_state} ganhou o programa Minha Picanha, Minha Vida. Verba a definir.',
    '{O_state} fechou aliança comigo. Tá escrito no papel de pão, mas vale.',
    '{O_state} aderiu à greve geral contra o adversário.',
    'Alô, {state}! Já tem ministério reservado pra vocês. Qual? A gente inventa.',
    '{O_state} virou companheiro. Agora é churrasco, cerveja e assembleia.',
    'Entrou {o_state} na base aliada. Custou três dados e uma costela.',
    '{O_state} vai ganhar aeroporto, porto e metrô. Prometido tá. Feito, a gente vê.',
    'Nunca antes na história deste país {o_state} mudou de lado tão rápido.',
    'Mais um pra bancada do churrasco: {o_state}.',
  ],
  // State-specific conquest lines (used about half the time on that state).
  conquerSpecial: {
    sp: [
      'Voltei pro ABC, companheiro! São Paulo tem cheiro de assembleia.',
      'Nunca antes na história desse país alguém tomou São Paulo com três dados e um discurso de improviso!',
    ],
    pe: ['Pernambuco! Voltei pra terra natal e trouxe picanha pra família toda.'],
    df: ['Brasília de novo? Pode deixar, já sei onde fica o cafezinho.'],
  },
  lose: [
    'Perdi {o_state}? Futebol é assim, tem jogo de volta.',
    'Caiu {o_state}. Vamos montar um grupo de trabalho pra discutir.',
    'Perder {o_state} dói mais que churrasco sem farofa.',
    '{O_state} saiu da base aliada. Volta quando a picanha baratear.',
    'Foi pênalti mal marcado {em_state}. Segue o jogo.',
    'Caiu {o_state}? Calma. Perdi três eleições antes de ganhar a primeira.',
  ],
  // Attacker lost 3 armies in a single roll.
  bigLoss: [
    'Três exércitos de uma vez? Isso foi goleada do adversário.',
    'Esse dado joga no time de lá, só pode.',
    'Perdemos a assembleia. Mas a greve continua!',
    'Calma, companheiro. Até o Corinthians já caiu e voltou.',
  ],
  regionGained: [
    'O {region} inteiro é nosso! Picanha regional pra todo mundo.',
    'Fechamos o {region}. Isso é que é frente ampla!',
    'O {region} tá vermelhinho. Parece arquibancada em dia de final.',
    'Unificamos o {region}. Churrasco de integração no sábado.',
  ],
  regionLost: [
    'Perdemos o {region}? Vou ligar pros aliados antigos.',
    'O {region} rachou. Precisamos de mais uma reunião com os companheiros.',
    'Sem o {region}, o churrasco fica sem metade da carne.',
  ],
  eliminates: [
    'O {rival} saiu do jogo. Mandei convite pra ele entrar na frente ampla.',
    'Tchau, {rival}! Sem ressentimento: churrasco de despedida por minha conta.',
    'O {rival} foi eliminado. Na política a gente nunca diz nunca, mas hoje eu digo.',
  ],
  // Last words when this candidate is eliminated.
  eliminated: [
    'Saí do mapa, mas ninguém tira a churrasqueira de mim.',
    'Fui eliminado? Já vi esse filme. O final costuma ser bom pra mim.',
  ],
  victory: [
    'Vitória total! Nunca antes na história deste país alguém fez 27 a zero.',
    'O Brasil tá vermelho do Oiapoque ao Chuí. Picanha liberada... depois do orçamento.',
    'Ganhamos! Agora é churrasco de 27 grelhas e cerveja gelada.',
  ],
  // Said to the human player when this candidate knocks them out.
  knockout: [
    'Acabou pra você, companheiro. Mas a churrasqueira fica acesa pra revanche.',
    'Fim de jogo pra você. Quer entrar na minha base aliada?',
  ],
  // End-screen line when this candidate loses the match.
  defeat: [
    'Lula já marcou a revanche. Diz que conhece bem o caminho de volta.',
    'Lula foi pro churrasco de consolação e já está negociando a próxima aliança.',
  ],
  // v0.6 contextual lines.
  // Region fully taken, by region (used about half the time).
  regionGainedSpecial: {
    north: 'O Norte é nosso! Reunião de cúpula com açaí no cardápio.',
    northeast: 'O Nordeste inteiro! Aqui eu jogo em casa e com torcida a favor.',
    centerWest: 'Fechei o Centro-Oeste. Vou ter que aprender a conversar com o agro de botina.',
    southeast: 'O Sudeste é nosso! Quatro estados e nenhuma vaga no estacionamento da Paulista.',
    south: 'O Sul inteiro! Chimarrão na assembleia e churrasco gaúcho de verdade.',
  },
  // Three or more conquests in one turn.
  streak: [
    'Três seguidas! Isso não é vitória, é goleada de time grande.',
    'Mais um, mais um, mais um... parece campanha de 2002.',
  ],
  // Defended the last remaining state against an attack.
  lastStand: [
    'Último estado de pé! Ninguém tira o companheiro do páreo.',
    'Tô na última trincheira, mas já saí de situação pior. Segura!',
  ],
  // Conquered something while holding 3 states or fewer.
  underdog: [
    'Me deram como carta fora do baralho? Já ouvi isso antes. Voltei.',
    'Recuperação no segundo tempo. Futebol e política são assim.',
  ],
  // Victory after 15 or more rounds.
  longVictory: [
    'Demorou, mas veio! Campanha longa é minha especialidade.',
    'Vitória depois de tantas rodadas que até o churrasco esfriou.',
  ],
};

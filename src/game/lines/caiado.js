// Ronaldo Caiado — satirical lines. Fictional, not real quotes. See ./README.md for rules and placeholders.
// Mix of governor authority, doctor, state management and Goiás interior (not just cattle).
export default {
  card: {
    title: 'O Doutor Governador',
    pitch: 'Médico, governador de Goiás e homem de planilha. Trata o país como safra: plantio, gestão e colheita.',
  },
  start: [
    'Bom dia, Brasil! Aqui é na base da ordem: um estado de cada vez.',
    'Governar Goiás me preparou pra isso. Governar 27 é só multiplicar.',
    'Estetoscópio no bolso e mapa na mão. Vamos ao diagnóstico.',
  ],
  turn: [
    'Diagnóstico da rodada: falta estado. Tratamento: ataque.',
    'Comigo é assim: planilha aberta, meta definida, ataque autorizado.',
    'Despacho do governador: ataque autorizado. Publique-se.',
    'No interior a gente acorda às cinco. Ataque às cinco e meia.',
    'Planilha de gestão aberta. Meta da rodada: dois estados.',
    'Sou médico. Sei exatamente onde dói no adversário.',
    'Vou levar o modelo goiano pro país. E o pequi também.',
    'Reunião de secretariado: cinco minutos. Ataque: agora.',
  ],
  conquer: [
    '{O_state} passou no exame clínico: pressão boa e do nosso lado.',
    'Porteira aberta: {o_state} entrou pra base.',
    '{O_state} agora tem gestão de resultados e soja até na praça.',
    'Alô, {state}! Chegou a ordem. E o sertanejo também.',
    'Mais um no mapa: {o_state}. Pode pôr na conta da safra.',
    '{O_state} recebeu alta do adversário. Agora o tratamento é comigo.',
    'Decreto publicado: {o_state} agora segue o modelo goiano.',
    '{O_state} ganhou estrada nova, hospital novo e um outdoor com a minha cara.',
    'Consulta encerrada: {o_state} tinha deficiência de governo. Receitei eu.',
    'Anexei {o_state}. O secretário de agricultura já tá medindo a terra.',
    '{O_state} entrou no consórcio do agro. Colheita de votos garantida.',
    '{O_state} em festa: rodeio, quermesse e governador novo.',
  ],
  conquerSpecial: {
    go: [
      'Goiás de volta pra casa. O governador nem tirou o paletó.',
      'Goiás: celeiro do Brasil e sede do meu gabinete.',
    ],
    df: ['Brasília? Fica aqui do lado de casa. Fui a pé.'],
  },
  lose: [
    'Perdi {o_state}? É só a entressafra.',
    'Caiu {o_state}. Receitei repouso e contra-ataque.',
    '{O_state} saiu da base. Vou mandar uma auditoria.',
    'Perder {o_state} não tava no planejamento estratégico. Atualizem a planilha.',
    '{O_state} teve uma recaída. Volta pro tratamento na próxima rodada.',
    'Caiu {o_state}? Gabinete de crise ativado. Quero o mapa da safra até as seis.',
  ],
  bigLoss: [
    'Três baixas de uma vez. Quero o laudo desses dados.',
    'Isso foi fratura exposta. Gesso e contra-ataque.',
    'Seca braba nos dados. Safra perdida, mas a terra continua.',
    'Prognóstico reservado. Mas o paciente sou eu, e eu sou teimoso.',
  ],
  regionGained: [
    'O {region} inteiro sob gestão goiana. Produtividade recorde.',
    'Fechei o {region}. Decreto, carimbo e porteira trancada.',
    'O {region} é nosso. Mapa da safra atualizado.',
    'O {region} recebeu alta. Saúde regional excelente.',
  ],
  regionLost: [
    'Perdemos o {region}? Quero relatório na minha mesa em uma hora.',
    'O {region} adoeceu. Vou pessoalmente fazer a visita médica.',
    'Sem o {region}, a safra cai. Mas a gente replanta.',
  ],
  eliminates: [
    'O {rival} saiu do jogo. Atestado assinado.',
    'Tchau, {rival}! Porteira fechada atrás de você.',
    'Fim do mandato do {rival}. Transição feita com ordem.',
  ],
  eliminated: [
    'Saí do mapa? Volto pra Goiás. A safra não espera.',
    'Fui eliminado. Diagnóstico: excesso de vizinhos.',
  ],
  victory: [
    'Vitória total! O Brasil inteiro virou uma lavoura bem administrada.',
    'O Brasil tá verde do Oiapoque ao Chuí. Safra recorde de votos.',
    '27 estados com gestão goiana. Próxima meta: exportar o modelo.',
  ],
  knockout: [
    'Saiu do mapa! Pode voltar pra casa que a porteira tá aberta.',
    'Alta médica: você está liberado do jogo.',
  ],
  defeat: [
    'Caiado volta pra Goiás e jura que a próxima safra é dele.',
    'Caiado pediu exame de sangue dos dados. Ainda aguarda o laudo.',
  ],
  // v0.6 contextual lines.
  regionGainedSpecial: {
    north: 'O Norte é nosso. Hidrovia funcionando e safra escoando: isso é gestão.',
    northeast: 'Fechei o Nordeste. O Matopiba agradece a eficiência.',
    centerWest: 'O Centro-Oeste é meu! O celeiro do país voltou pra casa.',
    southeast: 'O Sudeste inteiro. Agora o porto escoa a minha safra.',
    south: 'O Sul fechado. Soja, trigo e gestão de fronteira em dia.',
  },
  streak: [
    'Três conquistas seguidas. Produtividade recorde por hectare.',
    'Uma atrás da outra: isso é colheita mecanizada.',
  ],
  lastStand: [
    'Último estado e resistiu. Porteira fechada não abre por pressão.',
    'Encurralado, mas a cerca aguentou. Divisa é divisa.',
  ],
  underdog: [
    'Achavam que a safra tinha acabado. Era só entressafra.',
    'Virada! Replantei do zero e já tô colhendo.',
  ],
  longVictory: [
    'Venci depois de muitas rodadas. Safra boa leva tempo pra amadurecer.',
    'Gestão de longo prazo: plantei na rodada 1, colhi agora.',
  ],
};

// Aberturas de capitulo.
//
// Onde existe cronica publicada no Diario de Campanha (lancebearers), o
// texto e o dela, palavra por palavra. Onde nao existe, e texto escrito
// para o jogo, e a tela diz isso: nao inventamos cronica que a mesa nao
// jogou.
//
// Embutido de proposito, sem fetch: o jogo funciona offline e nao quebra se
// o site mudar. Para atualizar, copie o paragrafo novo de
// `RPG Recursos/site-conteudo/cronicas/`.

export const INTERLUDIOS = {
  vogler: {
    origem: 'jogo',
    paragrafos: [
      'Vogler ardia. Os draconianos vieram pelo rio antes do amanhecer e não vieram saquear: vieram apagar o nome do lugar do mapa, como já tinham feito com meia dúzia de vilas antes daquela.',
      'Quatro estranhos se acharam no meio da mesma praça, cada um por um motivo diferente, e descobriram na mesma hora que sair vivo dali dependia de sair junto.',
    ],
  },

  catacumbas: {
    origem: 'jogo',
    paragrafos: [
      'Sob o Castelo de Kalaman, a cripta guarda mais do que ossos. Foi ali que o grupo encontrou o que nenhum plano previa: uma armadura vazia montada num cavalo que não respirava, e dentro dela uma voz que já tinha sido humana.',
      'Lord Soth não veio negociar. E não é o tipo de coisa que se vence com espada.',
    ],
  },

  infiltracao: {
    origem: 'cronica',
    data: '2025-11-07',
    titulo: 'A Infiltração na Cidade dos Nomes Perdidos',
    paragrafos: [
      'Trezentos e cinquenta anos depois que o mundo ruiu, com os deuses calados e o culto da Rainha Dragão reerguido das cinzas, quatro aventureiros a serviço de Kalaman se preparavam para entrar onde ninguém entrava. Os exércitos de Takhisis já tinham engolido o leste do continente, e seus draconianos cercavam a única fenda que levava à Cidade dos Nomes Perdidos, lá no Deserto do Norte. Em algum lugar daquela cidade morta, soterrada desde o cataclismo, havia uma arma que a Rainha Dragão queria nas mãos. O grupo precisava chegar primeiro.',
      'O plano nasceu da conversa com Darret, o comandante de Kalaman. A fenda era guardada demais para um ataque frontal, então o exército faria o barulho: uma investida em larga escala para puxar os olhos do inimigo. No meio do estrondo, um punhado de gente certa entraria por onde ninguém olhava, por uma passagem secreta que o familiar de Darian havia encontrado.',
    ],
  },

  descida: {
    origem: 'cronica',
    data: '2026-01-26',
    titulo: 'A Descida à Cidade dos Nomes Perdidos',
    paragrafos: [
      'Passada a batalha na boca da fenda, o grupo desceu para o escuro. O ar foi ficando pesado, com cheiro de água parada e podridão antiga, e a pedra bruta das cavernas aos poucos deu lugar a mármore trabalhado, pisos de uma cidade que um dia fora grandiosa e agora jazia colapsada e submersa. Era a entrada da Cidade dos Nomes Perdidos, e ela não recebia visitantes de braços abertos.',
      'A primeira provação não foi de espada. Luzes verdes e fantasmagóricas tomaram o túnel, e das paredes brotaram cabeças de dragões espectrais, cuspindo acusações: traidores, invasores, profanadores.',
    ],
  },

  ponte: {
    origem: 'cronica',
    data: '2026-06-14',
    titulo: 'A Cidade Soterrada e o Conde Gourmet',
    paragrafos: [
      'A cidade tinha caído dos céus, e o que sobrou dela era um esqueleto inclinado de prédios meio enterrados, telhados rompendo o solo como ossos. Era por dentro dessa ruína que Darian, Owo, Elandrin e Lathuriel precisavam descer, rumo ao Templo de Paladine lá nas cotas mais fundas.',
      'O problema não era só o caminho, todo desmoronamento e ponte quebrada que exigia escalada. Era o céu: draconianos patrulhavam o ar, e qualquer revoada podia transformar a travessia numa caçada.',
    ],
  },
};

export function interludioDe(capituloId) {
  return INTERLUDIOS[capituloId] || null;
}

// Os cinco capitulos, seguindo o arco que a mesa jogou de verdade.
//
// Um capitulo e um punhado de nos ligados. Cada no e combate, dialogo,
// descanso ou decisao. Nao ha mapa-mundi: o grafo e o mapa.
//
// Coordenadas `em` sao percentuais do mapa (0 a 1), para o desenho nao
// depender do tamanho do canvas.

export const CAPITULOS = [
  {
    id: 'vogler',
    nivelInicial: 1,
    numero: 'I',
    titulo: 'A Fuga de Vogler',
    trilha: 'vogler',
    fundo: { top: '#1a0f14', bottom: '#3a2416', glow: 'rgba(201,110,39,0.16)' },
    abertura: 'A vila arde. Os draconianos vieram pelo rio e não vieram para saquear.',
    nos: [
      { id: 'v1', tipo: 'combate', em: { x: 0.12, y: 0.5 }, titulo: 'A praça em chamas',
        // Nível 1: dois baaz já é sério. Um crítico derruba o Darian.
        inimigos: ['BAAZ', 'BAAZ'],
        terreno: [{ kind: 'fogo', cells: [[5,2],[5,3],[6,5]] }, { kind: 'entulho', cells: [[4,4],[7,3]] }],
        liga: ['v2'] },
      { id: 'v2', tipo: 'combate', em: { x: 0.38, y: 0.32 }, titulo: 'A ponte do moinho',
        inimigos: ['BAAZ', 'BAAZ', 'BAAZ'],
        terreno: [{ kind: 'parede', cells: [[5,0],[5,1],[5,6],[5,7]] }],
        liga: ['v3'] },
      { id: 'v3', tipo: 'descanso', em: { x: 0.62, y: 0.55 }, titulo: 'O celeiro',
        texto: 'Um celeiro fora do alcance das chamas. Meia hora, não mais.',
        descanso: 'curto', liga: ['v4'] },
      { id: 'v4', tipo: 'combate', em: { x: 0.86, y: 0.4 }, titulo: 'O sargento kapak', chefe: true,
        inimigos: ['KAPAK', 'BAAZ', 'BAAZ'],
        terreno: [{ kind: 'acido', cells: [[8,3],[8,4]] }],
        liga: [] },
    ],
  },

  {
    id: 'catacumbas',
    nivelInicial: 3,
    numero: 'II',
    titulo: 'As Catacumbas de Kalaman',
    trilha: 'catacumbas',
    fundo: { top: '#0b0d14', bottom: '#1c2028', glow: 'rgba(120,140,200,0.10)' },
    abertura: 'Sob o Castelo de Kalaman, a cripta guarda mais do que ossos.',
    nos: [
      { id: 'c1', tipo: 'dialogo', em: { x: 0.12, y: 0.45 }, titulo: 'Darret',
        cena: 'darretPlano', liga: ['c2'] },
      { id: 'c2', tipo: 'combate', em: { x: 0.36, y: 0.28 }, titulo: 'A galeria dos nichos',
        inimigos: ['MORTO_VIVO', 'MORTO_VIVO', 'MORTO_VIVO'],
        terreno: [{ kind: 'parede', cells: [[4,1],[4,2],[7,5],[7,6]] }],
        liga: ['c3'] },
      { id: 'c3', tipo: 'combate', em: { x: 0.58, y: 0.6 }, titulo: 'A sala dos sarcófagos',
        inimigos: ['MORTO_VIVO', 'MORTO_VIVO', 'MORTO_VIVO', 'BOZAK'],
        liga: ['c4'] },
      // Nao se vence no braco: aguente cinco rodadas ate a saida abrir.
      { id: 'c4', tipo: 'combate', em: { x: 0.85, y: 0.42 }, titulo: 'Lord Soth', chefe: true,
        especial: 'soth',
        objetivo: { kind: 'sobreviver', rounds: 5 },
        trilha: 'soth',
        inimigos: ['MORTO_VIVO', 'MORTO_VIVO'],
        aviso: 'Lord Soth é um cavaleiro da morte. Não se vence no braço. Aguente cinco rodadas.',
        liga: [] },
    ],
  },

  {
    id: 'infiltracao',
    nivelInicial: 4,
    numero: 'III',
    titulo: 'A Infiltração',
    trilha: 'infiltracao',
    fundo: { top: '#141019', bottom: '#2e2418', glow: 'rgba(201,162,39,0.12)' },
    abertura: 'A muralha da Cidade dos Nomes Perdidos. De um lado, o exército de Kalaman faz barulho. Do outro, quatro sombras.',
    nos: [
      { id: 'i1', tipo: 'combate', em: { x: 0.14, y: 0.35 }, titulo: 'A passagem secreta',
        inimigos: ['BAAZ', 'BAAZ', 'KAPAK'],
        terreno: [{ kind: 'parede', cells: [[3,0],[3,1],[3,2],[8,5],[8,6],[8,7]] }],
        liga: ['i2'] },
      { id: 'i2', tipo: 'decisao', em: { x: 0.4, y: 0.6 }, titulo: 'Duas rotas',
        texto: 'A rampa é rápida e exposta. O aqueduto é longo e escuro.',
        opcoes: [
          { texto: 'A rampa. Rápido.', bandeira: 'rotaRampa', vai: 'i3a' },
          { texto: 'O aqueduto. Sem ser visto.', bandeira: 'rotaAqueduto', vai: 'i3b' },
        ] },
      { id: 'i3a', tipo: 'combate', em: { x: 0.62, y: 0.3 }, titulo: 'A rampa exposta',
        inimigos: ['BOZAK', 'BAAZ+', 'BAAZ', 'BAAZ'], liga: ['i4'] },
      { id: 'i3b', tipo: 'combate', em: { x: 0.62, y: 0.75 }, titulo: 'O aqueduto',
        inimigos: ['KAPAK', 'KAPAK'],
        terreno: [{ kind: 'dificil', cells: [[4,3],[5,3],[6,3],[4,4],[5,4],[6,4]] }],
        liga: ['i4'] },
      { id: 'i4', tipo: 'combate', em: { x: 0.87, y: 0.5 }, titulo: 'O guardião sivak', chefe: true,
        inimigos: ['SIVAK', 'BAAZ+', 'BAAZ+'],
        aviso: 'Sivak assume a forma de quem derruba. Cuidado com quem cai.',
        liga: [] },
    ],
  },

  {
    id: 'descida',
    nivelInicial: 5,
    numero: 'IV',
    titulo: 'A Descida',
    trilha: 'descida',
    fundo: { top: '#0a0e12', bottom: '#1a2620', glow: 'rgba(100,200,160,0.10)' },
    abertura: 'A pedra bruta das cavernas dá lugar a mármore trabalhado. A cidade não recebe visitantes de braços abertos.',
    nos: [
      { id: 'd1', tipo: 'combate', em: { x: 0.12, y: 0.5 }, titulo: 'A loja de chapéus',
        inimigos: ['AURAK'],
        terreno: [{ kind: 'entulho', cells: [[4,2],[5,2],[4,5],[5,5],[7,3]] }],
        aviso: 'O aurak não deixa corpo. Vira energia, e a energia estoura.',
        liga: ['d2'] },
      { id: 'd2', tipo: 'combate', em: { x: 0.36, y: 0.28 }, titulo: 'O fosso oleoso',
        inimigos: ['KAPAK+', 'KAPAK', 'BOZAK', 'BOZAK'],
        terreno: [{ kind: 'abismo', cells: [[5,3],[6,3],[5,4],[6,4]] }],
        liga: ['d3'] },
      { id: 'd3', tipo: 'descanso', em: { x: 0.58, y: 0.62 }, titulo: 'A sala das garrafas azuis',
        texto: 'Seis garrafas azuis de desenho espiralado. Não é poção: é vinho de mais de trezentos anos.',
        descanso: 'curto', liga: ['d4'] },
      // Encontro social. Falha em duas vozes leva a combate.
      { id: 'd4', tipo: 'dialogo', em: { x: 0.86, y: 0.45 }, titulo: 'O Julgamento dos Dragões', chefe: true,
        cena: 'julgamentoDosDragoes',
        combateSeFalhar: { inimigos: ['MORTO_VIVO', 'MORTO_VIVO', 'MORTO_VIVO', 'AURAK'] },
        liga: [] },
    ],
  },

  {
    id: 'ponte',
    nivelInicial: 6,
    numero: 'V',
    titulo: 'A Cidade Soterrada e a Ponte',
    trilha: 'ponte',
    fundo: { top: '#180f10', bottom: '#331c14', glow: 'rgba(220,90,40,0.14)' },
    abertura: 'A cidade caiu dos céus e o que sobrou é um esqueleto inclinado, telhados rompendo o solo como ossos.',
    nos: [
      { id: 'p1', tipo: 'dialogo', em: { x: 0.11, y: 0.4 }, titulo: 'O Conde Cornelius',
        cena: 'condeCornelius',
        combateSeFalhar: { inimigos: ['SIVAK'] },
        liga: ['p2'] },
      { id: 'p2', tipo: 'dialogo', em: { x: 0.33, y: 0.65 }, titulo: 'A casa de Demelin',
        cena: 'demelinRefugio', liga: ['p3'] },
      { id: 'p3', tipo: 'combate', em: { x: 0.56, y: 0.32 }, titulo: 'A guarda da ponte',
        inimigos: ['BAAZ+', 'BAAZ+', 'KAPAK+', 'BOZAK', 'BOZAK'],
        convidado: 'CORNELIUS',
        terreno: [{ kind: 'abismo', cells: [[0,0],[1,0],[0,7],[1,7],[10,0],[11,0],[10,7],[11,7]] },
                  { kind: 'entulho', cells: [[5,2],[6,5]] }],
        liga: ['p4'] },
      { id: 'p4', tipo: 'combate', em: { x: 0.85, y: 0.55 }, titulo: 'A montadora de olho vermelho', chefe: true,
        inimigos: ['SIVAK', 'AURAK', 'BOZAK', 'KAPAK+'],
        convidado: 'CORNELIUS',
        aviso: 'A algoz de Becklin Uth Viharin. Ela não vem sozinha.',
        liga: [] },
    ],
  },
];

// Nivel em que a campanha termina, que e o nivel da mesa hoje.
export const NIVEL_FINAL = 8;

// Nivel do grupo ao entrar num capitulo. Serve tambem para quem pula
// direto para um capitulo pelo menu ou pela depuracao.
export function nivelDoCapitulo(indice) {
  return CAPITULOS[indice]?.nivelInicial ?? 1;
}

export function capituloPorId(id) {
  return CAPITULOS.find(c => c.id === id) || null;
}

export function noPorId(capitulo, noId) {
  return capitulo.nos.find(n => n.id === noId) || null;
}

// Primeiro no do capitulo: o que ninguem aponta.
export function noInicial(capitulo) {
  const apontados = new Set(capitulo.nos.flatMap(n => [...(n.liga || []), ...(n.opcoes || []).map(o => o.vai)]));
  return capitulo.nos.find(n => !apontados.has(n.id)) || capitulo.nos[0];
}

// Os quatro, direto das fichas em `06_RPG/RPG Recursos/fichas/`.
//
// O bloco 4 completa as listas de magia e os recursos de classe. O que esta
// aqui ja bate com a ficha em CA, PV, CD e ataque.

import { defineStatblock } from '../rules/statblock.js';
import { talentsFor } from './talents.js';
import { reactionsFor } from './reactions.js';
import { PROGRESSOES } from './progressoes.js';

// ---------- magias ----------
// Formato: o motor entende `attack` (jogada de ataque), `save` (resistencia),
// `heal`, `condition` e `area`. Alcance e area em metros.

export const SPELLS = {
  raioDeFogo: {
    id: 'raioDeFogo', name: 'Raio de Fogo', level: 0, school: 'evocacao',
    castTime: 'acao', range: 36, attack: true, color: '#ff7043',
    damage: { dice: '1d10', type: 'fogo' },
    detail: 'Um dardo de fogo. Escala com o nível do conjurador.',
  },
  bolaDeFogo: {
    id: 'bolaDeFogo', name: 'Bola de Fogo', level: 3, school: 'evocacao',
    castTime: 'acao', range: 45, color: '#ff5722',
    area: { shape: 'esfera', radius: 6 },
    save: { ability: 'des', onSuccess: 'metade' },
    damage: { dice: '8d6', type: 'fogo', perLevel: 'd6' },
    detail: 'Esfera de 6 m. Com Esculpir Magias, os aliados escolhidos ficam de fora.',
  },
  padraoHipnotico: {
    id: 'padraoHipnotico', name: 'Padrão Hipnótico', level: 3, school: 'ilusao',
    castTime: 'acao', range: 36, concentration: true, durationRounds: 10, color: '#b388ff',
    area: { shape: 'cubo', side: 9 },
    save: { ability: 'sab', condition: 'incapacitado' },
    detail: 'Cubo de 9 m. Quem falhar fica incapacitado enquanto durar.',
  },
  passoNebuloso: {
    id: 'passoNebuloso', name: 'Passo Nebuloso', level: 2, school: 'conjuracao',
    castTime: 'bonus', range: 0, targetSide: 'ally', color: '#80deea',
    selfEffect: { key: 'passoNebuloso', label: 'teleporta 9 m', rounds: 1 },
    detail: 'Teleporte curto como ação bônus.',
  },

  chamaSagrada: {
    id: 'chamaSagrada', name: 'Chama Sagrada', level: 0, school: 'evocacao',
    castTime: 'acao', range: 18, color: '#f0c94a',
    save: { ability: 'des' },
    damage: { dice: '1d8', type: 'radiante' },
    detail: 'Luz que desce sobre o alvo. Cobertura não ajuda.',
  },
  dardoOrientador: {
    id: 'dardoOrientador', name: 'Dardo Orientador', level: 1, school: 'evocacao',
    castTime: 'acao', range: 36, attack: true, color: '#f5e6a8',
    damage: { dice: '4d6', type: 'radiante', perLevel: 'd6' },
    detail: 'O próximo ataque contra o alvo tem vantagem.',
  },
  curarFerimentos: {
    id: 'curarFerimentos', name: 'Curar Ferimentos', level: 1, school: 'evocacao',
    castTime: 'acao', range: 1.5, targetSide: 'ally', color: '#9cffb0',
    heal: { dice: '1d8', perLevel: 'd8', addCastingMod: true },
    detail: 'Cura por toque.',
  },
  palavraCurativa: {
    id: 'palavraCurativa', name: 'Palavra Curativa', level: 1, school: 'evocacao',
    castTime: 'bonus', range: 18, targetSide: 'ally', color: '#9cffb0',
    heal: { dice: '1d4', perLevel: 'd4', addCastingMod: true },
    detail: 'Cura à distância como ação bônus. Levanta quem caiu.',
  },
  guardioesEspirituais: {
    id: 'guardioesEspirituais', name: 'Guardiões Espirituais', level: 3, school: 'conjuracao',
    castTime: 'acao', range: 0, concentration: true, durationRounds: 10, color: '#f0c94a',
    area: { shape: 'esfera', radius: 4.5 },
    save: { ability: 'sab', onSuccess: 'metade' },
    damage: { dice: '3d8', type: 'radiante', perLevel: 'd8' },
    detail: 'Aura de 4,5 m ao redor de Elandrin.',
  },

  rajadaMistica: {
    id: 'rajadaMistica', name: 'Rajada Mística', level: 0, school: 'evocacao',
    castTime: 'acao', range: 36, attack: true, beams: true, color: '#b388ff',
    damage: { dice: '1d10+4', type: 'energia' },
    detail: 'Rajada com Explosão Agonizante e Explosão Repelente (empurra 3 m). Dois feixes a partir do nível 5.',
  },
  sussurrosDissonantes: {
    id: 'sussurrosDissonantes', name: 'Sussurros Dissonantes', level: 1, school: 'encantamento',
    castTime: 'acao', range: 18, color: '#c060a0',
    save: { ability: 'sab', onSuccess: 'metade', condition: 'amedrontado' },
    damage: { dice: '3d6', type: 'psiquico', perLevel: 'd6' },
    detail: 'Quem falha se afasta apavorado.',
  },
  imagemEspelhada: {
    id: 'imagemEspelhada', name: 'Imagem Espelhada', level: 2, school: 'ilusao',
    castTime: 'acao', range: 0, targetSide: 'ally', color: '#80deea',
    selfEffect: { key: 'imagemEspelhada', label: 'três duplicatas ilusórias', rounds: 10 },
    detail: 'Duplicatas que absorvem ataques.',
  },
  bencao: {
    id: 'bencao', name: 'Bênção', level: 1, school: 'encantamento',
    castTime: 'acao', range: 9, targetSide: 'ally', concentration: true, durationRounds: 10, color: '#f0c94a',
    condition: 'abencoado',
    detail: '+1d4 em ataques e resistências enquanto durar.',
  },

  flechaCerteira: {
    id: 'flechaCerteira', name: 'Flecha Certeira', level: 1, school: 'transmutacao',
    castTime: 'bonus', range: 0, targetSide: 'ally', color: '#c9d94a',
    selfEffect: { key: 'flechaCerteira', label: 'próximo tiro causa dano extra', rounds: 10 },
    detail: 'Prepara o próximo disparo.',
  },
  marcaDoCacador: {
    id: 'marcaDoCacador', name: 'Marca do Caçador', level: 1, school: 'adivinhacao',
    castTime: 'bonus', range: 27, concentration: true, durationRounds: 10, color: '#c9d94a',
    effect: { key: 'marcado', label: 'marcado pela caçadora', rounds: 10, data: { extraDamage: '1d6' } },
    detail: 'Dano extra contra o alvo marcado.',
  },
};

// Marca em que nivel o item entra no kit daquele personagem. Copia em vez
// de alterar a definicao original, porque a mesma magia pode chegar em
// niveis diferentes para pessoas diferentes: Padrao Hipnotico e do 5o para
// o Darian e do 6o para o Lathuriel.
const em = (nivel, item) => ({ ...item, nivel });

// ---------- fichas ----------

export const HEROES = {
  DARIAN: defineStatblock({
    id: 'darian', name: 'Darian', sprite: 'DARIAN', side: 'ally',
    classe: 'Mago da Alta Feitiçaria (Evocação)', raca: 'Meio-elfo', level: 8, hitDie: 6,
    abilities: { for: 8, des: 14, con: 14, int: 20, sab: 12, car: 10 },
    ac: 17, maxHp: 66, speed: 9,
    saveProficiencies: ['int', 'sab'],
    skillProficiencies: ['arcanismo', 'historia', 'investigacao', 'percepcao'],
    // A ficha traz +9 de ataque de magia por causa da Varinha do Mago de
    // Guerra +1; sem ela o calculo daria +8.
    spellcasting: { ability: 'int', dc: 16, attack: 9, slots: { 1: 4, 2: 3, 3: 3, 4: 2 } },
    features: ['sculptSpells', 'potentCantrip'],
    actions: [
      { name: 'Bastão', kind: 'melee', ability: 'for', reach: 1.5, damage: { dice: '1d6', type: 'impacto' } },
    ],
    progressao: PROGRESSOES.DARIAN,
    spells: [
      em(1, SPELLS.raioDeFogo),
      em(3, SPELLS.passoNebuloso),
      em(5, SPELLS.bolaDeFogo),
      em(5, SPELLS.padraoHipnotico),
    ],
    talents: talentsFor('DARIAN'),
    reactions: reactionsFor('DARIAN').map(r =>
      em(r.id === 'contramagia' ? 5 : 1, r)),
    tactic: 'atirador',
  }),

  ELANDRIN: defineStatblock({
    id: 'elandrin', name: 'Elandrin', sprite: 'ELANDRIN', side: 'ally',
    classe: 'Clérigo de Paladine', raca: 'Alto elfo', level: 7, hitDie: 8,
    abilities: { for: 16, des: 12, con: 14, int: 10, sab: 18, car: 12 },
    ac: 21, maxHp: 71, speed: 9,
    saveProficiencies: ['sab', 'car'],
    skillProficiencies: ['religiao', 'percepcao', 'historia', 'intuicao'],
    spellcasting: { ability: 'sab', dc: 15, slots: { 1: 4, 2: 3, 3: 2 } },
    features: ['warCaster'],
    // Multiclasse: o dano da Radiância escala pelo nível de clérigo, não
    // pelo nível total do personagem.
    clericLevel: 5,
    resources: { canalizarDivindade: 2, segundoFolego: 1, bradoDeApoio: 2, clarao: 4 },
    shortRestResources: ['canalizarDivindade', 'segundoFolego', 'clarao'],
    actions: [
      { name: 'Espada longa', kind: 'melee', ability: 'for', reach: 1.5, damage: { dice: '1d8', type: 'cortante' } },
    ],
    progressao: PROGRESSOES.ELANDRIN,
    spells: [
      em(1, SPELLS.chamaSagrada),
      em(2, SPELLS.dardoOrientador),
      em(2, SPELLS.palavraCurativa),
      em(2, SPELLS.curarFerimentos),
      em(2, SPELLS.bencao),
      em(6, SPELLS.guardioesEspirituais),
    ],
    talents: talentsFor('ELANDRIN').map(t =>
      em({ segundoFolego: 1, radianciaDoAmanhecer: 3, expulsarMortosVivos: 3, brandoDeApoio: 5 }[t.id] || 1, t)),
    reactions: reactionsFor('ELANDRIN').map(r => em(3, r)),
    tactic: 'guarda',
  }),

  LATHURIEL: defineStatblock({
    id: 'lathuriel', name: 'Lathuriel', sprite: 'LATHURIEL', side: 'ally',
    classe: 'Bardo das Espadas / Bruxo Hexblade', raca: 'Dargonesti', level: 8, hitDie: 8,
    abilities: { for: 10, des: 16, con: 14, int: 12, sab: 12, car: 19 },
    ac: 20, maxHp: 67, speed: 9,
    saveProficiencies: ['des', 'car'],
    skillProficiencies: ['persuasao', 'atuacao', 'intimidacao', 'furtividade', 'arcanismo'],
    skillExpertise: ['persuasao'],
    resistances: ['frio'],
    spellcasting: { ability: 'car', dc: 15, slots: { 1: 4, 2: 3, 3: 3, 4: 2 }, pact: { level: 2, slots: 2 } },
    actions: [
      // Hexwarrior: usa Carisma no lugar de Força com a arma do pacto.
      { name: 'Espada longa +1', kind: 'melee', ability: 'car', reach: 1.5, bonus: 1, damageMod: 6, damage: { dice: '1d8', type: 'cortante' } },
    ],
    resources: { maldicaoDoHexblade: 1, inspiracaoDeBardo: 4 },
    shortRestResources: ['maldicaoDoHexblade'],
    progressao: PROGRESSOES.LATHURIEL,
    spells: [
      em(1, SPELLS.sussurrosDissonantes),
      em(2, SPELLS.rajadaMistica),
      em(3, SPELLS.imagemEspelhada),
      em(6, SPELLS.padraoHipnotico),
    ],
    talents: talentsFor('LATHURIEL').map(t =>
      em({ maldicaoDoHexblade: 2, florearDeLamina: 3 }[t.id] || 1, t)),
    reactions: reactionsFor('LATHURIEL'),
    tactic: 'bruto',
  }),

  OWO: defineStatblock({
    id: 'owo', name: 'Owo', sprite: 'OWO', side: 'ally',
    classe: 'Patrulheira', raca: 'Kender', level: 8, hitDie: 10,
    // PROVISÓRIO: a ficha do Owo é a única que ainda não está em
    // `RPG Recursos/fichas/`. Isto é um Patrulheiro de nível 8 padrão mais
    // o que a campanha confirma (arco, Lil'Toy). Substituir quando chegar.
    provisorio: true,
    abilities: { for: 12, des: 18, con: 14, int: 10, sab: 16, car: 12 },
    ac: 16, maxHp: 68, speed: 10.5,
    saveProficiencies: ['for', 'des'],
    skillProficiencies: ['furtividade', 'sobrevivencia', 'percepcao', 'natureza', 'acrobacia'],
    spellcasting: { ability: 'sab', dc: 14, slots: { 1: 4, 2: 3 } },
    actions: [
      { name: 'Arco longo', kind: 'ranged', ability: 'des', range: 45, damage: { dice: '1d8', type: 'perfurante' } },
      { name: 'Adaga', kind: 'melee', ability: 'des', reach: 1.5, damage: { dice: '1d4', type: 'perfurante' } },
    ],
    progressao: PROGRESSOES.OWO,
    spells: [em(2, SPELLS.marcaDoCacador), em(2, SPELLS.flechaCerteira)],
    talents: talentsFor('OWO'),
    reactions: reactionsFor('OWO'),
    tactic: 'atirador',
  }),
};

export const PARTY_ORDER = ['DARIAN', 'ELANDRIN', 'LATHURIEL', 'OWO'];

// Tabelas de nivel dos quatro.
//
// Uma linha por nivel, explicita. O ultimo nivel de cada tabela bate com a
// ficha da mesa, que e onde a campanha termina:
//   Darian 8 (CA 17, 66 PV)  ·  Elandrin 7 (CA 21, 71 PV)
//   Lathuriel 8 (CA 20, 67 PV)  ·  Owo 8 (CA 16, 68 PV, provisorio)
//
// Os PV do primeiro nivel sao dado de vida cheio mais CON, como manda 5e; o
// resto e interpolado para chegar exatamente no numero da ficha. Nao e a
// soma dos dados que a mesa rolou de verdade, e nem teria como ser.

// Atalho: preenche os campos que nao mudam de um nivel para o outro.
function linhas(base, mudancas) {
  const saida = [];
  let atual = { ...base };
  for (let n = 1; n <= mudancas.length; n++) {
    atual = { ...atual, ...mudancas[n - 1] };
    saida.push({ ...atual, slots: { ...(atual.slots || {}) }, recursos: { ...(atual.recursos || {}) } });
  }
  return saida;
}

export const PROGRESSOES = {
  // Mago Evocador. Esculpir Magias chega no 2, Bola de Fogo e Contramagia
  // no 5, Truque Potente no 6.
  DARIAN: linhas({ slots: {}, recursos: {}, features: [] }, [
    { hp: 8,  ac: 13, slots: { 1: 2 }, features: [] },
    { hp: 16, ac: 13, slots: { 1: 3 }, features: ['sculptSpells'] },
    { hp: 25, ac: 14, slots: { 1: 4, 2: 2 } },
    { hp: 33, ac: 14, slots: { 1: 4, 2: 3 } },
    { hp: 41, ac: 15, slots: { 1: 4, 2: 3, 3: 2 } },
    { hp: 50, ac: 15, slots: { 1: 4, 2: 3, 3: 3 }, features: ['sculptSpells', 'potentCantrip'] },
    { hp: 58, ac: 16, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
    { hp: 66, ac: 17, slots: { 1: 4, 2: 3, 3: 3, 4: 2 } },
  ]),

  // Guerreiro 1 / Clerigo da Luz. Os espacos seguem o nivel de clerigo, que
  // fica atras do nivel do personagem: por isso a ficha traz 4/3/2 no 7.
  ELANDRIN: linhas({ slots: {}, recursos: {}, features: [] }, [
    { hp: 10, ac: 16, slots: {}, recursos: { segundoFolego: 1 }, clericLevel: 0, features: [] },
    { hp: 20, ac: 16, slots: { 1: 2 }, clericLevel: 1 },
    { hp: 30, ac: 17, slots: { 1: 3 }, recursos: { segundoFolego: 1, canalizarDivindade: 1, clarao: 4 }, clericLevel: 2 },
    { hp: 40, ac: 18, slots: { 1: 4, 2: 2 }, clericLevel: 3, features: ['warCaster'] },
    { hp: 51, ac: 19, slots: { 1: 4, 2: 3 }, recursos: { segundoFolego: 1, canalizarDivindade: 1, clarao: 4, bradoDeApoio: 2 }, clericLevel: 4 },
    { hp: 61, ac: 20, slots: { 1: 4, 2: 3, 3: 2 }, recursos: { segundoFolego: 1, canalizarDivindade: 2, clarao: 4, bradoDeApoio: 2 }, clericLevel: 5 },
    { hp: 71, ac: 21, slots: { 1: 4, 2: 3, 3: 2 }, clericLevel: 5 },
  ]),

  // Bardo das Espadas com um mergulho em Bruxo Hexblade no 2. Ate la ele
  // luta com rapieira e Destreza; a espada do pacto com Carisma so existe
  // depois do Hexwarrior.
  LATHURIEL: linhas({ slots: {}, recursos: {}, features: [] }, [
    { hp: 10, ac: 15, slots: { 1: 2 }, recursos: { inspiracaoDeBardo: 3 },
      acoes: [{ name: 'Rapieira', kind: 'melee', ability: 'des', reach: 1.5, damage: { dice: '1d8', type: 'perfurante' } }] },
    { hp: 18, ac: 15, slots: { 1: 3 }, recursos: { inspiracaoDeBardo: 3, maldicaoDoHexblade: 1 },
      pacto: { nivel: 1, espacos: 1 },
      acoes: [{ name: 'Espada longa +1', kind: 'melee', ability: 'car', reach: 1.5, bonus: 1, damageMod: 5, damage: { dice: '1d8', type: 'cortante' } }] },
    { hp: 26, ac: 16, slots: { 1: 4, 2: 2 } },
    { hp: 34, ac: 17, slots: { 1: 4, 2: 3 } },
    { hp: 42, ac: 18, slots: { 1: 4, 2: 3, 3: 2 }, recursos: { inspiracaoDeBardo: 4, maldicaoDoHexblade: 1 },
      pacto: { nivel: 2, espacos: 2 } },
    { hp: 51, ac: 19, slots: { 1: 4, 2: 3, 3: 3 } },
    { hp: 59, ac: 19, slots: { 1: 4, 2: 3, 3: 3, 4: 1 } },
    { hp: 67, ac: 20, slots: { 1: 4, 2: 3, 3: 3, 4: 2 },
      acoes: [{ name: 'Espada longa +1', kind: 'melee', ability: 'car', reach: 1.5, bonus: 1, damageMod: 6, damage: { dice: '1d8', type: 'cortante' } }] },
  ]),

  // Patrulheira. Meia-conjuradora: os espacos so aparecem no nivel 2.
  // PROVISÓRIO junto com a ficha dela.
  OWO: linhas({ slots: {}, recursos: {}, features: [] }, [
    { hp: 12, ac: 14, slots: {} },
    { hp: 20, ac: 14, slots: { 1: 2 } },
    { hp: 28, ac: 15, slots: { 1: 3 } },
    { hp: 36, ac: 15, slots: { 1: 3 } },
    { hp: 44, ac: 16, slots: { 1: 4, 2: 2 } },
    { hp: 52, ac: 16, slots: { 1: 4, 2: 2 } },
    { hp: 60, ac: 16, slots: { 1: 4, 2: 3 } },
    { hp: 68, ac: 16, slots: { 1: 4, 2: 3 } },
  ]),
};

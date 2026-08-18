// Testes dos kits de classe e das mortes draconianas.
//
// Sao as regras que a mesa vai reconhecer na hora, entao valem verificacao
// exata em vez de "pareceu certo na tela".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as Dice from '../src/rules/dice.js';
import { Combatant } from '../src/rules/statblock.js';
import { Encounter } from '../src/rules/combat.js';
import { Field } from '../src/battle/field.js';
import { HEROES } from '../src/data/heroes.js';
import { MONSTERS, spawnGroup } from '../src/data/monsters.js';
import { TALENTS } from '../src/data/talents.js';
import { REACTIONS } from '../src/data/reactions.js';

const frac = (value, sides) => (value - 0.5) / sides;

// Monta um encontro minimo com campo, que e o que os efeitos de morte usam.
function arena({ herois = ['ELANDRIN'], monstros = ['BAAZ'] } = {}) {
  const field = new Field();
  const party = herois.map((k, i) => {
    const c = new Combatant(HEROES[k], { side: 'ally' });
    field.place(c, { x: 1, y: 2 + i });
    return c;
  });
  const foes = spawnGroup(monstros).map((sb, i) => {
    const c = new Combatant(sb, { side: 'foe' });
    field.place(c, { x: 3, y: 2 + i });
    return c;
  });
  const encounter = new Encounter({ combatants: [...party, ...foes] });
  encounter.field = field;
  return { field, party, foes, encounter, heroi: party[0], monstro: foes[0] };
}

describe('fichas batem com o papel', () => {
  test('as CDs de magia sao as das fichas', () => {
    const d = new Combatant(HEROES.DARIAN, { side: 'ally' });
    const e = new Combatant(HEROES.ELANDRIN, { side: 'ally' });
    const l = new Combatant(HEROES.LATHURIEL, { side: 'ally' });
    assert.equal(d.spellSaveDC, 16);
    assert.equal(e.spellSaveDC, 15);
    assert.equal(l.spellSaveDC, 15);
    // A varinha do Mago de Guerra +1 aparece no ataque, nao na CD.
    assert.equal(d.spellAttack, 9);
  });

  test('a ficha do Owo esta marcada como provisoria', () => {
    assert.equal(HEROES.OWO.provisorio, true,
      'enquanto a ficha real nao chega, o kit precisa se declarar aproximado');
  });

  test('Lathuriel usa Carisma na espada do pacto', () => {
    const l = new Combatant(HEROES.LATHURIEL, { side: 'ally' });
    const espada = l.sb.actions[0];
    assert.equal(espada.ability, 'car');
    assert.equal(l.mod('car'), 4);
  });
});

describe('Canalizar Divindade', () => {
  test('Radiancia queima os hostis e poupa os aliados', () => {
    const { encounter, heroi, foes, party } = arena({ herois: ['ELANDRIN', 'DARIAN'], monstros: ['BAAZ', 'BAAZ'] });
    const darianHp = party[1].hp;
    Dice.setRng(() => frac(1, 20));                 // todos falham
    const eventos = TALENTS.radianciaDoAmanhecer.resolve({
      encounter, actor: heroi, targets: [...party, ...foes],
    });
    Dice.resetRng();
    assert.equal(party[1].hp, darianHp, 'aliado no raio não é atingido');
    assert.ok(foes.every(f => f.hp < f.maxHp), 'os dois baaz sofrem');
    assert.ok(eventos.some(e => e.text.includes('radiante')));
  });

  test('o dano escala pelo nivel de clerigo, nao pelo nivel total', () => {
    // Alvo resistente de proposito: um baaz de 22 PV morreria antes e o
    // dano medido ficaria limitado pela vida em vez de pela regra.
    const { encounter, heroi, monstro } = arena({ monstros: ['SIVAK'] });
    // 2d10 com 10 em cada, mais 5 de nivel de clerigo = 25.
    let n = 0;
    Dice.setRng(() => { n++; return n === 1 ? frac(1, 20) : frac(10, 10); });
    TALENTS.radianciaDoAmanhecer.resolve({ encounter, actor: heroi, targets: [monstro] });
    Dice.resetRng();
    assert.equal(heroi.sb.clericLevel, 5);
    assert.equal(heroi.level, 7, 'o nível total é 7, mas o de clérigo é 5');
    assert.equal(monstro.maxHp - monstro.hp, 25);
  });

  test('Expulsar Mortos-Vivos destroi os fracos e nao faz nada em draconiano', () => {
    const semMortos = arena({ monstros: ['BAAZ'] });
    const nada = TALENTS.expulsarMortosVivos.resolve({
      encounter: semMortos.encounter, actor: semMortos.heroi, targets: [semMortos.monstro],
    });
    assert.match(nada[0].text, /Nenhum morto-vivo/);
    assert.equal(semMortos.monstro.hp, semMortos.monstro.maxHp);

    const cripta = arena({ monstros: ['MORTO_VIVO', 'MORTO_VIVO'] });
    Dice.setRng(() => frac(1, 20));                 // falham na resistencia
    TALENTS.expulsarMortosVivos.resolve({
      encounter: cripta.encounter, actor: cripta.heroi, targets: cripta.foes,
    });
    Dice.resetRng();
    assert.ok(cripta.foes.every(f => f.dead), 'ND 1/4 é destruído de imediato');
  });
});

describe('Maldicao do Hexblade', () => {
  test('marca o alvo, soma dano e amplia o critico para 19', async () => {
    const { encounter, heroi, monstro } = arena({ herois: ['LATHURIEL'], monstros: ['SIVAK'] });
    TALENTS.maldicaoDoHexblade.resolve({ actor: heroi, targets: [monstro] });
    const efeito = heroi.getEffect('maldicaoHexblade');
    assert.equal(efeito.data.markedTarget, monstro.id);
    assert.equal(efeito.data.critRange, 19);

    // d20 = 19 vira critico por causa da maldicao; sem ela seria acerto normal.
    let n = 0;
    Dice.setRng(() => { n++; return n === 1 ? frac(19, 20) : frac(4, 8); });
    const res = await encounter.attack(heroi, monstro, heroi.sb.actions[0], {});
    Dice.resetRng();
    assert.equal(res.crit, true, '19 critica contra o alvo amaldiçoado');
    assert.ok(encounter.history.some(e => e.text?.includes('maldição sobre')),
      'o dano extra da maldição aparece no log');
  });

  test('o dano extra so vale contra o alvo marcado', async () => {
    const { encounter, heroi, foes } = arena({ herois: ['LATHURIEL'], monstros: ['SIVAK', 'BAAZ'] });
    TALENTS.maldicaoDoHexblade.resolve({ actor: heroi, targets: [foes[0]] });
    let n = 0;
    Dice.setRng(() => { n++; return n === 1 ? frac(18, 20) : frac(4, 8); });
    await encounter.attack(heroi, foes[1], heroi.sb.actions[0], {});
    Dice.resetRng();
    assert.equal(encounter.history.some(e => e.text?.includes('maldição sobre')), false,
      'o baaz não amaldiçoado não come o dano extra');
  });
});

describe('mortes draconianas', () => {
  test('baaz vira estatua e o quadrado fica dificil de cruzar', async () => {
    const { encounter, heroi, monstro, field } = arena();
    monstro.hp = 1;
    field.place(monstro, { x: 2, y: 2 });
    let n = 0;
    Dice.setRng(() => { n++; return n === 1 ? frac(20, 20) : frac(6, 8); });
    await encounter.attack(heroi, monstro, heroi.sb.actions[0], {});
    Dice.resetRng();
    assert.equal(monstro.dead, true);
    assert.equal(field.terrain[2][2], 'entulho');
    assert.ok(encounter.history.some(e => e.text?.includes('estátua')));
  });

  test('sivak assume a forma de quem derruba, uma vez so', async () => {
    const { encounter, heroi, monstro } = arena({ herois: ['DARIAN'], monstros: ['SIVAK'] });
    assert.equal(monstro.name, 'Sivak');
    heroi.hp = 1;
    let n = 0;
    Dice.setRng(() => { n++; return n === 1 ? frac(20, 20) : frac(8, 8); });
    await encounter.attack(monstro, heroi, monstro.sb.actions[0], {});
    Dice.resetRng();
    assert.equal(heroi.down, true);
    assert.equal(monstro.name, 'Darian', 'o sivak passa a usar o nome da vítima');
    assert.equal(monstro.sb.sprite, 'DARIAN', 'e o sprite dela');
    assert.ok(encounter.history.some(e => e.type === 'kill-effect'));
  });

  test('aurak deixa energia que detona depois de tres rodadas', () => {
    const { encounter, field, monstro, heroi } = arena({ monstros: ['AURAK'] });
    field.place(monstro, { x: 4, y: 4 });
    field.place(heroi, { x: 5, y: 4 });
    monstro.applyDamage(999);
    MONSTERS.AURAK().onDeath.resolve({ encounter, victim: monstro });

    const perigo = field.hazards.find(h => h.id.startsWith('energia'));
    assert.ok(perigo, 'a energia fica no chão');
    assert.equal(perigo.rounds, 3, 'com contagem, para dar tempo de sair de perto');

    assert.equal(field.tickHazards().length, 0);
    assert.equal(field.tickHazards().length, 0);
    const expirados = field.tickHazards();
    assert.equal(expirados.length, 1);

    const hpAntes = heroi.hp;
    Dice.setRng(() => frac(1, 20));
    const eventos = expirados[0].onExpire({ encounter, hazard: expirados[0], field });
    Dice.resetRng();
    assert.ok(heroi.hp < hpAntes, 'quem ficou perto come a detonação');
    assert.ok(eventos.some(e => e.type === 'damage'));
  });

  test('kapak deixa poca de acido que expira sozinha', () => {
    const { encounter, field, monstro } = arena({ monstros: ['KAPAK'] });
    field.place(monstro, { x: 4, y: 4 });
    MONSTERS.KAPAK().onDeath.resolve({ encounter, victim: monstro });
    assert.equal(field.terrainAt({ x: 4, y: 4 }).label, 'poça de ácido');
    field.tickHazards(); field.tickHazards(); field.tickHazards();
    assert.equal(field.terrain[4][4], 'normal');
  });
});

describe('reacoes', () => {
  test('Contramagia com espaco igual ou maior anula sem teste', () => {
    const darian = new Combatant(HEROES.DARIAN, { side: 'ally' });
    const res = REACTIONS.contramagia.resolve({
      combatant: darian,
      trigger: { spellName: 'Dardo Arcano', spellLevel: 1 },
    });
    assert.equal(res.countered, true);
    assert.equal(darian.slots[3].used, 1, 'gasta um espaço de 3º');
  });

  test('Contramagia contra magia de nivel maior exige teste', () => {
    const darian = new Combatant(HEROES.DARIAN, { side: 'ally' });
    Dice.setRng(() => frac(1, 20));                 // teste falha
    const res = REACTIONS.contramagia.resolve({
      combatant: darian,
      trigger: { spellName: 'Desintegrar', spellLevel: 6 },
    });
    Dice.resetRng();
    assert.equal(res.countered, false);
    assert.ok(res.events.some(e => e.text.includes('a magia passa')));
  });

  test('Contramagia fica indisponivel sem espaco de 3º', () => {
    const darian = new Combatant(HEROES.DARIAN, { side: 'ally' });
    for (let l = 3; l <= 9; l++) if (darian.slots[l]) darian.slots[l].used = darian.slots[l].max;
    const pode = REACTIONS.contramagia.available({
      combatant: darian, trigger: { caster: {}, spellLevel: 1 },
    });
    assert.equal(pode, false);
  });

  test('Clarao Protetor gasta o recurso e impoe desvantagem', () => {
    const elandrin = new Combatant(HEROES.ELANDRIN, { side: 'ally' });
    assert.equal(elandrin.resourceLeft('clarao'), 4);
    const res = REACTIONS.clarãoProtetor.resolve({
      combatant: elandrin, trigger: { attacker: { name: 'Baaz' } },
    });
    assert.equal(res.imposeDisadvantage, true);
    assert.equal(elandrin.resourceLeft('clarao'), 3);
  });

  test('o motor recusa a reacao quando ela ja foi gasta na rodada', async () => {
    const { encounter, heroi, monstro } = arena({ herois: ['ELANDRIN'] });
    let vezes = 0;
    encounter.reactionResolver = async ({ options }) => { vezes++; return options[0]; };
    heroi.beginTurn();
    await encounter.offerReaction(heroi, { kind: 'incoming-attack', attacker: monstro, target: heroi });
    await encounter.offerReaction(heroi, { kind: 'incoming-attack', attacker: monstro, target: heroi });
    assert.equal(vezes, 1);
  });

  test('a conjuracao inimiga esta marcada para a Contramagia enxergar', () => {
    const bozak = MONSTERS.BOZAK();
    const dardo = bozak.actions.find(a => a.name === 'Dardo arcano');
    assert.equal(dardo.isSpell, true);
    assert.ok(dardo.spellLevel >= 1);
  });
});

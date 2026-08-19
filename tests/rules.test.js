// Testes do motor de regras. Rodam sem navegador: `npm test`.
//
// O gerador de numeros e injetavel, entao cada teste fixa a sequencia de
// dados e verifica o resultado exato em vez de torcer.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as Dice from '../src/rules/dice.js';
import { defineStatblock, Combatant } from '../src/rules/statblock.js';
import { Encounter } from '../src/rules/combat.js';
import { castSpell, canCast, damageAt, cantripDice, beamsFor } from '../src/rules/spells.js';
import { MONSTERS } from '../src/data/monsters.js';

// `die(sides)` faz floor(rng()*sides)+1. Esta fracao faz o dado cair
// exatamente em `value`, seja qual for o numero de faces.
const frac = (value, sides) => (value - 0.5) / sides;

describe('dados', () => {
  test('parse entende notacao composta', () => {
    assert.deepEqual(Dice.parse('2d6+3'), { dice: [{ count: 2, sides: 6 }], flat: 3 });
    assert.deepEqual(Dice.parse('1d8-1'), { dice: [{ count: 1, sides: 8 }], flat: -1 });
    assert.deepEqual(Dice.parse('8d6'), { dice: [{ count: 8, sides: 6 }], flat: 0 });
    assert.deepEqual(Dice.parse(5), { dice: [], flat: 5 });
    assert.throws(() => Dice.parse('2x6'), /invalida/);
  });

  test('critico dobra os dados e nao o fixo', () => {
    Dice.setRng(() => frac(4, 6));            // todo d6 sai 4
    const normal = Dice.rollNotation('2d6+3');
    const crit = Dice.rollNotation('2d6+3', { crit: true });
    assert.equal(normal.total, 4 + 4 + 3);    // 11
    assert.equal(crit.total, 4 * 4 + 3);      // 19, quatro dados e o +3 inteiro
    assert.equal(crit.rolls.length, 4);
    Dice.resetRng();
  });

  test('vantagem pega o maior e mostra os dois dados', () => {
    const seq = [frac(7, 20), frac(15, 20)];
    let i = 0;
    Dice.setRng(() => seq[i++ % seq.length]);
    const r = Dice.d20({ mod: 5, advantage: true });
    assert.deepEqual(r.rolls, [7, 15]);
    assert.equal(r.natural, 15);
    assert.equal(r.total, 20);
    assert.equal(r.mode, 'adv');
    Dice.resetRng();
  });

  test('vantagem e desvantagem juntas se cancelam', () => {
    Dice.setRng(() => frac(11, 20));
    const r = Dice.d20({ advantage: true, disadvantage: true });
    assert.equal(r.mode, 'flat');
    assert.equal(r.rolls.length, 1);
    Dice.resetRng();
  });

  test('natural 20 acerta e natural 1 erra, independente da CA', () => {
    Dice.setRng(() => frac(20, 20));
    assert.equal(Dice.attackRoll({ mod: -5, ac: 30 }).hit, true);
    Dice.setRng(() => frac(1, 20));
    assert.equal(Dice.attackRoll({ mod: 20, ac: 5 }).hit, false);
    Dice.resetRng();
  });

  test('bonus de proficiencia segue a tabela', () => {
    assert.equal(Dice.proficiencyBonus(1), 2);
    assert.equal(Dice.proficiencyBonus(4), 2);
    assert.equal(Dice.proficiencyBonus(5), 3);
    assert.equal(Dice.proficiencyBonus(8), 3);
    assert.equal(Dice.proficiencyBonus(9), 4);
    assert.equal(Dice.proficiencyBonus(17), 6);
  });

  test('modificador de atributo', () => {
    assert.equal(Dice.abilityMod(20), 5);
    assert.equal(Dice.abilityMod(10), 0);
    assert.equal(Dice.abilityMod(7), -2);
  });
});

// ---------- fichas de teste ----------

function makeDarian() {
  return new Combatant(defineStatblock({
    id: 'darian', name: 'Darian', level: 8, side: 'ally',
    abilities: { for: 8, des: 14, con: 14, int: 20, sab: 12, car: 10 },
    ac: 17, maxHp: 66, speed: 9, hitDie: 6,
    saveProficiencies: ['int', 'sab'],
    features: ['sculptSpells', 'potentCantrip'],
    spellcasting: { ability: 'int', slots: { 1: 4, 2: 3, 3: 3, 4: 2 } },
  }), { side: 'ally' });
}

function makeBaaz(id = 'baaz1') {
  return new Combatant(defineStatblock({
    id, name: 'Baaz', level: 2, side: 'foe',
    abilities: { for: 14, des: 12, con: 14, int: 8, sab: 10, car: 8 },
    ac: 15, maxHp: 22, speed: 9,
    actions: [{ name: 'Espada curta', kind: 'melee', ability: 'for', damage: { dice: '1d6', type: 'cortante' } }],
  }), { side: 'foe' });
}

describe('bloco de status', () => {
  test('CD de magia e ataque saem dos atributos', () => {
    const d = makeDarian();
    assert.equal(d.prof, 3);              // nivel 8
    assert.equal(d.mod('int'), 5);
    assert.equal(d.spellSaveDC, 8 + 3 + 5);  // 16, bate com a ficha
    assert.equal(d.spellAttack, 3 + 5);      // +8
  });

  test('resistencia corta o dano pela metade e imunidade zera', () => {
    const c = new Combatant(defineStatblock({
      id: 'x', maxHp: 40, resistances: ['fogo'], immunities: ['veneno'], vulnerabilities: ['radiante'],
    }));
    assert.equal(c.applyDamage(11, 'fogo').taken, 5);   // arredonda para baixo
    assert.equal(c.applyDamage(10, 'veneno').taken, 0);
    assert.equal(c.applyDamage(6, 'radiante').taken, 12);
  });

  test('PV temporario absorve antes dos PV e nao acumula', () => {
    const c = new Combatant(defineStatblock({ id: 'x', maxHp: 30 }));
    c.grantTempHp(8);
    assert.equal(c.grantTempHp(5), false);   // menor nao substitui
    assert.equal(c.tempHp, 8);
    const r = c.applyDamage(10);
    assert.equal(r.absorbed, 8);
    assert.equal(c.hp, 28);
  });

  test('espaco de magia sobe de nivel quando o pedido acabou', () => {
    const d = makeDarian();
    d.slots[3].used = 3;                     // gasta os tres de 3o nivel
    const used = d.spendSlot(3);
    assert.equal(used.level, 4);             // cai no de 4o
    assert.equal(d.slots[4].used, 1);
  });

  test('descanso longo devolve tudo', () => {
    const d = makeDarian();
    d.hp = 10; d.slots[1].used = 4; d.addCondition('envenenado');
    d.longRest();
    assert.equal(d.hp, 66);
    assert.equal(d.slots[1].used, 0);
    assert.equal(d.conditions.size, 0);
  });
});

describe('concentracao', () => {
  test('CD e 10 ou metade do dano, o que for maior', () => {
    const d = makeDarian();
    d.startConcentration('haste');
    Dice.setRng(() => frac(20, 20));         // passa com folga
    const easy = d.concentrationCheck(8);
    assert.equal(easy.dc, 10);               // metade de 8 e 4, entao 10
    const hard = (() => { d.startConcentration('haste'); return d.concentrationCheck(30); })();
    assert.equal(hard.dc, 15);               // metade de 30
    Dice.resetRng();
  });

  test('falhar no teste derruba a concentracao', () => {
    const d = makeDarian();
    d.startConcentration('wallOfFire');
    Dice.setRng(() => frac(1, 20));
    const r = d.concentrationCheck(40);
    assert.equal(r.kept, false);
    assert.equal(d.concentration, null);
    Dice.resetRng();
  });

  test('conjurar nova magia de concentracao derruba a anterior', () => {
    const d = makeDarian();
    d.startConcentration('haste');
    const spell = { id: 'hypnoticPattern', name: 'Padrão Hipnótico', level: 3, school: 'ilusao', concentration: true };
    const res = castSpell(d, spell, []);
    assert.ok(res.ok);
    assert.ok(res.events.some(e => e.type === 'concentration-dropped'));
    assert.equal(d.concentration.spell, 'hypnoticPattern');
  });
});

describe('magia', () => {
  const fireball = {
    id: 'fireball', name: 'Bola de Fogo', level: 3, school: 'evocacao',
    save: { ability: 'des', onSuccess: 'metade' },
    damage: { dice: '8d6', type: 'fogo', perLevel: 'd6' },
  };

  test('upcast soma um dado por nivel acima', () => {
    assert.equal(damageAt(fireball, 3), '8d6');
    assert.equal(damageAt(fireball, 5), '8d6+2d6');
  });

  test('truque escala por nivel de personagem', () => {
    const firebolt = { id: 'fb', level: 0, damage: { dice: '1d10', type: 'fogo' } };
    assert.equal(cantripDice(firebolt, 1), '1d10');
    assert.equal(cantripDice(firebolt, 5), '2d10');
    assert.equal(cantripDice(firebolt, 11), '3d10');
    assert.equal(cantripDice(firebolt, 17), '4d10');
  });

  describe('Rajada Mistica: feixes em vez de dado dobrado', () => {
    const rajada = {
      id: 'rajada', name: 'Rajada Mística', level: 0, school: 'evocacao',
      attack: true, beams: true, damage: { dice: '1d10+4', type: 'energia' },
    };

    function makeConjurador(level) {
      return new Combatant(defineStatblock({
        id: 'lathuriel', name: 'Lathuriel', level, side: 'ally',
        abilities: { for: 10, des: 14, con: 14, int: 10, sab: 10, car: 19 },
        ac: 20, maxHp: 67, speed: 9,
        spellcasting: { ability: 'car', slots: {} },
      }), { side: 'ally' });
    }

    test('beamsFor devolve 1 feixe abaixo do nivel 5 e 2 a partir dele', () => {
      assert.equal(beamsFor(rajada, 4), 1);
      assert.equal(beamsFor(rajada, 5), 2);
      assert.equal(beamsFor(rajada, 11), 3);
    });

    test('no nivel 4 rola um ataque; no nivel 5, dois, cada um com seu 1d10+4', () => {
      // d20(15) acerta a CA 15 do baaz sem virar critico; d10 sai 8, entao
      // cada feixe causa 8+4 = 12, sem dado dobrado.
      Dice.setRng(() => frac(15, 20));

      const baixo = castSpell(makeConjurador(4), rajada, [makeBaaz()]);
      assert.equal(baixo.events.filter(e => e.type === 'attack-roll').length, 1);
      assert.deepEqual(baixo.events.filter(e => e.type === 'damage').map(e => e.amount), [12]);

      const alto = castSpell(makeConjurador(5), rajada, [makeBaaz()]);
      assert.equal(alto.events.filter(e => e.type === 'attack-roll').length, 2);
      assert.deepEqual(alto.events.filter(e => e.type === 'damage').map(e => e.amount), [12, 12]);

      Dice.resetRng();
    });
  });

  test('sem espaco disponivel a magia nao sai', () => {
    const d = makeDarian();
    for (let l = 3; l <= 9; l++) if (d.slots[l]) d.slots[l].used = d.slots[l].max;
    const check = canCast(d, fireball, { slotLevel: 3 });
    assert.equal(check.ok, false);
    const res = castSpell(d, fireball, [makeBaaz()]);
    assert.equal(res.ok, false);
  });

  test('resistencia bem-sucedida causa metade do dano', () => {
    const d = makeDarian();
    const baaz = makeBaaz();
    // d20 do baaz sai 20 (passa), depois todo d6 sai 4 → 8d6 = 32 → metade 16
    let first = true;
    Dice.setRng(() => { if (first) { first = false; return frac(20, 20); } return frac(4, 6); });
    const res = castSpell(d, fireball, [baaz]);
    const dmg = res.events.find(e => e.type === 'damage');
    assert.equal(dmg.amount, 16);
    Dice.resetRng();
  });

  test('Esculpir Magias poupa exatamente os aliados escolhidos', () => {
    const d = makeDarian();
    const aliado = new Combatant(defineStatblock({ id: 'elandrin', name: 'Elandrin', maxHp: 71, ac: 21, side: 'ally' }), { side: 'ally' });
    const baaz = makeBaaz();
    let first = true;
    Dice.setRng(() => { if (first) { first = false; return frac(1, 20); } return frac(6, 6); });

    const res = castSpell(d, fireball, [aliado, baaz], { spared: [aliado] });
    assert.ok(res.events.some(e => e.type === 'spared' && e.target === 'elandrin'));
    assert.equal(aliado.hp, 71);                                  // intacto
    assert.ok(res.events.some(e => e.type === 'damage' && e.target === 'baaz1'));
    Dice.resetRng();
  });

  test('Esculpir Magias respeita o limite de 1 + nivel da magia', () => {
    const d = makeDarian();
    const alvos = [1, 2, 3, 4, 5, 6].map(i =>
      new Combatant(defineStatblock({ id: 'a' + i, name: 'A' + i, maxHp: 30, side: 'ally' }), { side: 'ally' }));
    Dice.setRng(() => frac(10, 20));
    const res = castSpell(d, fireball, alvos, { spared: alvos });
    const poupados = res.events.filter(e => e.type === 'spared').length;
    assert.equal(poupados, 4);                                    // 1 + 3
    Dice.resetRng();
  });

  test('Truque Potente causa metade mesmo quando o alvo resiste', () => {
    const d = makeDarian();
    const baaz = makeBaaz();
    const rajada = {
      id: 'rajada', name: 'Rajada', level: 0, school: 'evocacao',
      save: { ability: 'des' },                                   // sem "metade" declarado
      damage: { dice: '1d8', type: 'fogo' },
    };
    let first = true;
    Dice.setRng(() => { if (first) { first = false; return frac(20, 20); } return frac(8, 8); });
    const res = castSpell(d, rajada, [baaz]);
    const dmg = res.events.find(e => e.type === 'damage');
    // nivel 8 → 2 dados → 16, metade = 8
    assert.equal(dmg.amount, 8);
    Dice.resetRng();
  });
});

describe('encontro', () => {
  test('iniciativa ordena do maior para o menor', () => {
    const d = makeDarian();
    const b = makeBaaz();
    const seq = [frac(5, 20), frac(18, 20)];
    let i = 0;
    Dice.setRng(() => seq[i++ % seq.length]);
    const enc = new Encounter({ combatants: [d, b] });
    enc.rollInitiative();
    assert.equal(enc.order[0].id, 'baaz1');   // 18+1 contra 5+2
    Dice.resetRng();
  });

  test('ataque acerta, causa dano e o log mostra a conta', async () => {
    const d = makeDarian();
    const b = makeBaaz();
    const enc = new Encounter({ combatants: [d, b] });
    Dice.setRng(() => frac(10, 20));
    enc.rollInitiative();

    // baaz +2 for, +2 prof = +4; d20 15 = 19 vs CA 17 acerta; 1d6+2 = 5
    let step = 0;
    Dice.setRng(() => { step++; return step === 1 ? frac(15, 20) : frac(3, 6); });
    const res = await enc.attack(b, d, b.sb.actions[0]);
    assert.equal(res.hit, true);
    assert.equal(d.hp, 66 - 5);
    const linha = enc.history.find(e => e.type === 'attack-roll' && e.attacker === 'baaz1');
    assert.match(linha.text, /vs CA 17/);
    assert.match(linha.text, /acerta/);
    Dice.resetRng();
  });

  test('alvo caido da vantagem no corpo a corpo e desvantagem a distancia', () => {
    const d = makeDarian();
    const b = makeBaaz();
    b.addCondition('caido');
    const enc = new Encounter({ combatants: [d, b] });
    assert.equal(enc.computeAdvantage(d, b, { ranged: false }).advantage, true);
    assert.equal(enc.computeAdvantage(d, b, { ranged: true }).disadvantage, true);
  });

  test('condicao incapacitante impede acao no turno', () => {
    const b = makeBaaz();
    b.addCondition('atordoado');
    b.beginTurn();
    assert.equal(b.turn.action, false);
    assert.equal(b.turn.bonus, false);
    assert.equal(b.speed, 0);
  });

  test('reacao e recusada quando nao ha resolver', async () => {
    const d = makeDarian();
    const b = makeBaaz();
    const enc = new Encounter({ combatants: [d, b] });
    const r = await enc.offerReaction(d, { kind: 'incoming-attack', attacker: b, target: d });
    assert.equal(r, null);
  });

  test('reacao dispara uma vez e depois fica indisponivel', async () => {
    const d = makeDarian();
    const b = makeBaaz();
    d.sb.reactions = [{
      id: 'wardingFlare', name: 'Clarão Protetor', trigger: 'incoming-attack',
      resolve: () => ({ imposeDisadvantage: true }),
    }];
    let chamadas = 0;
    const enc = new Encounter({
      combatants: [d, b],
      reactionResolver: async ({ options }) => { chamadas++; return options[0]; },
    });
    d.beginTurn();

    const a = await enc.offerReaction(d, { kind: 'incoming-attack', attacker: b, target: d });
    assert.deepEqual(a, { imposeDisadvantage: true });
    assert.equal(d.turn.reaction, false);

    const bSegunda = await enc.offerReaction(d, { kind: 'incoming-attack', attacker: b, target: d });
    assert.equal(bSegunda, null);
    assert.equal(chamadas, 1);
  });

  test('encontro termina quando um lado cai', async () => {
    const d = makeDarian();
    const b = makeBaaz();
    b.hp = 3;
    const enc = new Encounter({ combatants: [d, b] });
    Dice.setRng(() => frac(10, 20));
    enc.rollInitiative();
    let step = 0;
    Dice.setRng(() => { step++; return step === 1 ? frac(20, 20) : frac(6, 6); });
    await enc.attack(d, b, { name: 'Bastão', kind: 'melee', ability: 'for', damage: { dice: '1d6', type: 'impacto' } });
    assert.equal(enc.finished, true);
    assert.equal(enc.outcome, 'vitoria');
    Dice.resetRng();
  });

  test('efeito de morte do bloco de status dispara ao derrubar', async () => {
    const d = makeDarian();
    const b = makeBaaz();
    b.hp = 2;
    let disparou = false;
    b.sb.onDeath = {
      id: 'petrifica', label: 'vira estátua de pedra',
      resolve: () => { disparou = true; return []; },
    };
    const enc = new Encounter({ combatants: [d, b] });
    let step = 0;
    Dice.setRng(() => { step++; return step === 1 ? frac(20, 20) : frac(6, 6); });
    await enc.attack(d, b, { name: 'Bastão', kind: 'melee', ability: 'for', damage: { dice: '1d6', type: 'impacto' } });
    assert.equal(disparou, true);
    assert.ok(enc.history.some(e => e.type === 'death-effect'));
    Dice.resetRng();
  });

  test('heroi a 0 PV cai inconsciente em vez de morrer', () => {
    const d = makeDarian();
    d.applyDamage(100);
    assert.equal(d.hp, 0);
    assert.equal(d.dead, false);
    assert.equal(d.has('inconsciente'), true);
  });

  test('tres falhas na salvaguarda matam, tres sucessos estabilizam', () => {
    const d = makeDarian();
    d.applyDamage(100);
    Dice.setRng(() => frac(5, 20));
    d.rollDeathSave(); d.rollDeathSave();
    const ultima = d.rollDeathSave();
    assert.equal(ultima.outcome, 'dead');

    const e = makeDarian();
    e.applyDamage(100);
    Dice.setRng(() => frac(15, 20));
    e.rollDeathSave(); e.rollDeathSave();
    assert.equal(e.rollDeathSave().outcome, 'stable');
    Dice.resetRng();
  });
});

describe('efeitos de morte por magia', () => {
  // Um baaz de verdade, com o onDeath do cânone (vira estátua). Ids distintos
  // para dois baaz no mesmo encontro e pos própria, que a resolução lê.
  function makeBaazReal(id = 'baazM', pos = { x: 3, y: 3 }) {
    const sb = MONSTERS.BAAZ();
    sb.id = id;
    return new Combatant(sb, { side: 'foe', pos });
  }

  // Campo falso: o onDeath do baaz só precisa de setTerrain e addHazard. Assim
  // o teste verifica o efeito colateral sem depender do Field de battle/.
  function fakeField() {
    return {
      terrain: {},
      hazards: [],
      setTerrain(pos, t) { this.terrain[`${pos.x},${pos.y}`] = t; },
      addHazard(h) { this.hazards.push(h); },
    };
  }

  const dardo = {
    id: 'guidingBolt', name: 'Dardo Orientador', level: 1, school: 'evocacao',
    attack: true, damage: { dice: '2d6', type: 'radiante' },
  };
  const fireball = {
    id: 'fireball', name: 'Bola de Fogo', level: 3, school: 'evocacao',
    save: { ability: 'des', onSuccess: 'metade' },
    damage: { dice: '8d6', type: 'fogo', perLevel: 'd6' },
  };

  test('magia de ataque que mata um baaz dispara death-effect e marca entulho no campo', async () => {
    const d = makeDarian();
    const b = makeBaazReal('baazM1', { x: 4, y: 2 });
    b.hp = 5;
    const enc = new Encounter({ combatants: [d, b] });
    enc.field = fakeField();

    let step = 0;
    Dice.setRng(() => { step++; return step === 1 ? frac(20, 20) : frac(6, 6); });
    await enc.resolveSpell(d, dardo, [b], {});
    Dice.resetRng();

    assert.equal(b.down, true);
    assert.ok(enc.history.some(e => e.type === 'death-effect'));
    assert.equal(enc.field.terrain['4,2'], 'entulho');
    assert.ok(enc.field.hazards.some(h => h.id === 'estatua-baazM1'));
  });

  test('Bola de Fogo que derruba dois baaz dispara um death-effect por alvo', async () => {
    const d = makeDarian();
    const b1 = makeBaazReal('baazA', { x: 3, y: 3 });
    const b2 = makeBaazReal('baazB', { x: 4, y: 3 });
    b1.hp = 5; b2.hp = 5;
    const enc = new Encounter({ combatants: [d, b1, b2] });
    enc.field = fakeField();

    // Nat 1 na salvaguarda de cada um: falham e comem o dano cheio.
    Dice.setRng(() => frac(1, 20));
    await enc.resolveSpell(d, fireball, [b1, b2], {});
    Dice.resetRng();

    const mortes = enc.history.filter(e => e.type === 'death-effect');
    assert.equal(mortes.length, 2);
    assert.deepEqual(mortes.map(e => e.target), ['baazA', 'baazB']);
    assert.equal(enc.field.hazards.length, 2);
  });

  test('magia de resistência com dano que leva o alvo a 0 PV dispara o onDeath', async () => {
    const d = makeDarian();
    const b = makeBaazReal('baazR', { x: 2, y: 2 });
    b.hp = 6;
    const enc = new Encounter({ combatants: [d, b] });
    enc.field = fakeField();

    Dice.setRng(() => frac(1, 20));   // falha na salvaguarda, dano cheio
    await enc.resolveSpell(d, fireball, [b], {});
    Dice.resetRng();

    assert.equal(b.down, true);
    assert.ok(enc.history.some(e => e.type === 'death-effect' && e.target === 'baazR'));
  });

  test('overkill e segunda instância no mesmo alvo não duplicam death-effect', async () => {
    const d = makeDarian();
    const b = makeBaazReal('baazO', { x: 5, y: 5 });
    b.hp = 3;                          // 8d6 de Bola de Fogo é overkill
    const enc = new Encounter({ combatants: [d, b] });
    enc.field = fakeField();

    Dice.setRng(() => frac(1, 20));
    await enc.resolveSpell(d, fireball, [b], {});
    // Segunda magia grátis no alvo já caído: o guard _deathEffectFired barra.
    await enc.resolveSpell(d, { ...dardo, id: 'g2' }, [b], { free: true });
    Dice.resetRng();

    assert.equal(enc.history.filter(e => e.type === 'death-effect').length, 1);
  });

  test('conjurador sem onKill não emite kill-effect; com onKill once emite uma vez', async () => {
    // Sem onKill (caso dos personagens jogáveis).
    const d = makeDarian();
    const b = makeBaazReal('baazK', { x: 1, y: 1 });
    b.hp = 5;
    const enc = new Encounter({ combatants: [d, b] });
    enc.field = fakeField();
    let step = 0;
    Dice.setRng(() => { step++; return step === 1 ? frac(20, 20) : frac(6, 6); });
    await enc.resolveSpell(d, dardo, [b], {});
    assert.equal(enc.history.some(e => e.type === 'kill-effect'), false);

    // Com onKill sintético e guard once: dois baaz mortos, um só kill-effect.
    const d2 = makeDarian();
    let vezes = 0;
    d2.sb.onKill = { id: 'ceifa', once: true, label: 'ceifa', resolve: () => { vezes++; return []; } };
    const c1 = makeBaazReal('baazX', { x: 2, y: 1 });
    const c2 = makeBaazReal('baazY', { x: 3, y: 1 });
    c1.hp = 5; c2.hp = 5;
    const enc2 = new Encounter({ combatants: [d2, c1, c2] });
    enc2.field = fakeField();
    Dice.setRng(() => frac(1, 20));
    await enc2.resolveSpell(d2, fireball, [c1, c2], {});
    Dice.resetRng();
    assert.equal(enc2.history.filter(e => e.type === 'kill-effect').length, 1);
    assert.equal(vezes, 1);
  });

  test('castSpell chamada sem Encounter não dispara efeito de morte', () => {
    const d = makeDarian();
    const b = makeBaazReal('baazP', { x: 3, y: 3 });
    b.hp = 5;
    let step = 0;
    Dice.setRng(() => { step++; return step === 1 ? frac(20, 20) : frac(6, 6); });
    const res = castSpell(d, dardo, [b], {});   // função pura, sem Encounter
    Dice.resetRng();

    assert.ok(res.ok);
    assert.equal(b.down, true);                 // caiu pelo dano
    assert.equal(res.events.some(e => e.type === 'death-effect'), false);
    assert.equal(res.events.some(e => e.type === 'terrain'), false);
  });

  test('aliado derrubado por área não gera death-effect nem kill-effect', async () => {
    const d = makeDarian();
    // Aliado frágil apanhado na Bola de Fogo, sem Esculpir Magias (spared vazio).
    const aliado = new Combatant(defineStatblock({
      id: 'owo', name: 'Owo', level: 5, side: 'ally',
      abilities: { for: 12, des: 16, con: 12, int: 10, sab: 14, car: 10 },
      ac: 15, maxHp: 5, speed: 9,
    }), { side: 'ally', pos: { x: 4, y: 4 } });
    const enc = new Encounter({ combatants: [d, aliado] });
    enc.field = fakeField();

    Dice.setRng(() => frac(1, 20));   // falha na salvaguarda, cai
    await enc.resolveSpell(d, fireball, [aliado], {});
    Dice.resetRng();

    assert.equal(aliado.down, true);
    assert.equal(aliado.has('inconsciente'), true);
    assert.equal(enc.history.some(e => e.type === 'death-effect'), false);
    assert.equal(enc.history.some(e => e.type === 'kill-effect'), false);
  });

  test('efeitos de morte por magia disparam antes de checkEnd', async () => {
    const d = makeDarian();
    const b = makeBaazReal('baazE', { x: 3, y: 3 });
    b.hp = 5;
    const enc = new Encounter({ combatants: [d, b] });
    enc.field = fakeField();

    let step = 0;
    Dice.setRng(() => { step++; return step === 1 ? frac(20, 20) : frac(6, 6); });
    await enc.resolveSpell(d, dardo, [b], {});   // mata o último inimigo
    Dice.resetRng();

    assert.equal(enc.finished, true);
    assert.equal(enc.outcome, 'vitoria');
    const iMorte = enc.history.findIndex(e => e.type === 'death-effect');
    const iFim = enc.history.findIndex(e => e.type === 'end');
    assert.ok(iMorte >= 0 && iFim >= 0 && iMorte < iFim);
  });
});

// Testes do save.
//
// A promessa: retomar devolve o grupo exatamente como estava, e o que o
// descanso nao devolveria continua gasto. Save quebrado e pior que save
// nenhum, entao vale checar o caminho de volta com cuidado.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { Combatant } from '../src/rules/statblock.js';
import { aplicarNivel } from '../src/rules/progression.js';
import { HEROES, PARTY_ORDER } from '../src/data/heroes.js';
import { CAPITULOS } from '../src/data/chapters.js';
import { serializar, aplicarAoGrupo, resumo, resumoEmTexto } from '../src/game/save.js';

const montarGrupo = nivel => PARTY_ORDER.map(k => {
  const c = new Combatant(HEROES[k], { side: 'ally' });
  aplicarNivel(c, nivel);
  return c;
});

// Campanha de mentira, so com o que o save le.
function campanhaFalsa({ nivel = 5, capitulo = 3 } = {}) {
  return {
    capituloIndex: capitulo,
    noAtual: CAPITULOS[capitulo].nos[1].id,
    nivelAtual: nivel,
    visitados: new Set([CAPITULOS[capitulo].nos[0].id]),
    bandeiras: new Set(['condeAliado', 'julgamentoVencido']),
    party: montarGrupo(nivel),
  };
}

describe('serializacao', () => {
  test('guarda onde o grupo parou', () => {
    const c = campanhaFalsa();
    const d = serializar(c);
    assert.equal(d.capitulo, 3);
    assert.equal(d.nivel, 5);
    assert.equal(d.no, c.noAtual);
    assert.deepEqual(d.visitados, [...c.visitados]);
    assert.deepEqual(d.bandeiras.sort(), ['condeAliado', 'julgamentoVencido']);
    assert.equal(d.grupo.length, 4);
  });

  test('guarda o gasto, nao o maximo', () => {
    const c = campanhaFalsa();
    const darian = c.party.find(p => p.id === 'darian');
    darian.slots[1].used = 3;
    const d = serializar(c);
    const salvo = d.grupo.find(g => g.id === 'darian');
    assert.equal(salvo.espacos['1'], 3);
    // O maximo vem da tabela de nivel ao restaurar, entao nao precisa ir junto.
    assert.equal(typeof salvo.espacos['1'], 'number');
    assert.equal(salvo.hp, darian.hp);
  });
});

describe('retomar', () => {
  test('devolve PV, espacos e recursos exatamente como estavam', () => {
    const c = campanhaFalsa({ nivel: 6 });
    const d0 = c.party.find(p => p.id === 'darian');
    const e0 = c.party.find(p => p.id === 'elandrin');
    d0.hp = 17;
    d0.tempHp = 4;
    d0.slots[3].used = 2;
    d0.hitDice.used = 3;
    e0.resources.canalizarDivindade.used = 1;
    e0.addCondition('envenenado');

    const dados = serializar(c);

    // Grupo novo em folha, no mesmo nivel.
    const novo = montarGrupo(6);
    aplicarAoGrupo(novo, dados.grupo);

    const d1 = novo.find(p => p.id === 'darian');
    const e1 = novo.find(p => p.id === 'elandrin');
    assert.equal(d1.hp, 17);
    assert.equal(d1.tempHp, 4);
    assert.equal(d1.slots[3].used, 2);
    assert.equal(d1.slots[3].max, d0.slots[3].max, 'o máximo vem da tabela de nível');
    assert.equal(d1.hitDice.used, 3);
    assert.equal(e1.resourceLeft('canalizarDivindade'), e0.resourceLeft('canalizarDivindade'));
    assert.ok(e1.has('envenenado'));
  });

  test('efeito e concentracao nao atravessam o save', () => {
    const c = campanhaFalsa();
    const d0 = c.party.find(p => p.id === 'darian');
    d0.addEffect({ key: 'esquiva', label: 'Esquivando', rounds: 1 });
    d0.startConcentration('bolaDeFogo');

    const dados = serializar(c);
    const novo = montarGrupo(5);
    aplicarAoGrupo(novo, dados.grupo);
    const d1 = novo.find(p => p.id === 'darian');

    assert.equal(d1.effects.length, 0, 'efeito é de combate, não de campanha');
    assert.equal(d1.concentration, null);
  });

  test('gasto maior que o maximo e cortado, nunca vira numero impossivel', () => {
    const c = campanhaFalsa({ nivel: 8 });
    const d0 = c.party.find(p => p.id === 'darian');
    d0.slots[4].used = 2;
    const dados = serializar(c);

    // Retomar num nivel mais baixo (save de versao anterior do balanceamento).
    const novo = montarGrupo(5);
    aplicarAoGrupo(novo, dados.grupo);
    const d1 = novo.find(p => p.id === 'darian');
    assert.equal(d1.slots[4], undefined, 'no nível 5 não existe espaço de 4º');
    for (const s of Object.values(d1.slots)) {
      assert.ok(s.used <= s.max, 'gasto nunca passa do máximo');
    }
    assert.ok(d1.hp <= d1.maxHp, 'PV nunca passa do teto do nível');
  });

  test('ficha que nao existe mais no grupo e ignorada sem quebrar', () => {
    const c = campanhaFalsa();
    const dados = serializar(c);
    dados.grupo.push({ id: 'fantasma', hp: 10, espacos: {}, recursos: {} });
    const novo = montarGrupo(5);
    assert.doesNotThrow(() => aplicarAoGrupo(novo, dados.grupo));
    assert.equal(novo.length, 4);
  });
});

describe('resumo para a tela de titulo', () => {
  test('diz capitulo, nivel e onde parou', () => {
    const c = campanhaFalsa({ capitulo: 2, nivel: 4 });
    const r = resumo(serializar(c));
    assert.match(r.capitulo, /III/);
    assert.equal(r.nivel, 4);
    assert.equal(r.total, 4);
    assert.equal(r.vivos, 4);
    assert.ok(r.no.length > 0);
  });

  test('conta quem esta caido', () => {
    const c = campanhaFalsa();
    c.party[0].hp = 0;
    const r = resumo(serializar(c));
    assert.equal(r.vivos, 3);
    assert.match(resumoEmTexto(serializar(c)), /caído/);
  });
});

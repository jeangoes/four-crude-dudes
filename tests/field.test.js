// Testes do campo de batalha: distancia, alcance, visao, movimento e areas.
// Geometria e o tipo de coisa que parece certa na tela e esta errada no
// numero, entao vale testar em vez de conferir por screenshot.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Field, TILE, moverCursor, celulaMaisProxima, proximoAlvo } from '../src/battle/field.js';
import { defineStatblock, Combatant } from '../src/rules/statblock.js';

const dummy = (id, side = 'ally') => new Combatant(defineStatblock({
  id, name: id, maxHp: 30, ac: 12, speed: 9, side,
  actions: [{ name: 'Lâmina', kind: 'melee', ability: 'for', reach: 1.5, damage: { dice: '1d6', type: 'cortante' } }],
}), { side });

describe('distancia', () => {
  test('a diagonal custa o mesmo que a ortogonal', () => {
    const f = new Field();
    // Regra padrao de 5e: tres passos na diagonal sao 4,5 m, nao 6,36 m.
    assert.equal(f.distance({ x: 0, y: 0 }, { x: 3, y: 3 }), 4.5);
    assert.equal(f.distance({ x: 0, y: 0 }, { x: 3, y: 0 }), 4.5);
    assert.equal(f.distance({ x: 2, y: 5 }, { x: 2, y: 5 }), 0);
  });

  test('alcance de arma corpo a corpo pega os oito vizinhos', () => {
    const f = new Field();
    const centro = { x: 4, y: 4 };
    const vizinhos = f.neighbors(centro);
    assert.equal(vizinhos.length, 8);
    assert.ok(vizinhos.every(v => f.inRange(centro, v, 1.5)));
    assert.equal(f.inRange(centro, { x: 6, y: 4 }, 1.5), false);
  });

  test('quadrado fora do campo nao existe', () => {
    const f = new Field({ cols: 12, rows: 8 });
    assert.equal(f.inBounds({ x: 11, y: 7 }), true);
    assert.equal(f.inBounds({ x: 12, y: 7 }), false);
    assert.equal(f.inBounds({ x: -1, y: 0 }), false);
    assert.equal(f.neighbors({ x: 0, y: 0 }).length, 3);   // canto
  });
});

describe('linha de visao', () => {
  test('parede no meio corta a linha', () => {
    const f = new Field();
    assert.equal(f.hasLineOfSight({ x: 0, y: 4 }, { x: 6, y: 4 }), true);
    f.setTerrain({ x: 3, y: 4 }, 'parede');
    assert.equal(f.hasLineOfSight({ x: 0, y: 4 }, { x: 6, y: 4 }), false);
  });

  test('parede no proprio quadrado do alvo nao bloqueia o alvo', () => {
    const f = new Field();
    f.setTerrain({ x: 6, y: 4 }, 'parede');
    assert.equal(f.hasLineOfSight({ x: 0, y: 4 }, { x: 6, y: 4 }), true);
  });

  test('entulho atrapalha o passo mas nao a visao', () => {
    const f = new Field();
    f.setTerrain({ x: 3, y: 4 }, 'entulho');
    assert.equal(f.hasLineOfSight({ x: 0, y: 4 }, { x: 6, y: 4 }), true);
  });
});

describe('movimento', () => {
  test('9 m de deslocamento alcancam 6 quadrados em linha reta', () => {
    const f = new Field();
    const c = dummy('a');
    f.place(c, { x: 0, y: 4 });
    const reach = f.reachable(c, 9);
    // 9 m / 1,5 = 6 passos
    assert.ok(reach.has('6,4'));
    assert.equal(reach.has('7,4'), false);
    assert.equal(reach.has('0,4'), false);        // a origem nao e destino
  });

  test('entrar em terreno dificil custa 3 m em vez de 1,5', () => {
    const f = new Field();
    const c = dummy('a');
    f.place(c, { x: 0, y: 4 });
    assert.equal(f.reachable(c, 9).get('1,4').cost, 1.5);
    f.setTerrain({ x: 1, y: 4 }, 'dificil');
    assert.equal(f.reachable(c, 9).get('1,4').cost, 3);
  });

  test('num corredor sem desvio o terreno dificil corta o alcance pela metade', () => {
    // Em campo aberto da para contornar, entao o alcance nao encolhe. O
    // custo dobrado so limita de fato quando nao ha rota alternativa.
    const f = new Field({ cols: 12, rows: 1 });
    const c = dummy('a');
    f.place(c, { x: 0, y: 0 });
    for (let x = 1; x <= 6; x++) f.setTerrain({ x, y: 0 }, 'dificil');
    const reach = f.reachable(c, 9);
    assert.ok(reach.has('3,0'), '9 m dão 3 passos a 3 m cada');
    assert.equal(reach.has('4,0'), false);
  });

  test('em campo aberto da para contornar o terreno dificil', () => {
    const f = new Field();
    const c = dummy('a');
    f.place(c, { x: 0, y: 4 });
    for (let x = 1; x <= 6; x++) f.setTerrain({ x, y: 4 }, 'dificil');
    const reach = f.reachable(c, 9);
    // Passa por cima pela fileira 3, que continua normal.
    assert.ok(reach.has('4,4'), 'o desvio pela fileira de cima ainda chega');
    assert.ok(reach.get('4,4').cost > 6, `mas sai mais caro: ${reach.get('4,4').cost} m`);
  });

  test('caminho contorna a parede em vez de atravessar', () => {
    const f = new Field();
    const c = dummy('a');
    f.place(c, { x: 0, y: 4 });
    for (let y = 0; y < 8; y++) if (y !== 7) f.setTerrain({ x: 2, y }, 'parede');
    const reach = f.reachable(c, 30);
    const caminho = f.pathFrom(reach, c, { x: 4, y: 4 });
    assert.ok(caminho, 'deveria existir caminho pelo vao de baixo');
    assert.ok(caminho.some(p => p.y === 7), 'o caminho passa pelo único vão');
  });

  test('parede sem vao deixa o outro lado inalcancavel', () => {
    const f = new Field();
    const c = dummy('a');
    f.place(c, { x: 0, y: 4 });
    for (let y = 0; y < 8; y++) f.setTerrain({ x: 2, y }, 'parede');
    const reach = f.reachable(c, 60);
    assert.equal(reach.has('4,4'), false);
  });

  test('inimigo de pe barra a passagem, caido nao', () => {
    const f = new Field();
    const eu = dummy('eu', 'ally');
    const foe = dummy('foe', 'foe');
    f.place(eu, { x: 0, y: 4 });
    f.place(foe, { x: 1, y: 4 });
    assert.equal(f.isBlocked({ x: 1, y: 4 }, eu), true);
    foe.applyDamage(999);                          // vira morto: some do campo
    assert.equal(f.isBlocked({ x: 1, y: 4 }, eu), false);
  });
});

describe('ameaca e oportunidade', () => {
  test('so ameaca quem esta adjacente e tem ataque corpo a corpo', () => {
    const f = new Field();
    const heroi = dummy('heroi', 'ally');
    const perto = dummy('perto', 'foe');
    const longe = dummy('longe', 'foe');
    f.place(heroi, { x: 4, y: 4 });
    f.place(perto, { x: 5, y: 5 });
    f.place(longe, { x: 8, y: 4 });
    const ameacas = f.threatsAt(heroi.pos, 'ally');
    assert.deepEqual(ameacas.map(a => a.id), ['perto']);
  });

  test('inimigo caido nao ameaca', () => {
    const f = new Field();
    const heroi = dummy('heroi', 'ally');
    const foe = dummy('foe', 'foe');
    f.place(heroi, { x: 4, y: 4 });
    f.place(foe, { x: 5, y: 4 });
    foe.applyDamage(999);
    assert.equal(f.threatsAt(heroi.pos, 'ally').length, 0);
  });
});

describe('areas de efeito', () => {
  test('Bola de Fogo cobre a esfera de 6 m e nao um quadrado', () => {
    const f = new Field();
    const cells = f.cellsInSphere({ x: 5, y: 4 }, 6);
    // Raio 6 m = 4 quadrados. Os cantos do quadrado 9x9 ficam de fora.
    assert.ok(cells.some(c => c.x === 9 && c.y === 4), 'alcança 4 quadrados na horizontal');
    assert.equal(cells.some(c => c.x === 9 && c.y === 0), false, 'o canto fica fora da esfera');
    assert.ok(cells.length > 30 && cells.length < 60, `área plausível, veio ${cells.length}`);
  });

  test('a esfera respeita a parede', () => {
    const f = new Field();
    f.setTerrain({ x: 6, y: 4 }, 'parede');
    const semParede = f.cellsInSphere({ x: 5, y: 4 }, 6).length;
    const comSombra = f.cellsInSphere({ x: 5, y: 4 }, 6, { requireSight: true });
    assert.ok(comSombra.length <= semParede);
    assert.equal(comSombra.some(c => c.x === 8 && c.y === 4), false, 'atrás da parede não pega');
  });

  test('cubo de 9 m e 6 por 6 quadrados', () => {
    const f = new Field({ cols: 20, rows: 20 });
    assert.equal(f.cellsInCube({ x: 2, y: 2 }, 9).length, 36);
  });

  test('occupantsOf devolve quem esta nos quadrados da area', () => {
    const f = new Field();
    const a = dummy('a'), b = dummy('b'), fora = dummy('fora');
    f.place(a, { x: 5, y: 4 });
    f.place(b, { x: 6, y: 4 });
    f.place(fora, { x: 11, y: 0 });
    const cells = f.cellsInSphere({ x: 5, y: 4 }, 3);
    const pegos = f.occupantsOf(cells).map(c => c.id);
    assert.deepEqual(pegos.sort(), ['a', 'b']);
  });
});

describe('perigos no chao', () => {
  test('poca de acido troca o terreno e expira', () => {
    const f = new Field();
    f.addHazard({ id: 'acido', label: 'poça', cells: [{ x: 3, y: 3 }], terrain: 'acido', rounds: 2 });
    assert.equal(f.terrain[3][3], 'acido');
    assert.ok(f.terrainAt({ x: 3, y: 3 }).damage);
    f.tickHazards();
    assert.equal(f.terrain[3][3], 'acido');       // ainda vale uma rodada
    f.tickHazards();
    assert.equal(f.terrain[3][3], 'normal');      // expirou e limpou
    assert.equal(f.hazards.length, 0);
  });

  test('estatua do baaz vira terreno dificil e encarece o passo', () => {
    const f = new Field();
    const c = dummy('a');
    f.place(c, { x: 0, y: 4 });
    assert.equal(f.reachable(c, 9).get('1,4').cost, 1.5);
    f.addHazard({ id: 'estatua', label: 'estátua', cells: [{ x: 1, y: 4 }], terrain: 'entulho', rounds: 7 });
    assert.equal(f.reachable(c, 9).get('1,4').cost, 3, 'pisar na estátua custa o dobro');
    assert.equal(f.terrainAt({ x: 1, y: 4 }).label, 'entulho');
  });
});

// O campo so era dirigivel pelo ponteiro. Estas funcoes sao a parte pura do
// cursor de teclado, e existem separadas justamente para caber aqui.
describe('cursor de teclado', () => {
  test('anda um quadrado por vez em cada direcao', () => {
    const c = { x: 5, y: 4 };
    assert.deepEqual(moverCursor(c, 'up', 12, 8), { x: 5, y: 3 });
    assert.deepEqual(moverCursor(c, 'down', 12, 8), { x: 5, y: 5 });
    assert.deepEqual(moverCursor(c, 'left', 12, 8), { x: 4, y: 4 });
    assert.deepEqual(moverCursor(c, 'right', 12, 8), { x: 6, y: 4 });
  });

  test('para na borda em vez de sair do tabuleiro', () => {
    assert.deepEqual(moverCursor({ x: 0, y: 0 }, 'up', 12, 8), { x: 0, y: 0 });
    assert.deepEqual(moverCursor({ x: 0, y: 0 }, 'left', 12, 8), { x: 0, y: 0 });
    assert.deepEqual(moverCursor({ x: 11, y: 7 }, 'right', 12, 8), { x: 11, y: 7 });
    assert.deepEqual(moverCursor({ x: 11, y: 7 }, 'down', 12, 8), { x: 11, y: 7 });
  });

  test('direcao desconhecida ou cursor ausente nao inventa quadrado', () => {
    assert.deepEqual(moverCursor({ x: 2, y: 2 }, 'confirm', 12, 8), { x: 2, y: 2 });
    assert.equal(moverCursor(null, 'up', 12, 8), null);
  });

  test('a mira nasce no alvo mais perto de quem age', () => {
    const alvos = [{ x: 10, y: 1 }, { x: 3, y: 2 }, { x: 8, y: 6 }];
    assert.deepEqual(celulaMaisProxima({ x: 2, y: 2 }, alvos), { x: 3, y: 2 });
    assert.deepEqual(celulaMaisProxima({ x: 9, y: 7 }, alvos), { x: 8, y: 6 });
  });

  test('sem alvo nao ha onde nascer', () => {
    assert.equal(celulaMaisProxima({ x: 0, y: 0 }, []), null);
    assert.equal(celulaMaisProxima({ x: 0, y: 0 }, null), null);
  });

  test('Tab cicla alvos e volta ao inicio', () => {
    const alvos = [{ x: 1, y: 1 }, { x: 4, y: 4 }, { x: 7, y: 2 }];
    assert.deepEqual(proximoAlvo(alvos, { x: 1, y: 1 }, 1), { x: 4, y: 4 });
    assert.deepEqual(proximoAlvo(alvos, { x: 7, y: 2 }, 1), { x: 1, y: 1 });
    assert.deepEqual(proximoAlvo(alvos, { x: 1, y: 1 }, -1), { x: 7, y: 2 });
  });

  test('ciclar a partir de um quadrado que nao e alvo cai no primeiro', () => {
    const alvos = [{ x: 1, y: 1 }, { x: 4, y: 4 }];
    assert.deepEqual(proximoAlvo(alvos, { x: 9, y: 9 }, 1), { x: 1, y: 1 });
    assert.equal(proximoAlvo([], { x: 1, y: 1 }, 1), null);
  });
});

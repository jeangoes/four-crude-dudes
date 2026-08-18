// Testes de progressao de nivel.
//
// A promessa e simples e verificavel: o grupo comeca no 1, sobe pelos
// capitulos e chega no nivel exato da ficha da mesa, com o kit aparecendo
// no caminho em vez de existir desde sempre.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { Combatant } from '../src/rules/statblock.js';
import { aplicarNivel, kitDisponivel, novidadesEntre } from '../src/rules/progression.js';
import { HEROES } from '../src/data/heroes.js';
import { PROGRESSOES } from '../src/data/progressoes.js';
import { CAPITULOS, NIVEL_FINAL, nivelDoCapitulo } from '../src/data/chapters.js';
import { spawnGroup, veterano, MONSTERS } from '../src/data/monsters.js';

const heroi = k => new Combatant(HEROES[k], { side: 'ally' });

// A ficha da mesa, que e onde a campanha tem que terminar.
const FICHA = {
  DARIAN:    { nivel: 8, ac: 17, hp: 66, dc: 16 },
  ELANDRIN:  { nivel: 7, ac: 21, hp: 71, dc: 15 },
  LATHURIEL: { nivel: 8, ac: 20, hp: 67, dc: 15 },
  OWO:       { nivel: 8, ac: 16, hp: 68 },
};

describe('curva de nivel', () => {
  test('os capitulos vao do 1 ao 8, sem pular nem voltar', () => {
    const niveis = CAPITULOS.map(c => c.nivelInicial);
    assert.deepEqual(niveis, [1, 3, 4, 5, 6]);
    assert.equal(NIVEL_FINAL, 8);
    for (let i = 1; i < niveis.length; i++) {
      assert.ok(niveis[i] > niveis[i - 1], 'o nível sempre sobe entre capítulos');
    }
    assert.ok(NIVEL_FINAL > niveis[niveis.length - 1]);
  });

  test('nivelDoCapitulo serve para quem pula direto', () => {
    assert.equal(nivelDoCapitulo(0), 1);
    assert.equal(nivelDoCapitulo(3), 5);   // Descida
    assert.equal(nivelDoCapitulo(99), 1);  // fora do intervalo cai no começo
  });
});

describe('tabelas dos herois', () => {
  for (const [chave, esperado] of Object.entries(FICHA)) {
    test(`${chave} termina exatamente na ficha da mesa`, () => {
      const c = heroi(chave);
      aplicarNivel(c, esperado.nivel);
      assert.equal(c.maxHp, esperado.hp, 'PV');
      assert.equal(c.ac, esperado.ac, 'CA');
      assert.equal(c.level, esperado.nivel);
      if (esperado.dc) assert.equal(c.spellSaveDC, esperado.dc, 'CD de magia');
    });

    test(`${chave}: PV e CA nunca caem ao subir de nivel`, () => {
      const c = heroi(chave);
      let hp = 0, ac = 0;
      for (let n = 1; n <= esperado.nivel; n++) {
        aplicarNivel(c, n);
        assert.ok(c.maxHp >= hp, `PV caiu do nível ${n - 1} para o ${n}`);
        assert.ok(c.ac >= ac, `CA caiu do nível ${n - 1} para o ${n}`);
        hp = c.maxHp; ac = c.ac;
      }
    });
  }

  test('a tabela tem uma linha por nivel ate o da ficha', () => {
    for (const [chave, esperado] of Object.entries(FICHA)) {
      assert.equal(PROGRESSOES[chave].length, esperado.nivel);
    }
  });

  test('o bonus de proficiencia segue o nivel do personagem', () => {
    const c = heroi('DARIAN');
    aplicarNivel(c, 1); assert.equal(c.prof, 2);
    aplicarNivel(c, 5); assert.equal(c.prof, 3);
    aplicarNivel(c, 8); assert.equal(c.prof, 3);
  });
});

describe('o kit aparece no caminho', () => {
  test('Darian no nivel 1 nao tem Bola de Fogo nem Contramagia', () => {
    const c = heroi('DARIAN');
    aplicarNivel(c, 1);
    const kit = kitDisponivel(c);
    const nomes = kit.spells.map(s => s.name);
    assert.deepEqual(nomes, ['Raio de Fogo']);
    assert.equal(kit.reactions.some(r => r.id === 'contramagia'), false);
    assert.equal(c.slotsAvailable(3), 0, 'sem espaço de 3º nível');
  });

  test('Bola de Fogo e Contramagia chegam juntas no nivel 5', () => {
    const c = heroi('DARIAN');
    aplicarNivel(c, 4);
    assert.equal(kitDisponivel(c).spells.some(s => s.id === 'bolaDeFogo'), false);
    aplicarNivel(c, 5);
    const kit = kitDisponivel(c);
    assert.ok(kit.spells.some(s => s.id === 'bolaDeFogo'));
    assert.ok(kit.reactions.some(r => r.id === 'contramagia'));
    assert.ok(c.slotsAvailable(3) > 0, 'o espaço de 3º existe junto com a magia');
  });

  test('Esculpir Magias chega no 2 e Truque Potente no 6', () => {
    const c = heroi('DARIAN');
    aplicarNivel(c, 1);
    assert.equal(c.sb.features.includes('sculptSpells'), false);
    aplicarNivel(c, 2);
    assert.ok(c.sb.features.includes('sculptSpells'));
    assert.equal(c.sb.features.includes('potentCantrip'), false);
    aplicarNivel(c, 6);
    assert.ok(c.sb.features.includes('potentCantrip'));
  });

  test('Canalizar Divindade do Elandrin nao existe no nivel 1', () => {
    const c = heroi('ELANDRIN');
    aplicarNivel(c, 1);
    assert.equal(kitDisponivel(c).talents.some(t => t.id === 'radianciaDoAmanhecer'), false);
    assert.equal(c.resourceLeft('canalizarDivindade'), 0);
    aplicarNivel(c, 3);
    assert.ok(kitDisponivel(c).talents.some(t => t.id === 'radianciaDoAmanhecer'));
    assert.equal(c.resourceLeft('canalizarDivindade'), 1);
    aplicarNivel(c, 6);
    assert.equal(c.resourceLeft('canalizarDivindade'), 2);
  });

  test('o dano da Radiancia escala pelo nivel de clerigo, que fica atras', () => {
    const c = heroi('ELANDRIN');
    aplicarNivel(c, 3); assert.equal(c.sb.clericLevel, 2);
    aplicarNivel(c, 7); assert.equal(c.sb.clericLevel, 5);
    assert.ok(c.sb.clericLevel < c.level, 'multiclasse: o nível de clérigo é menor que o total');
  });

  test('Lathuriel so pega a espada do pacto depois do mergulho em Bruxo', () => {
    const c = heroi('LATHURIEL');
    aplicarNivel(c, 1);
    assert.equal(c.sb.actions[0].name, 'Rapieira');
    assert.equal(c.sb.actions[0].ability, 'des');
    assert.equal(c.pactSlots, null);
    aplicarNivel(c, 2);
    assert.match(c.sb.actions[0].name, /Espada longa/);
    assert.equal(c.sb.actions[0].ability, 'car', 'Hexwarrior: Carisma no lugar de Força');
    assert.ok(c.pactSlots);
    assert.ok(kitDisponivel(c).talents.some(t => t.id === 'maldicaoDoHexblade'));
  });

  test('Owo, meia-conjuradora, so tem espaco a partir do 2', () => {
    const c = heroi('OWO');
    aplicarNivel(c, 1);
    assert.equal(c.slotsAvailable(1), 0);
    assert.equal(kitDisponivel(c).spells.length, 0);
    aplicarNivel(c, 2);
    assert.ok(c.slotsAvailable(1) > 0);
    assert.equal(kitDisponivel(c).spells.length, 2);
  });
});

describe('subir de nivel em jogo', () => {
  test('ganhar nivel aumenta o teto sem curar de graca', () => {
    const c = heroi('DARIAN');
    aplicarNivel(c, 4);
    c.hp = 5;                                  // machucado
    const antes = c.maxHp;
    aplicarNivel(c, 5);
    const ganho = c.maxHp - antes;
    assert.ok(ganho > 0);
    assert.equal(c.hp, 5 + ganho, 'ganha o PV novo, mas continua ferido');
    assert.ok(c.hp < c.maxHp);
  });

  test('espaco novo entra cheio e o que ja existia mantem o gasto', () => {
    const c = heroi('DARIAN');
    aplicarNivel(c, 4);
    c.slots[1].used = 4;                       // gastou tudo de 1º
    aplicarNivel(c, 5);
    assert.equal(c.slots[1].used, 4, 'o gasto não some ao subir de nível');
    assert.equal(c.slots[3].used, 0, 'o espaço novo chega cheio');
    assert.equal(c.slots[3].max, 2);
  });

  test('a tela de evolucao sabe dizer o que mudou', () => {
    const c = heroi('DARIAN');
    aplicarNivel(c, 4);
    const r = aplicarNivel(c, 5);
    const nomes = r.novidades.map(n => n.nome);
    assert.ok(nomes.includes('Bola de Fogo'));
    assert.ok(nomes.includes('Contramágica'));
    assert.equal(r.de, 4);
    assert.equal(r.para, 5);
  });

  test('novidades de um nivel para o seguinte nao repetem o que ja existia', () => {
    const c = heroi('DARIAN');
    aplicarNivel(c, 5);
    const r = aplicarNivel(c, 6);
    assert.equal(r.novidades.some(n => n.nome === 'Bola de Fogo'), false);
  });
});

describe('inimigos acompanham', () => {
  test('veterano aguenta e bate mais que o comum', () => {
    const comum = MONSTERS.BAAZ();
    const forte = veterano(MONSTERS.BAAZ());
    assert.ok(forte.maxHp > comum.maxHp);
    assert.ok(forte.ac > comum.ac);
    assert.match(forte.name, /veterano/);
    assert.equal(forte.actions[0].damage.dice, '2d6', 'um dado a mais na arma');
    assert.equal(comum.actions[0].damage.dice, '1d6', 'o comum não muda');
  });

  test("o sufixo + na lista do capitulo cria a versao veterana", () => {
    const g = spawnGroup(['BAAZ', 'BAAZ+']);
    assert.equal(g[0].maxHp, 22);
    assert.ok(g[1].maxHp > 22);
    assert.match(g[1].name, /veterano/);
  });

  test('o capitulo I nao joga mais que dois draconianos num grupo de nivel 1', () => {
    const cap = CAPITULOS[0];
    const primeiro = cap.nos.find(n => n.tipo === 'combate');
    assert.ok(primeiro.inimigos.length <= 2,
      `nível 1 com ${primeiro.inimigos.length} inimigos no primeiro nó é massacre`);
  });

  test('a dificuldade cresce com o capitulo', () => {
    // Soma de PV dos inimigos como medida grosseira de peso do encontro.
    const peso = cap => cap.nos
      .filter(n => n.inimigos)
      .map(n => spawnGroup(n.inimigos).reduce((s, m) => s + m.maxHp, 0))
      .reduce((a, b) => Math.max(a, b), 0);

    const pesos = CAPITULOS.map(peso);
    assert.ok(pesos[0] < pesos[2], `Vogler (${pesos[0]}) tem que ser mais leve que a Infiltração (${pesos[2]})`);
    assert.ok(pesos[2] < pesos[4], `a Infiltração (${pesos[2]}) tem que ser mais leve que a Ponte (${pesos[4]})`);
  });

  test('veteranos so aparecem depois que o grupo tem nivel para isso', () => {
    for (const cap of CAPITULOS) {
      const temVeterano = cap.nos.some(n => (n.inimigos || []).some(k => k.endsWith('+')));
      if (temVeterano) {
        assert.ok(cap.nivelInicial >= 4,
          `${cap.titulo} usa veterano com o grupo no nível ${cap.nivelInicial}`);
      }
    }
  });
});

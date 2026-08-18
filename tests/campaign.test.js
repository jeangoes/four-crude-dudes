// Testes da campanha: integridade do grafo de capitulos, o Julgamento dos
// Dragoes, Lord Soth e o Conde.
//
// Grafo quebrado e o tipo de erro que so aparece quando alguem joga ate o
// no errado. Melhor pegar aqui.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import * as Dice from '../src/rules/dice.js';
import { Combatant } from '../src/rules/statblock.js';
import { Encounter } from '../src/rules/combat.js';
import { Field } from '../src/battle/field.js';
import { CAPITULOS, noInicial, noPorId } from '../src/data/chapters.js';
import { CENAS, CONVIDADOS, SOTH, NPCS } from '../src/data/npcs.js';
import { MONSTERS, spawnGroup } from '../src/data/monsters.js';
import { HEROES } from '../src/data/heroes.js';
import { TERRAIN } from '../src/battle/field.js';

const frac = (v, s) => (v - 0.5) / s;

describe('grafo dos capitulos', () => {
  test('sao cinco capitulos, na ordem do arco da campanha', () => {
    assert.equal(CAPITULOS.length, 5);
    assert.deepEqual(CAPITULOS.map(c => c.id),
      ['vogler', 'catacumbas', 'infiltracao', 'descida', 'ponte']);
  });

  for (const cap of CAPITULOS) {
    test(`${cap.numero} ${cap.titulo}: todo destino existe`, () => {
      const ids = new Set(cap.nos.map(n => n.id));
      for (const no of cap.nos) {
        for (const destino of no.liga || []) {
          assert.ok(ids.has(destino), `${no.id} aponta para ${destino}, que não existe`);
        }
        for (const op of no.opcoes || []) {
          assert.ok(ids.has(op.vai), `opção de ${no.id} aponta para ${op.vai}, que não existe`);
        }
      }
    });

    test(`${cap.numero}: tem um começo só e chega ao fim`, () => {
      const apontados = new Set(cap.nos.flatMap(n =>
        [...(n.liga || []), ...(n.opcoes || []).map(o => o.vai)]));
      const comecos = cap.nos.filter(n => !apontados.has(n.id));
      assert.equal(comecos.length, 1, `começos encontrados: ${comecos.map(c => c.id)}`);
      assert.equal(noInicial(cap).id, comecos[0].id);

      // Caminha o grafo do inicio; todo no deve ser alcancavel e a busca
      // deve terminar num no sem saida.
      const vistos = new Set();
      const fila = [comecos[0].id];
      let terminais = 0;
      while (fila.length) {
        const id = fila.shift();
        if (vistos.has(id)) continue;
        vistos.add(id);
        const no = noPorId(cap, id);
        const saidas = [...(no.liga || []), ...(no.opcoes || []).map(o => o.vai)];
        if (!saidas.length) terminais++;
        fila.push(...saidas);
      }
      assert.equal(vistos.size, cap.nos.length, 'todo nó precisa ser alcançável');
      assert.ok(terminais >= 1, 'o capítulo precisa ter um fim');
    });

    test(`${cap.numero}: nos de combate declaram inimigos conhecidos`, () => {
      for (const no of cap.nos.filter(n => n.tipo === 'combate')) {
        assert.ok((no.inimigos || []).length || no.especial,
          `${no.id} é combate mas não tem inimigos`);
        for (const kind of no.inimigos || []) {
          assert.ok(MONSTERS[kind], `${no.id} usa monstro desconhecido: ${kind}`);
        }
      }
    });

    test(`${cap.numero}: terreno declarado cabe no campo e existe`, () => {
      const field = new Field();
      for (const no of cap.nos) {
        for (const bloco of no.terreno || []) {
          assert.ok(TERRAIN[bloco.kind], `${no.id}: terreno desconhecido ${bloco.kind}`);
          for (const [x, y] of bloco.cells) {
            assert.ok(field.inBounds({ x, y }), `${no.id}: quadrado ${x},${y} fora do campo`);
          }
        }
      }
    });

    test(`${cap.numero}: nos de dialogo apontam para cenas que existem`, () => {
      for (const no of cap.nos.filter(n => n.tipo === 'dialogo')) {
        assert.ok(CENAS[no.cena], `${no.id} usa cena desconhecida: ${no.cena}`);
      }
    });
  }

  test('todo capitulo tem chefe e trilha', () => {
    for (const cap of CAPITULOS) {
      assert.ok(cap.nos.some(n => n.chefe), `${cap.id} não tem nó de chefe`);
      assert.ok(cap.trilha, `${cap.id} não tem trilha`);
    }
  });
});

describe('Julgamento dos Dragoes', () => {
  const cena = CENAS.julgamentoDosDragoes;

  test('a cena pede duas vozes', () => {
    const fala = cena.falas.find(f => f.escolhas);
    assert.equal(fala.vezes, 2, 'com uma voz só era impossível vencer');
    assert.ok(fala.escolhas.length >= 3);
  });

  test('duas vozes desarmam o espirito', () => {
    const r = cena.resolucao({ bandeiras: new Set(['julgamentoDiplomacia', 'julgamentoFe']) });
    assert.equal(r.desfecho, 'paz');
    assert.equal(r.bandeira, 'julgamentoVencido');
  });

  test('uma voz so nao basta', () => {
    const r = cena.resolucao({ bandeiras: new Set(['julgamentoDiplomacia']) });
    assert.equal(r.desfecho, 'combate');
  });

  test('qualquer par de vozes serve, nao so o da mesa', () => {
    const r = cena.resolucao({ bandeiras: new Set(['julgamentoFe', 'julgamentoLinhagem']) });
    assert.equal(r.desfecho, 'paz');
  });

  test('sacar a arma leva a combate mesmo com vozes ganhas', () => {
    const r = cena.resolucao({
      bandeiras: new Set(['julgamentoDiplomacia', 'julgamentoFe', 'julgamentoCombate']),
    });
    assert.equal(r.desfecho, 'combate');
  });

  test('os testes usam as pericias certas de cada personagem', () => {
    const fala = cena.falas.find(f => f.escolhas);
    const porQuem = Object.fromEntries(
      fala.escolhas.filter(e => e.teste).map(e => [e.teste.quem, e.teste.pericia]));
    // Na mesa quem falou foi o Lathuriel, e ele e o rosto social do grupo.
    assert.equal(porQuem.lathuriel, 'persuasao');
    assert.equal(porQuem.elandrin, 'religiao');
    const lath = new Combatant(HEROES.LATHURIEL, { side: 'ally' });
    assert.equal(lath.skillBonus('persuasao'), 10, 'Persuasão +10, como na ficha');
  });
});

describe('Lord Soth', () => {
  test('nao pode ser reduzido a zero', () => {
    const soth = new Combatant(SOTH(), { side: 'foe' });
    const antes = soth.hp;
    const r = soth.applyDamage(500, 'radiante');
    assert.equal(r.taken, 0);
    assert.equal(r.reason, 'invulnerável');
    assert.equal(soth.hp, antes);
    assert.equal(soth.dead, false);
  });

  test('o encontro dele e de sobreviver, nao de derrotar', () => {
    const cap = CAPITULOS.find(c => c.id === 'catacumbas');
    const no = cap.nos.find(n => n.especial === 'soth');
    assert.ok(no, 'o nó do Soth existe');
    assert.equal(no.objetivo.kind, 'sobreviver');
    assert.equal(no.objetivo.rounds, 5);
  });

  test('aguentar as rodadas encerra em vitoria', () => {
    const heroi = new Combatant(HEROES.ELANDRIN, { side: 'ally' });
    const soth = new Combatant(SOTH(), { side: 'foe' });
    const enc = new Encounter({
      combatants: [heroi, soth],
      objective: { kind: 'sobreviver', rounds: 3 },
    });
    Dice.setRng(() => frac(10, 20));
    enc.rollInitiative();
    // Avanca turnos ate o objetivo bater.
    for (let i = 0; i < 40 && !enc.finished; i++) enc.endTurn();
    Dice.resetRng();
    assert.equal(enc.finished, true);
    assert.equal(enc.outcome, 'vitoria');
    assert.ok(enc.round > 3);
  });

  test('o grupo cair encerra em derrota mesmo no modo sobreviver', () => {
    const heroi = new Combatant(HEROES.ELANDRIN, { side: 'ally' });
    const soth = new Combatant(SOTH(), { side: 'foe' });
    const enc = new Encounter({
      combatants: [heroi, soth],
      objective: { kind: 'sobreviver', rounds: 5 },
    });
    Dice.setRng(() => frac(10, 20));
    enc.rollInitiative();
    heroi.applyDamage(999);
    heroi._dead = true;
    enc.checkEnd();
    Dice.resetRng();
    assert.equal(enc.outcome, 'derrota');
  });
});

describe('Conde Cornelius', () => {
  test('entra como convidado do lado do grupo', () => {
    const conde = new Combatant(CONVIDADOS.CORNELIUS(), { side: 'ally' });
    assert.equal(conde.side, 'ally');
    assert.equal(conde.sb.convidado, true);
    assert.equal(conde.resourceLeft('banquete'), 1);
  });

  test('so devora quem ja esta abaixo da metade dos PV', () => {
    const conde = new Combatant(CONVIDADOS.CORNELIUS(), { side: 'ally' });
    const banquete = conde.sb.talents[0];
    const inteiro = new Combatant(MONSTERS.SIVAK(), { side: 'foe' });

    const recusa = banquete.resolve({ actor: conde, targets: [inteiro] });
    assert.match(recusa[0].text, /inteiro demais/);
    assert.equal(inteiro.dead, false);

    inteiro.hp = 10;
    const aceita = banquete.resolve({ actor: conde, targets: [inteiro] });
    assert.equal(inteiro.dead, true);
    assert.ok(aceita.some(e => e.text.includes('devora')));
    assert.equal(conde.tempHp, 15);
  });

  test('so aparece na ponte se a conversa tiver corrido bem', () => {
    const ponte = CAPITULOS.find(c => c.id === 'ponte');
    const comConvidado = ponte.nos.filter(n => n.convidado === 'CORNELIUS');
    assert.equal(comConvidado.length, 2, 'a guarda da ponte e o chefe');
    const cena = CENAS.condeCornelius;
    const fala = cena.falas.find(f => f.escolhas);
    assert.ok(fala.escolhas.some(e => e.bandeira === 'condeAliado'));
    assert.ok(fala.escolhas.some(e => e.combate), 'atacar o Conde é uma saída possível');
  });
});

describe('nomes e continuidade', () => {
  test('os NPCs sao os da campanha, com os nomes que a mesa usa', () => {
    assert.equal(NPCS.CORNELIUS.titulo, 'Stefannius Cornelius Du-Lac de Limbo');
    assert.equal(NPCS.DEMELIN.titulo, 'Alta Maga de Silvanesti');
    assert.equal(NPCS.SOTH.titulo, 'cavaleiro da morte');
  });

  test('Demelin conta a historia certa da Dragonlance', () => {
    const falas = CENAS.demelinRefugio.falas.map(f => f.texto).join(' ');
    // Sarlamir, nao Lord Soth: sao personagens diferentes, e o MEMORY avisa
    // que os recaps ja confundiram os dois.
    assert.match(falas, /Sarlamir/);
    assert.doesNotMatch(falas, /Soth/);
  });

  test('a numeracao dos inimigos nao inventa numero para tipo unico', () => {
    const grupo = spawnGroup(['BAAZ', 'BAAZ', 'BOZAK']);
    assert.deepEqual(grupo.map(s => s.name), ['Baaz 1', 'Baaz 2', 'Bozak']);
  });
});

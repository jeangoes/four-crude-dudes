// Blocos de status dos inimigos.
//
// O bloco 4 completa a lista. Aqui ja entra o baaz com o efeito de morte do
// cânone, porque é ele que prova o gancho `onDeath` no jogo e não só no teste.

import { defineStatblock } from '../rules/statblock.js';
import { rollNotation, checkRoll, describe } from '../rules/dice.js';
import { REACTIONS } from './reactions.js';

export const MONSTERS = {
  BAAZ: () => defineStatblock({
    id: 'baaz', name: 'Baaz', sprite: 'BAAZ', side: 'foe',
    level: 2, hitDie: 8,
    abilities: { for: 14, des: 12, con: 14, int: 8, sab: 10, car: 8 },
    ac: 15, maxHp: 22, speed: 9,
    tactic: 'bruto',
    actions: [
      { name: 'Cimitarra', kind: 'melee', ability: 'for', reach: 1.5, damage: { dice: '1d6', type: 'cortante' } },
    ],
    // Cânone: o baaz vira estátua de pedra ao morrer. Quem o matou de perto
    // fica com a arma presa, e o quadrado vira terreno difícil.
    onDeath: {
      id: 'petrificacao',
      label: 'vira estátua de pedra',
      text: (v) => `${v.name} enrijece e vira uma estátua de pedra`,
      resolve: ({ encounter, victim, killer }) => {
        const events = [];
        const field = encounter.field;
        if (field) {
          field.setTerrain(victim.pos, 'entulho');
          field.addHazard({
            id: `estatua-${victim.id}`, label: 'estátua de baaz',
            cells: [{ ...victim.pos }], terrain: 'entulho', rounds: 7,
          });
          events.push({
            type: 'terrain', text: `A estátua bloqueia o quadrado: terreno difícil por 1 minuto`,
          });
        }
        // Arma presa só acontece se o golpe foi corpo a corpo e adjacente.
        const adjacente = killer && Math.max(
          Math.abs(killer.pos.x - victim.pos.x),
          Math.abs(killer.pos.y - victim.pos.y)) <= 1;
        if (killer && adjacente && killer.side === 'ally') {
          const teste = checkRoll({ mod: killer.mod('for') + (killer.sb.saveProficiencies.includes('for') ? killer.prof : 0), dc: 11 });
          events.push({
            type: 'save-roll', target: killer.id, success: teste.success,
            text: `${killer.name} tenta soltar a arma da pedra: ${describe(teste)} vs CD 11 — ${teste.success ? 'solta' : 'a arma fica presa'}`,
          });
          if (!teste.success) {
            killer.addEffect({ key: 'armaPresa', label: 'arma presa na estátua', rounds: 1 });
            events.push({ type: 'effect', target: killer.id, effect: 'armaPresa', text: `${killer.name} perde o próximo ataque` });
          }
        }
        return events;
      },
    },
  }),

  KAPAK: () => defineStatblock({
    id: 'kapak', name: 'Kapak', sprite: 'KAPAK', side: 'foe',
    level: 3, hitDie: 8,
    abilities: { for: 14, des: 14, con: 14, int: 10, sab: 10, car: 10 },
    ac: 15, maxHp: 30, speed: 9,
    tactic: 'bruto',
    actions: [
      {
        name: 'Mordida ácida', kind: 'melee', ability: 'for', reach: 1.5,
        damage: { dice: '1d6', type: 'perfurante' },
        extraDamage: [{ dice: '1d4', type: 'acido', condition: 'envenenado', save: { ability: 'con', dc: 12 } }],
      },
    ],
    onDeath: {
      id: 'dissolucao',
      label: 'dissolve numa poça de ácido',
      text: (v) => `${v.name} se dissolve numa poça de ácido fumegante`,
      resolve: ({ encounter, victim }) => {
        const field = encounter.field;
        if (!field) return [];
        field.addHazard({
          id: `acido-${victim.id}`, label: 'poça de ácido',
          cells: [{ ...victim.pos }], terrain: 'acido', rounds: 3,
        });
        return [{ type: 'terrain', text: 'A poça queima quem começar o turno nela (1d6 de ácido)' }];
      },
    },
  }),

  BOZAK: () => defineStatblock({
    id: 'bozak', name: 'Bozak', sprite: 'BOZAK', side: 'foe',
    level: 4, hitDie: 8,
    abilities: { for: 12, des: 14, con: 14, int: 14, sab: 12, car: 14 },
    ac: 14, maxHp: 39, speed: 9,
    tactic: 'atirador',
    spellcasting: { ability: 'car', dc: 12, slots: { 1: 2 } },
    actions: [
      { name: 'Dardo arcano', kind: 'ranged', ability: 'car', range: 27, damage: { dice: '1d8', type: 'energia' },
        // Marcado como conjuracao: abre a janela de Contramagia do Darian.
        isSpell: true, spellName: 'Dardo Arcano', spellLevel: 1 },
      { name: 'Garras', kind: 'melee', ability: 'for', reach: 1.5, damage: { dice: '1d6', type: 'cortante' } },
    ],
    onDeath: {
      id: 'explosao',
      label: 'explode',
      text: (v) => `Os ossos de ${v.name} explodem`,
      resolve: ({ encounter, victim }) => {
        const field = encounter.field;
        if (!field) return [];
        const cells = field.cellsInSphere(victim.pos, 3, { requireSight: false });
        const pegos = field.occupantsOf(cells).filter(c => c !== victim && !c.dead);
        const events = [];
        for (const alvo of pegos) {
          const save = checkRoll({ mod: alvo.saveBonus('des'), dc: 12 });
          const dano = rollNotation('3d6');
          const total = save.success ? Math.floor(dano.total / 2) : dano.total;
          const res = alvo.applyDamage(total, 'energia');
          events.push({
            type: 'save-roll', target: alvo.id, success: save.success,
            text: `${alvo.name} resiste com DES: ${describe(save)} vs CD 12 — ${save.success ? 'passa' : 'falha'}`,
          });
          events.push({
            type: 'damage', target: alvo.id, amount: res.taken, damageType: 'energia', wentDown: res.wentDown,
            text: `${alvo.name} sofre ${res.taken} da explosão`,
          });
        }
        if (!pegos.length) events.push({ type: 'info', text: 'A explosão não pega ninguém' });
        return events;
      },
    },
  }),

  SIVAK: () => defineStatblock({
    id: 'sivak', name: 'Sivak', sprite: 'SIVAK', side: 'foe',
    level: 8, hitDie: 10, nd: 5,
    abilities: { for: 18, des: 14, con: 16, int: 12, sab: 12, car: 14 },
    ac: 16, maxHp: 68, speed: 9,
    tactic: 'bruto',
    actions: [
      { name: 'Espada bastarda', kind: 'melee', ability: 'for', reach: 1.5, damage: { dice: '2d8', type: 'cortante' } },
      { name: 'Garras', kind: 'melee', ability: 'for', reach: 1.5, damage: { dice: '1d6', type: 'cortante' } },
    ],
    reactions: [REACTIONS.contragolpe],
    // Cânone: ao derrubar um humanoide, o sivak assume a forma dele. No
    // campo isso vira o sprite e o nome da vítima, o que é justamente o
    // risco tático que o grupo já conhece da campanha.
    onKill: {
      id: 'formaRoubada', once: true,
      label: 'assume a forma da vítima',
      text: (k, v) => `${k.name} se desdobra e assume a forma de ${v.name}`,
      resolve: ({ killer, victim }) => {
        killer.sb.sprite = victim.sb.sprite || victim.id.toUpperCase();
        killer.sb.name = `${victim.name}`;
        killer.name = `${victim.name}`;
        killer.sb.disfarcadoDe = victim.id;
        return [{
          type: 'info',
          text: `Cuidado: a coisa com a cara de ${victim.name} não é ${victim.name}`,
        }];
      },
    },
    onDeath: {
      id: 'sombraQueimada',
      label: 'queima e deixa a própria sombra no chão',
      text: (v) => `${v.name} arde e deixa a sombra marcada na pedra`,
      resolve: ({ encounter, victim }) => {
        const field = encounter.field;
        if (!field) return [];
        field.addHazard({
          id: `sombra-${victim.id}`, label: 'sombra queimada',
          cells: [{ ...victim.pos }], terrain: 'entulho', rounds: 10,
        });
        return [{ type: 'terrain', text: 'A marca fumegante torna o quadrado difícil de cruzar' }];
      },
    },
  }),

  AURAK: () => defineStatblock({
    id: 'aurak', name: 'Aurak', sprite: 'AURAK', side: 'foe',
    level: 10, hitDie: 8, nd: 7,
    abilities: { for: 14, des: 16, con: 16, int: 18, sab: 14, car: 18 },
    ac: 17, maxHp: 82, speed: 9,
    tactic: 'atirador',
    resistances: ['fogo'],
    spellcasting: { ability: 'car', dc: 15, slots: { 1: 3, 2: 2, 3: 1 } },
    actions: [
      { name: 'Raio necrótico', kind: 'ranged', ability: 'car', range: 27, damage: { dice: '2d8', type: 'necrotico' },
        isSpell: true, spellName: 'Raio Necrótico', spellLevel: 3 },
      { name: 'Garras flamejantes', kind: 'melee', ability: 'for', reach: 1.5, damage: { dice: '1d8', type: 'cortante' },
        extraDamage: [{ dice: '1d6', type: 'fogo' }] },
    ],
    // Cânone: o aurak não deixa corpo. Vira energia, e a energia estoura.
    // Aqui ela fica no chão por três rodadas antes de detonar, o que dá ao
    // grupo a chance de sair de perto em vez de só comer o dano.
    onDeath: {
      id: 'energiaInstavel',
      label: 'desfaz-se em energia instável',
      text: (v) => `${v.name} se desfaz numa bola de energia que pulsa e cresce`,
      resolve: ({ encounter, victim }) => {
        const field = encounter.field;
        if (!field) return [];
        field.addHazard({
          id: `energia-${victim.id}`, label: 'energia instável',
          cells: [{ ...victim.pos }], terrain: 'fogo', rounds: 3,
          onExpire: ({ encounter: enc, hazard }) => {
            const centro = hazard.cells[0];
            const area = field.cellsInSphere(centro, 4.5, { requireSight: false });
            const pegos = field.occupantsOf(area).filter(c => !c.dead);
            const eventos = [{ type: 'info', text: 'A energia do aurak estoura' }];
            for (const alvo of pegos) {
              const save = checkRoll({ mod: alvo.saveBonus('des'), dc: 15 });
              const dano = rollNotation('4d10');
              const total = save.success ? Math.floor(dano.total / 2) : dano.total;
              const res = alvo.applyDamage(total, 'energia');
              eventos.push({
                type: 'save-roll', target: alvo.id, success: save.success,
                text: `${alvo.name} resiste com DES: ${describe(save)} vs CD 15 — ${save.success ? 'passa' : 'falha'}`,
              });
              eventos.push({
                type: 'damage', target: alvo.id, amount: res.taken, damageType: 'energia', wentDown: res.wentDown,
                text: `${alvo.name} sofre ${res.taken} da detonação`,
              });
            }
            if (!pegos.length) eventos.push({ type: 'info', text: 'Ninguém estava perto o bastante' });
            return eventos;
          },
        });
        return [{ type: 'terrain', text: 'A energia detona em 3 rodadas, num raio de 4,5 m' }];
      },
    },
  }),

  MORTO_VIVO: () => defineStatblock({
    id: 'mortoVivo', name: 'Morto-vivo de Kalaman', sprite: 'MORTO_VIVO', side: 'foe',
    level: 1, hitDie: 8,
    // Estes dois campos são o que o Expulsar Mortos-Vivos consulta.
    tipo: 'morto-vivo', nd: 0.25,
    abilities: { for: 13, des: 6, con: 16, int: 3, sab: 6, car: 5 },
    ac: 8, maxHp: 22, speed: 6,
    tactic: 'bruto',
    resistances: ['necrotico'],
    immunities: ['veneno'],
    conditionImmunities: ['envenenado', 'enfeiticado'],
    actions: [
      { name: 'Agarrão', kind: 'melee', ability: 'for', reach: 1.5,
        damage: { dice: '1d6', type: 'impacto' },
        extraDamage: [{ dice: '0', type: 'impacto', condition: 'agarrado', save: { ability: 'for', dc: 12 } }] },
    ],
  }),
};

/**
 * Cria uma instancia com id unico.
 *
 * A numeracao e por tipo, nao pela posicao na lista: tres baaz e um bozak
 * viram "Baaz 1", "Baaz 2", "Baaz 3" e "Bozak", nunca "Bozak 4". Tipo unico
 * em campo fica sem numero.
 */
export function spawnGroup(kinds) {
  const contagem = {};
  for (const kind of kinds) contagem[kind] = (contagem[kind] || 0) + 1;

  const usados = {};
  return kinds.map(kind => {
    const factory = MONSTERS[kind];
    if (!factory) throw new Error(`monstro desconhecido: ${kind}`);
    const sb = factory();
    const n = (usados[kind] = (usados[kind] || 0) + 1);
    sb.id = `${sb.id}-${n}`;
    // So numera quando ha mais de um do mesmo tipo em campo.
    if (contagem[kind] > 1) sb.name = `${sb.name} ${n}`;
    return sb;
  });
}

// Decisao dos inimigos.
//
// Um plano por turno: mover, atacar, ou os dois. A tatica vem do bloco de
// status (`tactic`), nao de um `if` por monstro, para que o bloco 4 crie
// draconianos novos sem mexer aqui.

import { Field } from './field.js';

export const TACTICS = {
  // Avanca e bate no alvo mais conveniente.
  bruto: {
    pickTarget(self, foes, field) {
      // Prefere quem ja esta ao alcance; senao, o mais perto; empate no
      // menor PV, porque derrubar alguem vale mais que espalhar dano.
      const reach = self.sb.actions.find(a => a.kind === 'melee')?.reach || 1.5;
      const atReach = foes.filter(f => field.inRange(self, f, reach));
      const pool = atReach.length ? atReach : foes;
      return pool.slice().sort((a, b) =>
        field.distance(self, a) - field.distance(self, b) || a.hp - b.hp)[0] || null;
    },
    preferredRange: () => 1.5,
  },

  // Mantem distancia e atira. Recua se colarem nele.
  atirador: {
    pickTarget(self, foes, field) {
      // Alvo frágil e sem cobertura vale mais que o mais perto.
      return foes.slice().sort((a, b) => {
        const sightA = field.hasLineOfSight(self, a) ? 0 : 1;
        const sightB = field.hasLineOfSight(self, b) ? 0 : 1;
        return sightA - sightB || a.hp / a.maxHp - b.hp / b.maxHp;
      })[0] || null;
    },
    preferredRange: (self) => self.sb.actions.find(a => a.kind === 'ranged')?.range || 18,
    keepAway: 4.5,
  },

  // Fica junto do aliado mais importante e intercepta quem se aproxima.
  guarda: {
    pickTarget(self, foes, field) {
      const ward = self.sb.guards
        ? field.combatants.find(c => c.id === self.sb.guards && !c.dead)
        : null;
      const anchor = ward || self;
      return foes.slice().sort((a, b) => field.distance(anchor, a) - field.distance(anchor, b))[0] || null;
    },
    preferredRange: () => 1.5,
  },
};

/**
 * Monta o plano do turno. Nao executa nada: a sessao executa e anima.
 * Devolve { target, path, action, kind: 'attack'|'move'|'wait', reason }
 */
export function planTurn(self, { field, encounter }) {
  const tactic = TACTICS[self.sb.tactic] || TACTICS.bruto;
  const foes = encounter.combatants.filter(c =>
    c.side !== self.side && !c.dead && !(c.down && c.side === 'ally'));

  if (!foes.length) return { kind: 'wait', reason: 'sem alvos' };

  const summary = self.conditionSummary;
  if (summary.noAction) return { kind: 'wait', reason: 'incapacitado' };

  const target = tactic.pickTarget(self, foes, field);
  if (!target) return { kind: 'wait', reason: 'sem alvo escolhido' };

  const melee = self.sb.actions.find(a => a.kind === 'melee');
  const ranged = self.sb.actions.find(a => a.kind === 'ranged');
  const dist = field.distance(self, target);

  // --- atirador: atira se puder, recua se estiver colado ---
  if (ranged && tactic.keepAway !== undefined) {
    const tooClose = dist < tactic.keepAway;
    const canSee = field.hasLineOfSight(self, target);

    if (!tooClose && canSee && dist <= (ranged.range || 18)) {
      return { kind: 'attack', action: ranged, target, path: null, reason: 'tem linha e distância' };
    }
    const reach = field.reachable(self, self.speed);
    if (tooClose) {
      // Recuar custa o movimento, mas sair do alcance provoca oportunidade.
      // O motor resolve a provocacao; aqui so escolhemos o melhor destino.
      const spot = bestCell(reach, field, cell =>
        score(field, cell, target, {
          want: tactic.preferredRange(self),
          needSight: true,
          avoidAdjacent: foes,
        }));
      if (spot) return { kind: 'move-attack', action: ranged, target, path: field.pathFrom(reach, self, spot), reason: 'recua para atirar' };
    }
    if (!canSee) {
      const spot = bestCell(reach, field, cell =>
        score(field, cell, target, { want: tactic.preferredRange(self), needSight: true, avoidAdjacent: foes }));
      if (spot) return { kind: 'move-attack', action: ranged, target, path: field.pathFrom(reach, self, spot), reason: 'busca linha de visão' };
    }
    return { kind: 'attack', action: ranged, target, path: null, reason: 'atira mesmo assim' };
  }

  // --- corpo a corpo: bate se alcanca, senao anda ate alcancar ---
  const reachM = melee?.reach || 1.5;
  if (melee && dist <= reachM) {
    return { kind: 'attack', action: melee, target, path: null, reason: 'já está ao alcance' };
  }

  const reach = field.reachable(self, self.speed);
  const spot = bestCell(reach, field, cell => {
    const d = Field.steps(cell, target.pos) * 1.5;
    // Quanto mais perto do alcance, melhor; empate favorece caminho barato.
    return -Math.abs(d - reachM) * 10;
  });

  if (spot) {
    const path = field.pathFrom(reach, self, spot);
    const willReach = Field.steps(spot, target.pos) * 1.5 <= reachM;
    return {
      kind: willReach && melee ? 'move-attack' : 'move',
      action: melee, target, path,
      reason: willReach ? 'avança e ataca' : 'avança',
    };
  }

  // Cercado ou sem movimento util. Ataca a distancia se tiver, senao espera.
  if (ranged) return { kind: 'attack', action: ranged, target, path: null, reason: 'preso, atira' };
  return { kind: 'wait', reason: 'sem caminho até o alvo' };
}

// Escolhe o quadrado alcancavel com a melhor nota.
function bestCell(reachMap, field, scoreFn) {
  let best = null, bestScore = -Infinity;
  for (const { cell, cost } of reachMap.values()) {
    if (field.isBlocked(cell)) continue;
    const s = scoreFn(cell) - cost * 0.01;      // desempata pelo caminho curto
    if (s > bestScore) { bestScore = s; best = cell; }
  }
  return best;
}

// Nota de um quadrado para quem quer atirar: distancia certa, com visao, e
// longe de quem bate de perto.
function score(field, cell, target, { want, needSight, avoidAdjacent = [] }) {
  const d = Field.steps(cell, target.pos) * 1.5;
  let s = -Math.abs(d - want);
  if (needSight && !field.hasLineOfSight(cell, target.pos)) s -= 50;
  for (const foe of avoidAdjacent) {
    if (Field.steps(cell, foe.pos) <= 1) s -= 12;
  }
  const t = field.terrainAt(cell);
  if (t.damage) s -= 20;                        // nao para em cima do fogo
  if (t.cost > 1) s -= 3;
  return s;
}

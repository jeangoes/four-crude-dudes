// Reacoes.
//
// A reacao e o que justifica o jogo em turno: o jogo para no meio do turno
// do inimigo e pergunta. O motor emite o gatilho, a ficha declara o que
// pode responder a ele.
//
// Gatilhos que o motor emite hoje:
//   incoming-attack  antes da jogada de ataque contra voce
//   attack-missed    depois de um ataque que errou voce
//   enemy-casting    quando um inimigo comeca a conjurar
//   ally-hit         quando um ataque acerta voce ou um aliado

import { checkRoll, d20, describe } from '../rules/dice.js';

export const REACTIONS = {
  // --- Darian ---

  contramagia: {
    id: 'contramagia', name: 'Contramágica', trigger: 'enemy-casting',
    cost: 'espaço de 3º',
    available: ({ combatant, trigger }) =>
      combatant.slotsAvailable(3) > 0 &&
      trigger.caster && trigger.spellLevel !== undefined,
    resolve({ combatant, trigger }) {
      const gasto = combatant.spendSlot(3);
      const events = [{
        type: 'counterspell', id: combatant.id,
        text: `${combatant.name} tenta interromper ${trigger.spellName}`,
      }];
      // Espaco de nivel igual ou maior anula sem teste. Menor exige teste.
      if (gasto.level >= (trigger.spellLevel || 0)) {
        events.push({ type: 'counterspell-ok', text: `${trigger.spellName} é desfeita antes de tomar forma` });
        return { countered: true, events };
      }
      const dc = 10 + (trigger.spellLevel || 0);
      const teste = checkRoll({ mod: combatant.spellAttack, dc });
      events.push({
        type: 'skill-check', id: combatant.id, success: teste.success,
        text: `Teste de conjuração: ${describe(teste)} vs CD ${dc} — ${teste.success ? 'anula' : 'a magia passa'}`,
      });
      return { countered: teste.success, events };
    },
  },

  barreirasPrateadas: {
    id: 'barreirasPrateadas', name: 'Barreiras Prateadas', trigger: 'ally-hit',
    cost: 'espaço de 1º',
    available: ({ combatant }) => combatant.slotsAvailable(1) > 0,
    resolve({ combatant, trigger }) {
      combatant.spendSlot(1);
      return {
        rerollAttack: true,
        events: [{
          type: 'silvery-barbs', id: combatant.id,
          text: `${combatant.name} distorce a sorte: ${trigger.attacker.name} rola o ataque de novo com desvantagem`,
        }],
      };
    },
  },

  // --- Elandrin ---

  clarãoProtetor: {
    id: 'clarãoProtetor', name: 'Clarão Protetor', trigger: 'incoming-attack',
    cost: 'clarão',
    available: ({ combatant }) => combatant.resourceLeft('clarao') > 0,
    resolve({ combatant, trigger }) {
      combatant.useResource('clarao');
      return {
        imposeDisadvantage: true,
        events: [{
          type: 'warding-flare', id: combatant.id,
          text: `Luz explode diante de ${trigger.attacker.name}: desvantagem no ataque`,
        }],
      };
    },
  },

  // --- inimigos ---

  // Sivak bate de volta em quem o feriu de perto.
  contragolpe: {
    id: 'contragolpe', name: 'Contragolpe', trigger: 'attack-missed',
    available: ({ combatant, trigger, encounter }) =>
      encounter.field?.adjacent(combatant, trigger.attacker) ?? false,
    async resolve({ encounter, combatant, trigger }) {
      const golpe = combatant.sb.actions.find(a => a.kind === 'melee');
      if (!golpe) return {};
      await encounter.attack(combatant, trigger.attacker, golpe, { riposte: true });
      return {};
    },
  },
};

export const REACTION_SETS = {
  DARIAN: ['contramagia', 'barreirasPrateadas'],
  ELANDRIN: ['clarãoProtetor'],
  LATHURIEL: [],
  OWO: [],
};

export function reactionsFor(key) {
  return (REACTION_SETS[key] || []).map(id => REACTIONS[id]);
}

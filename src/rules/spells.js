// Magia: espacos, upcast, concentracao e resolucao.
//
// Uma magia e uma descricao declarativa. `castSpell` gasta o espaco, resolve
// os alvos e devolve uma lista de eventos que o log e a animacao consomem.
// Nada aqui toca DOM.

import { rollNotation, attackRoll, checkRoll, describe } from './dice.js';

export const CAST_TIMES = { acao: 'acao', bonus: 'bonus', reacao: 'reacao' };

// Ganchos de classe que alteram a resolucao. A ficha lista os nomes em
// `features`; aqui mora o que cada um faz.
export const FEATURE_HOOKS = {
  // Evocador: aliados escolhidos passam automaticamente e nao sofrem dano.
  sculptSpells: {
    appliesTo: (spell) => spell.school === 'evocacao' && spell.save,
    maxSpared: (caster, spell) => 1 + spell.level,
    onSpared: () => ({ autoSave: true, damageMultiplier: 0 }),
  },
  // Evocador: truque que erra ainda causa metade do dano.
  potentCantrip: {
    appliesTo: (spell) => spell.level === 0 && spell.save,
    onFailedToLand: () => ({ damageMultiplier: 0.5 }),
  },
};

export function hasFeature(caster, name) {
  return (caster.sb.features || []).includes(name);
}

// ---------- validacao ----------

export function canCast(caster, spell, { slotLevel } = {}) {
  if (spell.level === 0) return { ok: true, slotLevel: 0 };

  const level = slotLevel ?? spell.level;
  if (level < spell.level) {
    return { ok: false, reason: `${spell.name} precisa de espaço de ${spell.level}º nível ou maior` };
  }
  // Um espaco de nivel L serve; se nao houver, sobe procurando.
  let found = null;
  for (let l = level; l <= 9; l++) {
    if (caster.slotsAvailable(l) > 0) { found = l; break; }
  }
  if (found === null) return { ok: false, reason: 'sem espaços de magia disponíveis' };
  return { ok: true, slotLevel: found };
}

// Dano com upcast: base mais `perLevel` por nivel acima do nivel da magia.
export function damageAt(spell, slotLevel) {
  if (!spell.damage) return null;
  const base = spell.damage.dice;
  if (!spell.damage.perLevel || slotLevel <= spell.level) return base;
  const extra = slotLevel - spell.level;
  return `${base}+${extra}${spell.damage.perLevel}`;
}

// Limiares de nivel de personagem que escalam truques (1/5/11/17).
function cantripSteps(casterLevel) {
  return casterLevel >= 17 ? 4 : casterLevel >= 11 ? 3 : casterLevel >= 5 ? 2 : 1;
}

// Truque escala por nivel de personagem, nao por espaco.
export function cantripDice(spell, casterLevel) {
  if (spell.level !== 0 || !spell.damage) return null;
  const steps = cantripSteps(casterLevel);
  const { count, sides, flat = '' } = parseCantrip(spell.damage.dice);
  return `${count * steps}d${sides}${flat}`;
}

// Magias como Rajada Mistica escalam em numero de feixes, nao em dado por
// feixe: mesmos limiares de nivel do truque comum, mas cada feixe rola seu
// proprio ataque e seu proprio dano fixo.
export function beamsFor(spell, casterLevel) {
  return spell.beams ? cantripSteps(casterLevel) : 1;
}

function parseCantrip(notation) {
  const m = String(notation).match(/^(\d*)d(\d+)(.*)$/);
  if (!m) return { count: 1, sides: 6, flat: '' };
  return { count: m[1] === '' ? 1 : parseInt(m[1], 10), sides: parseInt(m[2], 10), flat: m[3] || '' };
}

// ---------- resolucao ----------

/**
 * Lanca uma magia. Devolve { ok, events, slotUsed }.
 *
 * @param caster    Combatant que conjura
 * @param spell     descricao da magia
 * @param targets   Combatant[] ja filtrados por alcance e area
 * @param options   { slotLevel, spared: Combatant[], free: bool }
 */
export function castSpell(caster, spell, targets = [], options = {}) {
  const events = [];
  const check = canCast(caster, spell, options);
  if (!check.ok) return { ok: false, reason: check.reason, events };

  // Gasta o espaco antes de resolver, para que falha de alvo nao devolva magia.
  let slotUsed = null;
  if (spell.level > 0 && !options.free) {
    slotUsed = caster.spendSlot(check.slotLevel);
    if (!slotUsed) return { ok: false, reason: 'sem espaços de magia disponíveis', events };
  }
  const slotLevel = slotUsed?.level ?? check.slotLevel;

  events.push({
    type: 'cast',
    caster: caster.id,
    spell: spell.id,
    name: spell.name,
    slotLevel,
    upcast: slotLevel > spell.level,
    text: `${caster.name} conjura ${spell.name}` +
          (slotLevel > spell.level ? ` (espaço de ${slotLevel}º nível)` : ''),
  });

  // Concentracao nova derruba a anterior.
  if (spell.concentration) {
    const dropped = caster.startConcentration(spell.id, { rounds: spell.durationRounds || 10 });
    if (dropped) {
      events.push({
        type: 'concentration-dropped',
        caster: caster.id,
        text: `${caster.name} perde a concentração em ${dropped.spell}`,
      });
    }
  }

  // Sculpt Spells: quem for poupado nao entra na resolucao de dano.
  const spared = new Set();
  if (hasFeature(caster, 'sculptSpells') && FEATURE_HOOKS.sculptSpells.appliesTo(spell)) {
    const max = FEATURE_HOOKS.sculptSpells.maxSpared(caster, spell);
    for (const t of (options.spared || []).slice(0, max)) spared.add(t.id);
    if (spared.size) {
      events.push({
        type: 'feature',
        caster: caster.id,
        feature: 'sculptSpells',
        text: `Esculpir Magias poupa ${[...spared].length} aliado(s)`,
      });
    }
  }

  const notation = spell.beams
    ? spell.damage?.dice
    : spell.level === 0
      ? cantripDice(spell, caster.level)
      : damageAt(spell, slotLevel);
  const beamCount = beamsFor(spell, caster.level);

  for (const target of targets) {
    if (spared.has(target.id)) {
      events.push({
        type: 'spared',
        target: target.id,
        text: `${target.name} é poupado por Esculpir Magias`,
      });
      continue;
    }
    events.push(...resolveOnTarget(caster, spell, target, notation, slotLevel, beamCount));
  }

  if (spell.selfEffect) events.push(...applySelfEffect(caster, spell));

  return { ok: true, events, slotLevel, slotUsed };
}

function resolveOnTarget(caster, spell, target, notation, slotLevel, beamCount = 1) {
  const events = [];

  // --- magia de ataque ---
  if (spell.attack) {
    for (let i = 1; i <= beamCount; i++) {
      const roll = attackRoll({
        mod: caster.spellAttack,
        ac: target.ac,
        advantage: spell.advantage,
      });
      const feixe = beamCount > 1 ? ` (feixe ${i}/${beamCount})` : '';
      events.push({
        type: 'attack-roll',
        caster: caster.id, target: target.id,
        hit: roll.hit, crit: roll.critHit, roll, beam: i, beams: beamCount,
        text: `${caster.name} → ${target.name}${feixe}: ${describe(roll)} vs CA ${target.ac} — ${roll.critHit ? 'crítico!' : roll.hit ? 'acerta' : 'erra'}`,
      });
      if (roll.hit && notation) {
        const dmg = rollNotation(notation, { crit: roll.critHit });
        events.push(...dealDamage(caster, target, dmg, spell.damage.type, describe(dmg)));
      }
    }
    return events;
  }

  // --- magia de resistencia ---
  if (spell.save) {
    const summary = target.conditionSummary;
    const auto = summary.autoFailSaves.includes(spell.save.ability);
    const roll = auto
      ? { total: 0, natural: 0, mod: 0, rolls: [0], success: false, dc: caster.spellSaveDC, mode: 'flat' }
      : checkRoll({
          mod: target.saveBonus(spell.save.ability),
          dc: caster.spellSaveDC,
          disadvantage: summary.savesWithDisadvantage.includes(spell.save.ability),
        });

    events.push({
      type: 'save-roll',
      caster: caster.id, target: target.id,
      success: roll.success, roll, ability: spell.save.ability,
      text: `${target.name} resiste com ${spell.save.ability.toUpperCase()}: ` +
            (auto ? 'falha automática' : `${describe(roll)} vs CD ${caster.spellSaveDC}`) +
            ` — ${roll.success ? 'passa' : 'falha'}`,
    });

    if (notation) {
      let multiplier = roll.success ? (spell.save.onSuccess === 'metade' ? 0.5 : 0) : 1;
      // Potent Cantrip: truque que o alvo resistiu ainda causa metade.
      if (roll.success && multiplier === 0 && spell.level === 0 && hasFeature(caster, 'potentCantrip')) {
        multiplier = 0.5;
      }
      if (multiplier > 0) {
        const dmg = rollNotation(notation);
        const final = Math.floor(dmg.total * multiplier);
        events.push(...dealDamage(caster, target, { ...dmg, total: final }, spell.damage.type,
          `${describe(dmg)}${multiplier < 1 ? ' → metade' : ''}`));
      }
    }

    if (!roll.success && spell.save.condition) {
      const applied = target.addCondition(spell.save.condition);
      events.push({
        type: applied ? 'condition' : 'condition-immune',
        target: target.id, condition: spell.save.condition,
        text: applied
          ? `${target.name} fica ${spell.save.condition}`
          : `${target.name} é imune a ${spell.save.condition}`,
      });
    }
    return events;
  }

  // --- cura ---
  if (spell.heal) {
    const notationHeal = spell.heal.perLevel && slotLevel > spell.level
      ? `${spell.heal.dice}+${slotLevel - spell.level}${spell.heal.perLevel}`
      : spell.heal.dice;
    const base = rollNotation(notationHeal);
    const total = base.total + (spell.heal.addCastingMod ? caster.mod(caster.sb.spellcasting.ability) : 0);
    const res = target.heal(total);
    events.push({
      type: 'heal',
      caster: caster.id, target: target.id, amount: res.healed, revived: res.revived,
      text: `${target.name} recupera ${res.healed} PV${res.revived ? ' e volta a si' : ''} (${describe(base)})`,
    });
    return events;
  }

  // --- efeito puro (buff, debuff, condicao sem resistencia) ---
  if (spell.condition) {
    const applied = target.addCondition(spell.condition);
    events.push({
      type: applied ? 'condition' : 'condition-immune',
      target: target.id, condition: spell.condition,
      text: applied ? `${target.name} fica ${spell.condition}` : `${target.name} é imune a ${spell.condition}`,
    });
  }
  if (spell.effect) {
    target.addEffect({ ...spell.effect, source: caster.id });
    events.push({
      type: 'effect',
      target: target.id, effect: spell.effect.key,
      text: `${target.name}: ${spell.effect.label}`,
    });
  }
  return events;
}

// Aplica dano e resolve o teste de concentracao que ele provoca.
export function dealDamage(source, target, dmg, type, rollText) {
  const events = [];
  const res = target.applyDamage(dmg.total, type);
  events.push({
    type: 'damage',
    source: source?.id, target: target.id,
    amount: res.taken, damageType: type, wentDown: res.wentDown,
    text: `${target.name} sofre ${res.taken} de ${type}` +
          (res.reason ? ` (${res.reason})` : '') +
          (rollText ? ` — ${rollText}` : ''),
  });

  if (res.taken > 0 && target.concentration) {
    const conc = target.concentrationCheck(res.taken);
    if (conc) {
      events.push({
        type: 'concentration-check',
        target: target.id, kept: conc.kept,
        text: `${target.name} testa concentração: ${describe(conc)} vs CD ${conc.dc} — ` +
              (conc.kept ? 'mantém' : 'perde'),
      });
    }
  }

  if (res.wentDown) {
    events.push({
      type: 'down',
      target: target.id,
      text: target.side === 'ally'
        ? `${target.name} cai inconsciente`
        : `${target.name} é derrubado`,
    });
  }
  return events;
}

function applySelfEffect(caster, spell) {
  caster.addEffect({ ...spell.selfEffect, source: caster.id });
  return [{
    type: 'effect',
    target: caster.id, effect: spell.selfEffect.key,
    text: `${caster.name}: ${spell.selfEffect.label}`,
  }];
}

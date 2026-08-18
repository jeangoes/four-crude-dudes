// O encontro: iniciativa, rodadas, economia de turno, ataques e reacoes.
//
// Nada de DOM. A UI se inscreve em `onEvent` e responde a pedidos de reacao
// pelo `reactionResolver`. Sem resolver, toda reacao e recusada, o que deixa
// o motor rodavel em teste sem interface.

import { attackRoll, checkRoll, rollNotation, d20, describe } from './dice.js';
import { dealDamage } from './spells.js';

export class Encounter {
  /**
   * @param objective  como o encontro termina. Por padrao, derrotar todos.
   *   { kind: 'derrotar' }
   *   { kind: 'sobreviver', rounds: 5 }   aguente ate o fim da rodada N
   *   { kind: 'escapar', cells: [...] }   leve todo mundo vivo ate a saida
   */
  constructor({ combatants = [], reactionResolver = null, onEvent = null, name = 'Encontro',
                objective = { kind: 'derrotar' } } = {}) {
    this.name = name;
    this.objective = objective;
    this.combatants = combatants;
    this.order = [];
    this.turnIndex = 0;
    this.round = 0;
    this.started = false;
    this.finished = false;
    this.outcome = null;
    this.reactionResolver = reactionResolver;
    this.onEvent = onEvent;
    this.history = [];
  }

  // ---------- eventos ----------

  emit(event) {
    const stamped = { round: this.round, ...event };
    this.history.push(stamped);
    this.onEvent?.(stamped);
    return stamped;
  }

  emitAll(events) { for (const e of events) this.emit(e); return events; }

  // ---------- consultas ----------

  get current() { return this.order[this.turnIndex] || null; }
  get allies() { return this.combatants.filter(c => c.side === 'ally'); }
  get foes() { return this.combatants.filter(c => c.side === 'foe'); }

  active(side) {
    return this.combatants.filter(c => c.side === side && !c.down && !c.dead);
  }

  find(id) { return this.combatants.find(c => c.id === id) || null; }

  // ---------- iniciativa ----------

  rollInitiative() {
    const entries = this.combatants.map(c => {
      const roll = d20({ mod: c.initiativeBonus });
      return { combatant: c, roll, total: roll.total };
    });
    // Empate: maior DES; persistindo, aliado antes de inimigo.
    entries.sort((a, b) =>
      b.total - a.total ||
      b.combatant.mod('des') - a.combatant.mod('des') ||
      (a.combatant.side === 'ally' ? -1 : 1));

    this.order = entries.map(e => e.combatant);
    this.started = true;
    this.round = 1;
    this.turnIndex = 0;

    this.emit({
      type: 'initiative',
      order: entries.map(e => ({ id: e.combatant.id, name: e.combatant.name, total: e.total })),
      text: 'Iniciativa: ' + entries.map(e => `${e.combatant.name} ${e.total}`).join(', '),
    });
    this.emit({ type: 'round', round: 1, text: 'Rodada 1' });
    this.beginTurn();
    return this.order;
  }

  // ---------- turnos ----------

  beginTurn() {
    const c = this.current;
    if (!c) return null;

    // Heroi caido rola salvaguarda contra a morte em vez de agir.
    if (c.side === 'ally' && c.down && !c.dead && !c.stable) {
      const save = c.rollDeathSave();
      this.emit({
        type: 'death-save',
        target: c.id, outcome: save.outcome,
        text: `${c.name} rola salvaguarda contra a morte: ${describe(save)} — ` +
              ({ revived: 'volta a si com 1 PV!', stable: 'estabiliza', dead: 'morre', success: 'sucesso', failure: 'falha' }[save.outcome]),
      });
      if (save.outcome !== 'revived') { this.checkEnd(); return c; }
    }

    c.beginTurn();
    c.refreshReaction();
    this.emit({ type: 'turn', id: c.id, name: c.name, text: `Turno de ${c.name}` });

    const summary = c.conditionSummary;
    if (summary.noAction) {
      this.emit({
        type: 'turn-skipped', id: c.id,
        text: `${c.name} não pode agir (${[...c.conditions].join(', ')})`,
      });
    }
    return c;
  }

  endTurn() {
    const c = this.current;
    if (c) {
      const expired = c.endTurn();
      for (const e of expired) {
        this.emit({ type: 'effect-expired', target: c.id, effect: e.key, text: `${c.name}: ${e.label} termina` });
      }
    }
    if (this.checkEnd()) return null;
    return this.nextTurn();
  }

  nextTurn() {
    this.turnIndex++;
    if (this.turnIndex >= this.order.length) {
      this.turnIndex = 0;
      this.round++;
      this.emit({ type: 'round', round: this.round, text: `Rodada ${this.round}` });
      // Sobreviver ate a rodada N so pode ser decidido aqui, na virada.
      if (this.checkEnd()) return null;
    }
    // Pula quem morreu de vez; caido ainda tem turno para rolar salvaguarda.
    let guard = 0;
    while (this.current?.dead && guard < this.order.length * 2) {
      this.turnIndex++;
      if (this.turnIndex >= this.order.length) { this.turnIndex = 0; this.round++; }
      guard++;
    }
    return this.beginTurn();
  }

  checkEnd() {
    if (this.finished) return true;

    // O grupo cair encerra qualquer encontro, seja qual for o objetivo.
    if (this.active('ally').length === 0) { this.finish('derrota'); return true; }

    const obj = this.objective || { kind: 'derrotar' };

    if (obj.kind === 'sobreviver') {
      // Vitoria por resistir. Derrubar os inimigos tambem serve, mas com
      // Lord Soth em campo isso nao vai acontecer.
      if (this.round > obj.rounds) { this.finish('vitoria'); return true; }
      if (this.active('foe').every(f => f.sb.invulnerable)) return false;
      if (this.active('foe').length === 0) { this.finish('vitoria'); return true; }
      return false;
    }

    if (obj.kind === 'escapar') {
      const naSaida = c => (obj.cells || []).some(s => s.x === c.pos.x && s.y === c.pos.y);
      const emPe = this.active('ally');
      if (emPe.length && emPe.every(naSaida)) { this.finish('vitoria'); return true; }
      return false;
    }

    if (this.active('foe').length === 0) { this.finish('vitoria'); return true; }
    return false;
  }

  finish(outcome) {
    this.finished = true;
    this.outcome = outcome;
    const texto = outcome === 'derrota' ? 'O grupo tombou.'
      : this.objective?.kind === 'sobreviver' ? 'O grupo aguentou. A saída se abre.'
      : this.objective?.kind === 'escapar' ? 'O grupo escapa.'
      : 'Inimigos derrotados.';
    this.emit({ type: 'end', outcome, text: texto });
  }

  // ---------- vantagem ----------

  // Junta as condicoes dos dois lados mais o contexto da jogada.
  computeAdvantage(attacker, target, { ranged = false, withinReach = true, extra = {} } = {}) {
    const a = attacker.conditionSummary;
    const t = target.conditionSummary;
    const reasons = { advantage: [], disadvantage: [] };

    if (a.ownAttacksHaveAdvantage) reasons.advantage.push('atacante');
    if (a.ownAttacksHaveDisadvantage) reasons.disadvantage.push('atacante');
    if (t.attacksAgainstHaveAdvantage) reasons.advantage.push('alvo');
    if (t.attacksAgainstHaveDisadvantage) reasons.disadvantage.push('alvo');

    // Caido: vantagem no corpo a corpo, desvantagem a distancia.
    const mode = ranged ? 'ranged' : 'melee';
    if (t.attacksAgainstAdvantageWhen === mode) reasons.advantage.push('alvo caído');
    if (t.attacksAgainstDisadvantageWhen === mode) reasons.disadvantage.push('alvo caído');

    // Ataque a distancia com inimigo adjacente sofre desvantagem.
    if (ranged && extra.foeAdjacent) reasons.disadvantage.push('inimigo adjacente');
    if (extra.advantage) reasons.advantage.push(extra.advantage);
    if (extra.disadvantage) reasons.disadvantage.push(extra.disadvantage);

    // Crítico automático contra alvo indefeso ao alcance.
    const autoCrit = t.critWithinReach && !ranged && withinReach;

    return {
      advantage: reasons.advantage.length > 0,
      disadvantage: reasons.disadvantage.length > 0,
      autoCrit,
      reasons,
    };
  }

  // Bonus de dado vindos de efeitos como Bless.
  rollSituationalBonus(combatant, kind) {
    const summary = combatant.conditionSummary;
    const list = kind === 'attack' ? summary.bonusToAttacks : summary.bonusToSaves;
    const fromEffects = combatant.effects
      .filter(e => e.data?.[kind === 'attack' ? 'attackBonus' : 'saveBonus'])
      .map(e => e.data[kind === 'attack' ? 'attackBonus' : 'saveBonus']);
    const all = [...list, ...fromEffects];
    if (!all.length) return { total: 0, parts: [] };
    const parts = all.map(n => rollNotation(n));
    return { total: parts.reduce((s, p) => s + p.total, 0), parts };
  }

  // ---------- ataque com arma ----------

  /**
   * Resolve uma acao de ataque. `action` vem da ficha:
   * { name, kind:'melee'|'ranged', ability, damage:{dice, type}, reach, range, extraDamage }
   */
  async attack(attacker, target, action, opts = {}) {
    if (target.dead) return { ok: false, reason: 'alvo já está fora de combate' };

    const ranged = action.kind === 'ranged';
    const adv = this.computeAdvantage(attacker, target, {
      ranged, withinReach: opts.withinReach ?? true, extra: opts,
    });

    const ability = action.ability || (ranged ? 'des' : 'for');
    const profBonus = action.proficient === false ? 0 : attacker.prof;
    const situational = this.rollSituationalBonus(attacker, 'attack');
    const mod = attacker.mod(ability) + profBonus + (action.bonus || 0) + situational.total;

    // Janela de reacao defensiva antes da rolagem (Warding Flare, Escudo).
    const preHit = await this.offerReaction(target, {
      kind: 'incoming-attack', attacker, target, action,
    });
    const extraDisadvantage = preHit?.imposeDisadvantage || false;
    const acBonus = preHit?.acBonus || 0;

    // Maldicao do Hexblade amplia a faixa de critico contra o alvo marcado.
    const curse = attacker.effects.find(e => e.data?.critRange && e.data?.markedTarget === target.id);
    const critRange = curse?.data.critRange ?? attacker.sb.critRange ?? 20;

    const roll = attackRoll({
      mod,
      ac: target.ac + acBonus,
      advantage: adv.advantage && !adv.disadvantage && !extraDisadvantage,
      disadvantage: (adv.disadvantage || extraDisadvantage) && !adv.advantage,
      critRange,
    });
    const critHit = roll.critHit || (adv.autoCrit && roll.hit);

    this.emit({
      type: 'attack-roll',
      attacker: attacker.id, target: target.id, action: action.name,
      hit: roll.hit, crit: critHit, roll,
      text: `${attacker.name} ataca ${target.name} com ${action.name}: ${describe(roll)} vs CA ${target.ac + acBonus}` +
            (adv.advantage && !adv.disadvantage ? ' (vantagem)' : '') +
            (adv.disadvantage && !adv.advantage ? ' (desvantagem)' : '') +
            ` — ${critHit ? 'crítico!' : roll.hit ? 'acerta' : 'erra'}`,
    });

    if (!roll.hit) {
      await this.offerReaction(target, { kind: 'attack-missed', attacker, target });
      return { ok: true, hit: false, roll };
    }

    const dmgMod = action.damageMod ?? attacker.mod(ability);
    const notation = `${action.damage.dice}${dmgMod ? (dmgMod > 0 ? '+' : '') + dmgMod : ''}`;
    const dmg = rollNotation(notation, { crit: critHit, min: 0 });
    this.emitAll(dealDamage(attacker, target, dmg, action.damage.type, describe(dmg)));

    // Dano extra de outro tipo (Hex, Hexblade, veneno do kapak).
    for (const extra of action.extraDamage || []) {
      const ed = rollNotation(extra.dice, { crit: critHit });
      this.emitAll(dealDamage(attacker, target, ed, extra.type, describe(ed)));
      if (extra.condition) {
        const save = checkRoll({ mod: target.saveBonus(extra.save.ability), dc: extra.save.dc });
        this.emit({
          type: 'save-roll', target: target.id, success: save.success,
          text: `${target.name} resiste com ${extra.save.ability.toUpperCase()}: ${describe(save)} vs CD ${extra.save.dc} — ${save.success ? 'passa' : 'falha'}`,
        });
        if (!save.success && target.addCondition(extra.condition)) {
          this.emit({ type: 'condition', target: target.id, condition: extra.condition, text: `${target.name} fica ${extra.condition}` });
        }
      }
    }

    // Dano extra vindo de efeito do proprio atacante preso a este alvo:
    // Hex, Marca do Cacador, Maldicao do Hexblade.
    for (const eff of attacker.effects) {
      const d = eff.data || {};
      if (!d.extraDamage) continue;
      if (d.markedTarget && d.markedTarget !== target.id) continue;
      const ed = rollNotation(d.extraDamage, { crit: critHit });
      this.emitAll(dealDamage(attacker, target, ed, d.extraDamageType || 'necrotico',
        `${eff.label}: ${describe(ed)}`));
    }

    // Gancho de morte: baaz vira pedra, bozak explode, kapak vira acido.
    if (target.down || target.dead) {
      await this.triggerDeathEffect(target, attacker);
      await this.triggerKillEffect(attacker, target);
    }

    this.checkEnd();
    return { ok: true, hit: true, crit: critHit, roll, damage: dmg.total };
  }

  // Gancho de quem derrubou. E o que o sivak usa para assumir a forma da
  // vitima; morte e efeito do morto, isto e efeito do matador.
  async triggerKillEffect(killer, victim) {
    const effect = killer?.sb?.onKill;
    if (!effect) return null;
    if (effect.once && killer._killEffectFired) return null;
    killer._killEffectFired = true;
    this.emit({
      type: 'kill-effect',
      id: killer.id, target: victim.id, effect: effect.id,
      text: effect.text ? effect.text(killer, victim) : `${killer.name}: ${effect.label}`,
    });
    if (typeof effect.resolve === 'function') {
      const events = await effect.resolve({ encounter: this, killer, victim });
      this.emitAll(events || []);
    }
    return effect;
  }

  // Efeito de morte declarado no bloco de status. Bloco 4 preenche os
  // draconianos; o motor so precisa saber chamar.
  async triggerDeathEffect(victim, killer) {
    const effect = victim.sb.onDeath;
    if (!effect || victim._deathEffectFired) return null;
    victim._deathEffectFired = true;
    this.emit({
      type: 'death-effect',
      target: victim.id, effect: effect.id,
      text: effect.text ? effect.text(victim, killer) : `${victim.name}: ${effect.label}`,
    });
    if (typeof effect.resolve === 'function') {
      const events = await effect.resolve({ encounter: this, victim, killer });
      this.emitAll(events || []);
    }
    return effect;
  }

  // ---------- reacoes ----------

  // Pergunta ao dono se quer gastar a reacao. Sem resolver, recusa.
  async offerReaction(combatant, trigger) {
    if (!combatant || combatant.down || combatant.dead) return null;
    if (!combatant.turn.reaction) return null;
    if (combatant.conditionSummary.noReaction) return null;
    if (!this.reactionResolver) return null;

    const options = this.availableReactions(combatant, trigger);
    if (!options.length) return null;

    // Ja disse que nao quer ser perguntado sobre este gatilho neste combate.
    combatant._reacoesCaladas ??= new Set();
    if (combatant._reacoesCaladas.has(trigger.kind)) return null;

    const chosen = await this.reactionResolver({ combatant, trigger, options, encounter: this });
    if (!chosen) return null;

    if (chosen.silenciar) {
      combatant._reacoesCaladas.add(trigger.kind);
      this.emit({
        type: 'reaction-silenced', id: combatant.id,
        text: `${combatant.name} guarda a reação e pede para não ser perguntado de novo neste combate`,
      });
      return null;
    }

    combatant.turn.reaction = false;
    this.emit({
      type: 'reaction',
      id: combatant.id, reaction: chosen.id,
      text: `${combatant.name} usa ${chosen.name} como reação`,
    });
    const result = await chosen.resolve({ encounter: this, combatant, trigger });
    if (result?.events) this.emitAll(result.events);
    return result || {};
  }

  // Oferece o mesmo gatilho a todos de um lado, na ordem de iniciativa.
  // Contramagia e Barreiras Prateadas nao dependem de ser o alvo.
  async offerReactionToSide(side, trigger) {
    for (const c of this.order) {
      if (c.side !== side) continue;
      const res = await this.offerReaction(c, trigger);
      // O primeiro que responde resolve o momento.
      if (res) return { responder: c, ...res };
    }
    return null;
  }

  // As reacoes que a ficha declara e cujo gatilho casa com o momento.
  availableReactions(combatant, trigger) {
    return (combatant.sb.reactions || [])
      .filter(r => r.trigger === trigger.kind)
      .filter(r => !r.available || r.available({ combatant, trigger, encounter: this }));
  }

  // Ataque de oportunidade: quem sai do alcance provoca. field.js chama isto.
  async provokeOpportunity(mover, threats) {
    for (const threat of threats) {
      if (threat.down || threat.dead || !threat.turn.reaction) continue;
      const action = (threat.sb.actions || []).find(a => a.kind === 'melee');
      if (!action) continue;
      threat.turn.reaction = false;
      this.emit({
        type: 'opportunity',
        attacker: threat.id, target: mover.id,
        text: `${mover.name} sai do alcance e provoca ataque de oportunidade de ${threat.name}`,
      });
      await this.attack(threat, mover, action, { opportunity: true });
    }
  }

  // ---------- testes fora de combate ----------

  skillCheck(combatant, skill, dc, opts = {}) {
    const summary = combatant.conditionSummary;
    const roll = checkRoll({
      mod: combatant.skillBonus(skill),
      dc,
      advantage: opts.advantage,
      disadvantage: opts.disadvantage || summary.ownChecksHaveDisadvantage,
    });
    this.emit({
      type: 'skill-check',
      id: combatant.id, skill, success: roll.success,
      text: `${combatant.name} testa ${skill}: ${describe(roll)} vs CD ${dc} — ${roll.success ? 'passa' : 'falha'}`,
    });
    return roll;
  }

  savingThrow(combatant, ability, dc, opts = {}) {
    const summary = combatant.conditionSummary;
    if (summary.autoFailSaves.includes(ability)) {
      const fail = { total: 0, natural: 0, mod: 0, rolls: [0], success: false, dc, mode: 'flat' };
      this.emit({
        type: 'save-roll', target: combatant.id, success: false,
        text: `${combatant.name} falha automaticamente em ${ability.toUpperCase()}`,
      });
      return fail;
    }
    const bonus = this.rollSituationalBonus(combatant, 'save');
    const roll = checkRoll({
      mod: combatant.saveBonus(ability) + bonus.total,
      dc,
      advantage: opts.advantage,
      disadvantage: opts.disadvantage || summary.savesWithDisadvantage.includes(ability),
    });
    this.emit({
      type: 'save-roll', target: combatant.id, success: roll.success, ability,
      text: `${combatant.name} resiste com ${ability.toUpperCase()}: ${describe(roll)} vs CD ${dc} — ${roll.success ? 'passa' : 'falha'}`,
    });
    return roll;
  }
}

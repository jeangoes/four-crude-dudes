// Bloco de status e o combatente em jogo.
//
// `defineStatblock` normaliza a ficha declarada em data/. `Combatant` e a
// instancia viva: PV atuais, condicoes, espacos gastos, posicao no grid.
// Herois e monstros usam a mesma classe; o que muda e a ficha.

import { abilityMod, proficiencyBonus, rollNotation, d20, checkRoll } from './dice.js';
import { summarize, isKnown } from './conditions.js';

export const ABILITIES = ['for', 'des', 'con', 'int', 'sab', 'car'];

export const SKILLS = {
  acrobacia: 'des', arcanismo: 'int', atletismo: 'for', atuacao: 'car',
  enganacao: 'car', furtividade: 'des', historia: 'int', intimidacao: 'car',
  intuicao: 'sab', investigacao: 'int', lidarAnimais: 'sab', medicina: 'sab',
  natureza: 'int', percepcao: 'sab', persuasao: 'car', prestidigitacao: 'des',
  religiao: 'int', sobrevivencia: 'sab',
};

const DEFAULTS = {
  abilities: { for: 10, des: 10, con: 10, int: 10, sab: 10, car: 10 },
  level: 1,
  ac: 10,
  hp: 1,
  speed: 9,               // metros, nao pes. A mesa joga em metros.
  size: 'medio',
  saveProficiencies: [],
  skillProficiencies: [],
  skillExpertise: [],
  resistances: [],
  immunities: [],
  vulnerabilities: [],
  conditionImmunities: [],
  actions: [],
  features: [],
  spellcasting: null,
  side: 'foe',
};

export function defineStatblock(raw) {
  const sb = { ...DEFAULTS, ...raw };
  sb.abilities = { ...DEFAULTS.abilities, ...(raw.abilities || {}) };
  sb.prof = raw.prof ?? proficiencyBonus(sb.level);
  sb.maxHp = raw.maxHp ?? sb.hp;
  if (!sb.id) throw new Error('bloco de status sem id');
  if (!sb.name) sb.name = sb.id;
  return sb;
}

export class Combatant {
  constructor(statblock, { side, pos } = {}) {
    this.sb = statblock;
    this.id = statblock.id;
    this.name = statblock.name;
    this.side = side || statblock.side;
    this.pos = pos ? { ...pos } : { x: 0, y: 0 };

    this.hp = statblock.maxHp;
    this.tempHp = 0;
    this.conditions = new Set();
    this.effects = [];            // efeitos com duracao: {key, label, rounds, data}
    this.concentration = null;    // {spell, targets, rounds}
    this.deathSaves = { success: 0, failure: 0 };
    this.stable = false;

    // Economia de turno, zerada no inicio de cada turno proprio.
    this.turn = { action: true, bonus: true, reaction: true, movement: this.speed };

    // Recursos gastaveis declarados na ficha: { canalizarDivindade: {max, used} }
    this.resources = {};
    for (const [key, max] of Object.entries(statblock.resources || {})) {
      this.resources[key] = { max, used: 0 };
    }

    // Espacos de magia por nivel: slots[3] = { max, used }
    this.slots = {};
    const sc = statblock.spellcasting;
    if (sc?.slots) {
      for (const [lvl, max] of Object.entries(sc.slots)) {
        this.slots[Number(lvl)] = { max, used: 0 };
      }
    }
    this.pactSlots = sc?.pact ? { level: sc.pact.level, max: sc.pact.slots, used: 0 } : null;
    this.hitDice = { max: statblock.level, used: 0, sides: statblock.hitDie || 8 };
  }

  // ---------- derivados ----------

  get level() { return this.sb.level; }
  get prof() { return this.sb.prof; }
  get maxHp() { return this.sb.maxHp; }
  get ac() { return this.sb.ac + (this.effects.find(e => e.key === 'shield')?.data?.bonus || 0); }

  get speed() {
    const s = summarize([...this.conditions]);
    return s.speedOverride !== null ? s.speedOverride : this.sb.speed;
  }

  get alive() { return this.hp > 0 || (this.side === 'ally' && !this.dead); }
  get down() { return this.hp <= 0; }
  get dead() { return this.deathSaves.failure >= 3 || this._dead === true; }

  mod(ability) { return abilityMod(this.sb.abilities[ability]); }

  saveBonus(ability) {
    const prof = this.sb.saveProficiencies.includes(ability) ? this.prof : 0;
    return this.mod(ability) + prof;
  }

  skillBonus(skill) {
    const ability = SKILLS[skill];
    if (!ability) throw new Error(`pericia desconhecida: ${skill}`);
    let prof = 0;
    if (this.sb.skillExpertise.includes(skill)) prof = this.prof * 2;
    else if (this.sb.skillProficiencies.includes(skill)) prof = this.prof;
    return this.mod(ability) + prof;
  }

  get spellSaveDC() {
    const sc = this.sb.spellcasting;
    if (!sc) return null;
    return sc.dc ?? 8 + this.prof + this.mod(sc.ability);
  }

  get spellAttack() {
    const sc = this.sb.spellcasting;
    if (!sc) return null;
    return sc.attack ?? this.prof + this.mod(sc.ability);
  }

  get initiativeBonus() { return this.mod('des') + (this.sb.initiativeBonus || 0); }

  // ---------- condicoes e efeitos ----------

  addCondition(name) {
    if (!isKnown(name)) throw new Error(`condicao desconhecida: ${name}`);
    if (this.sb.conditionImmunities.includes(name)) return false;
    this.conditions.add(name);
    return true;
  }

  removeCondition(name) { return this.conditions.delete(name); }
  has(name) { return this.conditions.has(name); }
  get conditionSummary() { return summarize([...this.conditions]); }

  addEffect(effect) {
    this.effects = this.effects.filter(e => e.key !== effect.key);
    this.effects.push({ rounds: 1, ...effect });
  }

  removeEffect(key) {
    const before = this.effects.length;
    this.effects = this.effects.filter(e => e.key !== key);
    return this.effects.length !== before;
  }

  getEffect(key) { return this.effects.find(e => e.key === key) || null; }

  // Chamado no fim do turno do dono do efeito.
  tickEffects() {
    const expired = [];
    for (const e of this.effects) {
      if (e.rounds === Infinity) continue;
      e.rounds -= 1;
      if (e.rounds <= 0) expired.push(e);
    }
    this.effects = this.effects.filter(e => !expired.includes(e));
    return expired;
  }

  // ---------- dano e cura ----------

  // Aplica resistencia, imunidade e vulnerabilidade, depois PV temporario.
  applyDamage(amount, type = 'impacto') {
    // Alvo de roteiro que nao se vence no braco: Lord Soth e um cavaleiro
    // da morte de ND 19, e a resposta certa e correr, nao lutar.
    if (this.sb.invulnerable) {
      return { taken: 0, blocked: amount, reason: 'invulnerável', type };
    }
    if (this.sb.immunities.includes(type)) {
      return { taken: 0, blocked: amount, reason: 'imunidade', type };
    }
    let dmg = amount;
    let reason = null;
    if (this.sb.resistances.includes(type)) { dmg = Math.floor(dmg / 2); reason = 'resistência'; }
    else if (this.sb.vulnerabilities.includes(type)) { dmg = dmg * 2; reason = 'vulnerabilidade'; }

    const absorbed = Math.min(this.tempHp, dmg);
    this.tempHp -= absorbed;
    const toHp = dmg - absorbed;
    const before = this.hp;
    this.hp = Math.max(0, this.hp - toHp);

    const result = { taken: dmg, toHp, absorbed, reason, type, wentDown: before > 0 && this.hp === 0 };

    if (this.hp === 0) {
      // Monstro cai morto; heroi cai inconsciente e comeca a rolar salvaguarda.
      if (this.side === 'ally') {
        this.addCondition('inconsciente');
        this.addCondition('caido');
      } else {
        this._dead = true;
      }
      this.breakConcentration('caiu a 0 PV');
    }
    return result;
  }

  heal(amount) {
    if (this.dead) return { healed: 0, revived: false };
    const before = this.hp;
    this.hp = Math.min(this.maxHp, this.hp + amount);
    const revived = before === 0 && this.hp > 0;
    if (revived) {
      this.removeCondition('inconsciente');
      this.deathSaves = { success: 0, failure: 0 };
      this.stable = false;
    }
    return { healed: this.hp - before, revived };
  }

  grantTempHp(amount) {
    // PV temporario nao acumula: fica o maior.
    if (amount > this.tempHp) { this.tempHp = amount; return true; }
    return false;
  }

  // ---------- concentracao ----------

  startConcentration(spell, data = {}) {
    const dropped = this.concentration;
    this.concentration = { spell, ...data };
    return dropped;
  }

  breakConcentration(reason = '') {
    const was = this.concentration;
    this.concentration = null;
    return was ? { spell: was.spell, reason } : null;
  }

  // CD e 10 ou metade do dano, o que for maior. War Caster da vantagem.
  concentrationCheck(damage) {
    if (!this.concentration) return null;
    const dc = Math.max(10, Math.floor(damage / 2));
    const advantage = this.sb.features?.includes('warCaster') || false;
    const roll = checkRoll({ mod: this.saveBonus('con'), dc, advantage });
    if (!roll.success) this.breakConcentration(`falhou no teste de concentração (CD ${dc})`);
    return { ...roll, kept: roll.success, spell: this.concentration?.spell };
  }

  // ---------- recursos ----------

  slotsAvailable(level) {
    const s = this.slots[level];
    const pact = this.pactSlots?.level === level ? this.pactSlots : null;
    return (s ? s.max - s.used : 0) + (pact ? pact.max - pact.used : 0);
  }

  // Gasta um espaco do nivel pedido, ou o menor disponivel acima dele.
  spendSlot(level) {
    for (let l = level; l <= 9; l++) {
      const s = this.slots[l];
      if (s && s.used < s.max) { s.used++; return { level: l, pact: false }; }
      if (this.pactSlots?.level === l && this.pactSlots.used < this.pactSlots.max) {
        this.pactSlots.used++;
        return { level: l, pact: true };
      }
    }
    return null;
  }

  useResource(key, n = 1) {
    const r = this.resources[key];
    if (!r || r.max - r.used < n) return false;
    r.used += n;
    return true;
  }

  resourceLeft(key) {
    const r = this.resources[key];
    return r ? r.max - r.used : 0;
  }

  // ---------- descanso ----------

  shortRest({ spendHitDice = 0 } = {}) {
    const healed = [];
    for (let i = 0; i < spendHitDice; i++) {
      if (this.hitDice.used >= this.hitDice.max) break;
      this.hitDice.used++;
      const r = rollNotation(`1d${this.hitDice.sides}+${this.mod('con')}`, { min: 1 });
      healed.push(r);
      this.heal(r.total);
    }
    if (this.pactSlots) this.pactSlots.used = 0;
    for (const [key, r] of Object.entries(this.resources)) {
      if (this.sb.shortRestResources?.includes(key)) r.used = 0;
    }
    return { healed, hp: this.hp };
  }

  longRest() {
    this.hp = this.maxHp;
    this.tempHp = 0;
    this.deathSaves = { success: 0, failure: 0 };
    this._dead = false;
    this.stable = false;
    this.conditions.clear();
    this.effects = [];
    this.breakConcentration('descanso longo');
    for (const s of Object.values(this.slots)) s.used = 0;
    if (this.pactSlots) this.pactSlots.used = 0;
    for (const r of Object.values(this.resources)) r.used = 0;
    // Recupera metade dos dados de vida, arredondando para baixo, minimo 1.
    this.hitDice.used = Math.max(0, this.hitDice.used - Math.max(1, Math.floor(this.hitDice.max / 2)));
    return { hp: this.hp };
  }

  // ---------- salvaguardas contra a morte ----------

  rollDeathSave() {
    if (this.side !== 'ally' || this.hp > 0 || this.dead) return null;
    const r = d20({});
    if (r.natural === 20) {
      this.heal(1);
      return { ...r, outcome: 'revived' };
    }
    if (r.natural === 1) {
      this.deathSaves.failure += 2;
    } else if (r.total >= 10) {
      this.deathSaves.success += 1;
    } else {
      this.deathSaves.failure += 1;
    }
    if (this.deathSaves.success >= 3) { this.stable = true; return { ...r, outcome: 'stable' }; }
    if (this.deathSaves.failure >= 3) { this._dead = true; return { ...r, outcome: 'dead' }; }
    return { ...r, outcome: r.total >= 10 ? 'success' : 'failure' };
  }

  // ---------- turno ----------

  beginTurn() {
    const s = this.conditionSummary;
    this.turn = {
      action: !s.noAction,
      bonus: !s.noBonusAction,
      reaction: this.turn?.reaction ?? true,
      movement: this.speed,
    };
    return this.turn;
  }

  endTurn() {
    return this.tickEffects();
  }

  // Reacao volta no inicio do proprio turno, nao no fim.
  refreshReaction() {
    const s = this.conditionSummary;
    this.turn.reaction = !s.noReaction;
  }
}

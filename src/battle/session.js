// A sessao de batalha: amarra motor de regras, campo, desenho, IA e HUD.
//
// O turno do jogador e uma maquina de estados pequena (escolhendo comando →
// escolhendo alvo → resolvendo). O turno do inimigo e um plano executado e
// animado. Tudo que muda estado passa pelo Encounter, nunca por aqui.

import { Encounter } from '../rules/combat.js';
import { canCast } from '../rules/spells.js';
import { rollNotation, describe } from '../rules/dice.js';
import { Field, moverCursor, celulaMaisProxima, proximoAlvo } from './field.js';
import { BattleView } from './view.js';
import { Animator } from './animator.js';
import { planTurn } from './ai.js';
import { kitDisponivel } from '../rules/progression.js';
import { BattleHUD, askReaction } from '../ui/hud.js';
import { CombatLog } from '../ui/log.js';
import { attachPointer, on } from '../engine/input.js';
import { SFX, playTrack, duckTrack } from '../engine/audio.js';

const MODE = { IDLE: 'idle', COMMAND: 'command', TARGET: 'target', MOVE: 'move', BUSY: 'busy', OVER: 'over' };
const DIR_TECLA = new Set(['up', 'down', 'left', 'right']);

export class BattleSession {
  constructor({ canvas, field, party, foes, track = 'vogler', backdrop = null, name = 'Encontro',
                objective = { kind: 'derrotar' } }) {
    this.field = field;
    this.canvas = canvas;
    this.view = new BattleView(canvas, field);
    this.view.backdrop = backdrop;
    this.anim = new Animator();
    this.hud = new BattleHUD();
    this.log = new CombatLog(document.getElementById('combat-log-entries'), document.getElementById('combat-log'));
    this.track = track;

    this.encounter = new Encounter({
      name,
      combatants: [...party, ...foes],
      objective,
      onEvent: e => this.onEvent(e),
      reactionResolver: ctx => askReaction(ctx),
    });
    // Os efeitos de morte (estátua do baaz, poça do kapak) mexem no chao,
    // entao o motor precisa enxergar o campo.
    this.encounter.field = field;

    this.mode = MODE.IDLE;
    this.pending = null;          // comando aguardando alvo
    this.submenu = null;          // 'magia' | 'talentos' | null
    this.reachMap = null;
    this.running = false;
    this.detachers = [];
    this.onFinish = null;
  }

  // ---------- ciclo de vida ----------

  start() {
    this.running = true;
    this.log.clear();
    playTrack(this.track);
    this.bindInput();
    this.startTicker();
    this.encounter.rollInitiative();
    this.hud.setRound(1);
    this.refreshHud();
    this.advance();
  }

  stop() {
    this.running = false;
    clearInterval(this.watchdog);
    for (const off of this.detachers) off();
    this.detachers = [];
    this.hud.clearCommands();
  }

  // O relogio do jogo.
  //
  // requestAnimationFrame para de disparar quando a aba vai para segundo
  // plano. Como o fluxo do turno espera as animacoes terminarem, depender
  // so dele trava a batalha para sempre se o jogador trocar de aba. O
  // watchdog assume o passo quando o rAF silencia.
  startTicker() {
    let last = performance.now();
    let lastFrame = performance.now();

    const tick = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      this.anim.update(dt);
      this.view.update(dt);
      // Desenhar em aba oculta e desperdicio; a logica precisa correr, o
      // pixel nao.
      if (!document.hidden) this.view.draw();
    };

    const frame = () => {
      if (!this.running) return;
      lastFrame = performance.now();
      tick();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    this.watchdog = setInterval(() => {
      if (!this.running) return;
      if (performance.now() - lastFrame > 200) tick();
    }, 60);
  }

  // ---------- eventos do motor ----------

  onEvent(e) {
    this.log.push(e);

    if (e.type === 'round') {
      this.hud.setRound(e.round);
      if (e.round > 1) this.tickHazards();
      const obj = this.encounter.objective;
      if (obj?.kind === 'sobreviver') {
        const faltam = obj.rounds - e.round + 1;
        if (faltam > 0) { this.hud.showBanner(`Aguente mais ${faltam} rodada${faltam > 1 ? 's' : ''}`, 1600); SFX.tick(); }
      }
    }
    if (e.type === 'damage') {
      const t = this.encounter.find(e.target);
      if (t) { this.view.addFloating(t.pos, `-${e.amount}`, '#ff8a75'); this.view.hit(e.amount > 15 ? 1.6 : 1); }
    }
    if (e.type === 'heal') {
      const t = this.encounter.find(e.target);
      if (t) this.view.addFloating(t.pos, `+${e.amount}`, '#9cffb0');
    }
    if (e.type === 'attack-roll' && !e.hit) {
      const t = this.encounter.find(e.target);
      if (t) this.view.addFloating(t.pos, 'errou', '#8d8172');
      SFX.miss();
    }
    if (e.type === 'attack-roll' && e.hit) (e.crit ? SFX.crit() : SFX.hitSlash());
    if (e.type === 'save-roll') {
      const t = this.encounter.find(e.target);
      if (t) this.view.addFloating(t.pos, e.success ? 'resistiu' : 'falhou', e.success ? '#9cffb0' : '#ffb37a');
    }
    if (e.type === 'condition') {
      const t = this.encounter.find(e.target);
      if (t) this.view.addFloating(t.pos, e.condition, '#f0c94a');
    }
    if (e.type === 'down') SFX.down();
    if (e.type === 'cast') SFX.spell();
    if (e.type === 'end') {
      this.mode = MODE.OVER;
      this.hud.clearCommands();
      this.hud.showBanner(e.outcome === 'vitoria' ? 'Vitória' : 'O grupo tombou', 0);
      duckTrack(3);
      e.outcome === 'vitoria' ? SFX.victory() : SFX.defeat();
      setTimeout(() => this.onFinish?.(e.outcome), 1200);
    }

    this.refreshHud();
  }

  refreshHud() {
    this.hud.renderInitiative(this.encounter.order, this.encounter.current);
    this.hud.renderParty(this.encounter.allies, this.encounter.current);
  }

  // ---------- fluxo de turnos ----------

  async advance() {
    if (this.encounter.finished) return;
    const c = this.encounter.current;
    if (!c) return;

    this.view.clearOverlays();
    this.refreshHud();

    // Terreno que fere cobra de quem comeca o turno em cima dele.
    if (!c.dead && !c.down) await this.applyTerrainDamage(c);
    if (this.encounter.finished) return;

    // Sem turno util: morto, caido ainda rolando, ou incapacitado.
    if (c.dead || (c.down && c.side === 'ally') || c.conditionSummary.noAction) {
      await this.anim.wait(0.35);
      return this.endTurn();
    }

    if (c.side === 'ally') {
      this.hud.showBanner(c.name, 900);
      this.openCommandMenu(c);
    } else {
      this.mode = MODE.BUSY;
      this.hud.clearCommands();
      await this.anim.wait(0.35);
      await this.runEnemyTurn(c);
      return this.endTurn();
    }
  }

  // Uma vez por rodada. Perigo com contagem regressiva (a energia do aurak)
  // detona ao acabar, e o estouro precisa virar evento como qualquer outro.
  tickHazards() {
    const expirados = this.field.tickHazards();
    for (const h of expirados) {
      if (typeof h.onExpire !== 'function') continue;
      const eventos = h.onExpire({ encounter: this.encounter, hazard: h, field: this.field }) || [];
      this.encounter.emitAll(eventos);
      for (const cell of h.cells || []) this.view.addFloating(cell, '!', '#ff7043');
      this.view.hit(2);
    }
    if (expirados.length) this.encounter.checkEnd();
  }

  // Poça de ácido do kapak, chamas: dano ao começar o turno em cima.
  async applyTerrainDamage(c) {
    const t = this.field.terrainAt(c.pos);
    if (!t.damage) return;
    const dmg = rollNotation(t.damage.dice);
    const res = c.applyDamage(dmg.total, t.damage.type);
    this.encounter.emit({
      type: 'damage', target: c.id, amount: res.taken, damageType: t.damage.type, wentDown: res.wentDown,
      text: `${c.name} começa o turno em ${t.label} e sofre ${res.taken} de ${t.damage.type} (${describe(dmg)})`,
    });
    await this.anim.recoil(c, this.view, 0.6);
    this.encounter.checkEnd();
  }

  async endTurn() {
    this.mode = MODE.BUSY;
    this.view.clearOverlays();
    this.hud.clearCommands();
    const next = this.encounter.endTurn();
    if (!next || this.encounter.finished) return;
    return this.advance();
  }

  // ---------- turno do jogador ----------

  openCommandMenu(actor) {
    this.mode = MODE.COMMAND;
    this.pending = null;
    this.submenu = null;
    this.view.clearOverlays();

    const melee = (actor.sb.actions || []).filter(a => a.kind === 'melee' || a.kind === 'ranged');
    // O menu mostra so o que o nivel atual ja liberou. Bola de Fogo nao
    // aparece cinza no capitulo I: ela ainda nao existe.
    const kit = kitDisponivel(actor);
    const spells = kit.spells;

    const commands = [];

    for (const action of melee) {
      const targets = this.targetsFor(actor, action);
      commands.push({
        id: `atk:${action.name}`,
        label: action.name,
        detail: action.detail || `${action.kind === 'ranged' ? 'Ataque à distância' : 'Ataque corpo a corpo'}, ${action.damage.dice} de ${action.damage.type}.`,
        rule: `Alcance ${action.kind === 'ranged' ? (action.range || 18) : (action.reach || 1.5)} m · usa a ação`,
        disabled: !actor.turn.action || targets.length === 0,
        reason: !actor.turn.action ? 'ação já usada neste turno' : 'nenhum alvo ao alcance',
        run: () => this.beginTargeting(actor, { kind: 'attack', action }),
      });
    }

    const talents = kit.talents;
    if (talents.length) {
      commands.push({
        id: 'talentos',
        label: 'Talentos',
        detail: `${talents.length} recurso(s) de classe.`,
        rule: 'Canalizar Divindade, maldições, fôlego',
        disabled: !talents.some(t => this.talentUsable(actor, t)),
        reason: 'nenhum talento disponível agora',
        run: () => this.openTalentMenu(actor),
      });
    }

    if (spells.length) {
      commands.push({
        id: 'magia',
        label: 'Magia',
        detail: `${spells.length} magia(s) preparada(s).`,
        rule: 'Escolha a magia e o nível do espaço',
        disabled: !actor.turn.action && !actor.turn.bonus,
        reason: 'sem ação nem ação bônus',
        run: () => this.openSpellMenu(actor),
      });
    }

    commands.push({
      id: 'mover',
      label: 'Mover',
      detail: `Até ${actor.turn.movement} m de deslocamento.`,
      rule: 'Sair do alcance de um inimigo provoca ataque de oportunidade',
      disabled: actor.turn.movement <= 0 || actor.speed === 0,
      reason: actor.speed === 0 ? 'deslocamento zerado por condição' : 'movimento já gasto',
      run: () => this.beginMove(actor),
    });

    commands.push({
      id: 'esquivar',
      label: 'Esquivar',
      detail: 'Ataques contra você têm desvantagem até o seu próximo turno.',
      rule: 'Usa a ação',
      disabled: !actor.turn.action,
      reason: 'ação já usada neste turno',
      run: () => this.takeDodge(actor),
    });

    commands.push({
      id: 'passar',
      label: 'Encerrar turno',
      detail: 'Passa a vez.',
      disabled: false,
      run: () => this.endTurn(),
    });

    this.hud.renderCommands(commands, cmd => { SFX.select(); cmd.run(); });
  }

  openSpellMenu(actor) {
    this.submenu = 'magia';
    const spells = kitDisponivel(actor).spells;
    const commands = spells.map(spell => {
      const check = canCast(actor, spell);
      const needsAction = spell.castTime !== 'bonus';
      const hasEconomy = needsAction ? actor.turn.action : actor.turn.bonus;
      const targets = this.targetsFor(actor, spell);
      return {
        id: `spell:${spell.id}`,
        label: spell.name,
        cost: spell.level === 0 ? 'truque' : `${spell.level}º`,
        detail: spell.detail || '',
        rule: [
          spell.castTime === 'bonus' ? 'ação bônus' : 'ação',
          spell.range ? `alcance ${spell.range} m` : 'pessoal',
          spell.concentration ? 'concentração' : null,
          spell.save ? `resistência de ${spell.save.ability.toUpperCase()} CD ${actor.spellSaveDC}` : null,
        ].filter(Boolean).join(' · '),
        disabled: !check.ok || !hasEconomy || targets.length === 0,
        reason: !check.ok ? check.reason : !hasEconomy ? 'sem economia de ação' : 'nenhum alvo válido',
        run: () => this.beginTargeting(actor, { kind: 'spell', spell }),
      };
    });

    commands.push({ id: 'voltar', label: '← Voltar', disabled: false, run: () => this.openCommandMenu(actor) });
    this.hud.renderCommands(commands, cmd => { SFX.select(); cmd.run(); });
  }

  talentUsable(actor, talent) {
    if (talent.resource && actor.resourceLeft(talent.resource) <= 0) return false;
    if (talent.castTime === 'bonus') return actor.turn.bonus;
    if (talent.castTime === 'livre') return true;
    return actor.turn.action;
  }

  openTalentMenu(actor) {
    this.submenu = 'talentos';
    const commands = kitDisponivel(actor).talents.map(talent => {
      const restante = talent.resource ? actor.resourceLeft(talent.resource) : null;
      const alvos = this.targetsFor(actor, talent);
      const precisaAlvo = talent.range > 0 && !talent.area;
      return {
        id: `talent:${talent.id}`,
        label: talent.name,
        cost: restante === null ? '' : `${restante}x`,
        detail: talent.detail || '',
        rule: talent.rule || '',
        disabled: !this.talentUsable(actor, talent) || (precisaAlvo && alvos.length === 0),
        reason: talent.resource && actor.resourceLeft(talent.resource) <= 0
          ? 'recurso esgotado' : 'sem economia de ação ou sem alvo',
        run: () => this.useTalent(actor, talent),
      };
    });
    commands.push({ id: 'voltar', label: '← Voltar', disabled: false, run: () => this.openCommandMenu(actor) });
    this.hud.renderCommands(commands, cmd => { SFX.select(); cmd.run(); });
  }

  async useTalent(actor, talent) {
    // Talento centrado em si mesmo resolve na hora; o que mira alguem passa
    // pela selecao de alvo como uma magia.
    if (talent.range > 0 && !talent.area) {
      return this.beginTargeting(actor, { kind: 'talent', talent, spell: talent });
    }
    this.mode = MODE.BUSY;
    this.view.clearOverlays();

    const alvos = talent.area
      ? this.field.occupantsOf(this.areaCells(talent, actor.pos))
      : [actor];

    if (talent.resource) actor.useResource(talent.resource);
    if (talent.castTime === 'bonus') actor.turn.bonus = false;
    else if (talent.castTime !== 'livre') actor.turn.action = false;

    this.encounter.emit({
      type: 'talent', id: actor.id, talent: talent.id,
      text: `${actor.name} usa ${talent.name}`,
    });
    if (talent.area) {
      await this.anim.burst(this.areaCells(talent, actor.pos), this.view, { color: talent.color || '#f0c94a' });
      this.view.hit(1.5);
    }
    const eventos = talent.resolve({ encounter: this.encounter, actor, targets: alvos, field: this.field }) || [];
    this.encounter.emitAll(eventos);
    this.encounter.checkEnd();
    if (!this.encounter.finished) this.openCommandMenu(actor);
  }

  // ---------- selecao de alvo ----------

  targetsFor(actor, spec) {
    const range = spec.kind === 'ranged' ? (spec.range || 18)
      : spec.range !== undefined ? spec.range
      : (spec.reach || 1.5);

    // Magia de area mira quadrado, nao criatura; qualquer quadrado visivel vale.
    if (spec.area) {
      return this.cellsWithin(actor, range).filter(cell => this.field.hasLineOfSight(actor.pos, cell));
    }

    const wantsAlly = spec.heal || spec.targetSide === 'ally';
    return this.encounter.combatants.filter(c => {
      if (c.dead) return false;
      if (wantsAlly ? c.side !== actor.side : c.side === actor.side) return false;
      if (!wantsAlly && c.down && c.side === 'ally') return false;
      if (!this.field.inRange(actor, c, range)) return false;
      return this.field.hasLineOfSight(actor.pos, c.pos);
    });
  }

  cellsWithin(actor, meters) {
    const out = [];
    for (let y = 0; y < this.field.rows; y++) {
      for (let x = 0; x < this.field.cols; x++) {
        if (this.field.inRange(actor.pos, { x, y }, meters)) out.push({ x, y });
      }
    }
    return out;
  }

  beginTargeting(actor, pending) {
    this.mode = MODE.TARGET;
    this.pending = { actor, ...pending };
    const spec = pending.spell || pending.action;
    const targets = this.targetsFor(actor, spec);
    this.pending.targets = targets;

    const cells = spec.area
      ? targets
      : targets.map(t => t.pos);

    // Alcance que cobre o campo inteiro nao informa nada e ainda atrapalha a
    // leitura da area. Bola de Fogo tem 45 m num tabuleiro de 18.
    const cobreTudo = spec.area && cells.length > this.field.cols * this.field.rows * 0.8;
    this.view.setOverlay(
      spec.heal ? 'heal' : pending.kind === 'spell' ? 'spell' : 'attack',
      cobreTudo ? [] : cells);
    this.hud.showBanner(spec.area ? 'Escolha o centro da área' : 'Escolha o alvo', 1100);

    // O cursor nasce no alvo mais perto de quem age. Quem joga no teclado
    // confirma sem mexer; quem joga no mouse nem percebe, porque o proximo
    // hover manda.
    this.setCursor(celulaMaisProxima(actor.pos, cells) || actor.pos);

    this.hud.renderCommands([
      { id: 'cancelar', label: '← Cancelar', disabled: false, run: () => this.openCommandMenu(actor) },
    ], cmd => { SFX.cancel(); cmd.run(); });
  }

  beginMove(actor) {
    this.mode = MODE.MOVE;
    this.reachMap = this.field.reachable(actor, actor.turn.movement);
    this.view.setOverlay('move', [...this.reachMap.values()].map(v => v.cell));
    this.setCursor({ ...actor.pos });
    this.hud.showBanner('Escolha o destino', 1100);
    this.hud.renderCommands([
      { id: 'cancelar', label: '← Cancelar', disabled: false, run: () => { this.view.clearOverlays(); this.openCommandMenu(actor); } },
    ], cmd => { SFX.cancel(); cmd.run(); });
  }

  async takeDodge(actor) {
    actor.turn.action = false;
    actor.addEffect({ key: 'esquiva', label: 'Esquivando', rounds: 1, data: { dodging: true } });
    this.encounter.emit({ type: 'dodge', id: actor.id, text: `${actor.name} se esquiva: ataques contra ele têm desvantagem` });
    SFX.select();
    this.openCommandMenu(actor);
  }

  // O Esc tem dono. Quando a batalha esta no meio de escolher alvo, de
  // mover, ou dentro de um submenu, ele volta um passo em vez de abrir a
  // pausa. Quem escuta o teclado consulta isto antes de decidir.
  escVolta() {
    if (!this.running || this.encounter.finished) return false;
    if (this.mode === MODE.TARGET || this.mode === MODE.MOVE) {
      SFX.cancel();
      this.view.clearOverlays();
      this.openCommandMenu(this.encounter.current);
      return true;
    }
    if (this.mode === MODE.COMMAND && this.submenu) {
      SFX.cancel();
      this.openCommandMenu(this.encounter.current);
      return true;
    }
    return false;
  }

  // ---------- entrada ----------

  bindInput() {
    this.detachers.push(attachPointer(this.canvas, {
      toCell: (x, y) => this.view.pixelToCell(x, y),
    }));

    this.detachers.push(on('hover', ({ cell }) => this.setCursor(cell)));

    this.detachers.push(on('pick', ({ cell }) => this.onPick(cell)));

    this.detachers.push(on('action', ({ action }) => {
      if (this.anim.busy) { this.anim.skipAll(); return; }

      // Escolher alvo ou destino e coisa do campo, nao do menu. Nesses dois
      // modos o menu so tem "Cancelar", entao as setas e o confirmar
      // pertencem ao cursor. Sem isto o teclado nao joga: o confirmar caia
      // no Cancelar e voltava ao comando.
      if (this.mode === MODE.TARGET || this.mode === MODE.MOVE) {
        if (DIR_TECLA.has(action)) {
          this.setCursor(moverCursor(this.view.cursor, action, this.field.cols, this.field.rows));
          return;
        }
        if (action === 'next' || action === 'prev') { this.cicloAlvo(action === 'next' ? 1 : -1); return; }
        if (action === 'confirm') { this.onPick(this.view.cursor); return; }
        return;
      }

      if (action === 'up') this.hud.move(-1);
      if (action === 'down') this.hud.move(1);
      if (action === 'confirm') this.hud.confirm();
      // O Esc e resolvido em main.js, que consulta escVolta() antes de
      // abrir a pausa. Deixar os dois tratarem abriria a pausa por cima.
    }));
  }

  // Um so lugar decide o que acontece quando o cursor muda de quadrado,
  // venha ele do ponteiro ou das setas. Foi o que faltava para o teclado.
  setCursor(cell) {
    this.view.cursor = cell;
    if (this.mode === MODE.MOVE && cell && this.reachMap) {
      this.view.path = this.field.pathFrom(this.reachMap, this.encounter.current, cell);
    } else if (this.mode === MODE.TARGET && cell) {
      this.previewArea(cell);
    } else {
      this.view.path = null;
    }
  }

  // Tab, Q e E saltam de alvo em alvo. Numa sala com seis inimigos, andar
  // quadrado a quadrado ate o do outro canto seria castigo.
  cicloAlvo(passo) {
    if (this.mode !== MODE.TARGET) return;
    const spec = this.pending?.spell || this.pending?.action;
    const cells = spec?.area ? this.pending.targets : (this.pending?.targets || []).map(t => t.pos);
    const proximo = proximoAlvo(cells, this.view.cursor, passo);
    if (proximo) { SFX.select(); this.setCursor(proximo); }
  }

  // Mostra a area coberta antes de confirmar. E o que torna Bola de Fogo
  // uma decisao em vez de um chute.
  previewArea(cell) {
    const spec = this.pending?.spell || this.pending?.action;
    if (!spec?.area) return;
    const cells = this.areaCells(spec, cell);
    const atingidos = this.field.occupantsOf(cells);
    this.view.setOverlay('danger', cells);
    // Aliado dentro da area precisa saltar aos olhos.
    const aliados = atingidos.filter(c => c.side === 'ally');
    if (aliados.length) this.view.setOverlay('heal', aliados.map(a => a.pos));
    else this.view.setOverlay('heal', []);
  }

  areaCells(spec, center) {
    if (spec.area.shape === 'esfera') return this.field.cellsInSphere(center, spec.area.radius);
    if (spec.area.shape === 'cubo') return this.field.cellsInCube(center, spec.area.side);
    if (spec.area.shape === 'cone') return this.field.cellsInCone(this.pending.actor.pos, center, spec.area.length);
    if (spec.area.shape === 'linha') return this.field.cellsInLine(this.pending.actor.pos, center, spec.area.length, spec.area.width);
    return [center];
  }

  async onPick(cell) {
    if (!cell || this.anim.busy) return;
    const actor = this.encounter.current;

    if (this.mode === MODE.MOVE) {
      const entry = this.reachMap?.get(this.field.key(cell));
      if (!entry) return;
      const path = this.field.pathFrom(this.reachMap, actor, cell);
      if (!path) return;
      this.mode = MODE.BUSY;
      this.view.clearOverlays();
      await this.moveActor(actor, path, entry.cost);
      if (!this.encounter.finished) this.openCommandMenu(actor);
      return;
    }

    if (this.mode === MODE.TARGET) {
      const spec = this.pending.spell || this.pending.action;
      this.mode = MODE.BUSY;
      this.view.clearOverlays();

      if (spec.area) {
        const valid = this.pending.targets.some(c => c.x === cell.x && c.y === cell.y);
        if (!valid) { this.beginTargeting(actor, this.pending); return; }
        await this.resolveArea(actor, this.pending, cell);
      } else {
        const target = this.pending.targets.find(t => t.pos.x === cell.x && t.pos.y === cell.y);
        if (!target) { this.beginTargeting(actor, this.pending); return; }
        await this.resolveSingle(actor, this.pending, target);
      }

      if (!this.encounter.finished) this.openCommandMenu(actor);
    }
  }

  // ---------- execucao ----------

  async moveActor(actor, path, cost) {
    // Provoca oportunidade ao deixar o alcance de quem ameaca a origem.
    const before = this.field.threatsAt(actor.pos, actor.side);
    await this.anim.walk(actor, path, this.view);
    actor.turn.movement = Math.max(0, actor.turn.movement - cost);

    const stillNear = new Set(this.field.threatsAt(actor.pos, actor.side).map(t => t.id));
    const left = before.filter(t => !stillNear.has(t.id));
    if (left.length) await this.encounter.provokeOpportunity(actor, left);

    // Terreno que machuca cobra ao parar em cima.
    const hazard = this.field.terrainAt(actor.pos);
    if (hazard.damage) {
      this.encounter.emit({ type: 'hazard', target: actor.id, text: `${actor.name} para sobre ${hazard.label}` });
    }
  }

  async resolveSingle(actor, pending, target) {
    if (pending.kind === 'attack') {
      const ranged = pending.action.kind === 'ranged';
      if (ranged) {
        await this.anim.projectile(actor.pos, target.pos, this.view, { color: '#f0c94a' });
      } else {
        await this.anim.lunge(actor, target, this.view);
      }
      actor.turn.action = false;
      const foeAdjacent = ranged && this.field.threatsAt(actor.pos, actor.side).length > 0;
      const res = await this.encounter.attack(actor, target, pending.action, { foeAdjacent });
      if (res.hit) await this.anim.recoil(target, this.view, res.crit ? 1.6 : 1);
      return;
    }

    // talento com alvo unico (Maldicao do Hexblade)
    if (pending.kind === 'talent') {
      const talent = pending.talent;
      if (talent.resource) actor.useResource(talent.resource);
      if (talent.castTime === 'bonus') actor.turn.bonus = false;
      else if (talent.castTime !== 'livre') actor.turn.action = false;
      this.encounter.emit({ type: 'talent', id: actor.id, talent: talent.id, text: `${actor.name} usa ${talent.name}` });
      const eventos = talent.resolve({ encounter: this.encounter, actor, targets: [target], field: this.field }) || [];
      this.encounter.emitAll(eventos);
      this.encounter.checkEnd();
      return;
    }

    // magia de alvo unico
    const spell = pending.spell;
    if (spell.castTime === 'bonus') actor.turn.bonus = false; else actor.turn.action = false;
    if (spell.range > 1.5) {
      await this.anim.projectile(actor.pos, target.pos, this.view, { color: spell.color || '#b388ff' });
    }
    const res = await this.encounter.resolveSpell(actor, spell, [target], {});
    if (res.events.some(e => e.type === 'damage')) await this.anim.recoil(target, this.view);
  }

  async resolveArea(actor, pending, center) {
    const spell = pending.spell;
    const cells = this.areaCells(spell, center);
    const alvos = this.field.occupantsOf(cells);

    if (spell.castTime === 'bonus') actor.turn.bonus = false; else actor.turn.action = false;

    await this.anim.projectile(actor.pos, center, this.view, { color: spell.color || '#ff7043', size: 7 });
    await this.anim.burst(cells, this.view, { color: spell.color || '#ff7043' });
    this.view.hit(2);

    // Esculpir Magias: poupa os aliados apanhados na area, ate o limite.
    const spared = alvos.filter(c => c.side === actor.side);
    await this.encounter.resolveSpell(actor, spell, alvos, { spared });
  }

  // ---------- turno do inimigo ----------

  async runEnemyTurn(actor) {
    this.hud.showBanner(actor.name, 800);
    const plan = planTurn(actor, { field: this.field, encounter: this.encounter });

    if (plan.kind === 'wait') {
      this.encounter.emit({ type: 'wait', id: actor.id, text: `${actor.name} aguarda (${plan.reason})` });
      await this.anim.wait(0.4);
      return;
    }

    if (plan.path?.length > 1) {
      const cost = (plan.path.length - 1) * 1.5;
      await this.moveActor(actor, plan.path, cost);
      if (this.encounter.finished) return;
    }

    if (plan.kind === 'move') { await this.anim.wait(0.2); return; }

    const target = plan.target;
    if (!target || target.dead) return;
    if (!this.field.inRange(actor, target, plan.action.kind === 'ranged' ? (plan.action.range || 18) : (plan.action.reach || 1.5))) {
      this.encounter.emit({ type: 'wait', id: actor.id, text: `${actor.name} não alcança ${target.name}` });
      return;
    }

    // Conjuracao inimiga para o jogo e pergunta ao grupo. E o momento em
    // que Contramagia existe.
    if (plan.action.isSpell) {
      this.hud.showBanner(`${actor.name} conjura ${plan.action.spellName}`, 1200);
      const resposta = await this.encounter.offerReactionToSide('ally', {
        kind: 'enemy-casting',
        caster: actor,
        spellName: plan.action.spellName,
        spellLevel: plan.action.spellLevel,
      });
      if (resposta?.countered) {
        this.encounter.emit({
          type: 'countered', id: actor.id,
          text: `${plan.action.spellName} de ${actor.name} não se completa`,
        });
        actor.turn.action = false;
        return;
      }
    }

    if (plan.action.kind === 'ranged') {
      await this.anim.projectile(actor.pos, target.pos, this.view, { color: '#ff7043' });
    } else {
      await this.anim.lunge(actor, target, this.view);
    }
    actor.turn.action = false;
    const res = await this.encounter.attack(actor, target, plan.action, {});
    if (res.hit) await this.anim.recoil(target, this.view, res.crit ? 1.6 : 1);
  }
}

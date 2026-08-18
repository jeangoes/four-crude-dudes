// Desenho do campo. Camera de cima em angulo: a grade e quadrada mas
// achatada na vertical, e os sprites ficam em pe sobre o quadrado. E o que
// Fire Emblem faz, e e o que mantem util o sprite parado de frente.

import { spriteFor } from '../engine/render.js';
import { TERRAIN } from './field.js';

// Proporcao escolhida para o sprite ficar com cerca de 1,6 vez a altura do
// quadrado: alto o bastante para ler como personagem, baixo o bastante para
// nao cobrir a fileira de tras inteira.
export const TILE_W = 66;
export const TILE_H = 46;

const SPRITE_W = 56;
const SPRITE_H = 74;
const LIFT = 12;                 // quanto o sprite sobe acima do centro do piso

const OVERLAY = {
  move:   { fill: 'rgba(90,140,220,0.26)',  stroke: 'rgba(140,190,255,0.7)' },
  attack: { fill: 'rgba(200,60,50,0.26)',   stroke: 'rgba(255,120,110,0.75)' },
  spell:  { fill: 'rgba(200,140,40,0.28)',  stroke: 'rgba(255,205,90,0.8)' },
  heal:   { fill: 'rgba(80,190,120,0.26)',  stroke: 'rgba(150,255,190,0.75)' },
  danger: { fill: 'rgba(160,40,120,0.30)',  stroke: 'rgba(240,110,200,0.8)' },
};

export class BattleView {
  constructor(canvas, field) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.field = field;
    this.originX = Math.floor((canvas.width - field.cols * TILE_W) / 2);
    this.originY = Math.floor((canvas.height - field.rows * TILE_H) / 2) + 40;

    this.cursor = null;          // quadrado sob o ponteiro
    this.overlays = [];          // [{ cells, kind }]
    this.path = null;
    this.floating = [];          // numeros de dano subindo
    this.shake = 0;
    this.backdrop = null;        // paleta do capitulo
  }

  // ---------- conversao ----------

  cellToPixel(cell) {
    return {
      x: this.originX + cell.x * TILE_W,
      y: this.originY + cell.y * TILE_H,
    };
  }

  cellCenter(cell) {
    const p = this.cellToPixel(cell);
    return { x: p.x + TILE_W / 2, y: p.y + TILE_H / 2 };
  }

  pixelToCell(px, py) {
    const x = Math.floor((px - this.originX) / TILE_W);
    const y = Math.floor((py - this.originY) / TILE_H);
    return this.field.inBounds({ x, y }) ? { x, y } : null;
  }

  // ---------- estado de desenho ----------

  setOverlay(kind, cells) {
    this.overlays = this.overlays.filter(o => o.kind !== kind);
    if (cells?.length) this.overlays.push({ kind, cells });
  }

  clearOverlays() { this.overlays = []; this.path = null; }

  addFloating(cell, text, color = '#f0c94a') {
    const c = this.cellCenter(cell);
    // Resistência, dano e condição costumam sair no mesmo instante, no mesmo
    // quadrado. Empilha em vez de sobrepor.
    const empilhados = this.floating.filter(f => Math.abs(f.x - c.x) < TILE_W * 0.8 && f.life > 0.7).length;
    this.floating.push({
      x: c.x,
      y: c.y - SPRITE_H + LIFT - 14 - empilhados * 17,
      text, color, life: 1.2, max: 1.2,
    });
  }

  hit(strength = 1) { this.shake = Math.max(this.shake, 5 * strength); }

  // ---------- laco ----------

  update(dt) {
    for (const f of this.floating) { f.y -= 26 * dt; f.life -= dt; }
    this.floating = this.floating.filter(f => f.life > 0);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - 26 * dt);
  }

  draw() {
    const { ctx, canvas } = this;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake);
    }

    this.drawBackdrop();
    this.drawFloor();
    this.drawOverlays();
    this.drawPath();
    this.drawCursor();
    this.drawCombatants();
    this.drawEffects();
    this.drawFloating();

    ctx.restore();
  }

  // Projeteis e estouros criados pelo Animator.
  drawEffects() {
    const { ctx } = this;

    for (const b of this.bursts || []) {
      const alpha = Math.sin(b.t * Math.PI);        // sobe e some
      ctx.globalAlpha = alpha * 0.75;
      ctx.fillStyle = b.color;
      for (const cell of b.cells) {
        const p = this.cellToPixel(cell);
        const grow = 0.5 + b.t * 0.5;
        const w = TILE_W * grow, h = TILE_H * grow;
        ctx.fillRect(p.x + (TILE_W - w) / 2, p.y + (TILE_H - h) / 2, w, h);
      }
      // anel de choque a partir do centro da area
      if (b.cells.length) {
        const cx = b.cells.reduce((s, c) => s + c.x, 0) / b.cells.length;
        const cy = b.cells.reduce((s, c) => s + c.y, 0) / b.cells.length;
        const center = this.cellCenter({ x: cx, y: cy });
        ctx.globalAlpha = (1 - b.t) * 0.9;
        ctx.strokeStyle = b.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(center.x, center.y, TILE_W * 2.4 * b.t, TILE_H * 2.4 * b.t, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    for (const p of this.projectiles || []) {
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  drawBackdrop() {
    const { ctx, canvas } = this;
    const pal = this.backdrop || { top: '#120d16', bottom: '#241a12', glow: 'rgba(201,162,39,0.10)' };
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, pal.top);
    g.addColorStop(1, pal.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // brilho atras da grade, para o campo nao flutuar no vazio
    const r = ctx.createRadialGradient(
      canvas.width / 2, this.originY + this.field.rows * TILE_H * 0.4, 20,
      canvas.width / 2, this.originY + this.field.rows * TILE_H * 0.4, canvas.width * 0.6);
    r.addColorStop(0, pal.glow);
    r.addColorStop(1, 'transparent');
    ctx.fillStyle = r;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  drawFloor() {
    const { ctx, field } = this;
    for (let y = 0; y < field.rows; y++) {
      for (let x = 0; x < field.cols; x++) {
        const cell = { x, y };
        const p = this.cellToPixel(cell);
        const kind = field.terrain[y][x];
        const t = TERRAIN[kind] || TERRAIN.normal;

        // xadrez discreto para o olho contar quadrados sem esforco
        let base = (x + y) % 2 ? '#2a2119' : '#241c15';
        if (kind === 'dificil' || kind === 'entulho') base = (x + y) % 2 ? '#3a2f20' : '#33291c';
        if (kind === 'parede') base = '#0f0c09';
        if (kind === 'abismo') base = '#07060a';
        if (kind === 'fogo') base = (x + y) % 2 ? '#5a2410' : '#4d1f0d';
        if (kind === 'acido') base = (x + y) % 2 ? '#2f4416' : '#293c13';

        ctx.fillStyle = base;
        ctx.fillRect(p.x, p.y, TILE_W, TILE_H);

        if (kind === 'parede') {
          ctx.fillStyle = '#1c1712';
          ctx.fillRect(p.x + 2, p.y + 2, TILE_W - 4, TILE_H - 10);
        }
        if (kind === 'entulho' || kind === 'dificil') {
          ctx.fillStyle = 'rgba(120,100,70,0.5)';
          for (let i = 0; i < 3; i++) {
            ctx.fillRect(p.x + 8 + i * 17, p.y + 10 + (i % 2) * 9, 7, 5);
          }
        }
        ctx.strokeStyle = 'rgba(201,162,39,0.10)';
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x + 0.5, p.y + 0.5, TILE_W - 1, TILE_H - 1);
      }
    }
  }

  drawOverlays() {
    const { ctx } = this;
    for (const { kind, cells } of this.overlays) {
      const style = OVERLAY[kind] || OVERLAY.move;
      ctx.fillStyle = style.fill;
      ctx.strokeStyle = style.stroke;
      ctx.lineWidth = 1.5;
      for (const cell of cells) {
        const p = this.cellToPixel(cell);
        ctx.fillRect(p.x + 1, p.y + 1, TILE_W - 2, TILE_H - 2);
        ctx.strokeRect(p.x + 1.5, p.y + 1.5, TILE_W - 3, TILE_H - 3);
      }
    }
  }

  drawPath() {
    if (!this.path || this.path.length < 2) return;
    const { ctx } = this;
    ctx.strokeStyle = 'rgba(240,201,74,0.9)';
    ctx.lineWidth = 3;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    this.path.forEach((cell, i) => {
      const c = this.cellCenter(cell);
      i === 0 ? ctx.moveTo(c.x, c.y) : ctx.lineTo(c.x, c.y);
    });
    ctx.stroke();
    ctx.setLineDash([]);
    // ponta
    const end = this.cellCenter(this.path[this.path.length - 1]);
    ctx.fillStyle = 'rgba(240,201,74,0.9)';
    ctx.beginPath();
    ctx.arc(end.x, end.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  drawCursor() {
    if (!this.cursor) return;
    const { ctx } = this;
    const p = this.cellToPixel(this.cursor);
    ctx.strokeStyle = '#f0c94a';
    ctx.lineWidth = 2;
    ctx.strokeRect(p.x + 1, p.y + 1, TILE_W - 2, TILE_H - 2);
    // cantos, para o cursor nao sumir sobre overlay claro
    ctx.fillStyle = '#f0c94a';
    const s = 5;
    for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      ctx.fillRect(p.x + cx * (TILE_W - s), p.y + cy * (TILE_H - s), s, s);
    }
  }

  drawCombatants() {
    // Fila de baixo desenha por cima: sobreposicao correta na perspectiva.
    const ordered = [...this.field.combatants]
      .filter(c => !c.dead || c.side === 'ally')
      .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);

    for (const c of ordered) this.drawCombatant(c);
  }

  drawCombatant(c) {
    const { ctx } = this;
    const center = this.cellCenter(c.pos);
    const pose = c.dead ? 'down' : c.down ? 'down' : (c.anim?.pose || 'idle');
    const sprite = spriteFor(c.sb.sprite || c.id.toUpperCase(), pose);

    const bob = c.anim?.offset || { x: 0, y: 0 };
    const x = center.x - SPRITE_W / 2 + bob.x;
    const y = center.y - SPRITE_H + LIFT + bob.y;

    // sombra no chao
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + LIFT - 2, TILE_W * 0.30, TILE_H * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();

    // faixa do lado, para distinguir aliado de inimigo num relance
    ctx.fillStyle = c.side === 'ally' ? 'rgba(106,127,208,0.75)' : 'rgba(192,57,43,0.75)';
    ctx.fillRect(center.x - 15, center.y + LIFT - 3, 30, 2.5);

    ctx.save();
    if (c.anim?.flash) { ctx.globalAlpha = 0.9; }
    if (c.down && !c.dead) ctx.globalAlpha = 0.8;
    if (c.dead) ctx.globalAlpha = 0.45;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sprite, Math.round(x), Math.round(y), SPRITE_W, SPRITE_H);
    ctx.restore();

    if (!c.down && !c.dead) this.drawHealthPip(c, center);
    else if (c.side === 'ally') this.drawDownMarker(c, center);
    if (c.concentration) this.drawConcentration(center);
    this.drawConditionMarks(c, center);
  }

  drawHealthPip(c, center) {
    const { ctx } = this;
    const w = 36, h = 5;
    // Colada na cabeca. Mais alto que isto e a barra parece pertencer ao
    // personagem da fileira de tras.
    const x = center.x - w / 2, y = center.y - SPRITE_H + LIFT - 3;
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
    const pct = Math.max(0, c.hp / c.maxHp);
    ctx.fillStyle = pct > 0.5 ? '#4c9a4c' : pct > 0.25 ? '#c9a227' : '#b5342a';
    ctx.fillRect(x, y, w * pct, h);
    if (c.tempHp > 0) {
      ctx.fillStyle = '#8ab4ff';
      ctx.fillRect(x, y - 3, Math.min(w, w * (c.tempHp / c.maxHp)), 2);
    }
  }

  // Aliado no chao precisa gritar na tela: e ele que decide o turno de quem
  // tem Palavra Curativa. Mostra as salvaguardas contra a morte no campo.
  drawDownMarker(c, center) {
    const { ctx } = this;
    const y = center.y - 34;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(center.x - 20, y - 9, 40, 13);
    ctx.textAlign = 'center';
    ctx.font = 'bold 10px monospace';
    if (c.dead) {
      ctx.fillStyle = '#8d8172';
      ctx.fillText('morto', center.x, y + 1);
      return;
    }
    ctx.fillStyle = '#9cffb0';
    ctx.fillText('✓'.repeat(c.deathSaves.success) || '·', center.x - 10, y + 1);
    ctx.fillStyle = '#ff8a75';
    ctx.fillText('✗'.repeat(c.deathSaves.failure) || '·', center.x + 10, y + 1);
    // pulso vermelho por baixo, para achar o corpo de relance
    const pulse = 0.35 + 0.25 * Math.sin(Date.now() / 260);
    ctx.strokeStyle = `rgba(200,60,50,${pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(center.x, center.y + LIFT - 2, TILE_W * 0.34, TILE_H * 0.26, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawConcentration(center) {
    const { ctx } = this;
    ctx.fillStyle = '#b388ff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('◈', center.x + 26, center.y - SPRITE_H + LIFT + 4);
  }

  drawConditionMarks(c, center) {
    if (!c.conditions.size) return;
    const { ctx } = this;
    const marks = { envenenado: '☠', atordoado: '★', amedrontado: '!', caido: '↓', agarrado: '⊗', abencoado: '✦', invisivel: '◌' };
    const list = [...c.conditions].map(k => marks[k]).filter(Boolean).slice(0, 4);
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    list.forEach((m, i) => {
      ctx.fillStyle = '#f0c94a';
      ctx.fillText(m, center.x - 18 + i * 12, center.y + LIFT + 12);
    });
  }

  drawFloating() {
    const { ctx } = this;
    ctx.textAlign = 'center';
    for (const f of this.floating) {
      ctx.globalAlpha = Math.min(1, f.life / f.max);
      ctx.font = 'bold 15px "Cinzel", Georgia, serif';
      ctx.fillStyle = '#000';
      ctx.fillText(f.text, f.x + 1, f.y + 1);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
  }
}

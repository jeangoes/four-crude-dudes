// O campo de batalha: grid, distancia, alcance, linha de visao e areas.
//
// Convencao de 5e adotada: cada quadrado tem 1,5 m e a diagonal custa o
// mesmo que a ortogonal (variante padrao do Livro do Jogador). Distancia
// entre dois quadrados e portanto Chebyshev vezes 1,5.

export const TILE = 1.5;              // metros por quadrado
export const COLS = 12;
export const ROWS = 8;

export const TERRAIN = {
  normal:    { cost: 1, blocksMove: false, blocksSight: false },
  dificil:   { cost: 2, blocksMove: false, blocksSight: false, label: 'terreno difícil' },
  parede:    { cost: Infinity, blocksMove: true, blocksSight: true, label: 'parede' },
  entulho:   { cost: 2, blocksMove: false, blocksSight: false, label: 'entulho' },
  abismo:    { cost: Infinity, blocksMove: true, blocksSight: false, label: 'abismo' },
  fogo:      { cost: 1, blocksMove: false, blocksSight: false, label: 'chamas', damage: { dice: '1d6', type: 'fogo' } },
  acido:     { cost: 1, blocksMove: false, blocksSight: false, label: 'poça de ácido', damage: { dice: '1d6', type: 'acido' } },
};

export class Field {
  constructor({ cols = COLS, rows = ROWS, terrain = null } = {}) {
    this.cols = cols;
    this.rows = rows;
    // Grade de terreno; por padrao tudo normal.
    this.terrain = terrain || Array.from({ length: rows }, () => Array(cols).fill('normal'));
    this.combatants = [];
    // Efeitos presos ao chao: estátua do baaz, poça do kapak, muro de fogo.
    this.hazards = [];
  }

  // ---------- basico ----------

  inBounds(cell) {
    return cell && cell.x >= 0 && cell.y >= 0 && cell.x < this.cols && cell.y < this.rows;
  }

  key(cell) { return `${cell.x},${cell.y}`; }

  terrainAt(cell) {
    if (!this.inBounds(cell)) return TERRAIN.parede;
    return TERRAIN[this.terrain[cell.y][cell.x]] || TERRAIN.normal;
  }

  setTerrain(cell, kind) {
    if (!this.inBounds(cell)) return false;
    if (!TERRAIN[kind]) throw new Error(`terreno desconhecido: ${kind}`);
    this.terrain[cell.y][cell.x] = kind;
    return true;
  }

  place(combatant, cell) {
    if (!this.inBounds(cell)) throw new Error(`fora do campo: ${JSON.stringify(cell)}`);
    combatant.pos = { ...cell };
    if (!this.combatants.includes(combatant)) this.combatants.push(combatant);
    return combatant;
  }

  occupant(cell) {
    return this.combatants.find(c =>
      !c.dead && c.pos.x === cell.x && c.pos.y === cell.y) || null;
  }

  // Quadrado onde ninguem pode entrar. Aliado caido nao bloqueia.
  isBlocked(cell, mover = null) {
    if (!this.inBounds(cell)) return true;
    if (this.terrainAt(cell).blocksMove) return true;
    const who = this.occupant(cell);
    if (!who || who === mover) return false;
    if (who.down) return false;                  // corpo no chao nao barra
    return true;
  }

  // ---------- distancia e alcance ----------

  // Chebyshev: diagonal custa igual, que e a regra padrao de 5e.
  static steps(a, b) {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  distance(a, b) {
    return Field.steps(a.pos || a, b.pos || b) * TILE;
  }

  inRange(from, to, meters) {
    return this.distance(from, to) <= meters + 1e-9;
  }

  adjacent(a, b) {
    return Field.steps(a.pos || a, b.pos || b) === 1;
  }

  neighbors(cell, { diagonals = true } = {}) {
    const out = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (!diagonals && dx && dy) continue;
        const n = { x: cell.x + dx, y: cell.y + dy };
        if (this.inBounds(n)) out.push(n);
      }
    }
    return out;
  }

  // Inimigos que ameacam este quadrado. Base do ataque de oportunidade.
  threatsAt(cell, side) {
    return this.combatants.filter(c =>
      c.side !== side && !c.down && !c.dead &&
      Field.steps(c.pos, cell) <= 1 &&
      (c.sb.actions || []).some(a => a.kind === 'melee'));
  }

  // ---------- linha de visao ----------

  // Bresenham entre centros. Um quadrado que bloqueia visao no meio do
  // caminho corta a linha; origem e destino nunca bloqueiam a si mesmos.
  hasLineOfSight(from, to) {
    const a = from.pos || from, b = to.pos || to;
    let x0 = a.x, y0 = a.y;
    const x1 = b.x, y1 = b.y;
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    while (x0 !== x1 || y0 !== y1) {
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
      if (x0 === x1 && y0 === y1) break;
      if (this.terrainAt({ x: x0, y: y0 }).blocksSight) return false;
    }
    return true;
  }

  // ---------- movimento ----------

  /**
   * Quadrados alcancaveis com o movimento disponivel, em metros.
   * Devolve Map de "x,y" -> { cell, cost, from } para desenhar o alcance e
   * reconstruir o caminho sem recalcular.
   */
  reachable(mover, meters) {
    const start = mover.pos;
    const seen = new Map([[this.key(start), { cell: { ...start }, cost: 0, from: null }]]);
    // Dijkstra simples: a grade e pequena, fila ordenada basta.
    const queue = [{ cell: { ...start }, cost: 0 }];

    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const node = queue.shift();
      for (const n of this.neighbors(node.cell)) {
        if (this.isBlocked(n, mover)) continue;
        const stepCost = this.terrainAt(n).cost * TILE;
        const cost = node.cost + stepCost;
        if (cost > meters + 1e-9) continue;
        const k = this.key(n);
        const prev = seen.get(k);
        if (prev && prev.cost <= cost) continue;
        seen.set(k, { cell: n, cost, from: node.cell });
        queue.push({ cell: n, cost });
      }
    }
    // O ponto de partida nao e destino valido de movimento.
    seen.delete(this.key(start));
    return seen;
  }

  // Reconstroi o caminho a partir do mapa devolvido por reachable.
  pathFrom(reachMap, mover, target) {
    const path = [];
    let cur = reachMap.get(this.key(target));
    if (!cur) return null;
    while (cur) {
      path.unshift(cur.cell);
      cur = cur.from ? reachMap.get(this.key(cur.from)) : null;
    }
    return path;
  }

  // ---------- areas de efeito ----------

  // Esfera: todo quadrado cujo centro esta dentro do raio. Fireball tem 6 m,
  // o que pega um circulo de 4 de diametro no grid de 1,5.
  cellsInSphere(center, radiusMeters, { requireSight = true } = {}) {
    const out = [];
    const r = Math.ceil(radiusMeters / TILE);
    for (let y = center.y - r; y <= center.y + r; y++) {
      for (let x = center.x - r; x <= center.x + r; x++) {
        const cell = { x, y };
        if (!this.inBounds(cell)) continue;
        // Distancia euclidiana entre centros, que e o que a esfera cobre.
        const d = Math.hypot(x - center.x, y - center.y) * TILE;
        if (d > radiusMeters + 1e-9) continue;
        if (requireSight && !this.hasLineOfSight(center, cell)) continue;
        out.push(cell);
      }
    }
    return out;
  }

  // Cubo ou quadrado com lado em metros, ancorado num canto.
  cellsInCube(origin, sideMeters) {
    const n = Math.round(sideMeters / TILE);
    const out = [];
    for (let y = origin.y; y < origin.y + n; y++) {
      for (let x = origin.x; x < origin.x + n; x++) {
        const cell = { x, y };
        if (this.inBounds(cell)) out.push(cell);
      }
    }
    return out;
  }

  // Linha reta a partir da origem na direcao do alvo, com comprimento e
  // largura em metros. Serve para Relampago e para o sopro do dragao.
  cellsInLine(origin, toward, lengthMeters, widthMeters = TILE) {
    const len = Math.round(lengthMeters / TILE);
    const half = Math.floor(Math.round(widthMeters / TILE) / 2);
    const dx = Math.sign(toward.x - origin.x);
    const dy = Math.sign(toward.y - origin.y);
    const out = [];
    for (let i = 1; i <= len; i++) {
      for (let w = -half; w <= half; w++) {
        // Alarga perpendicular ao avanco.
        const cell = dx && dy
          ? { x: origin.x + dx * i, y: origin.y + dy * i + w }
          : dx
            ? { x: origin.x + dx * i, y: origin.y + w }
            : { x: origin.x + w, y: origin.y + dy * i };
        if (this.inBounds(cell) && !this.terrainAt(cell).blocksMove) out.push(cell);
      }
    }
    return out;
  }

  // Cone com o comprimento igual a largura na ponta, como 5e define.
  cellsInCone(origin, toward, lengthMeters) {
    const len = Math.round(lengthMeters / TILE);
    const dx = Math.sign(toward.x - origin.x);
    const dy = Math.sign(toward.y - origin.y);
    const out = [];
    for (let i = 1; i <= len; i++) {
      const spread = Math.floor(i / 2);
      for (let w = -spread; w <= spread; w++) {
        const cell = dx && !dy ? { x: origin.x + dx * i, y: origin.y + w }
          : dy && !dx ? { x: origin.x + w, y: origin.y + dy * i }
          : { x: origin.x + dx * i, y: origin.y + dy * i + w };
        if (this.inBounds(cell) && this.hasLineOfSight(origin, cell)) out.push(cell);
      }
    }
    // Um mesmo quadrado pode cair duas vezes na varredura diagonal.
    const seen = new Set();
    return out.filter(c => { const k = this.key(c); if (seen.has(k)) return false; seen.add(k); return true; });
  }

  // Combatentes ocupando qualquer um dos quadrados dados.
  occupantsOf(cells) {
    const keys = new Set(cells.map(c => this.key(c)));
    return this.combatants.filter(c => !c.dead && keys.has(this.key(c.pos)));
  }

  // ---------- perigos presos ao chao ----------

  addHazard(hazard) {
    this.hazards.push({ rounds: Infinity, ...hazard });
    for (const cell of hazard.cells || []) {
      if (hazard.terrain) this.setTerrain(cell, hazard.terrain);
    }
    return hazard;
  }

  hazardsAt(cell) {
    const k = this.key(cell);
    return this.hazards.filter(h => (h.cells || []).some(c => this.key(c) === k));
  }

  /**
   * Chamado uma vez por rodada. Devolve os perigos que expiraram, ja com o
   * terreno limpo. Perigo com `onExpire` (a energia do aurak) detona ao
   * acabar a contagem, e quem chama resolve os eventos.
   */
  tickHazards() {
    const expired = [];
    for (const h of this.hazards) {
      if (h.rounds === Infinity) continue;
      h.rounds -= 1;
      if (h.rounds <= 0) expired.push(h);
    }
    // Remove da lista antes de detonar, para um onExpire que crie outro
    // perigo no mesmo quadrado nao ser varrido junto.
    this.hazards = this.hazards.filter(h => !expired.includes(h));
    for (const h of expired) {
      for (const cell of h.cells || []) {
        if (h.terrain) this.setTerrain(cell, 'normal');
      }
    }
    return expired;
  }
}

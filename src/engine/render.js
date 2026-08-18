// Render: sprites por manifesto, com desenhista procedural como fallback.
//
// Regra do modulo: nada aqui sabe sobre regras de 5e. Recebe "desenhe a
// entidade X na pose Y em tal ponto" e desenha. Quem decide pose e posicao
// e a camada de batalha.

const CACHE = new Map();      // chave -> canvas ja desenhado
const IMAGES = new Map();     // src -> HTMLImageElement carregada
let MANIFEST = null;

export const POSES = ['idle', 'attack', 'hurt', 'down'];

// ---------- carga ----------

export async function loadManifest(url = 'assets/manifest.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`manifesto nao carregou: ${res.status}`);
  MANIFEST = await res.json();
  const srcs = [];
  for (const group of ['heroes', 'monsters']) {
    for (const entry of Object.values(MANIFEST[group] || {})) {
      if (entry.src) srcs.push(entry.src);
    }
  }
  await Promise.all([...new Set(srcs)].map(loadImage));
  return MANIFEST;
}

function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => { IMAGES.set(src, img); resolve(img); };
    // Falha de imagem nao derruba o jogo: a entidade cai no procedural.
    img.onerror = () => { console.warn(`sprite ausente, usando procedural: ${src}`); resolve(null); };
    img.src = src;
  });
}

function entryFor(id) {
  if (!MANIFEST) return null;
  return MANIFEST.heroes?.[id] || MANIFEST.monsters?.[id] || null;
}

// ---------- API publica ----------

// Devolve um canvas com a entidade desenhada na pose pedida.
export function spriteFor(id, pose = 'idle') {
  const key = `${id}:${pose}`;
  if (CACHE.has(key)) return CACHE.get(key);

  const entry = entryFor(id);
  let canvas;

  if (entry?.src && IMAGES.get(entry.src)) {
    canvas = fromSheet(entry, pose);
  } else if (entry) {
    canvas = drawProcedural(entry, pose);
  } else {
    canvas = drawMissing(id);
  }

  CACHE.set(key, canvas);
  return canvas;
}

// Chame quando trocar o manifesto em runtime (troca de arte sem reload).
export function clearCache() { CACHE.clear(); }

// ---------- sprite sheet ----------

function fromSheet(entry, pose) {
  const img = IMAGES.get(entry.src);
  const w = entry.frameW || img.width;
  const h = entry.frameH || img.height;
  // Pose ausente na folha cai para idle: arte parcial nao quebra o jogo.
  const index = entry.poses?.[pose] ?? entry.poses?.idle ?? 0;
  const perRow = Math.max(1, Math.floor(img.width / w));

  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(img, (index % perRow) * w, Math.floor(index / perRow) * h, w, h, 0, 0, w, h);

  // Sem quadro proprio para a pose, aplica uma deformacao barata para que
  // atacar e apanhar ainda leiam como acoes distintas.
  if (entry.poses?.[pose] === undefined && pose !== 'idle') return deform(c, pose);
  return c;
}

// Inclina / achata o quadro parado para sugerir a pose que falta.
function deform(src, pose) {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.save();
  if (pose === 'attack') {
    g.translate(src.width * 0.5, src.height);
    g.transform(1, 0, -0.16, 1, 0, 0);   // inclina para frente
    g.translate(-src.width * 0.5, -src.height);
  } else if (pose === 'hurt') {
    g.translate(src.width * 0.5, src.height);
    g.transform(1, 0, 0.12, 0.97, 0, 0); // recua e encolhe
    g.translate(-src.width * 0.5, -src.height);
  } else if (pose === 'down') {
    // Deitar um quadro retrato dentro de um canvas retrato exige encolher:
    // sem isso o corpo rotacionado sai da area e o caido some do campo,
    // justamente quando o jogador precisa achar quem levantar.
    // Depois de girar e encolher por k, a figura ocupa a largura cheia e
    // k*altura na vertical. Centrar em 0,706 da altura encaixa a caixa
    // resultante exatamente na metade de baixo do quadro.
    const k = src.width / src.height;
    g.translate(src.width / 2, src.height * 0.706);
    g.rotate(-Math.PI / 2);
    g.scale(k, k);
    g.translate(-src.width / 2, -src.height / 2);
  }
  g.drawImage(src, 0, 0);
  g.restore();
  if (pose === 'hurt') tintCanvas(c, 'rgba(255,90,90,0.45)');
  // Escurece de leve, so para ler como fora de combate. Mais que isto e o
  // caido some do campo, e achar quem levantar e a decisao do turno.
  if (pose === 'down') tintCanvas(c, 'rgba(30,12,12,0.18)');
  return c;
}

// ---------- desenhista procedural ----------

const SPR_W = 104, SPR_H = 136;

function drawProcedural(entry, pose) {
  const c = makeCanvas(SPR_W, SPR_H);
  const g = c.getContext('2d');
  const p = entry.palette || {};
  const b = entry.build || {};

  const pal = {
    scale: p.scale || '#6b7a3a',
    belly: p.belly || shift(p.scale || '#6b7a3a', 34),
    wing:  p.wing  || shift(p.scale || '#6b7a3a', -28),
    horn:  p.horn  || '#d8cfa8',
    eye:   p.eye   || '#ffcc33',
  };
  pal.dark = shift(pal.scale, -34);
  pal.light = shift(pal.scale, 26);

  const height = b.height ?? 0.9;
  const bulk = b.bulk ?? 1;

  // Sistema de coordenadas: chao em y=SPR_H, figura centrada em x.
  g.save();
  g.translate(SPR_W / 2, SPR_H);

  // Deformacao de pose aplicada ao corpo inteiro. O ataque precisa ler a
  // distancia num campo de batalha, entao e exagerado de proposito.
  if (pose === 'attack') { g.transform(1, 0, -0.30, 0.94, 0, 0); g.translate(6, 0); }
  if (pose === 'hurt')   { g.transform(1, 0, 0.16, 0.93, 0, 0); g.translate(-5, 0); }
  if (pose === 'down')   { g.rotate(-0.42); g.translate(-14, 6); g.scale(1, 0.62); }

  const H = SPR_H * height;          // altura util da figura
  const shoulderY = -H * 0.72;
  const hipY = -H * 0.36;
  const headY = -H * 0.86;
  const torsoW = 30 * bulk;

  if (entry.procedural === 'draconian') {
    drawWings(g, b.wings || 'folded', pal, H, torsoW, pose);
    drawTail(g, pal, H, bulk, pose);
  }

  drawLegs(g, pal, hipY, bulk, pose);
  drawTorso(g, pal, shoulderY, hipY, torsoW, entry.procedural);
  drawArms(g, pal, shoulderY, torsoW, bulk, pose);
  drawHead(g, pal, headY, shoulderY, bulk, b.crest || 'none', entry.procedural, pose);

  g.restore();

  if (pose === 'hurt') tintCanvas(c, 'rgba(255,90,90,0.42)');
  return c;
}

function drawLegs(g, pal, hipY, bulk, pose) {
  const spread = 10 * bulk;
  const legH = -hipY;
  // Perna digitigrada: coxa para frente, canela para tras, pe no chao.
  for (const side of [-1, 1]) {
    const x = side * spread;
    const kneeY = hipY + legH * 0.44;
    const ankleY = -legH * 0.22;

    g.fillStyle = pal.dark;
    g.beginPath();                                  // coxa, inclinada para fora
    g.moveTo(x - 7 * bulk, hipY);
    g.lineTo(x + 7 * bulk, hipY);
    g.lineTo(x + side * 3 + 5 * bulk, kneeY);
    g.lineTo(x + side * 3 - 5 * bulk, kneeY);
    g.closePath(); g.fill();

    g.fillStyle = pal.scale;
    g.beginPath();                                  // canela, recuando
    g.moveTo(x + side * 3 - 5 * bulk, kneeY);
    g.lineTo(x + side * 3 + 5 * bulk, kneeY);
    g.lineTo(x + 4 * bulk, ankleY);
    g.lineTo(x - 4 * bulk, ankleY);
    g.closePath(); g.fill();

    g.fillStyle = pal.dark;                         // metatarso vertical
    g.fillRect(x - 4 * bulk, ankleY, 8 * bulk, -ankleY - 4);
    g.fillRect(x - 8 * bulk, -4, 16 * bulk, 4);     // pe
    g.fillStyle = pal.horn;                         // garras
    for (let i = 0; i < 3; i++) g.fillRect(x - 7 * bulk + i * 5.5 * bulk, -2, 3, 2);
  }
}

function drawTorso(g, pal, shoulderY, hipY, torsoW, kind) {
  const h = hipY - shoulderY;
  const waistW = torsoW * 0.72;
  const shoulderW = torsoW + 8;

  // Tronco em trapezio: ombros largos afunilando na cintura. E o que separa
  // "criatura" de "caixa".
  g.fillStyle = pal.scale;
  g.beginPath();
  g.moveTo(-shoulderW / 2, shoulderY);
  g.lineTo(shoulderW / 2, shoulderY);
  g.lineTo(waistW / 2, hipY);
  g.lineTo(-waistW / 2, hipY);
  g.closePath(); g.fill();

  // sombra do lado direito, acompanhando o afunilamento
  g.fillStyle = pal.dark;
  g.beginPath();
  g.moveTo(shoulderW / 2 - 5, shoulderY);
  g.lineTo(shoulderW / 2, shoulderY);
  g.lineTo(waistW / 2, hipY);
  g.lineTo(waistW / 2 - 4, hipY);
  g.closePath(); g.fill();

  // peitoral
  g.fillStyle = pal.light;
  g.fillRect(-shoulderW / 2 + 4, shoulderY + 3, shoulderW - 8, h * 0.16);

  if (kind === 'undead') {
    g.fillStyle = pal.horn;
    for (let i = 0; i < 4; i++) {
      const t = i / 4;
      const w = shoulderW * (1 - t * 0.28) * 0.62;
      g.fillRect(-w / 2, shoulderY + h * 0.34 + i * 7, w, 2);
    }
    return;
  }

  // barriga em placas, estreitando com a cintura
  g.fillStyle = pal.belly;
  const plates = 5;
  for (let i = 0; i < plates; i++) {
    const t = i / plates;
    const w = (torsoW * 0.54) * (1 - t * 0.3);
    const y = shoulderY + h * 0.28 + (h * 0.62 / plates) * i;
    g.fillRect(-w / 2, y, w, (h * 0.62 / plates) - 2);
  }
}

function drawArms(g, pal, shoulderY, torsoW, bulk, pose) {
  const armLen = 30 * bulk;
  for (const side of [-1, 1]) {
    const raised = pose === 'attack' && side === 1;
    const x = side * (torsoW / 2 + 2);
    const top = raised ? shoulderY - 12 : shoulderY + 2;
    g.fillStyle = pal.scale;
    g.fillRect(x - 4 * side - (side < 0 ? 4 : 0), top, 8 * bulk, armLen);
    g.fillStyle = pal.dark;
    g.fillRect(x - 4 * side - (side < 0 ? 4 : 0), top + armLen - 6, 8 * bulk, 6);
    // garras
    g.fillStyle = pal.horn;
    for (let i = 0; i < 3; i++) g.fillRect(x - 4 * side - (side < 0 ? 4 : 0) + i * 3, top + armLen, 2, 4);
  }
}

function drawHead(g, pal, headY, shoulderY, bulk, crest, kind, pose) {
  const w = 22 * bulk, h = 20 * bulk;
  // pescoco
  g.fillStyle = pal.dark;
  g.fillRect(-5 * bulk, headY + h, 10 * bulk, shoulderY - headY - h + 4);
  // cranio
  g.fillStyle = pal.scale;
  g.fillRect(-w / 2, headY, w, h);
  // focinho projetado para frente
  const snoutW = 15 * bulk, snoutH = 9 * bulk;
  g.fillRect(-snoutW / 2 + 3, headY + h * 0.42, snoutW, snoutH);
  g.fillStyle = pal.light;
  g.fillRect(-snoutW / 2 + 3, headY + h * 0.42, snoutW, 3);
  // dentes
  g.fillStyle = pal.horn;
  for (let i = 0; i < 4; i++) g.fillRect(-snoutW / 2 + 4 + i * 4, headY + h * 0.42 + snoutH, 2, 3);
  // olhos brilhando
  g.fillStyle = pal.eye;
  const eyeH = pose === 'attack' ? 4 : 3;
  g.fillRect(-w / 2 + 3, headY + 5, 5, eyeH);
  g.fillRect(w / 2 - 8, headY + 5, 5, eyeH);
  // chifres e crista
  g.fillStyle = pal.horn;
  if (crest === 'low' || crest === 'high') {
    const n = crest === 'high' ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const s = crest === 'high' ? 7 : 4;
      g.fillRect(-2, headY - s + i, 4, s - i);
    }
  }
  for (const side of [-1, 1]) {
    g.fillRect(side * (w / 2 - 2), headY + 1, 6 * side, 4);
    g.fillRect(side * (w / 2 + 2), headY - 3, 3 * side, 5);
  }
  if (kind === 'undead') {
    // orbitas vazias sobre o cranio claro
    g.fillStyle = '#0d0f0b';
    g.fillRect(-w / 2 + 3, headY + 5, 5, 4);
    g.fillRect(w / 2 - 8, headY + 5, 5, 4);
    g.fillStyle = pal.eye;
    g.fillRect(-w / 2 + 4, headY + 6, 2, 2);
    g.fillRect(w / 2 - 7, headY + 6, 2, 2);
  }
}

function drawWings(g, mode, pal, H, torsoW, pose) {
  if (mode === 'none') return;
  const shoulderY = -H * 0.72;
  const flare = pose === 'attack' ? 1.3 : pose === 'hurt' ? 0.8 : 1;

  // Cada asa e uma membrana entre dedos que saem de um punho. Os dedos
  // apontam para BAIXO a partir da ponta, e e isso que faz ler como asa em
  // vez de tabua horizontal.
  for (const side of [-1, 1]) {
    g.save();
    g.translate(side * (torsoW / 2 - 1), shoulderY + 5);
    g.scale(side, 1);

    let wristX, wristY, span, drop;
    if (mode === 'folded')    { wristX = 9;  wristY = -12; span = 13 * flare; drop = H * 0.40; }
    else if (mode === 'half') { wristX = 24 * flare; wristY = -20; span = 22 * flare; drop = H * 0.34; }
    else                      { wristX = 38 * flare; wristY = -26; span = 30 * flare; drop = H * 0.26; }

    // dedos: do punho, abrindo em leque para baixo
    const fingers = 4;
    const tips = [];
    for (let i = 0; i < fingers; i++) {
      const t = i / (fingers - 1);
      tips.push({
        x: wristX + span * (1 - t) * 0.5,
        y: wristY + drop * (0.25 + t * 0.75),
      });
    }

    // membrana
    g.fillStyle = pal.wing;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(wristX, wristY);
    for (const t of tips) g.lineTo(t.x, t.y);
    g.closePath();
    g.fill();

    // nervura de cada dedo
    g.strokeStyle = shift(pal.wing, -26);
    g.lineWidth = 1.6;
    for (const t of tips) {
      g.beginPath(); g.moveTo(wristX, wristY); g.lineTo(t.x, t.y); g.stroke();
    }

    // osso do braco da asa, ombro ate punho
    g.strokeStyle = pal.horn;
    g.lineWidth = 2.4;
    g.beginPath(); g.moveTo(0, 0); g.lineTo(wristX, wristY); g.stroke();
    // garra do punho
    g.fillStyle = pal.horn;
    g.fillRect(wristX - 1, wristY - 5, 2.5, 6);

    g.restore();
  }
}

function drawTail(g, pal, H, bulk, pose) {
  // Cauda saindo por tras do quadril, descendo e varrendo para a direita.
  const segs = 9;
  const baseY = -H * 0.32;
  g.save();
  let x = 4, y = baseY;
  let ang = -0.15;
  for (let i = 0; i < segs; i++) {
    const t = i / (segs - 1);
    const w = (13 - t * 9.5) * bulk;
    const step = 7 - t * 1.5;
    ang += 0.19;                       // curva progressiva para baixo
    x += Math.cos(ang) * step;
    y += Math.sin(ang) * step;
    g.fillStyle = i % 2 ? pal.dark : pal.scale;
    g.beginPath();
    g.ellipse(x, y, w / 2, w / 2.2, ang, 0, Math.PI * 2);
    g.fill();
  }
  // ponta ossuda
  g.fillStyle = pal.horn;
  g.save();
  g.translate(x, y); g.rotate(ang);
  g.beginPath(); g.moveTo(0, -3); g.lineTo(9, 0); g.lineTo(0, 3); g.closePath(); g.fill();
  g.restore();
  g.restore();
}

// ---------- fallback final ----------

function drawMissing(id) {
  const c = makeCanvas(SPR_W, SPR_H);
  const g = c.getContext('2d');
  g.fillStyle = '#2a1a2a';
  g.fillRect(SPR_W * 0.25, SPR_H * 0.3, SPR_W * 0.5, SPR_H * 0.7);
  g.strokeStyle = '#c0392b'; g.lineWidth = 2;
  g.strokeRect(SPR_W * 0.25, SPR_H * 0.3, SPR_W * 0.5, SPR_H * 0.7);
  g.fillStyle = '#f5c518';
  g.font = '10px monospace';
  g.textAlign = 'center';
  g.fillText('?', SPR_W / 2, SPR_H * 0.62);
  g.fillText(String(id).slice(0, 10), SPR_W / 2, SPR_H * 0.78);
  return c;
}

// ---------- utilitarios ----------

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tintCanvas(c, color) {
  const g = c.getContext('2d');
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
}

// Clareia (amount > 0) ou escurece (amount < 0) uma cor hex.
function shift(hex, amount) {
  const n = parseInt(hex.replace('#', ''), 16);
  const clamp = v => Math.max(0, Math.min(255, v));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

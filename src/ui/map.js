// Mapa de nos do capitulo. Grafo desenhado em canvas: circulos ligados por
// linhas, com o no atual em destaque e os visitados apagados.

const CORES = {
  combate:  { anel: '#c0392b', preenche: '#3a1614' },
  dialogo:  { anel: '#6a7fd0', preenche: '#1c2038' },
  descanso: { anel: '#4c9a4c', preenche: '#16281a' },
  decisao:  { anel: '#c9a227', preenche: '#2e2410' },
};

const RAIO = 26;

export class ChapterMap {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.capitulo = null;
    this.estado = null;         // { atual, visitados:Set, disponiveis:Set }
    this.hover = null;
    this.onPick = null;
    this.pulso = 0;

    canvas.addEventListener('mousemove', e => { this.hover = this.emPonto(e); this.draw(); });
    canvas.addEventListener('click', e => {
      const no = this.emPonto(e);
      if (no && this.estado?.disponiveis.has(no.id)) this.onPick?.(no);
    });
    canvas.addEventListener('touchend', e => {
      e.preventDefault();
      const no = this.emPonto(e.changedTouches[0]);
      if (no && this.estado?.disponiveis.has(no.id)) this.onPick?.(no);
    }, { passive: false });
  }

  set(capitulo, estado) {
    this.capitulo = capitulo;
    this.estado = estado;
    this.draw();
  }

  ponto(no) {
    // Margem para o circulo e o rotulo nunca encostarem na borda.
    const mx = 70, my = 70;
    return {
      x: mx + no.em.x * (this.canvas.width - mx * 2),
      y: my + no.em.y * (this.canvas.height - my * 2),
    };
  }

  emPonto(ev) {
    const r = this.canvas.getBoundingClientRect();
    const x = (ev.clientX - r.left) * (this.canvas.width / r.width);
    const y = (ev.clientY - r.top) * (this.canvas.height / r.height);
    return (this.capitulo?.nos || []).find(no => {
      const p = this.ponto(no);
      return Math.hypot(p.x - x, p.y - y) <= RAIO + 6;
    }) || null;
  }

  tick(dt) { this.pulso += dt; }

  draw() {
    const { ctx, canvas, capitulo, estado } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!capitulo) return;

    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, capitulo.fundo?.top || '#12101a');
    g.addColorStop(1, capitulo.fundo?.bottom || '#241a12');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ligacoes primeiro, para os nos ficarem por cima
    for (const no of capitulo.nos) {
      const destinos = [...(no.liga || []), ...(no.opcoes || []).map(o => o.vai)];
      for (const id of destinos) {
        const alvo = capitulo.nos.find(n => n.id === id);
        if (!alvo) continue;
        const a = this.ponto(no), b = this.ponto(alvo);
        const percorrida = estado?.visitados.has(no.id);
        ctx.strokeStyle = percorrida ? 'rgba(201,162,39,0.55)' : 'rgba(201,162,39,0.16)';
        ctx.lineWidth = percorrida ? 2.5 : 1.5;
        ctx.setLineDash(percorrida ? [] : [5, 5]);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    for (const no of capitulo.nos) this.drawNo(no);

    // titulo do capitulo
    ctx.textAlign = 'left';
    ctx.font = '600 15px "Cinzel", Georgia, serif';
    ctx.fillStyle = 'rgba(232,220,192,0.55)';
    ctx.fillText(`${capitulo.numero} · ${capitulo.titulo}`, 18, 28);
  }

  drawNo(no) {
    const { ctx, estado } = this;
    const p = this.ponto(no);
    const cor = CORES[no.tipo] || CORES.combate;
    const visitado = estado?.visitados.has(no.id);
    const disponivel = estado?.disponiveis.has(no.id);
    const atual = estado?.atual === no.id;

    ctx.globalAlpha = visitado && !atual ? 0.42 : 1;

    if (disponivel) {
      const pulso = 0.4 + 0.25 * Math.sin(this.pulso * 3);
      ctx.strokeStyle = `rgba(240,201,74,${pulso})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, RAIO + 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = cor.preenche;
    ctx.beginPath();
    ctx.arc(p.x, p.y, RAIO, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = atual ? '#f0c94a' : cor.anel;
    ctx.lineWidth = atual ? 3 : 2;
    ctx.stroke();

    // simbolo do tipo
    ctx.textAlign = 'center';
    ctx.font = '15px serif';
    ctx.fillStyle = atual ? '#f0c94a' : '#e8dcc0';
    const simbolo = { combate: no.chefe ? '☠' : '⚔', dialogo: '❝', descanso: '☾', decisao: '⁇' }[no.tipo] || '·';
    ctx.fillText(simbolo, p.x, p.y + 5);

    if (visitado && !atual) {
      ctx.strokeStyle = 'rgba(156,255,176,0.8)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - 7, p.y + RAIO - 2);
      ctx.lineTo(p.x - 2, p.y + RAIO + 4);
      ctx.lineTo(p.x + 8, p.y + RAIO - 8);
      ctx.stroke();
    }

    // rotulo
    ctx.font = `${this.hover === no || atual ? '600 ' : ''}12px "Cinzel", Georgia, serif`;
    ctx.fillStyle = atual ? '#f0c94a' : disponivel ? '#e8dcc0' : 'rgba(232,220,192,0.5)';
    ctx.fillText(no.titulo, p.x, p.y + RAIO + 20);

    if (no.chefe) {
      ctx.font = '9px "Press Start 2P", monospace';
      ctx.fillStyle = '#c0392b';
      ctx.fillText('CHEFE', p.x, p.y - RAIO - 10);
    }

    ctx.globalAlpha = 1;
  }
}

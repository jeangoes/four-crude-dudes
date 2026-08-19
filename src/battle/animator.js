// Animacoes curtas do campo. Tudo baseado em promessa, para a sessao poder
// esperar a animacao terminar antes de seguir com a proxima jogada.

const easeOut = t => 1 - Math.pow(1 - t, 3);
const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class Animator {
  constructor() {
    this.running = [];
    this.skip = false;
  }

  update(dt) {
    for (const a of this.running) {
      a.elapsed += this.skip ? a.duration : dt;
      const t = Math.min(1, a.elapsed / a.duration);
      a.step(a.ease ? a.ease(t) : t);
      if (t >= 1) { a.done = true; a.resolve(); }
    }
    this.running = this.running.filter(a => !a.done);
    if (!this.running.length) this.skip = false;
  }

  get busy() { return this.running.length > 0; }

  // Pula o que estiver rodando. Ligado ao clique impaciente do jogador.
  skipAll() { this.skip = true; }

  run({ duration = 0.25, ease = easeOut, step = () => {} }) {
    return new Promise(resolve => {
      this.running.push({ duration, ease, step, elapsed: 0, resolve, done: false });
    });
  }

  wait(seconds) {
    return this.run({ duration: seconds, ease: t => t, step: () => {} });
  }

  // Anda um caminho de quadrados, um passo de cada vez.
  async walk(combatant, path, view, { stepTime = 0.13 } = {}) {
    combatant.anim = { pose: 'idle', offset: { x: 0, y: 0 } };
    // `pathFrom` devolve so os quadrados a percorrer, sem a origem. Comecar
    // em i=1 comia o primeiro passo: num caminho de um quadrado so, o laco
    // nao rodava e o combatente ficava parado gastando deslocamento.
    let anterior = combatant.pos;
    for (let i = 0; i < path.length; i++) {
      const from = view.cellCenter(anterior);
      const to = view.cellCenter(path[i]);
      await this.run({
        duration: stepTime,
        ease: t => t,
        step: t => {
          combatant.anim.offset = { x: (to.x - from.x) * t, y: (to.y - from.y) * t };
          // pulinho leve para o passo nao ficar deslizando
          combatant.anim.offset.y -= Math.sin(t * Math.PI) * 4;
        },
      });
      combatant.pos = { ...path[i] };
      combatant.anim.offset = { x: 0, y: 0 };
      anterior = path[i];
    }
    combatant.anim = null;
  }

  // Avanca na direcao do alvo, bate, volta.
  async lunge(attacker, target, view) {
    const from = view.cellCenter(attacker.pos);
    const to = view.cellCenter(target.pos);
    const dx = (to.x - from.x) * 0.35;
    const dy = (to.y - from.y) * 0.35;
    attacker.anim = { pose: 'attack', offset: { x: 0, y: 0 } };
    await this.run({
      duration: 0.16,
      step: t => { attacker.anim.offset = { x: dx * t, y: dy * t }; },
    });
    await this.run({
      duration: 0.2,
      ease: easeInOut,
      step: t => { attacker.anim.offset = { x: dx * (1 - t), y: dy * (1 - t) }; },
    });
    attacker.anim = null;
  }

  // Recuo de quem apanhou, com o sprite na pose de dano.
  async recoil(target, view, strength = 1) {
    target.anim = { pose: 'hurt', offset: { x: 0, y: 0 }, flash: true };
    await this.run({
      duration: 0.26,
      step: t => {
        target.anim.offset = { x: Math.sin(t * Math.PI * 5) * 6 * strength * (1 - t), y: 0 };
      },
    });
    target.anim = null;
  }

  // Projetil viajando entre dois quadrados.
  async projectile(fromCell, toCell, view, { color = '#f0c94a', size = 5, duration = 0.22 } = {}) {
    const a = view.cellCenter(fromCell);
    const b = view.cellCenter(toCell);
    const shot = { x: a.x, y: a.y - 30, color, size };
    view.projectiles = view.projectiles || [];
    view.projectiles.push(shot);
    await this.run({
      duration,
      ease: t => t,
      step: t => {
        shot.x = a.x + (b.x - a.x) * t;
        shot.y = (a.y - 30) + ((b.y - 30) - (a.y - 30)) * t - Math.sin(t * Math.PI) * 22;
      },
    });
    view.projectiles = view.projectiles.filter(p => p !== shot);
  }

  // Estouro de area, para Bola de Fogo e afins.
  async burst(cells, view, { color = '#ff7043', duration = 0.4 } = {}) {
    view.bursts = view.bursts || [];
    const fx = { cells, color, t: 0 };
    view.bursts.push(fx);
    await this.run({ duration, ease: t => t, step: t => { fx.t = t; } });
    view.bursts = view.bursts.filter(b => b !== fx);
  }
}

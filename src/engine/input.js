// Input para jogo em turno: ponteiro sobre o campo e teclado nos menus.
// Nada de polling por quadro. Tudo por evento.

const listeners = new Map();

export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event).add(fn);
  return () => listeners.get(event).delete(fn);
}

function emit(event, payload) {
  for (const fn of listeners.get(event) || []) fn(payload);
}

// Teclas mapeadas para intencao, nao para letra. Assim o menu e o campo
// respondem ao mesmo vocabulario e trocar o mapa e mudar uma tabela.
const KEYMAP = {
  ArrowUp: 'up', w: 'up', W: 'up',
  ArrowDown: 'down', s: 'down', S: 'down',
  ArrowLeft: 'left', a: 'left', A: 'left',
  ArrowRight: 'right', d: 'right', D: 'right',
  Enter: 'confirm', ' ': 'confirm', z: 'confirm', Z: 'confirm',
  Escape: 'cancel', x: 'cancel', X: 'cancel', Backspace: 'cancel',
  Tab: 'next', q: 'prev', Q: 'prev', e: 'next', E: 'next',
  i: 'sheet', I: 'sheet',
  l: 'log', L: 'log',
  m: 'mute', M: 'mute',
};

export function attachKeyboard(target = window) {
  const handler = e => {
    // Nao sequestra teclado quando o foco esta num campo de texto.
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;
    const action = KEYMAP[e.key];
    if (!action) return;
    e.preventDefault();
    emit('action', { action, key: e.key, shift: e.shiftKey });
  };
  target.addEventListener('keydown', handler);
  return () => target.removeEventListener('keydown', handler);
}

// Converte clique/toque no canvas para coordenada do campo. O canvas e
// escalado por CSS, entao a conversao precisa do fator real, nao do atributo.
export function attachPointer(canvas, { toCell }) {
  const toLocal = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (clientX - r.left) * (canvas.width / r.width),
      y: (clientY - r.top) * (canvas.height / r.height),
    };
  };

  const move = e => {
    const pt = e.touches?.[0] || e;
    const { x, y } = toLocal(pt.clientX, pt.clientY);
    emit('hover', { x, y, cell: toCell(x, y) });
  };

  const click = e => {
    const pt = e.changedTouches?.[0] || e;
    const { x, y } = toLocal(pt.clientX, pt.clientY);
    emit('pick', { x, y, cell: toCell(x, y) });
  };

  const context = e => { e.preventDefault(); emit('action', { action: 'cancel' }); };

  canvas.addEventListener('mousemove', move);
  canvas.addEventListener('click', click);
  canvas.addEventListener('contextmenu', context);
  // No toque, mover o dedo faz o papel do hover antes de confirmar.
  canvas.addEventListener('touchmove', e => { e.preventDefault(); move(e); }, { passive: false });
  canvas.addEventListener('touchend', e => { e.preventDefault(); move(e); click(e); }, { passive: false });

  return () => {
    canvas.removeEventListener('mousemove', move);
    canvas.removeEventListener('click', click);
    canvas.removeEventListener('contextmenu', context);
  };
}

export function isTouchDevice() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

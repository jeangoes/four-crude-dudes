// Log de combate. Recebe os eventos crus do motor e escreve a linha que a
// mesa reconhece, com a rolagem por extenso.

const CLASS_BY_TYPE = {
  round: 'is-round',
  initiative: 'is-round',
  turn: 'is-turn',
  end: 'is-round',
};

export class CombatLog {
  constructor(listEl, panelEl) {
    this.list = listEl;
    this.panel = panelEl;
    this.entries = [];
  }

  clear() {
    this.entries = [];
    this.list.innerHTML = '';
  }

  open() { this.panel.classList.add('is-open'); }
  close() { this.panel.classList.remove('is-open'); }
  toggle() { this.panel.classList.toggle('is-open'); }

  // Nem todo evento vira linha: alguns so servem para animacao.
  push(event) {
    if (!event.text) return;
    if (event.type === 'hover' || event.type === 'preview') return;

    let cls = CLASS_BY_TYPE[event.type] || '';
    if (event.crit) cls = 'is-crit';
    else if (event.type === 'attack-roll' && !event.hit) cls = 'is-miss';

    const li = document.createElement('li');
    li.className = cls;
    li.textContent = event.text;
    this.list.appendChild(li);
    this.entries.push(event);

    // Mantem a rolagem no fim, como um log de verdade.
    this.list.scrollTop = this.list.scrollHeight;

    // Poda para o DOM nao crescer sem limite num encontro longo.
    while (this.list.children.length > 400) this.list.removeChild(this.list.firstChild);
  }

  // Texto puro, para depuracao e para o resumo do fim do encontro.
  asText() {
    return this.entries.map(e => e.text).join('\n');
  }
}

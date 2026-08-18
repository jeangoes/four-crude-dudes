// HUD da batalha: faixa de iniciativa, cartoes do grupo, lista de comandos
// e o painel de detalhe. Tudo DOM, porque menu de RPG em DOM e mais legivel,
// rolavel e tocavel do que desenhado em canvas.

const el = id => document.getElementById(id);

// Comandos que levam de volta, e por isso nunca podem ficar escondidos ou
// colados no item anterior.
const ehVoltar = cmd => cmd.id === 'voltar' || cmd.id === 'cancelar' || cmd.voltar === true;

export class BattleHUD {
  constructor() {
    this.initiative = el('initiative-track');
    this.roundNumber = el('round-number');
    this.partyBar = el('party-bar');
    this.commandList = el('command-list');
    this.commandBack = el('command-back');
    this.commandDetail = el('command-detail');
    this.banner = el('battle-banner');
    this.selected = 0;
    this.commands = [];
    this.itens = [];
    this.onPick = null;
  }

  // ---------- iniciativa ----------

  renderInitiative(order, current) {
    this.initiative.innerHTML = '';
    for (const c of order) {
      const li = document.createElement('li');
      li.textContent = c.name;
      li.className = [
        c === current ? 'is-current' : '',
        c.side === 'ally' ? 'is-ally' : 'is-foe',
        (c.down || c.dead) ? 'is-down' : '',
      ].filter(Boolean).join(' ');
      this.initiative.appendChild(li);
    }
  }

  setRound(n) { this.roundNumber.textContent = String(n); }

  // ---------- grupo ----------

  renderParty(allies, current) {
    this.partyBar.innerHTML = '';
    for (const c of allies) {
      const card = document.createElement('div');
      card.className = 'party-card' +
        (c === current ? ' is-current' : '') +
        ((c.down || c.dead) ? ' is-down' : '');

      const hpPct = Math.max(0, (c.hp / c.maxHp) * 100);
      const slots = this.slotSummary(c);

      card.innerHTML = `
        <div class="pc-name">${c.name}</div>
        <div class="pc-bars">
          <div class="bar bar-hp"><i style="width:${hpPct}%"></i></div>
          ${slots.total ? `<div class="bar bar-slot"><i style="width:${(slots.left / slots.total) * 100}%"></i></div>` : ''}
          <div class="pc-meta">${c.dead ? 'morto' : c.down ? `caído ${c.deathSaves.success}✓ ${c.deathSaves.failure}✗` : `${c.hp}/${c.maxHp} PV`}${slots.total ? ` · ${slots.left} espaços` : ''}${c.concentration ? ' · ◈' : ''}</div>
        </div>`;
      this.partyBar.appendChild(card);
    }
  }

  slotSummary(c) {
    let left = 0, total = 0;
    for (const s of Object.values(c.slots || {})) { left += s.max - s.used; total += s.max; }
    if (c.pactSlots) { left += c.pactSlots.max - c.pactSlots.used; total += c.pactSlots.max; }
    return { left, total };
  }

  // ---------- comandos ----------

  /**
   * @param commands [{ id, label, cost, detail, rule, disabled, reason }]
   * @param onPick   chamado com o comando escolhido
   */
  renderCommands(commands, onPick) {
    this.commands = commands;
    this.onPick = onPick;

    this.commandList.innerHTML = '';
    this.commandBack.innerHTML = '';
    this.itens = [];

    commands.forEach((cmd, i) => {
      const li = document.createElement('li');
      li.className = cmd.disabled ? 'is-disabled' : '';
      li.innerHTML = `${cmd.label}${cmd.cost ? `<span class="cmd-cost">${cmd.cost}</span>` : ''}`;
      li.addEventListener('mouseenter', () => this.select(i));
      li.addEventListener('click', () => this.confirm(i));
      // Voltar e cancelar saem da lista rolavel e ficam numa linha fixa,
      // separada. Encostado na ultima magia, o dedo erra e entra em mira
      // sem querer, e o caminho de volta some.
      (ehVoltar(cmd) ? this.commandBack : this.commandList).appendChild(li);
      this.itens.push(li);
    });

    this.selected = commands.findIndex(c => !c.disabled);
    if (this.selected < 0) this.selected = 0;
    this.pintar();
    this.showDetail(commands[this.selected]);
  }

  clearCommands() {
    this.commands = [];
    this.itens = [];
    this.onPick = null;
    this.commandList.innerHTML = '';
    this.commandBack.innerHTML = '';
    this.commandDetail.innerHTML = '';
  }

  pintar() {
    (this.itens || []).forEach((li, i) => li.classList.toggle('is-selected', i === this.selected));
  }

  select(i) {
    if (!this.commands.length) return;
    this.selected = (i + this.commands.length) % this.commands.length;
    this.pintar();
    // Mantem o item escolhido a vista quando a lista rola.
    this.itens[this.selected]?.scrollIntoView({ block: 'nearest' });
    this.showDetail(this.commands[this.selected]);
  }

  move(delta) {
    if (!this.commands.length) return;
    let i = this.selected;
    // Pula comandos indisponiveis em vez de parar neles.
    for (let n = 0; n < this.commands.length; n++) {
      i = (i + delta + this.commands.length) % this.commands.length;
      if (!this.commands[i].disabled) break;
    }
    this.select(i);
  }

  confirm(i = this.selected) {
    const cmd = this.commands[i];
    if (!cmd || cmd.disabled) return false;
    this.onPick?.(cmd);
    return true;
  }

  showDetail(cmd) {
    if (!cmd) { this.commandDetail.innerHTML = ''; return; }
    this.commandDetail.innerHTML = `
      <h4>${cmd.label}</h4>
      ${cmd.detail ? `<p>${cmd.detail}</p>` : ''}
      ${cmd.rule ? `<p class="rule">${cmd.rule}</p>` : ''}
      ${cmd.disabled && cmd.reason ? `<p class="rule" style="color:#c0392b">${cmd.reason}</p>` : ''}`;
  }

  // ---------- faixa ----------

  showBanner(text, ms = 1400) {
    this.banner.textContent = text;
    this.banner.hidden = false;
    clearTimeout(this._bannerTimer);
    if (ms) this._bannerTimer = setTimeout(() => { this.banner.hidden = true; }, ms);
  }

  hideBanner() {
    clearTimeout(this._bannerTimer);
    this.banner.hidden = true;
  }
}

// ---------- janela de reacao ----------

export function askReaction({ combatant, trigger, options }) {
  return new Promise(resolve => {
    const overlay = el('overlay-reaction');
    const prompt = el('reaction-prompt');
    const actions = el('reaction-actions');

    const contexto = trigger.kind === 'incoming-attack'
      ? `${trigger.attacker.name} ataca ${trigger.target.name}.`
      : trigger.kind === 'enemy-casting'
        ? `${trigger.caster.name} começa a conjurar ${trigger.spellName}.`
        : '';

    prompt.innerHTML = `${contexto}<br><strong>${combatant.name}</strong> pode usar a reação.`;
    actions.innerHTML = '';

    const close = value => {
      overlay.hidden = true;
      actions.innerHTML = '';
      document.removeEventListener('keydown', onKey);
      resolve(value);
    };

    options.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'btn btn-primary';
      b.textContent = `${opt.name}${opt.cost ? ` (${opt.cost})` : ''}`;
      b.addEventListener('click', () => close(opt));
      actions.appendChild(b);
    });

    const skip = document.createElement('button');
    skip.className = 'btn';
    skip.textContent = 'Guardar reação';
    skip.addEventListener('click', () => close(null));
    actions.appendChild(skip);

    // Uma janela por ataque recebido vira doze janelas por combate. Quem ja
    // decidiu que nao vai gastar a reacao precisa poder dizer isso uma vez.
    const calar = document.createElement('button');
    calar.className = 'btn btn-ghost';
    calar.textContent = 'Não perguntar mais neste combate';
    calar.addEventListener('click', () => close({ silenciar: true }));
    actions.appendChild(calar);

    const onKey = e => {
      if (e.key === 'Escape') close(null);
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) close(options[n - 1]);
    };
    document.addEventListener('keydown', onKey);

    overlay.hidden = false;
    actions.firstChild?.focus();
  });
}

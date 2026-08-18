// A campanha: o que liga capitulo, mapa de nos, dialogo e batalha.
//
// O grupo persiste entre nos, que e o ponto do 5e fiel: PV, espacos de
// magia e recursos so voltam em descanso, e descanso e no limitado. E isso
// que faz a economia existir.

import { Combatant } from '../rules/statblock.js';
import { Field } from '../battle/field.js';
import { BattleSession } from '../battle/session.js';
import { ChapterMap } from '../ui/map.js';
import { DialogueScreen } from '../ui/dialogue.js';
import { CAPITULOS, noPorId, noInicial, nivelDoCapitulo, NIVEL_FINAL } from '../data/chapters.js';
import { aplicarNivel } from '../rules/progression.js';
import { HEROES, PARTY_ORDER } from '../data/heroes.js';
import { spawnGroup } from '../data/monsters.js';
import { CENAS, NPCS, CONVIDADOS, SOTH } from '../data/npcs.js';
import { playTrack, SFX } from '../engine/audio.js';

const FORMACAO = {
  ELANDRIN: { x: 1, y: 3 }, LATHURIEL: { x: 1, y: 5 },
  DARIAN: { x: 0, y: 2 }, OWO: { x: 0, y: 6 },
};

export class Campaign {
  constructor({ show, onInterlude = null, onLevelUp = null }) {
    this.show = show;
    this.onInterlude = onInterlude;
    this.onLevelUp = onLevelUp;

    this.party = PARTY_ORDER.map(k => new Combatant(HEROES[k], { side: 'ally' }));
    this.bandeiras = new Set();
    this.capituloIndex = 0;
    this.visitados = new Set();
    this.noAtual = null;
    this.session = null;

    this.mapa = new ChapterMap(document.getElementById('map-canvas'));
    this.mapa.onPick = no => this.entrarNo(no);
    this.dialogo = new DialogueScreen();

    this.relogioMapa = null;
  }

  get capitulo() { return CAPITULOS[this.capituloIndex]; }

  // ---------- inicio ----------

  async comecar(indice = 0) {
    this.capituloIndex = indice;
    this.visitados = new Set();
    this.noAtual = noInicial(this.capitulo).id;
    // O grupo entra no nivel daquele capitulo. Comecar a campanha e comecar
    // no 1, e pular direto para a Descida entra no 5, com o kit de la.
    this.nivelAtual = nivelDoCapitulo(indice);
    for (const p of this.party) {
      aplicarNivel(p, this.nivelAtual);
      p.longRest();
    }
    await this.abrirCapitulo();
  }

  // Sobe o grupo de nivel e devolve o que cada um ganhou, para a tela.
  subirNivel(novoNivel) {
    this.nivelAtual = novoNivel;
    return this.party.map(p => ({ quem: p, ...aplicarNivel(p, novoNivel) }));
  }

  async abrirCapitulo() {
    playTrack(this.capitulo.trilha);
    if (this.onInterlude) await this.onInterlude(this.capitulo);
    this.mostrarMapa();
  }

  // ---------- mapa ----------

  mostrarMapa() {
    this.show('map');
    document.getElementById('map-chapter').textContent =
      `${this.capitulo.numero} · ${this.capitulo.titulo}`;
    this.atualizarMapa();
    this.pintarDica();

    clearInterval(this.relogioMapa);
    this.relogioMapa = setInterval(() => {
      this.mapa.tick(0.08);
      this.mapa.draw();
    }, 80);
  }

  pararMapa() { clearInterval(this.relogioMapa); this.relogioMapa = null; }

  atualizarMapa() {
    this.mapa.set(this.capitulo, {
      atual: this.noAtual,
      visitados: this.visitados,
      disponiveis: new Set(this.noAtual ? [this.noAtual] : []),
    });
  }

  pintarDica() {
    const no = this.noAtual ? noPorId(this.capitulo, this.noAtual) : null;
    const dica = document.getElementById('map-hint');
    if (!no) {
      const ultimo = this.capituloIndex >= CAPITULOS.length - 1;
      dica.textContent = ultimo
        ? 'Capítulo encerrado. A campanha chega ao Templo de Paladine.'
        : 'Capítulo encerrado. O próximo já espera.';
      return;
    }
    const estado = this.resumoDoGrupo();
    dica.textContent = `Nível ${this.nivelAtual} · ${no.titulo}${no.aviso ? ' — ' + no.aviso : ''}   ·   ${estado}`;
  }

  resumoDoGrupo() {
    return this.party.map(p => {
      const espacos = Object.values(p.slots).reduce((s, x) => s + (x.max - x.used), 0)
        + (p.pactSlots ? p.pactSlots.max - p.pactSlots.used : 0);
      return `${p.name} ${p.hp}/${p.maxHp}${espacos ? ` (${espacos})` : ''}`;
    }).join('  ·  ');
  }

  // ---------- nos ----------

  async entrarNo(no) {
    this.pararMapa();
    SFX.select();

    if (no.tipo === 'combate') return this.rodarCombate(no);
    if (no.tipo === 'dialogo') return this.rodarDialogo(no);
    if (no.tipo === 'descanso') return this.rodarDescanso(no);
    if (no.tipo === 'decisao') return this.rodarDecisao(no);
    return this.avancar(no);
  }

  // Marca o no como feito e vai para o proximo, ou fecha o capitulo.
  async avancar(no, forcarDestino = null) {
    this.visitados.add(no.id);
    const destino = forcarDestino || (no.liga || [])[0] || null;
    this.noAtual = destino;

    if (!destino) return this.fecharCapitulo();
    this.mostrarMapa();
  }

  async fecharCapitulo() {
    this.pararMapa();
    const ultimo = this.capituloIndex >= CAPITULOS.length - 1;

    // Marco: fechar o capitulo sobe o grupo ao nivel do proximo. No ultimo,
    // sobe ao nivel em que a mesa esta hoje.
    const destino = ultimo ? NIVEL_FINAL : nivelDoCapitulo(this.capituloIndex + 1);
    if (destino > this.nivelAtual) {
      const ganhos = this.subirNivel(destino);
      if (this.onLevelUp) await this.onLevelUp({ nivel: destino, ganhos, ultimo });
    }

    if (ultimo) {
      this.mostrarMapa();
      document.getElementById('map-hint').textContent =
        `A campanha alcança o Templo de Paladine com o grupo no nível ${NIVEL_FINAL}. Daqui em diante, a mesa continua na próxima sessão.`;
      return;
    }

    this.capituloIndex++;
    this.visitados = new Set();
    this.noAtual = noInicial(this.capitulo).id;
    // Entre capitulos, descanso longo: a viagem cura.
    for (const p of this.party) p.longRest();
    await this.abrirCapitulo();
  }

  // ---------- combate ----------

  montarCampo(no) {
    const field = new Field({ cols: 12, rows: 8 });
    for (const bloco of no.terreno || []) {
      for (const [x, y] of bloco.cells) field.setTerrain({ x, y }, bloco.kind);
    }

    for (const p of this.party) {
      // Quem chegou caido do no anterior entra de pe com 1 PV: o encontro
      // precisa ser jogavel, mas o preco de ter caido continua sendo caro.
      if (p.down && !p.dead) { p.hp = 1; p.conditions.clear(); p.deathSaves = { success: 0, failure: 0 }; }
      p.effects = [];
      p.breakConcentration('novo encontro');
      field.place(p, FORMACAO[p.id.toUpperCase()] || { x: 0, y: 3 });
    }

    const elenco = [...this.party];

    if (no.convidado && this.bandeiras.has('condeAliado')) {
      const convidado = new Combatant(CONVIDADOS[no.convidado](), { side: 'ally' });
      field.place(convidado, { x: 1, y: 1 });
      elenco.push(convidado);
    }

    const inimigos = spawnGroup(no.inimigos || []).map((sb, i) => {
      const c = new Combatant(sb, { side: 'foe' });
      field.place(c, { x: 10 - (i % 2), y: 1 + (i % 6) });
      return c;
    });

    if (no.especial === 'soth') {
      const soth = new Combatant(SOTH(), { side: 'foe' });
      field.place(soth, { x: 11, y: 4 });
      inimigos.push(soth);
    }

    return { field, elenco, inimigos };
  }

  rodarCombate(no, sobrescreve = {}) {
    const { field, elenco, inimigos } = this.montarCampo({ ...no, ...sobrescreve });

    const session = new BattleSession({
      canvas: document.getElementById('battle-canvas'),
      field, party: elenco, foes: inimigos,
      track: no.trilha || this.capitulo.trilha,
      backdrop: this.capitulo.fundo,
      name: no.titulo,
      objective: no.objetivo,
    });

    this.session = session;
    session.onFinish = resultado => {
      session.stop();
      this.session = null;
      if (resultado === 'derrota') return this.derrota(no);
      this.avancar(no);
    };

    this.show('battle');
    session.start();
    if (no.aviso) session.hud.showBanner(no.aviso, 2600);
  }

  derrota(no) {
    // Sem tela de fim de jogo: o grupo volta ao no com descanso longo, que
    // e o equivalente a "recuar e tentar de novo amanha".
    for (const p of this.party) p.longRest();
    this.noAtual = no.id;
    this.mostrarMapa();
    document.getElementById('map-hint').textContent =
      `O grupo recua de ${no.titulo}, lambe as feridas e volta inteiro. Tente de novo.`;
  }

  // ---------- dialogo ----------

  async rodarDialogo(no) {
    const cena = CENAS[no.cena];
    if (!cena) return this.avancar(no);

    this.show('dialogue');
    playTrack(this.capitulo.trilha);

    const res = await this.dialogo.run(cena, {
      party: this.party, npcs: NPCS,
      onRoll: r => { this.ultimaRolagem = r; },
    });

    for (const b of res.bandeiras) this.bandeiras.add(b);
    if (res.descanso === 'longo') for (const p of this.party) p.longRest();
    if (res.descanso === 'curto') for (const p of this.party) p.shortRest({ spendHitDice: 2 });

    if (res.combate && no.combateSeFalhar) {
      return this.rodarCombate(no, { inimigos: no.combateSeFalhar.inimigos, terreno: no.terreno });
    }
    return this.avancar(no);
  }

  // ---------- descanso e decisao ----------

  async rodarDescanso(no) {
    this.show('dialogue');
    this.dialogo.speaker.textContent = no.titulo;
    this.dialogo.text.textContent = no.texto || '';
    this.dialogo.portrait.hidden = true;

    const escolha = await this.dialogo.escolher([
      { texto: 'Descanso curto. Gastar dados de vida.', tipo: 'curto' },
      { texto: 'Seguir sem parar.', tipo: 'nada' },
    ], this.party);

    if (escolha.tipo === 'curto') {
      for (const p of this.party) p.shortRest({ spendHitDice: 2 });
      this.dialogo.speaker.textContent = '';
      this.dialogo.text.textContent = `O grupo recupera o fôlego. ${this.resumoDoGrupo()}`;
      await this.dialogo.esperarAvancar();
    }
    return this.avancar(no);
  }

  async rodarDecisao(no) {
    this.show('dialogue');
    this.dialogo.speaker.textContent = no.titulo;
    this.dialogo.text.textContent = no.texto || '';
    this.dialogo.portrait.hidden = true;

    const escolha = await this.dialogo.escolher(no.opcoes, this.party);
    if (escolha.bandeira) this.bandeiras.add(escolha.bandeira);
    return this.avancar(no, escolha.vai);
  }
}

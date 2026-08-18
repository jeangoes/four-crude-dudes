// Tela de dialogo. Uma cena e uma lista de falas; a ultima costuma trazer
// escolhas, e uma escolha pode exigir teste de pericia de um personagem
// especifico. E aqui que Persuasao +10 do Lathuriel importa.

import { checkRoll, describe } from '../rules/dice.js';
import { SFX } from '../engine/audio.js';

const el = id => document.getElementById(id);

export class DialogueScreen {
  constructor() {
    this.speaker = el('dialogue-speaker');
    this.text = el('dialogue-text');
    this.choices = el('dialogue-choices');
    this.portrait = el('dialogue-portrait');
  }

  /**
   * Roda a cena inteira e resolve com o que aconteceu.
   * @returns { bandeiras:Set, rolagens:[], combate:bool, descanso:string|null }
   */
  async run(cena, { party, npcs, onRoll = null }) {
    const resultado = { bandeiras: new Set(), rolagens: [], combate: false, descanso: null };

    for (const fala of cena.falas) {
      const nome = fala.quem ? (npcs[fala.quem]?.name || fala.quem) : '';
      const titulo = fala.quem ? npcs[fala.quem]?.titulo : '';
      this.speaker.textContent = nome ? (titulo ? `${nome} — ${titulo}` : nome) : '';
      this.text.textContent = fala.texto;
      this.portrait.hidden = true;

      if (!fala.escolhas) {
        await this.esperarAvancar();
        continue;
      }

      // Fala com `vezes` deixa o grupo falar mais de uma vez, uma escolha
      // por vez, sem repetir a mesma. O Julgamento dos Dragoes foi vencido
      // assim na mesa: a palavra do Lathuriel e depois a fe do Elandrin.
      const vezes = fala.vezes || 1;
      let disponiveis = [...fala.escolhas];

      for (let rodada = 0; rodada < vezes && disponiveis.length; rodada++) {
        const escolha = await this.escolher(disponiveis, party);
        disponiveis = disponiveis.filter(e => e !== escolha);
        const encerra = await this.resolverEscolha(escolha, party, resultado, onRoll);
        if (encerra) break;
      }
    }

    // Cena com resolucao propria (o Julgamento) decide pelo conjunto.
    if (typeof cena.resolucao === 'function') {
      const fim = cena.resolucao(resultado);
      if (fim.bandeira) resultado.bandeiras.add(fim.bandeira);
      if (fim.desfecho === 'combate') resultado.combate = true;
      this.speaker.textContent = '';
      this.text.textContent = fim.texto;
      this.choices.innerHTML = '';
      await this.esperarAvancar();
    }

    return resultado;
  }

  // Resolve uma escolha. Devolve true quando ela encerra a fala na hora:
  // sacar a arma nao deixa mais ninguem falar depois.
  async resolverEscolha(escolha, party, resultado, onRoll) {
    if (escolha.teste) {
      const quem = party.find(p => p.id === escolha.teste.quem) || party[0];
      const rolagem = checkRoll({ mod: quem.skillBonus(escolha.teste.pericia), dc: escolha.teste.cd });
      resultado.rolagens.push({ quem: quem.name, ...escolha.teste, ...rolagem });

      const linha = `${quem.name} testa ${escolha.teste.pericia}: ${describe(rolagem)} vs CD ${escolha.teste.cd} — ${rolagem.success ? 'passa' : 'falha'}`;
      onRoll?.({ quem: quem.name, pericia: escolha.teste.pericia, ...rolagem, texto: linha });
      rolagem.success ? SFX.heal() : SFX.cancel();

      // A rolagem fica visivel: o jogador precisa ver por que deu certo.
      this.speaker.textContent = `${quem.name} · ${escolha.teste.pericia} ${describe(rolagem)} vs CD ${escolha.teste.cd}`;
      this.text.textContent = rolagem.success ? escolha.sucesso : escolha.falha;

      const bandeira = rolagem.success ? escolha.bandeira : escolha.bandeiraFalha;
      if (bandeira) resultado.bandeiras.add(bandeira);
      await this.esperarAvancar();
    } else {
      if (escolha.bandeira) resultado.bandeiras.add(escolha.bandeira);
      if (escolha.resposta) {
        this.speaker.textContent = '';
        this.text.textContent = escolha.resposta;
        await this.esperarAvancar();
      }
    }

    if (escolha.combate) { resultado.combate = true; return true; }
    if (escolha.descanso) resultado.descanso = escolha.descanso;
    return false;
  }

  esperarAvancar() {
    this.choices.innerHTML = '';
    const li = document.createElement('li');
    li.className = 'is-selected';
    li.textContent = '▸ continuar';
    this.choices.appendChild(li);
    return new Promise(resolve => {
      const fim = () => { document.removeEventListener('keydown', tecla); li.removeEventListener('click', fim2); resolve(); };
      const fim2 = () => { SFX.select(); fim(); };
      const tecla = e => { if (['Enter', ' ', 'z', 'Z'].includes(e.key)) { e.preventDefault(); fim2(); } };
      document.addEventListener('keydown', tecla);
      li.addEventListener('click', fim2);
    });
  }

  escolher(escolhas, party) {
    this.choices.innerHTML = '';
    let sel = 0;

    const itens = escolhas.map((esc, i) => {
      const li = document.createElement('li');
      const quem = esc.teste ? party.find(p => p.id === esc.teste.quem) : null;
      const marca = esc.teste
        ? `<span class="check">${quem ? quem.name : ''} · ${esc.teste.pericia} CD ${esc.teste.cd} (${fmt(quem?.skillBonus(esc.teste.pericia))})</span>`
        : esc.combate ? '<span class="check" style="color:#c0392b">leva a combate</span>' : '';
      li.innerHTML = esc.texto + marca;
      this.choices.appendChild(li);
      return li;
    });

    const pinta = () => itens.forEach((li, i) => li.classList.toggle('is-selected', i === sel));
    pinta();

    return new Promise(resolve => {
      const escolher = i => {
        document.removeEventListener('keydown', tecla);
        SFX.select();
        resolve(escolhas[i]);
      };
      const tecla = e => {
        if (e.key === 'ArrowDown' || e.key === 's') { sel = (sel + 1) % escolhas.length; pinta(); e.preventDefault(); }
        if (e.key === 'ArrowUp' || e.key === 'w') { sel = (sel - 1 + escolhas.length) % escolhas.length; pinta(); e.preventDefault(); }
        if (['Enter', ' ', 'z', 'Z'].includes(e.key)) { e.preventDefault(); escolher(sel); }
      };
      document.addEventListener('keydown', tecla);
      itens.forEach((li, i) => {
        li.addEventListener('mouseenter', () => { sel = i; pinta(); });
        li.addEventListener('click', () => escolher(i));
      });
    });
  }
}

function fmt(n) {
  if (n === undefined || n === null) return '';
  return n >= 0 ? `+${n}` : `${n}`;
}

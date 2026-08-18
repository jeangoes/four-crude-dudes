// Boot e roteador de telas.
//
// O jogo e uma maquina de estados de telas: titulo, interludio, mapa,
// batalha, dialogo. Cada tela e uma <section> no HTML; trocar de tela e
// trocar a classe. Nada de framework.

import * as Audio from './engine/audio.js';
import * as Render from './engine/render.js';
import { attachKeyboard, on } from './engine/input.js';
import { Combatant } from './rules/statblock.js';
import { Field } from './battle/field.js';
import { BattleSession } from './battle/session.js';
import { HEROES, PARTY_ORDER } from './data/heroes.js';
import { spawnGroup } from './data/monsters.js';
import { Campaign } from './game/campaign.js';
import { CAPITULOS } from './data/chapters.js';
import { interludioDe } from './data/interludes.js';
import { renderSheet } from './ui/sheet.js';

export const VERSION = '4.0-dev';

const SCREENS = ['title', 'interlude', 'map', 'battle', 'dialogue'];

export const game = {
  screen: 'title',
  chapter: 0,
  party: [],
  flags: {},        // decisoes tomadas, portas abertas, NPCs convencidos
};

// ---------- telas ----------

export function show(name) {
  if (!SCREENS.includes(name)) throw new Error(`tela desconhecida: ${name}`);
  for (const s of SCREENS) {
    document.getElementById(`screen-${s}`)?.classList.toggle('is-active', s === name);
  }
  game.screen = name;
  document.dispatchEvent(new CustomEvent('screenchange', { detail: { screen: name } }));
}

// ---------- sobreposicoes ----------

function toggleOverlay(id, open) {
  const el = document.getElementById(id);
  if (!el) return;
  el.hidden = open === undefined ? !el.hidden : !open;
}

function wireAudioPanel() {
  const music = document.getElementById('vol-music');
  const sfx = document.getElementById('vol-sfx');
  const mute = document.getElementById('chk-mute');
  const prefs = Audio.getPrefs();
  music.value = prefs.music;
  sfx.value = prefs.sfx;
  mute.checked = prefs.muted;

  music.addEventListener('input', () => Audio.setMusicVolume(music.value));
  sfx.addEventListener('input', () => { Audio.setSfxVolume(sfx.value); Audio.SFX.select(); });
  mute.addEventListener('change', () => Audio.setMuted(mute.checked));

  document.getElementById('btn-audio').addEventListener('click', () => { Audio.unlock(); toggleOverlay('overlay-audio', true); });
  document.getElementById('btn-audio-close').addEventListener('click', () => toggleOverlay('overlay-audio', false));
}

// ---------- menu de pausa ----------

// Esc dentro do jogo abre a pausa. Fora dela, Esc so fecha o que estiver
// aberto. Sem isto, quem entrou numa campanha nao tinha como sair.
const OVERLAYS = ['overlay-reaction', 'overlay-levelup', 'overlay-audio', 'overlay-sheet', 'overlay-pause'];

function overlayAberto() {
  return OVERLAYS.find(id => !document.getElementById(id)?.hidden) || null;
}

function abrirPausa() {
  const onde = {
    battle: 'Combate em andamento. O turno espera por você.',
    map: 'No mapa do capítulo.',
    dialogue: 'No meio de uma conversa.',
    interlude: 'Na abertura do capítulo.',
  }[game.screen] || '';
  document.getElementById('pause-where').textContent = onde;
  toggleOverlay('overlay-pause', true);
  Audio.SFX.select();
}

function fecharPausa() {
  toggleOverlay('overlay-pause', false);
  Audio.SFX.cancel();
}

function wirePausa() {
  document.getElementById('btn-pause-resume').addEventListener('click', fecharPausa);

  document.getElementById('btn-pause-sheet').addEventListener('click', () => {
    renderSheet(document.getElementById('sheet-panel'), grupoAtual());
    toggleOverlay('overlay-sheet', true);
  });

  document.getElementById('btn-pause-log').addEventListener('click', () => {
    fecharPausa();
    document.getElementById('combat-log').classList.add('is-open');
  });

  document.getElementById('btn-pause-audio').addEventListener('click', () => {
    Audio.unlock();
    toggleOverlay('overlay-audio', true);
  });

  document.getElementById('btn-pause-title').addEventListener('click', () => {
    // Sair descarta a campanha em andamento. Sem save ainda, entao vale
    // dizer isso em vez de deixar o jogador descobrir depois.
    const emJogo = game.campaign && game.screen !== 'title';
    if (emJogo && !confirm('Sair para o início encerra esta campanha. O progresso não é salvo. Sair mesmo?')) return;
    voltarAoTitulo();
  });
}

function grupoAtual() {
  return game.campaign?.party || game.session?.encounter.allies || [];
}

export function voltarAoTitulo() {
  for (const id of OVERLAYS) toggleOverlay(id, false);
  document.getElementById('combat-log').classList.remove('is-open');
  game.campaign?.pararMapa();
  game.campaign?.session?.stop();
  game.session?.stop();
  game.campaign = null;
  game.session = null;
  Audio.playTrack('menu');
  show('title');
}

function wireLog() {
  const log = document.getElementById('combat-log');
  document.getElementById('btn-log-close').addEventListener('click', () => log.classList.remove('is-open'));
}

// ---------- boot ----------

function bootError(err) {
  const el = document.getElementById('boot-error');
  el.hidden = false;
  el.textContent =
    `Falha ao iniciar\n\n${err?.message || err}\n\n` +
    `Este jogo usa modulos ES e precisa ser servido por HTTP.\n` +
    `Abrir o arquivo direto (file://) nao funciona.\n\n` +
    `Rode:  python3 -m http.server\n` +
    `e abra http://localhost:8000`;
  console.error(err);
}

async function boot() {
  document.getElementById('title-version').textContent = `v${VERSION}`;

  await Render.loadManifest();

  attachKeyboard();
  wireAudioPanel();
  wireLog();
  wirePausa();

  on('action', ({ action }) => {
    if (action === 'mute') {
      Audio.setMuted(!Audio.isMuted());
      document.getElementById('chk-mute').checked = Audio.isMuted();
    }
    if (action === 'log' && game.screen === 'battle') {
      document.getElementById('combat-log').classList.toggle('is-open');
    }
    if (action === 'sheet') {
      const painel = document.getElementById('sheet-panel');
      renderSheet(painel, grupoAtual());
      toggleOverlay('overlay-sheet');
    }
    if (action === 'cancel') {
      // Esc fecha o que estiver aberto; se nao houver nada aberto e o jogo
      // estiver em andamento, abre a pausa.
      const aberto = overlayAberto();
      // A janela de reacao e a de evolucao exigem escolha: nao fecham no Esc.
      if (aberto === 'overlay-reaction' || aberto === 'overlay-levelup') return;
      if (aberto) { toggleOverlay(aberto, false); return; }
      // A batalha tem prioridade: dentro dela, Esc volta um passo do menu
      // antes de significar "pausar".
      const batalha = game.campaign?.session || game.session;
      if (batalha?.escVolta()) return;
      if (game.screen !== 'title') abrirPausa();
    }
  });

  document.getElementById('btn-new-game').addEventListener('click', () => {
    Audio.unlock();
    Audio.SFX.select();
    novaCampanha();
  });

  show('title');

  window.__debug = {
    game, show, Render, Audio, VERSION,
    startTestEncounter,
    novaCampanha,
    // Pula direto para qualquer capitulo, para nao ter que jogar tudo a cada
    // ajuste. `__debug.capitulo(3)` cai na Descida.
    capitulo: n => novaCampanha(Math.max(0, Math.min(CAPITULOS.length - 1, n - 1))),
    capitulos: () => CAPITULOS.map((c, i) => `${i + 1}. ${c.numero} ${c.titulo}`),
    campanha: () => game.campaign,
    session: () => game.campaign?.session || game.session,
  };
}

// ---------- campanha ----------

export function novaCampanha(capitulo = 0) {
  game.campaign?.pararMapa();
  game.session?.stop();
  game.session = null;

  const campanha = new Campaign({
    show,
    onInterlude: cap => mostrarInterludio(cap),
    onLevelUp: dados => mostrarEvolucao(dados),
  });
  game.campaign = campanha;
  campanha.comecar(capitulo);
  return campanha;
}

// Abertura do capitulo no visual do tomo do Diario de Campanha.
//
// Onde ha cronica publicada, o texto e o dela e a tela credita a sessao.
// Onde nao ha, e texto escrito para o jogo e a tela diz isso: cronica que
// a mesa nao jogou nao se inventa.
function mostrarInterludio(capitulo) {
  return new Promise(resolve => {
    const inter = interludioDe(capitulo.id);
    const paragrafos = inter?.paragrafos?.length ? inter.paragrafos : [capitulo.abertura];

    document.getElementById('interlude-numeral').textContent = capitulo.numero;
    document.getElementById('interlude-title').textContent = capitulo.titulo;
    document.getElementById('interlude-body').innerHTML =
      paragrafos.map(t => `<p>${t}</p>`).join('') +
      (inter?.origem === 'cronica'
        ? `<p class="tome-fonte">Do Diário de Campanha — ${inter.titulo}, ${formatarData(inter.data)}</p>`
        : `<p class="tome-fonte">Prólogo escrito para o jogo. Esta parte do arco é anterior às crônicas do Diário.</p>`);
    show('interlude');

    const botao = document.getElementById('btn-interlude-next');
    const seguir = () => {
      botao.removeEventListener('click', seguir);
      document.removeEventListener('keydown', tecla);
      Audio.SFX.select();
      resolve();
    };
    const tecla = e => { if (['Enter', ' ', 'z', 'Z'].includes(e.key)) { e.preventDefault(); seguir(); } };
    botao.addEventListener('click', seguir);
    document.addEventListener('keydown', tecla);
  });
}

// Tela de evolucao. Mostra o que cada um passou a ter, porque subir de
// nivel so vale se der para ver o que mudou.
function mostrarEvolucao({ nivel, ganhos, ultimo }) {
  return new Promise(resolve => {
    document.getElementById('levelup-title').textContent = `Nível ${nivel}`;
    document.getElementById('levelup-sub').textContent = ultimo
      ? 'O grupo alcança o nível em que a mesa está hoje.'
      : 'O grupo cresce com o que atravessou.';

    document.getElementById('levelup-body').innerHTML = ganhos.map(g => {
      const novidades = (g.novidades || []).map(n =>
        n.tipo === 'recurso'
          ? `<li>${n.nome}: ${n.quantidade} uso(s)</li>`
          : `<li>${n.nome} <em>(${n.tipo})</em></li>`).join('');
      return `<div class="levelup-heroi">
        <b>${g.quem.name}</b>
        <span class="numeros">${g.hp} PV · CA ${g.ac} · prof +${g.prof}</span>
        ${novidades ? `<ul>${novidades}</ul>` : ''}
      </div>`;
    }).join('');

    toggleOverlay('overlay-levelup', true);
    Audio.duckTrack(2.4);
    Audio.SFX.victory();

    const botao = document.getElementById('btn-levelup-close');
    const seguir = () => {
      botao.removeEventListener('click', seguir);
      document.removeEventListener('keydown', tecla);
      toggleOverlay('overlay-levelup', false);
      Audio.SFX.select();
      resolve();
    };
    const tecla = e => { if (['Enter', ' ', 'z', 'Z'].includes(e.key)) { e.preventDefault(); seguir(); } };
    botao.addEventListener('click', seguir);
    document.addEventListener('keydown', tecla);
  });
}

function formatarData(iso) {
  if (!iso) return '';
  const [ano, mes, dia] = iso.split('-');
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${Number(dia)} de ${meses[Number(mes) - 1]} de ${ano}`;
}

// ---------- encontro de teste ----------

// Os quatro contra uma patrulha de draconianos. Serve para afinar o combate
// antes de existirem capitulos.
export function startTestEncounter({ foes = ['BAAZ', 'BAAZ', 'BAAZ', 'BOZAK'] } = {}) {
  game.campaign?.pararMapa();
  game.session?.stop();

  const field = new Field({ cols: 12, rows: 8 });

  // Um pouco de terreno para o grid ter decisao: entulho no meio e duas
  // paredes que cortam linha de visao.
  for (const cell of [{ x: 5, y: 2 }, { x: 5, y: 3 }, { x: 6, y: 5 }, { x: 6, y: 6 }]) {
    field.setTerrain(cell, 'entulho');
  }
  for (const cell of [{ x: 6, y: 0 }, { x: 6, y: 1 }, { x: 5, y: 7 }]) {
    field.setTerrain(cell, 'parede');
  }

  // Grupo entra pela esquerda, em duas colunas: quem bate na frente.
  const FORMACAO = { ELANDRIN: { x: 1, y: 3 }, LATHURIEL: { x: 1, y: 5 }, DARIAN: { x: 0, y: 2 }, OWO: { x: 0, y: 6 } };
  const party = PARTY_ORDER.map(key => {
    const c = new Combatant(HEROES[key], { side: 'ally' });
    field.place(c, FORMACAO[key]);
    return c;
  });

  const enemies = spawnGroup(foes).map((sb, i) => {
    const c = new Combatant(sb, { side: 'foe' });
    field.place(c, { x: 10 - (i % 2), y: 1 + i * 2 });
    return c;
  });

  const session = new BattleSession({
    canvas: document.getElementById('battle-canvas'),
    field, party, foes: enemies,
    track: 'vogler',
    backdrop: { top: '#1a0f14', bottom: '#3a2416', glow: 'rgba(201,110,39,0.14)' },
    name: 'Patrulha draconiana',
  });
  session.onFinish = outcome => {
    session.stop();
    show('title');
    game.session = null;
  };

  game.session = session;
  show('battle');
  session.start();
  return session;
}

boot().catch(bootError);

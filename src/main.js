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

  on('action', ({ action }) => {
    if (action === 'mute') {
      Audio.setMuted(!Audio.isMuted());
      document.getElementById('chk-mute').checked = Audio.isMuted();
    }
    if (action === 'log' && game.screen === 'battle') {
      document.getElementById('combat-log').classList.toggle('is-open');
    }
    if (action === 'sheet') toggleOverlay('overlay-sheet');
    if (action === 'cancel') {
      // Esc fecha a sobreposicao aberta antes de qualquer outra coisa.
      for (const id of ['overlay-audio', 'overlay-sheet']) {
        const el = document.getElementById(id);
        if (el && !el.hidden) { el.hidden = true; return; }
      }
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
  });
  game.campaign = campanha;
  campanha.comecar(capitulo);
  return campanha;
}

// Abertura do capitulo no visual do tomo. O bloco 6 troca o texto pelo
// trecho da cronica real; a mecanica de tela ja e esta.
function mostrarInterludio(capitulo) {
  return new Promise(resolve => {
    document.getElementById('interlude-numeral').textContent = capitulo.numero;
    document.getElementById('interlude-title').textContent = capitulo.titulo;
    document.getElementById('interlude-body').innerHTML =
      `<p>${capitulo.abertura}</p>`;
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

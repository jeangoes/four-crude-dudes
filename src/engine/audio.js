// Audio sintetico. Sem arquivo externo: tudo gerado em WebAudio.
//
// SFX em duas camadas: um transiente de ruido (o impacto) somado a um corpo
// tonal (o peso). E a diferenca entre "bip" e "golpe".

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let currentTrack = null;

const PREFS_KEY = 'fcd_audio';

const prefs = loadPrefs();

function loadPrefs() {
  try {
    return { muted: false, music: 0.35, sfx: 0.6, ...JSON.parse(localStorage.getItem(PREFS_KEY) || '{}') };
  } catch { return { muted: false, music: 0.35, sfx: 0.6 }; }
}

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* modo privado */ }
}

// Precisa ser chamado a partir de um gesto do usuario (regra do navegador).
export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return ctx; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  master = ctx.createGain();
  musicGain = ctx.createGain();
  sfxGain = ctx.createGain();
  musicGain.connect(master);
  sfxGain.connect(master);
  master.connect(ctx.destination);
  applyPrefs();
  return ctx;
}

function applyPrefs() {
  if (!ctx) return;
  master.gain.value = prefs.muted ? 0 : 1;
  musicGain.gain.value = prefs.music;
  sfxGain.gain.value = prefs.sfx;
}

export function setMuted(v) { prefs.muted = !!v; savePrefs(); applyPrefs(); }
export function isMuted() { return prefs.muted; }
export function setMusicVolume(v) { prefs.music = clamp01(v); savePrefs(); applyPrefs(); }
export function setSfxVolume(v) { prefs.sfx = clamp01(v); savePrefs(); applyPrefs(); }
export function getPrefs() { return { ...prefs }; }

// ---------- blocos de sintese ----------

function noiseBuffer(dur) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// O transiente: estalo curto e filtrado. Da a "batida" do golpe.
function transient({ dur = 0.07, cutoff = 2400, type = 'lowpass', gain = 0.5, at = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(dur);
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.frequency.setValueAtTime(cutoff, t);
  filt.frequency.exponentialRampToValueAtTime(Math.max(120, cutoff * 0.25), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filt); filt.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + dur);
}

// O corpo: componente tonal que da peso e altura ao som.
function body({ f1 = 220, f2 = 80, dur = 0.16, type = 'triangle', gain = 0.3, at = 0 } = {}) {
  if (!ctx) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f1, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(sfxGain);
  o.start(t); o.stop(t + dur);
}

// ---------- SFX do jogo ----------

export const SFX = {
  // dado rolando: varios estalos secos
  dice() {
    unlock();
    for (let i = 0; i < 5; i++) transient({ dur: 0.03, cutoff: 5000, type: 'highpass', gain: 0.22, at: i * 0.045 });
  },
  hitSlash() {
    unlock();
    transient({ dur: 0.05, cutoff: 6000, type: 'highpass', gain: 0.45 });
    body({ f1: 340, f2: 120, dur: 0.12, type: 'sawtooth', gain: 0.18 });
  },
  hitBlunt() {
    unlock();
    transient({ dur: 0.08, cutoff: 1400, gain: 0.6 });
    body({ f1: 150, f2: 55, dur: 0.2, type: 'triangle', gain: 0.34 });
  },
  miss() {
    unlock();
    transient({ dur: 0.11, cutoff: 900, type: 'bandpass', gain: 0.3 });
  },
  crit() {
    unlock();
    transient({ dur: 0.06, cutoff: 7000, type: 'highpass', gain: 0.5 });
    body({ f1: 520, f2: 180, dur: 0.26, type: 'sawtooth', gain: 0.3 });
    body({ f1: 780, f2: 260, dur: 0.26, type: 'square', gain: 0.14, at: 0.03 });
  },
  spell() {
    unlock();
    body({ f1: 420, f2: 1180, dur: 0.3, type: 'sine', gain: 0.22 });
    body({ f1: 630, f2: 1760, dur: 0.3, type: 'sine', gain: 0.12, at: 0.04 });
  },
  fire() {
    unlock();
    transient({ dur: 0.42, cutoff: 1100, type: 'lowpass', gain: 0.55 });
    body({ f1: 110, f2: 38, dur: 0.5, type: 'sawtooth', gain: 0.3 });
  },
  heal() {
    unlock();
    [523, 659, 784].forEach((f, i) => body({ f1: f, f2: f * 1.5, dur: 0.34, type: 'sine', gain: 0.16, at: i * 0.07 }));
  },
  down() {
    unlock();
    transient({ dur: 0.2, cutoff: 700, gain: 0.5 });
    body({ f1: 220, f2: 45, dur: 0.55, type: 'triangle', gain: 0.3 });
  },
  select() { unlock(); body({ f1: 660, f2: 880, dur: 0.05, type: 'square', gain: 0.12 }); },
  cancel() { unlock(); body({ f1: 320, f2: 200, dur: 0.07, type: 'square', gain: 0.12 }); },
  victory() {
    unlock();
    [523, 659, 784, 1047].forEach((f, i) => body({ f1: f, f2: null, dur: 0.26, type: 'square', gain: 0.2, at: i * 0.15 }));
  },
};

// ---------- trilha ----------

// Paleta harmonica por capitulo. Graus em semitons sobre a tonica.
const TRACKS = {
  vogler:      { root: 146.83, scale: [0, 2, 3, 5, 7, 8, 10], bpm: 96,  wave: 'triangle' },
  catacumbas:  { root: 110.00, scale: [0, 1, 3, 5, 7, 8, 10], bpm: 72,  wave: 'sine' },
  infiltracao: { root: 130.81, scale: [0, 2, 3, 5, 7, 8, 11], bpm: 104, wave: 'square' },
  descida:     { root: 98.00,  scale: [0, 1, 3, 6, 7, 8, 11], bpm: 66,  wave: 'sine' },
  ponte:       { root: 164.81, scale: [0, 2, 3, 6, 7, 9, 10], bpm: 118, wave: 'sawtooth' },
  menu:        { root: 196.00, scale: [0, 2, 4, 5, 7, 9, 11], bpm: 84,  wave: 'triangle' },
};

export function playTrack(name) {
  unlock();
  if (currentTrack?.name === name) return;
  stopTrack();
  const spec = TRACKS[name];
  if (!spec) return;

  const beat = 60 / spec.bpm;
  const state = { name, timer: null, step: 0, stopped: false };

  const tick = () => {
    if (state.stopped || !ctx) return;
    const t = ctx.currentTime;
    const deg = spec.scale[(state.step * 3) % spec.scale.length];
    const oct = state.step % 8 < 4 ? 1 : 2;

    // baixo na tonica
    if (state.step % 4 === 0) voice(spec.root / 2, beat * 2, 0.12, 'triangle', t);
    // arpejo
    voice(spec.root * oct * Math.pow(2, deg / 12), beat * 0.9, 0.06, spec.wave, t);
    // percussao de ruido nos tempos fracos
    if (state.step % 2 === 1) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.05);
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 5000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.06, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      src.connect(f); f.connect(g); g.connect(musicGain);
      src.start(t); src.stop(t + 0.05);
    }

    state.step++;
    state.timer = setTimeout(tick, beat * 1000);
  };

  const voice = (freq, dur, gain, type, t) => {
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur);
  };

  currentTrack = state;
  tick();
}

export function stopTrack() {
  if (currentTrack) {
    currentTrack.stopped = true;
    clearTimeout(currentTrack.timer);
    currentTrack = null;
  }
}

function clamp01(v) { return Math.max(0, Math.min(1, Number(v) || 0)); }

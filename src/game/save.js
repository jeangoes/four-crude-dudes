// Save da campanha.
//
// Grava entre os nos, no mapa, que e o unico ponto seguro: no meio de um
// combate ha ordem de iniciativa, animacao pendente e reacao em aberto, e
// guardar isso e fragil. Quem sai no meio de uma batalha volta ao comeco
// daquele no, e a tela diz isso em vez de deixar descobrir depois.
//
// O que se guarda e o estado que o descanso nao devolve: nivel, PV, espacos
// gastos, recursos, dados de vida e as bandeiras da campanha.

import { CAPITULOS } from '../data/chapters.js';
import { PARTY_ORDER } from '../data/heroes.js';

const CHAVE = 'fcd_save';
const VERSAO = 1;

// ---------- serializacao ----------

export function serializar(campanha) {
  return {
    versao: VERSAO,
    quando: null,               // carimbado por `salvar`, para o menu mostrar
    capitulo: campanha.capituloIndex,
    no: campanha.noAtual,
    nivel: campanha.nivelAtual,
    visitados: [...campanha.visitados],
    bandeiras: [...campanha.bandeiras],
    grupo: campanha.party.map(p => ({
      id: p.id,
      hp: p.hp,
      tempHp: p.tempHp,
      morto: p.dead,
      salvaguardas: { ...p.deathSaves },
      estavel: p.stable,
      dadosDeVida: p.hitDice.used,
      // So o gasto: o maximo vem da tabela de nivel ao restaurar.
      espacos: Object.fromEntries(Object.entries(p.slots).map(([n, s]) => [n, s.used])),
      pacto: p.pactSlots ? p.pactSlots.used : null,
      recursos: Object.fromEntries(Object.entries(p.resources).map(([k, r]) => [k, r.used])),
      condicoes: [...p.conditions],
    })),
  };
}

/**
 * Devolve o estado guardado para um grupo ja construido e ja no nivel certo.
 * Chamar depois de `aplicarNivel`, nunca antes: o maximo de PV e de espacos
 * vem da tabela de nivel, e so o gasto vem daqui.
 */
export function aplicarAoGrupo(party, grupoSalvo) {
  for (const salvo of grupoSalvo || []) {
    const p = party.find(x => x.id === salvo.id);
    if (!p) continue;                      // ficha que nao existe mais: ignora

    p.hp = Math.max(0, Math.min(salvo.hp ?? p.maxHp, p.maxHp));
    p.tempHp = salvo.tempHp || 0;
    p._dead = !!salvo.morto;
    p.deathSaves = { success: 0, failure: 0, ...(salvo.salvaguardas || {}) };
    p.stable = !!salvo.estavel;
    p.hitDice.used = Math.min(salvo.dadosDeVida || 0, p.hitDice.max);

    for (const [n, used] of Object.entries(salvo.espacos || {})) {
      const s = p.slots[Number(n)];
      if (s) s.used = Math.min(used, s.max);
    }
    if (p.pactSlots && salvo.pacto !== null && salvo.pacto !== undefined) {
      p.pactSlots.used = Math.min(salvo.pacto, p.pactSlots.max);
    }
    for (const [k, used] of Object.entries(salvo.recursos || {})) {
      const r = p.resources[k];
      if (r) r.used = Math.min(used, r.max);
    }

    p.conditions = new Set(salvo.condicoes || []);
    // Efeito e concentracao sao de combate: nao atravessam o mapa.
    p.effects = [];
    p.concentration = null;
  }
}

// ---------- armazenamento ----------

export function salvar(campanha) {
  const dados = serializar(campanha);
  dados.quando = Date.now();
  try {
    localStorage.setItem(CHAVE, JSON.stringify(dados));
    return dados;
  } catch {
    // Modo privado ou cota estourada. O jogo continua; so nao guarda.
    return null;
  }
}

export function carregar() {
  try {
    const cru = localStorage.getItem(CHAVE);
    if (!cru) return null;
    const dados = JSON.parse(cru);
    if (!valido(dados)) { apagar(); return null; }
    return dados;
  } catch {
    return null;
  }
}

export function apagar() {
  try { localStorage.removeItem(CHAVE); } catch { /* nada a fazer */ }
}

export function existe() { return carregar() !== null; }

// Save de versao antiga ou corrompido nao vale a pena migrar num jogo
// desta escala: e melhor recusar e deixar comecar de novo do que restaurar
// um estado meio certo.
function valido(dados) {
  if (!dados || dados.versao !== VERSAO) return false;
  if (typeof dados.capitulo !== 'number' || !CAPITULOS[dados.capitulo]) return false;
  if (typeof dados.nivel !== 'number' || dados.nivel < 1) return false;
  if (!Array.isArray(dados.grupo) || dados.grupo.length === 0) return false;
  // O no precisa existir no capitulo; nulo significa capitulo terminado.
  if (dados.no !== null && !CAPITULOS[dados.capitulo].nos.some(n => n.id === dados.no)) return false;
  return true;
}

// ---------- para a tela de titulo ----------

export function resumo(dados) {
  if (!dados) return null;
  const cap = CAPITULOS[dados.capitulo];
  const no = cap?.nos.find(n => n.id === dados.no);
  const vivos = (dados.grupo || []).filter(g => !g.morto && g.hp > 0).length;
  return {
    capitulo: `${cap.numero} · ${cap.titulo}`,
    no: no?.titulo || 'capítulo concluído',
    nivel: dados.nivel,
    vivos,
    total: PARTY_ORDER.length,
    quando: dados.quando ? new Date(dados.quando) : null,
  };
}

export function resumoEmTexto(dados) {
  const r = resumo(dados);
  if (!r) return '';
  const caidos = r.total - r.vivos;
  return `${r.capitulo} · nível ${r.nivel} · ${r.no}` + (caidos ? ` · ${caidos} caído(s)` : '');
}

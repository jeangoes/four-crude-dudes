// Progressao de nivel.
//
// Cada heroi traz uma tabela explicita por nivel em vez de o motor tentar
// calcular multiclasse sozinho. Sao quatro fichas conhecidas, a tabela cabe
// em oito linhas cada, e da para conferir contra o papel. Tabela explicita
// erra menos que formula generica.
//
// O ultimo nivel de cada tabela bate exatamente com a ficha da mesa: e ali
// que a campanha termina, no nivel em que o grupo esta hoje.

import { proficiencyBonus } from './dice.js';

// Recursos aparecem na tela de evolucao, entao precisam de nome de gente.
const NOME_RECURSO = {
  canalizarDivindade: 'Canalizar Divindade',
  segundoFolego: 'Segundo Fôlego',
  bradoDeApoio: 'Brado de Apoio',
  clarao: 'Clarão Protetor',
  maldicaoDoHexblade: 'Maldição do Hexblade',
  inspiracaoDeBardo: 'Inspiração de Bardo',
  banquete: 'Banquete',
};

export function nomeDoRecurso(chave) {
  return NOME_RECURSO[chave] || chave;
}

/**
 * Aplica um nivel a um combatente ja construido.
 * Recalcula PV, CA, espacos, recursos e o que esta liberado do kit.
 */
export function aplicarNivel(combatente, nivel) {
  const tabela = combatente.sb.progressao;
  if (!tabela) return null;

  const alvo = Math.max(1, Math.min(nivel, tabela.length));
  const linha = tabela[alvo - 1];
  const anterior = combatente.nivelAtual ?? null;

  combatente.nivelAtual = alvo;
  combatente.sb.level = alvo;
  combatente.sb.prof = proficiencyBonus(alvo);
  combatente.sb.ac = linha.ac;

  // PV sobe junto: quem estava ferido continua ferido, mas ganha o teto novo.
  const ganho = linha.hp - combatente.sb.maxHp;
  combatente.sb.maxHp = linha.hp;
  if (ganho > 0) combatente.hp = Math.min(linha.hp, combatente.hp + ganho);
  combatente.hp = Math.min(combatente.hp, linha.hp);

  // Espacos de magia: a tabela do nivel manda, sempre. Reconstruir em vez de
  // somar, senao o construtor (que monta a partir da ficha do nivel maximo)
  // deixaria o Darian de nivel 1 com espacos de 4o nivel.
  //
  // O gasto sobrevive nos niveis que continuam existindo: subir de nivel no
  // meio do dia nao devolve o que ja se usou. O espaco novo entra cheio.
  const gastoAnterior = {};
  for (const [n, s] of Object.entries(combatente.slots || {})) gastoAnterior[n] = s.used;

  combatente.slots = {};
  for (const [lvl, max] of Object.entries(linha.slots || {})) {
    const n = Number(lvl);
    combatente.slots[n] = { max, used: Math.min(gastoAnterior[n] || 0, max) };
  }

  if (linha.pacto) {
    const usadoPacto = combatente.pactSlots?.used || 0;
    combatente.pactSlots = {
      level: linha.pacto.nivel,
      max: linha.pacto.espacos,
      used: Math.min(usadoPacto, linha.pacto.espacos),
    };
  } else {
    combatente.pactSlots = null;
  }

  const gastoRecursos = {};
  for (const [k, r] of Object.entries(combatente.resources || {})) gastoRecursos[k] = r.used;

  combatente.resources = {};
  for (const [chave, max] of Object.entries(linha.recursos || {})) {
    combatente.resources[chave] = { max, used: Math.min(gastoRecursos[chave] || 0, max) };
  }

  // Tracos que so existem a partir de certo nivel: Esculpir Magias no 2,
  // Truque Potente no 6, Conjurador de Guerra no 4.
  if (linha.features) combatente.sb.features = [...linha.features];
  // Arma que muda com a classe: o Lathuriel so pega a espada do pacto
  // depois do mergulho em Bruxo.
  if (linha.acoes) combatente.sb.actions = linha.acoes.map(a => ({ ...a }));
  // O dano da Radiancia escala pelo nivel de clerigo, nao pelo do personagem.
  if (linha.clericLevel !== undefined) combatente.sb.clericLevel = linha.clericLevel;

  combatente.hitDice.max = alvo;
  combatente.hitDice.used = Math.min(combatente.hitDice.used, alvo);

  return {
    de: anterior, para: alvo,
    hp: linha.hp, ac: linha.ac,
    prof: combatente.sb.prof,
    novidades: novidadesEntre(combatente, anterior, alvo),
  };
}

// O que passou a existir entre um nivel e outro. E o que a tela de evolucao
// mostra, e o motivo de subir de nivel ser um acontecimento e nao um numero.
export function novidadesEntre(combatente, de, para) {
  if (de === null) return [];
  const novas = [];
  const listas = [
    ['magia', combatente.sb.spells || []],
    ['talento', combatente.sb.talents || []],
    ['reação', combatente.sb.reactions || []],
  ];
  for (const [tipo, lista] of listas) {
    for (const item of lista) {
      const n = item.nivel || 1;
      if (n > de && n <= para) novas.push({ tipo, nome: item.name, nivel: n });
    }
  }
  // Recurso novo ou aumentado também é novidade.
  const antes = combatente.sb.progressao[de - 1]?.recursos || {};
  const agora = combatente.sb.progressao[para - 1]?.recursos || {};
  for (const [chave, max] of Object.entries(agora)) {
    if ((antes[chave] || 0) < max) {
      novas.push({ tipo: 'recurso', nome: nomeDoRecurso(chave), quantidade: max });
    }
  }
  return novas;
}

// Filtra o kit pelo nivel. O menu de comando so mostra o que ja existe.
export function liberado(item, nivel) {
  return (item.nivel || 1) <= nivel;
}

export function kitDisponivel(combatente) {
  const n = combatente.nivelAtual ?? combatente.level;
  return {
    spells: (combatente.sb.spells || []).filter(s => liberado(s, n)),
    talents: (combatente.sb.talents || []).filter(t => liberado(t, n)),
    reactions: (combatente.sb.reactions || []).filter(r => liberado(r, n)),
  };
}

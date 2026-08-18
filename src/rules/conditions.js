// Condicoes de 5e.
//
// Cada condicao declara o que faz mecanicamente, em vez de espalhar `if`
// pelo motor. combat.js consulta estas tabelas ao montar uma jogada.

export const CONDITIONS = {
  cego: {
    label: 'Cego',
    attacksAgainstHaveAdvantage: true,
    ownAttacksHaveDisadvantage: true,
    autoFailChecks: ['visao'],
  },
  amedrontado: {
    label: 'Amedrontado',
    // Desvantagem enquanto a fonte do medo estiver na linha de visao.
    ownAttacksHaveDisadvantage: true,
    ownChecksHaveDisadvantage: true,
    cannotApproachSource: true,
  },
  agarrado: {
    label: 'Agarrado',
    speed: 0,
  },
  incapacitado: {
    label: 'Incapacitado',
    noAction: true,
    noBonusAction: true,
    noReaction: true,
  },
  paralisado: {
    label: 'Paralisado',
    noAction: true,
    noBonusAction: true,
    noReaction: true,
    speed: 0,
    autoFailSaves: ['for', 'des'],
    attacksAgainstHaveAdvantage: true,
    critWithinReach: true,
  },
  envenenado: {
    label: 'Envenenado',
    ownAttacksHaveDisadvantage: true,
    ownChecksHaveDisadvantage: true,
  },
  caido: {
    label: 'Caído',
    ownAttacksHaveDisadvantage: true,
    // Quem ataca de perto tem vantagem; de longe, desvantagem.
    attacksAgainstHaveAdvantage: 'melee',
    attacksAgainstHaveDisadvantage: 'ranged',
    costsHalfMovementToStand: true,
  },
  contido: {
    label: 'Contido',
    speed: 0,
    ownAttacksHaveDisadvantage: true,
    attacksAgainstHaveAdvantage: true,
    autoFailSaves: [],
    savesWithDisadvantage: ['des'],
  },
  atordoado: {
    label: 'Atordoado',
    noAction: true,
    noBonusAction: true,
    noReaction: true,
    speed: 0,
    autoFailSaves: ['for', 'des'],
    attacksAgainstHaveAdvantage: true,
  },
  inconsciente: {
    label: 'Inconsciente',
    noAction: true,
    noBonusAction: true,
    noReaction: true,
    speed: 0,
    autoFailSaves: ['for', 'des'],
    attacksAgainstHaveAdvantage: true,
    critWithinReach: true,
  },
  enfeiticado: {
    label: 'Enfeitiçado',
    cannotTargetSource: true,
  },
  invisivel: {
    label: 'Invisível',
    ownAttacksHaveAdvantage: true,
    attacksAgainstHaveDisadvantage: true,
  },
  abencoado: {
    label: 'Abençoado',
    // Bless nao e condicao oficial, mas o motor trata efeito continuo do
    // mesmo jeito: um modificador com duracao.
    bonusToAttacks: '1d4',
    bonusToSaves: '1d4',
  },
  amaldicoado: {
    label: 'Amaldiçoado',
    // Bestow Curse na variante de desvantagem em testes de um atributo.
    ownChecksHaveDisadvantage: true,
  },
};

// Condicoes que impedem qualquer acao. Uma so ja basta para pular o turno.
export const INCAPACITATING = Object.entries(CONDITIONS)
  .filter(([, c]) => c.noAction)
  .map(([k]) => k);

export function isKnown(name) {
  return Object.prototype.hasOwnProperty.call(CONDITIONS, name);
}

export function label(name) {
  return CONDITIONS[name]?.label || name;
}

// Junta as condicoes ativas num unico resumo de efeitos. Booleanos usam OU;
// velocidade usa o menor valor; listas concatenam.
export function summarize(names = []) {
  const out = {
    noAction: false, noBonusAction: false, noReaction: false,
    speedOverride: null,
    ownAttacksHaveAdvantage: false, ownAttacksHaveDisadvantage: false,
    ownChecksHaveDisadvantage: false,
    attacksAgainstHaveAdvantage: false, attacksAgainstHaveDisadvantage: false,
    attacksAgainstAdvantageWhen: null, attacksAgainstDisadvantageWhen: null,
    critWithinReach: false,
    autoFailSaves: [], savesWithDisadvantage: [],
    bonusToAttacks: [], bonusToSaves: [],
  };

  for (const name of names) {
    const c = CONDITIONS[name];
    if (!c) continue;
    for (const flag of ['noAction', 'noBonusAction', 'noReaction', 'ownAttacksHaveAdvantage',
      'ownAttacksHaveDisadvantage', 'ownChecksHaveDisadvantage', 'critWithinReach']) {
      if (c[flag]) out[flag] = true;
    }
    if (c.speed !== undefined) {
      out.speedOverride = out.speedOverride === null ? c.speed : Math.min(out.speedOverride, c.speed);
    }
    // Valor string ('melee'/'ranged') vira condicional; true vira geral.
    if (c.attacksAgainstHaveAdvantage === true) out.attacksAgainstHaveAdvantage = true;
    else if (typeof c.attacksAgainstHaveAdvantage === 'string') out.attacksAgainstAdvantageWhen = c.attacksAgainstHaveAdvantage;
    if (c.attacksAgainstHaveDisadvantage === true) out.attacksAgainstHaveDisadvantage = true;
    else if (typeof c.attacksAgainstHaveDisadvantage === 'string') out.attacksAgainstDisadvantageWhen = c.attacksAgainstHaveDisadvantage;

    if (c.autoFailSaves) out.autoFailSaves.push(...c.autoFailSaves);
    if (c.savesWithDisadvantage) out.savesWithDisadvantage.push(...c.savesWithDisadvantage);
    if (c.bonusToAttacks) out.bonusToAttacks.push(c.bonusToAttacks);
    if (c.bonusToSaves) out.bonusToSaves.push(c.bonusToSaves);
  }
  return out;
}

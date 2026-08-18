// Dados. Nucleo de tudo: se isto estiver errado, o resto mente.
//
// O gerador e injetavel para que teste seja deterministico. Em jogo usa
// Math.random; em teste, uma sequencia fixa.

let rng = Math.random;

export function setRng(fn) { rng = fn; }
export function resetRng() { rng = Math.random; }

export function die(sides) {
  return Math.floor(rng() * sides) + 1;
}

// ---------- notacao ----------

// Aceita "2d6+3", "1d8", "3d6-1", "2d6+1d4+2", "5". Devolve termos.
export function parse(notation) {
  if (typeof notation === 'number') return { dice: [], flat: notation };
  const clean = String(notation).replace(/\s+/g, '').toLowerCase();
  if (!/^[+-]?(\d*d\d+|\d+)([+-](\d*d\d+|\d+))*$/.test(clean)) {
    throw new Error(`notacao de dados invalida: ${notation}`);
  }
  const terms = clean.match(/[+-]?(?:\d*d\d+|\d+)/g) || [];
  const dice = [];
  let flat = 0;
  for (const term of terms) {
    const sign = term.startsWith('-') ? -1 : 1;
    const bare = term.replace(/^[+-]/, '');
    if (bare.includes('d')) {
      const [n, s] = bare.split('d');
      dice.push({ count: (n === '' ? 1 : parseInt(n, 10)) * sign, sides: parseInt(s, 10) });
    } else {
      flat += sign * parseInt(bare, 10);
    }
  }
  return { dice, flat };
}

// Rola a notacao. `crit` dobra a quantidade de dados, nunca o fixo, que e a
// regra de 5e para acerto critico.
export function rollNotation(notation, { crit = false, min = 0 } = {}) {
  const { dice, flat } = parse(notation);
  const rolls = [];
  let total = flat;
  for (const group of dice) {
    const count = Math.abs(group.count) * (crit ? 2 : 1);
    const sign = Math.sign(group.count);
    for (let i = 0; i < count; i++) {
      const v = die(group.sides);
      rolls.push({ sides: group.sides, value: v, sign });
      total += v * sign;
    }
  }
  return { total: Math.max(min, total), rolls, flat, notation: String(notation), crit };
}

// ---------- d20 ----------

// Vantagem e desvantagem se cancelam, e nunca empilham: 5e literal.
export function d20({ mod = 0, advantage = false, disadvantage = false, critRange = 20 } = {}) {
  const net = advantage && disadvantage ? 'flat' : advantage ? 'adv' : disadvantage ? 'dis' : 'flat';
  const rolls = net === 'flat' ? [die(20)] : [die(20), die(20)];
  const natural = net === 'adv' ? Math.max(...rolls) : net === 'dis' ? Math.min(...rolls) : rolls[0];
  return {
    rolls,
    natural,
    mod,
    total: natural + mod,
    mode: net,
    crit: natural >= critRange,
    fumble: natural === 1,
  };
}

// ---------- resolucoes ----------

// Jogada de ataque contra CA. Natural 20 sempre acerta, natural 1 sempre erra.
export function attackRoll({ mod = 0, ac, advantage, disadvantage, critRange = 20 }) {
  const r = d20({ mod, advantage, disadvantage, critRange });
  const hit = r.crit ? true : r.fumble ? false : r.total >= ac;
  return { ...r, ac, hit, critHit: r.crit && hit };
}

// Teste de resistencia ou de pericia contra uma CD.
export function checkRoll({ mod = 0, dc, advantage, disadvantage }) {
  const r = d20({ mod, advantage, disadvantage });
  return { ...r, dc, success: r.total >= dc };
}

// ---------- utilitarios ----------

export function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}

// Bonus de proficiencia por nivel, tabela de 5e.
export function proficiencyBonus(level) {
  return 2 + Math.floor((Math.max(1, Math.min(20, level)) - 1) / 4);
}

// Formata uma rolagem para o log, do jeito que a mesa reconhece.
export function describe(roll) {
  if (roll.rolls && roll.natural !== undefined) {
    const dice = roll.mode === 'flat' ? `d20(${roll.natural})` : `d20(${roll.rolls.join(',')}→${roll.natural})`;
    const sign = roll.mod >= 0 ? '+' : '';
    return `${dice}${roll.mod ? sign + roll.mod : ''} = ${roll.total}`;
  }
  const values = roll.rolls.map(r => r.value).join(',');
  const sign = roll.flat >= 0 ? '+' : '';
  return `${roll.notation}${roll.crit ? ' (crítico)' : ''}: [${values}]${roll.flat ? sign + roll.flat : ''} = ${roll.total}`;
}

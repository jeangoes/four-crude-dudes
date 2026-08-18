// Ficha do grupo. Aberta com I, mostra o que a mesa consulta no papel:
// atributos, defesas, recursos gastos, condicoes ativas e concentracao.

import { ABILITIES, SKILLS } from '../rules/statblock.js';

const NOMES = { for: 'FOR', des: 'DES', con: 'CON', int: 'INT', sab: 'SAB', car: 'CAR' };

export function renderSheet(painel, party) {
  if (!party?.length) {
    painel.innerHTML = '<h3>Ficha</h3><p>Nenhum grupo em jogo.</p>';
    return;
  }
  painel.innerHTML = `<h3>O grupo</h3>` + party.map(fichaDe).join('');
}

function fichaDe(c) {
  const sinal = n => (n >= 0 ? `+${n}` : `${n}`);

  const atributos = ABILITIES.map(a =>
    `<div class="ficha-attr"><b>${NOMES[a]}</b><span>${c.sb.abilities[a]}</span><i>${sinal(c.mod(a))}</i></div>`
  ).join('');

  const espacos = Object.entries(c.slots)
    .map(([nivel, s]) => `${nivel}º ${s.max - s.used}/${s.max}`)
    .concat(c.pactSlots ? [`pacto ${c.pactSlots.max - c.pactSlots.used}/${c.pactSlots.max}`] : [])
    .join(' · ') || 'não conjura';

  const recursos = Object.entries(c.resources)
    .map(([k, r]) => `${k} ${r.max - r.used}/${r.max}`).join(' · ') || '—';

  // Só as perícias em que ele é proficiente: a lista inteira vira ruído.
  const pericias = [...new Set([...c.sb.skillProficiencies, ...c.sb.skillExpertise])]
    .sort()
    .map(p => `${p} ${sinal(c.skillBonus(p))}`).join(' · ') || '—';

  const condicoes = [...c.conditions].join(', ') || 'nenhuma';

  return `
    <section class="ficha">
      <header>
        <h4>${c.name}${c.sb.provisorio ? ' <em>(ficha provisória)</em>' : ''}</h4>
        <span>${c.sb.classe || ''}${c.sb.raca ? ' · ' + c.sb.raca : ''} · nível ${c.level}</span>
      </header>
      <div class="ficha-attrs">${atributos}</div>
      <dl class="ficha-linhas">
        <dt>PV</dt><dd>${c.hp}/${c.maxHp}${c.tempHp ? ` (+${c.tempHp} temp)` : ''}${c.down ? ' — caído' : ''}</dd>
        <dt>CA</dt><dd>${c.ac}</dd>
        <dt>Iniciativa</dt><dd>${sinal(c.initiativeBonus)}</dd>
        <dt>Deslocamento</dt><dd>${c.speed} m</dd>
        ${c.spellSaveDC ? `<dt>CD de magia</dt><dd>${c.spellSaveDC} · ataque ${sinal(c.spellAttack)}</dd>` : ''}
        <dt>Espaços</dt><dd>${espacos}</dd>
        <dt>Recursos</dt><dd>${recursos}</dd>
        <dt>Dados de vida</dt><dd>${c.hitDice.max - c.hitDice.used}/${c.hitDice.max} d${c.hitDice.sides}</dd>
        <dt>Perícias</dt><dd>${pericias}</dd>
        <dt>Condições</dt><dd>${condicoes}</dd>
        ${c.concentration ? `<dt>Concentração</dt><dd>${c.concentration.spell}</dd>` : ''}
      </dl>
    </section>`;
}

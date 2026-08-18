// Talentos de classe: o que nao e magia nem ataque de arma.
//
// Canalizar Divindade, Maldicao do Hexblade, Segundo Folego. Sao acoes com
// custo de recurso em vez de espaco de magia. A forma e a mesma de uma
// magia (alcance, area, resistencia, dano), entao a sessao resolve pelo
// mesmo caminho; quem precisa de regra propria traz um `resolve`.

import { rollNotation, checkRoll, describe } from '../rules/dice.js';

export const TALENTS = {
  // --- Elandrin ---

  radianciaDoAmanhecer: {
    id: 'radianciaDoAmanhecer', name: 'Radiância do Amanhecer',
    resource: 'canalizarDivindade', castTime: 'acao',
    range: 0, color: '#f0c94a',
    area: { shape: 'esfera', radius: 9 },
    hitsAllies: false,
    detail: 'Luz explode de Elandrin. Dissipa trevas mágicas e queima quem estiver em volta.',
    rule: 'Canalizar Divindade · esfera de 9 m · resistência de DES para metade',
    resolve({ encounter, actor, targets }) {
      const events = [];
      // 2d10 + nivel de clerigo. Elandrin e Clerigo 5.
      const nivelClerigo = actor.sb.clericLevel ?? 5;
      for (const alvo of targets) {
        if (alvo.side === actor.side) continue;         // so os hostis
        const save = checkRoll({ mod: alvo.saveBonus('des'), dc: actor.spellSaveDC });
        const dano = rollNotation(`2d10+${nivelClerigo}`);
        const total = save.success ? Math.floor(dano.total / 2) : dano.total;
        events.push({
          type: 'save-roll', target: alvo.id, success: save.success,
          text: `${alvo.name} resiste com DES: ${describe(save)} vs CD ${actor.spellSaveDC} — ${save.success ? 'passa' : 'falha'}`,
        });
        const res = alvo.applyDamage(total, 'radiante');
        events.push({
          type: 'damage', target: alvo.id, amount: res.taken, damageType: 'radiante', wentDown: res.wentDown,
          text: `${alvo.name} sofre ${res.taken} de radiante — ${describe(dano)}${save.success ? ' → metade' : ''}`,
        });
      }
      if (!events.length) events.push({ type: 'info', text: 'A luz não alcança nenhum inimigo' });
      return events;
    },
  },

  expulsarMortosVivos: {
    id: 'expulsarMortosVivos', name: 'Expulsar Mortos-Vivos',
    resource: 'canalizarDivindade', castTime: 'acao',
    range: 0, color: '#e8dcc0',
    area: { shape: 'esfera', radius: 9 },
    detail: 'Os mortos-vivos fogem de Elandrin. Os mais fracos se desfazem na hora.',
    rule: 'Canalizar Divindade · esfera de 9 m · resistência de SAB · destrói morto-vivo de ND ≤ 1/2',
    resolve({ encounter, actor, targets }) {
      const events = [];
      const mortosVivos = targets.filter(t => t.side !== actor.side && t.sb.tipo === 'morto-vivo');
      if (!mortosVivos.length) {
        return [{ type: 'info', text: 'Nenhum morto-vivo ao alcance: o Canalizar não faz efeito' }];
      }
      for (const alvo of mortosVivos) {
        const save = checkRoll({ mod: alvo.saveBonus('sab'), dc: actor.spellSaveDC });
        events.push({
          type: 'save-roll', target: alvo.id, success: save.success,
          text: `${alvo.name} resiste com SAB: ${describe(save)} vs CD ${actor.spellSaveDC} — ${save.success ? 'resiste' : 'falha'}`,
        });
        if (save.success) continue;
        // Destruicao imediata dos fracos, a marca do clerigo em cripta.
        if ((alvo.sb.nd ?? 1) <= 0.5) {
          alvo.applyDamage(alvo.hp + alvo.tempHp, 'radiante');
          alvo._dead = true;
          events.push({ type: 'down', target: alvo.id, text: `${alvo.name} se desfaz em pó` });
        } else {
          alvo.addCondition('amedrontado');
          alvo.addEffect({ key: 'expulso', label: 'expulso pela fé', rounds: 10, data: { fleeFrom: actor.id } });
          events.push({ type: 'condition', target: alvo.id, condition: 'amedrontado', text: `${alvo.name} recua apavorado` });
        }
      }
      return events;
    },
  },

  segundoFolego: {
    id: 'segundoFolego', name: 'Segundo Fôlego',
    resource: 'segundoFolego', castTime: 'bonus',
    range: 0, targetSide: 'self', color: '#9cffb0',
    detail: 'Elandrin retoma o fôlego e fecha os próprios cortes.',
    rule: 'Ação bônus · 1d10 + nível de guerreiro',
    resolve({ actor }) {
      const cura = rollNotation('1d10+1', { min: 1 });
      const res = actor.heal(cura.total);
      return [{
        type: 'heal', target: actor.id, amount: res.healed,
        text: `${actor.name} recupera ${res.healed} PV — ${describe(cura)}`,
      }];
    },
  },

  brandoDeApoio: {
    id: 'brandoDeApoio', name: 'Brado de Apoio',
    resource: 'bradoDeApoio', castTime: 'bonus',
    range: 18, targetSide: 'ally', color: '#f0c94a',
    detail: 'Um grito que firma os aliados. Dá pontos de vida temporários.',
    rule: 'Ação bônus · alcance 18 m · PV temporário não acumula',
    resolve({ actor, targets }) {
      const events = [];
      for (const alvo of targets) {
        const temp = rollNotation('1d6+4');
        const aplicou = alvo.grantTempHp(temp.total);
        events.push({
          type: 'temphp', target: alvo.id, amount: temp.total,
          text: aplicou
            ? `${alvo.name} ganha ${temp.total} PV temporários — ${describe(temp)}`
            : `${alvo.name} já tem PV temporários maiores`,
        });
      }
      return events;
    },
  },

  // --- Lathuriel ---

  maldicaoDoHexblade: {
    id: 'maldicaoDoHexblade', name: 'Maldição do Hexblade',
    resource: 'maldicaoDoHexblade', castTime: 'bonus',
    range: 9, color: '#b388ff',
    detail: 'Lathuriel marca um inimigo. Contra ele acerta mais fundo, critica mais fácil, e a morte dele o cura.',
    rule: 'Ação bônus · alcance 9 m · dano extra, crítico em 19, cura ao matar · 1 minuto',
    resolve({ actor, targets }) {
      const alvo = targets[0];
      if (!alvo) return [{ type: 'info', text: 'Nenhum alvo' }];
      actor.addEffect({
        key: 'maldicaoHexblade',
        label: `maldição sobre ${alvo.name}`,
        rounds: 10,
        data: {
          markedTarget: alvo.id,
          extraDamage: `${actor.prof}`,
          extraDamageType: 'necrotico',
          critRange: 19,
          healOnKill: actor.level + actor.mod('car'),
        },
      });
      return [{
        type: 'effect', target: actor.id, effect: 'maldicaoHexblade',
        text: `${actor.name} amaldiçoa ${alvo.name}: dano extra e crítico em 19 contra ele`,
      }];
    },
  },

  florearDeLamina: {
    id: 'florearDeLamina', name: 'Florear de Lâmina',
    resource: 'inspiracaoDeBardo', castTime: 'livre',
    range: 1.5, color: '#f0c94a',
    detail: 'Um floreio no golpe: dano extra e um passo lateral livre.',
    rule: 'Gasta Inspiração de Bardo · soma 1d6 ao dano do próximo acerto',
    resolve({ actor }) {
      actor.addEffect({
        key: 'florear', label: 'floreio preparado', rounds: 1,
        data: { extraDamage: '1d6', extraDamageType: 'cortante' },
      });
      return [{ type: 'effect', target: actor.id, effect: 'florear', text: `${actor.name} prepara um floreio` }];
    },
  },
};

// Quem tem qual talento. Mantido fora da ficha para a ficha nao inchar.
export const TALENT_SETS = {
  ELANDRIN: ['radianciaDoAmanhecer', 'expulsarMortosVivos', 'segundoFolego', 'brandoDeApoio'],
  LATHURIEL: ['maldicaoDoHexblade', 'florearDeLamina'],
  DARIAN: [],
  OWO: [],
};

export function talentsFor(key) {
  return (TALENT_SETS[key] || []).map(id => TALENTS[id]);
}

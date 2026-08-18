// NPCs e cenas de dialogo.
//
// Uma cena e uma lista de falas. Cada fala pode oferecer escolhas, e uma
// escolha pode exigir teste de pericia. O resultado marca uma bandeira na
// campanha, que os nos seguintes consultam.
//
// Tudo aqui e fiel ao que aconteceu na mesa. O Julgamento dos Dragoes foi
// vencido com a diplomacia do Lathuriel mais a fe do Elandrin, e e assim
// que ele se resolve aqui.

import { MONSTERS } from './monsters.js';
import { defineStatblock } from '../rules/statblock.js';

export const NPCS = {
  DARRET: { id: 'darret', name: 'Darret', titulo: 'comandante de Kalaman', sprite: null },
  ESPIRITO_DRAGAO: { id: 'espiritoDragao', name: 'Espírito de Dragão', titulo: 'guardião dos túmulos', sprite: null },
  CORNELIUS: { id: 'cornelius', name: 'Conde Cornelius', titulo: 'Stefannius Cornelius Du-Lac de Limbo', sprite: null },
  DEMELIN: { id: 'demelin', name: 'Demelin', titulo: 'Alta Maga de Silvanesti', sprite: null },
  SOTH: { id: 'soth', name: 'Lord Soth', titulo: 'cavaleiro da morte', sprite: null },
};

// Conde Cornelius entra como convidado controlavel no capitulo 5, no
// formato de guest character: bloco proprio, entra e sai por roteiro.
export const CONVIDADOS = {
  CORNELIUS: () => defineStatblock({
    id: 'cornelius', name: 'Conde Cornelius', sprite: 'CORNELIUS', side: 'ally',
    classe: 'Death Slaad', raca: 'Slaad do Limbo', level: 10, hitDie: 8,
    convidado: true,
    abilities: { for: 18, des: 15, con: 19, int: 15, sab: 10, car: 16 },
    ac: 18, maxHp: 90, speed: 9,
    resistances: ['acido', 'frio', 'fogo', 'raio', 'trovejante'],
    tactic: 'bruto',
    skillProficiencies: ['persuasao', 'enganacao'],
    actions: [
      { name: 'Garras', kind: 'melee', ability: 'for', reach: 1.5, damage: { dice: '2d6', type: 'cortante' } },
    ],
    talents: [{
      id: 'banquete', name: 'Banquete',
      resource: 'banquete', castTime: 'acao', range: 1.5, color: '#c0392b',
      detail: 'O Conde devora um inimigo já ferido, inteiro, com molho.',
      rule: 'Ação · alvo adjacente abaixo de metade dos PV · uma vez por encontro',
      resolve({ actor, targets }) {
        const alvo = targets[0];
        if (!alvo) return [{ type: 'info', text: 'Nenhum prato à mão' }];
        if (alvo.hp > alvo.maxHp / 2) {
          return [{ type: 'info', text: `${alvo.name} ainda está inteiro demais para o paladar do Conde` }];
        }
        alvo.applyDamage(alvo.hp + alvo.tempHp, 'necrotico');
        alvo._dead = true;
        actor.grantTempHp(15);
        return [
          { type: 'down', target: alvo.id, text: `O Conde devora ${alvo.name} sem deixar sobra` },
          { type: 'temphp', target: actor.id, amount: 15, text: 'O Conde ganha 15 PV temporários e elogia o tempero' },
        ];
      },
    }],
    resources: { banquete: 1 },
  }),
};

// Lord Soth: nao se vence no braco. O bloco existe para pressionar, nao
// para cair.
export const SOTH = () => defineStatblock({
  id: 'soth', name: 'Lord Soth', sprite: 'SOTH', side: 'foe',
  level: 19, hitDie: 8, nd: 19,
  invulnerable: true,
  abilities: { for: 20, des: 16, con: 20, int: 16, sab: 18, car: 18 },
  ac: 20, maxHp: 180, speed: 9,
  tactic: 'bruto',
  immunities: ['necrotico', 'veneno'],
  conditionImmunities: ['envenenado', 'enfeiticado', 'amedrontado'],
  actions: [
    { name: 'Espada flamejante', kind: 'melee', ability: 'for', reach: 1.5,
      damage: { dice: '2d10', type: 'cortante' },
      extraDamage: [{ dice: '2d6', type: 'fogo' }] },
  ],
});

// ---------- cenas ----------

export const CENAS = {
  darretPlano: {
    id: 'darretPlano',
    fundo: { top: '#161018', bottom: '#2a1f16', glow: 'rgba(201,162,39,0.12)' },
    falas: [
      { quem: 'DARRET', texto: 'A entrada da Cidade dos Nomes Perdidos está guardada. Se batermos de frente, morremos na muralha e o inimigo chega ao artefato antes.' },
      { quem: 'DARRET', texto: 'Meu exército pode fazer barulho de um lado. Vocês entram pelo outro. É a única forma.' },
      {
        quem: 'DARRET', texto: 'Como querem fazer?',
        escolhas: [
          {
            texto: 'Entrar pela passagem secreta enquanto o exército distrai.',
            bandeira: 'infiltracaoFurtiva',
            resposta: 'Então é isso. Vou dar a vocês uma hora de gritaria. Usem bem.',
          },
          {
            texto: 'Pedir que o exército ataque com tudo e entrar no meio do caos.',
            teste: { pericia: 'persuasao', cd: 15, quem: 'lathuriel' },
            bandeira: 'infiltracaoAberta',
            sucesso: 'Darret encara você por um tempo, depois assente. "Vai custar homens. Que não seja em vão."',
            falha: 'Darret balança a cabeça. "Não vou queimar meu exército num plano que não fecha. Fazemos do meu jeito."',
            bandeiraFalha: 'infiltracaoFurtiva',
          },
        ],
      },
    ],
  },

  julgamentoDosDragoes: {
    id: 'julgamentoDosDragoes',
    fundo: { top: '#0c1418', bottom: '#16242a', glow: 'rgba(120,255,200,0.10)' },
    falas: [
      { texto: 'A última porta da descida está trancada. Atrás dela, uma sala cerimonial intacta, adornada com crânios de dragões.' },
      { quem: 'ESPIRITO_DRAGAO', texto: 'Profanadores. Vocês pisam sobre nossos túmulos como pisaram há três séculos, quando nos usaram de ferramenta e de combustível para erguer uma cidade aos céus.' },
      { quem: 'ESPIRITO_DRAGAO', texto: 'Deem-me um motivo para não arrancar de vocês o que os mortais devem aos dragões.' },
      {
        quem: 'ESPIRITO_DRAGAO', texto: 'Falem. E que fale mais de um, se quiserem ser ouvidos.',
        // Duas vozes: foi assim na mesa. Uma so nao desarma o espirito.
        vezes: 2,
        escolhas: [
          {
            texto: 'Lathuriel costura diplomacia onde há fúria.',
            teste: { pericia: 'persuasao', cd: 16, quem: 'lathuriel' },
            bandeira: 'julgamentoDiplomacia',
            sucesso: 'A voz do bardo desarma a acusação sem negá-la. O ódio do espírito perde o fio.',
            falha: 'As palavras escorregam. O espírito não se move.',
          },
          {
            texto: 'Elandrin revela a missão: Bahamut contra a tirania de Takhisis.',
            teste: { pericia: 'religiao', cd: 15, quem: 'elandrin' },
            bandeira: 'julgamentoFe',
            sucesso: 'A convicção do clérigo pesa mais que o argumento. O espírito reconhece o nome que ele invoca.',
            falha: 'O espírito ri, e o riso corta. "Fé não devolve os mortos."',
          },
          {
            texto: 'Darian invoca a linhagem de Demelin e a alta magia de Istar.',
            teste: { pericia: 'historia', cd: 17, quem: 'darian' },
            bandeira: 'julgamentoLinhagem',
            sucesso: 'O espírito reconhece o sangue de quem ergueu a cidade, e hesita.',
            falha: '"Linhagem", cospe o espírito. "É justamente o sangue de vocês que nos matou."',
          },
          {
            texto: 'Sacar a arma.',
            bandeira: 'julgamentoCombate',
            resposta: 'O espírito não espera o segundo movimento.',
            combate: true,
          },
        ],
      },
    ],
    // Duas vozes bastam. Foi assim na mesa: a palavra macia de um mais a
    // convicção do outro.
    resolucao({ bandeiras }) {
      if (bandeiras.has('julgamentoCombate')) {
        return { desfecho: 'combate', texto: 'O ódio dos túmulos toma forma.' };
      }
      const vozes = ['julgamentoDiplomacia', 'julgamentoFe', 'julgamentoLinhagem']
        .filter(b => bandeiras.has(b)).length;
      if (vozes >= 2) {
        return {
          desfecho: 'paz',
          bandeira: 'julgamentoVencido',
          texto: 'Entre a palavra macia de um e a convicção do outro, o espírito cede. Aceita a jornada do grupo como uma chance de redenção para os vivos, e a tensão se desfaz no ar. A porta se abre.',
        };
      }
      return {
        desfecho: 'combate',
        texto: 'Uma voz só não basta. O espírito ergue os crânios ao redor e a sala esfria.',
      };
    },
  },

  condeCornelius: {
    id: 'condeCornelius',
    fundo: { top: '#140f1a', bottom: '#2c2018', glow: 'rgba(180,60,140,0.12)' },
    falas: [
      { texto: 'Num canto bonito demais para ignorar, uma figura grande examina as próprias garras com tédio aristocrático. Usa, de todas as coisas, uma cartola com broche brilhante e uma pena vermelha.' },
      { quem: 'CORNELIUS', texto: 'Conde Stefannius Cornelius Du-Lac de Limbo, criado na alta sociedade do plano de onde venho. E vocês são o quê, exatamente? Almoço ou companhia?' },
      { quem: 'CORNELIUS', texto: 'Antes que respondam: elfo dá azia, e humano comum é sem graça. O que eu quero mesmo é draconiano. Vivo. Paralisado. Uma perninha de cada vez, com molho.' },
      {
        quem: 'CORNELIUS', texto: 'Pois bem?',
        escolhas: [
          {
            texto: 'Oferecer os draconianos da ponte em troca de companhia.',
            teste: { pericia: 'persuasao', cd: 14, quem: 'lathuriel' },
            bandeira: 'condeAliado',
            sucesso: 'O Conde tira a cartola numa mesura. "Meus caros. Isto é o começo de uma bela amizade."',
            falha: 'O Conde boceja. "Talvez eu os acompanhe. Talvez eu os coma. Vamos descobrindo."',
            bandeiraFalha: 'condeIndiferente',
          },
          {
            texto: 'Elogiar a cartola e perguntar de onde ela vem.',
            teste: { pericia: 'atuacao', cd: 12, quem: 'lathuriel' },
            bandeira: 'condeAliado',
            sucesso: 'O Conde ilumina-se. "Enfim, alguém com olho." Sobre a origem, ele desconversa, mas fica.',
            falha: 'O Conde ajeita a cartola, ofendido. "Não fale do que não entende."',
            bandeiraFalha: 'condeIndiferente',
          },
          {
            texto: 'Atacar antes que ele decida por conta própria.',
            bandeira: 'condeInimigo',
            resposta: 'A cartola flutua um instante no ar vazio, e some.',
            combate: true,
          },
        ],
      },
    ],
  },

  demelinRefugio: {
    id: 'demelinRefugio',
    fundo: { top: '#12101c', bottom: '#241c2c', glow: 'rgba(140,120,255,0.12)' },
    falas: [
      { texto: 'A casa de Demelin nas ruínas: biblioteca e cozinha, livros e vinho de mais de trezentos anos. É o único lugar da cidade onde dá para dormir.' },
      { quem: 'DEMELIN', texto: 'Descansem. O que vem depois da ponte não se atravessa com espaços de magia gastos.' },
      { quem: 'DEMELIN', texto: 'A lança que vocês carregam é de Sarlamir. Paladine o encarregou de mediar a paz entre Istar e os dragões. Ele escolheu Istar, e usou a dragonlance da família para matar o líder dos dourados. Foi isso que enferrujou a arma.' },
      {
        quem: 'DEMELIN', texto: 'Vão descansar?',
        escolhas: [
          { texto: 'Descanso longo. Recuperar tudo antes da ponte.', bandeira: 'descansoLongo', descanso: 'longo',
            resposta: 'Demelin apaga as velas uma a uma. Pela primeira vez em dias, o grupo dorme.' },
          { texto: 'Só um respiro. Seguir logo.', bandeira: 'descansoCurto', descanso: 'curto',
            resposta: 'Uma hora de silêncio, ataduras e fôlego. Depois, a ponte.' },
        ],
      },
    ],
  },
};

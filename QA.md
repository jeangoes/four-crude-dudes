# Roteiro de QA

O que precisa passar antes de uma versão nova ir para a `main`. Quem roda isto é o QA, em sessão separada de quem escreveu o código, e o resultado vira `.qa/laudo.json`. Sem laudo verde o commit é recusado por hook.

Cada item termina em **passou**, **falhou** ou **não aplicável**, sempre com uma linha de evidência. Um item falho torna o laudo inteiro vermelho.

Quando o comportamento do jogo estiver certo e quem estiver errado for este arquivo, **não marque falha**. Marque não aplicável e descreva o problema na lista `roteiro_a_corrigir` do laudo.

---

## Bloco 1 — Suíte automatizada

| # | Item | Como | Passa quando |
|:--|:--|:--|:--|
| 1.1 | Suíte completa | `npm test` | `fail 0` e o total de testes é **maior ou igual** ao da versão anterior. Total que caiu significa teste apagado: investigue antes de aprovar. |
| 1.2 | Testes novos do bloco | Ler o diff de `tests/` | Existem casos novos cobrindo os critérios de aceite da spec. Teste que só confirma que a função devolve algo não conta. |
| 1.3 | Teste das crônicas | Já dentro do `npm test` | O teste que compara os interlúdios com `site-conteudo/cronicas/` passa. Se falhou, a crônica publicada mudou ou o texto do jogo divergiu. |
| 1.4 | Pureza de `src/rules/` | `grep -rE "document\|window\|canvas\|from '\.\./(ui\|battle\|engine)" src/rules/` | Sem resultado. O motor de 5e não conhece DOM. |
| 1.5 | Sem dependência nova | `git diff package.json` | Nenhuma chave `dependencies` ou `devDependencies` apareceu. |

## Bloco 2 — Smoke no navegador

Suba com `preview_start` na configuração `four-crude-dudes` (serve o repo na porta 8000). Recarregue ignorando cache antes de começar.

### Antes de executar, leia isto

O ambiente restringe o que dá para fazer, e ignorar isso leva a marcar falha onde não há bug.

**Screenshot só funciona com o painel do navegador visível.** Sem ele, `computer` recusa clique por coordenada, porque não tem dimensão em cache. Clique por `ref` (vindo do `read_page`) continua funcionando, e é assim que se aperta botão de menu. O grid de combate é canvas e **não tem ref**, então mirar um quadrado por clique só é possível com o painel aberto. Onde o roteiro exigir isso, o item diz.

**No teclado, use `z` para confirmar e `x` para cancelar.** Mandar `Return` pelo `computer` não chega ao jogo: o mapa de teclas espera `Enter`, e a tradução não acontece. As setas e `Esc` funcionam.

**O teclado dirige o menu, não o campo.** Escolher comando, subir e descer na lista e confirmar são teclado. Escolher alvo ou destino sai exclusivamente do ponteiro sobre o canvas. Em modo de mira, `z` confirma o item "← Cancelar" do próprio menu e volta ao comando: isso é o comportamento atual, não um bug do bloco que você está testando.

**Ganchos úteis no console:**

```js
__debug.session()                 // é função, não propriedade
__debug.session().mode            // 'command' | 'target' | 'move' | 'busy' | 'over'
__debug.session().pending.targets // alvos válidos no modo de mira
__debug.session().encounter.history.map(l => l.text)   // o log de combate
__debug.session().encounter.combatants                 // nome, hp, side
__debug.campanha().mapa.estado.disponiveis             // nós que dá para entrar
__debug.campanha().mapa.onPick(no)                     // entra num nó sem clicar no canvas
__debug.capitulos()               // devolve strings formatadas, não objetos
```

### Os itens

| # | Item | Como | Passa quando |
|:--|:--|:--|:--|
| 2.1 | Console limpo no boot | `read_console_messages` com `onlyErrors` | Nenhum erro. Aviso é aceitável, erro não. |
| 2.2 | Rede | `read_network_requests` | Nenhum 404. Módulo ou asset faltando aparece aqui. |
| 2.3 | Versão na tela de título | `read_page` | A string exibida é idêntica à `version` do `package.json`. |
| 2.4 | Novidades | Clicar no botão por `ref` | `#overlay-changelog` abre e a entrada do topo de `#changelog-body` é a da versão nova, em linguagem de jogador. |
| 2.5 | Nova campanha | Botão de começar | Entra no interlúdio do capítulo I. Capítulos I e II declaram "escrito para o jogo"; III a V trazem crédito de sessão e data. Cobrar crédito de sessão em I ou II é erro do roteiro, não do jogo. |
| 2.6 | Mapa de nós | Seguir do interlúdio | `#screen-map` visível, `#map-chapter` com numeral e título, `#map-hint` com nível e PV do grupo. |
| 2.7 | Combate abre | Entrar no primeiro nó de combate, via `mapa.onPick` | `#screen-battle` visível, `#initiative-track` com a ordem, `#round-number` em 1, `#command-list` com os comandos do herói da vez. |
| 2.8a | Um turno resolve | Escolher comando por teclado (`z`), mirar e confirmar | O ataque resolve, o PV do alvo cai, o turno passa para o próximo da iniciativa. **Se o painel do navegador não estiver visível, a mira é impossível:** marque não aplicável e diga isso no laudo. Não simule. |
| 2.8b | Movimento respeita o alcance | Comando Mover e destino além de 9 m | O destino fora do alcance é recusado. Mesma restrição de painel do item 2.8a. |
| 2.9 | Log com a conta por extenso | `encounter.history` ou tecla `L` | A linha mostra dado, modificador, total, CA e resultado, no formato que a mesa reconhece. |
| 2.10 | Reação | Provocar o gatilho (`__debug.startTestEncounter({ foes: ['BOZAK'] })`) | O jogo para e pergunta. Recusar e aceitar levam a resultados diferentes no log. |
| 2.11 | Esc em camadas | Esc na mira, depois no menu | Primeiro sai da mira e volta a `mode: 'command'` **sem abrir a pausa**, depois do submenu, só então abre a pausa. |
| 2.12 | Menu de pausa | Esc no menu principal | Abre com voltar, ficha, log, áudio e sair. `I` e `L` também abrem ficha e log direto. |
| 2.13 | Autosave | Voltar ao mapa e rodar `__debug.save()` | Devolve objeto, não `null`. |
| 2.14 | Continuar | Recarregar a página | `#btn-continue` fica **habilitado** (ele existe sempre; sem save vem `disabled`), `#title-save` mostra capítulo, nível e onde parou, e retomar devolve PV, espaços gastos e decisões. |
| 2.15 | Derrota não trava | Perder um encontro | Sem tela de fim de jogo. O grupo recua e dá para tentar de novo depois de descanso longo. |
| 2.16 | Celular | `resize_window` no preset mobile e recarregar | O campo desenha inteiro e menus, ficha e diálogo ficam legíveis. O toque no campo é ponteiro sobre canvas: mesma restrição de painel do item 2.8a. |
| 2.17 | Ganchos de debug | Os da lista acima | Todos respondem sem erro. |
| 2.18 | Console limpo no fim | `read_console_messages` de novo | Nada novo apareceu durante a sessão de teste. |

**Mortes dos draconianos**, quando o bloco tocou em combate, monstros ou regras. Monte com `__debug.startTestEncounter` e confirme cada uma no log:

- Baaz vira estátua e prende a arma de quem matou de perto (Força CD 11); o quadrado vira terreno difícil.
- Kapak deixa poça de ácido que queima quem começa o turno nela.
- Bozak explode em 3 m.
- Sivak assume nome e sprite de quem derrubou, com a faixa vermelha sob os pés.
- Aurak conta três rodadas antes de detonar.

## Bloco 3 — Checklist de release

| # | Item | Passa quando |
|:--|:--|:--|
| 3.1 | `VERSION` em `src/main.js` | Subiu de patch em relação ao último commit. |
| 3.2 | `version` em `package.json` | Idêntica à `VERSION`. |
| 3.3 | `?v=` em `index.html` | As duas queries, de `src/main.js` e de `src/styles.css`, batem com a versão nova. Este é o item que já quebrou na mesa. |
| 3.4 | `src/data/changelog.js` | Entrada nova no topo, escrita para quem joga: sem nome de função, sem "refatorado", sem "cobertura". |
| 3.5 | `CHANGELOG.md` | Entrada nova, técnica, por bloco. |
| 3.6 | Sufixo `-dev` | Presente enquanto a lista de "Pendências conhecidas" do `README.md` não estiver vazia; ausente se ela zerou. |
| 3.7 | `README.md` | Coerente com o que o bloco mudou (pendências, estrutura, controles). |
| 3.8 | Árvore | `git status --short` sem arquivo de rascunho e sem nada fora do escopo do bloco. |

## Bloco 4 — Regressão apontada

O dev termina o bloco dizendo o que pode ter quebrado de lado. Teste isso explicitamente, **além** dos blocos acima. Se ele não apontou nada, registre no laudo que não houve indicação e teste por conta o subsistema mais próximo do que mudou.

Referência rápida de vizinhança: mexeu em `rules/combat` → reteste reação e concentração; mexeu em `data/progressoes` → reteste a subida de nível ao fechar capítulo e a ficha final de cada herói; mexeu em `game/campaign` ou `game/save` → reteste continuar e a navegação do mapa; mexeu em `battle/field` → reteste linha de visão, área de efeito e terreno difícil.

---

## Saída

`.qa/laudo.json` (o portão lê este) e `.qa/laudo.md` (o Jean lê este). Formato em `.claude/agents/fcd-qa.md`.

`.qa/` não entra no repo.

# Four Crude Dudes

RPG tático em turno com os quatro personagens da nossa mesa de **Dragonlance: Shadow of the Dragon Queen**. Roda no navegador, sem instalar nada.

Darian, Owo, Lathuriel e Elandrin percorrem o arco da campanha, da fuga de Vogler ao Templo de Paladine, em combates que seguem as regras de D&D 5ª edição de verdade.

**Jogar:** https://jeangoes.github.io/four-crude-dudes/

---

## Como funciona

### A campanha

Cinco capítulos, na ordem em que a mesa jogou:

| | Capítulo | Nível | Fecha com |
|:--|:--|:--|:--|
| I | A Fuga de Vogler | 1 | O sargento kapak |
| II | As Catacumbas de Kalaman | 3 | **Lord Soth** |
| III | A Infiltração | 4 | O guardião sivak |
| IV | A Descida | 5 | **O Julgamento dos Dragões** |
| V | A Cidade Soterrada e a Ponte | 6 | A montadora de olho vermelho |

Cada capítulo é um mapa de nós ligados: combate, diálogo, descanso e decisão. Não há mapa-múndi; o grafo é o mapa.

O grupo persiste entre os nós. Pontos de vida, espaços de magia e recursos de classe só voltam em descanso, e descanso é nó limitado. É isso que faz a economia do 5e existir de verdade: chegar no chefe do capítulo com o Darian a 1 ponto de vida é resultado das escolhas do caminho.

Perder um encontro não tem tela de fim de jogo. O grupo recua, faz descanso longo e tenta de novo.

**O progresso é salvo sozinho**, no mapa, entre um nó e outro. É o único ponto seguro: no meio de um combate há ordem de iniciativa, animação pendente e reação em aberto, e guardar isso seria frágil. Quem fecha o navegador no meio de uma batalha volta ao começo daquele nó, e o jogo avisa antes de sair. A tela de título mostra onde o grupo parou e o botão **Continuar** retoma exatamente ali, com os pontos de vida, os espaços gastos e as decisões tomadas.

### A progressão

O grupo **começa no nível 1** em Vogler, como na aventura publicada, e chega ao **nível 8** na Ponte, que é onde a mesa está hoje. Sobe de nível ao fechar cada capítulo, com uma tela mostrando o que cada um ganhou.

O kit vem junto, e por isso vira descoberta:

- **Esculpir Magias** chega no nível 2. É ela que deixa o Darian centrar uma Bola de Fogo em cima do próprio bardo sem queimá-lo.
- **Bola de Fogo** e **Contramágica** chegam juntas no nível 5, com o espaço de 3º nível.
- **Canalizar Divindade** do Elandrin chega no 3, com Radiância do Amanhecer e Expulsar Mortos-Vivos.
- **Truque Potente** no 6.
- O Lathuriel luta de rapieira com Destreza até o mergulho em Bruxo no nível 2, quando a espada do pacto passa a usar Carisma e a **Maldição do Hexblade** aparece.

### O combate

Grid de 12 por 8 quadrados de 1,5 m, câmera de cima em ângulo. A diagonal custa o mesmo que a ortogonal, que é a regra padrão do Livro do Jogador.

Iniciativa por d20 mais Destreza. No seu turno você tem ação, ação bônus, 9 m de movimento e uma reação até o começo do próximo. Ataque é d20 mais proficiência mais atributo contra a CA. Crítico dobra os dados e não o modificador fixo. Vantagem e desvantagem se cancelam em vez de empilhar.

Magia gasta espaço por nível, aceita upcast, e concentração cai com teste de Constituição contra CD 10 ou metade do dano, o que for maior.

O log mostra a conta por extenso, do jeito que a mesa reconhece:

```
Darian ataca Baaz com Bastão: d20(15)+8 = 23 vs CA 15 — acerta
Baaz sofre 7 de impacto — 1d6+2: [5]+2 = 7
Baaz 1 enrijece e vira uma estátua de pedra
Elandrin tenta soltar a arma da pedra: d20(18)+3 = 21 vs CD 11 — solta
```

**Reação é o que justifica o gênero.** Quando o bozak começa a conjurar, o jogo para e pergunta se o Darian usa Contramágica. Se a janela aparecer demais, dá para silenciar aquele gatilho até o fim do combate.

### Os draconianos

Morrem como no cânone, e é isso que dá tática ao combate:

- **Baaz** vira estátua de pedra. Quem o matou de perto rola Força CD 11 para soltar a arma, e o quadrado vira terreno difícil.
- **Kapak** se dissolve numa poça de ácido que queima quem começa o turno nela.
- **Bozak** explode num raio de 3 m. Mate de longe, ou pague.
- **Sivak** assume a forma de quem derruba: passa a usar o nome e o sprite da vítima. A faixa vermelha sob os pés é o único tell.
- **Aurak** não deixa corpo. Vira energia instável que conta três rodadas antes de detonar, o que dá tempo de sair de perto.
- **Morto-vivo de Kalaman** agarra e segura. É o alvo do Expulsar do Elandrin.

Reusados em capítulo adiantado, baaz e kapak aparecem na variante **veterana**: mais PV, mais CA e um dado a mais na arma.

### Nem tudo se vence no braço

**Lord Soth** é invulnerável. É um cavaleiro da morte, e na mesa o grupo fugiu dele. O encontro é aguentar cinco rodadas até a saída abrir.

**O Julgamento dos Dragões** se resolve na conversa. Precisa de duas vozes, porque foi assim que o grupo venceu: a diplomacia do Lathuriel mais a fé do Elandrin. Uma voz só não desarma o espírito, e sacar a arma encerra a conversa na hora.

**O Conde Cornelius** só entra na ponte como convidado controlável se a conversa com ele tiver corrido bem. Traz o Banquete: devora inteiro um inimigo já abaixo da metade dos PV.

### As crônicas

A abertura de cada capítulo traz o texto da crônica publicada no [Diário de Campanha](https://lancebearers.vercel.app), creditada por sessão e data. Onde o arco é anterior às crônicas (Vogler e as Catacumbas), o texto é escrito para o jogo e a tela diz isso. Um teste compara os trechos com os arquivos publicados e falha se divergirem.

---

## Controles

| Tecla | Ação |
|:--|:--|
| Setas ou WASD | Navegar menu e campo |
| Enter, Espaço ou Z | Confirmar |
| Esc, X ou Backspace | Voltar um passo; no menu principal, abre a pausa |
| I | Ficha do grupo |
| L | Log de combate |
| M | Mudo |

No celular, toque no campo para escolher quadrado e nos itens de menu para confirmar.

**Ressalva honesta sobre o celular:** num grid de 12 por 8 em tela de 375 px, cada quadrado fica com uns 26 px depois da escala. Dá para jogar, mas mirar um quadrado específico é chato. Menus, ficha e diálogo são confortáveis; o campo é apertado.

---

## Rodar local

O jogo usa módulos ES, então precisa ser servido por HTTP. Abrir o `index.html` direto pelo `file://` não funciona.

```bash
python3 -m http.server
```

Depois abra `http://localhost:8000`.

**Aviso para quem for mexer no código:** o navegador guarda módulos ES em cache com força, e o `http.server` não manda cabeçalho que impeça isso. Se você editar um arquivo e a mudança não aparecer, provavelmente não é o seu código. Recarregue ignorando o cache (Ctrl+Shift+R) ou sirva com `Cache-Control: no-store`.

## Testes

```bash
npm test
```

153 testes, sem dependências: o `package.json` existe só para ligar o `node --test`. `src/rules/` não conhece DOM nem canvas, então roda no Node direto.

Cobrem o motor de 5e (crítico dobra dados e não o fixo, vantagem e desvantagem se cancelam, resistência bem-sucedida causa metade, Esculpir Magias poupa exatamente 1 mais o nível da magia), a geometria do campo (linha de visão, terreno difícil, áreas de efeito), a progressão (cada herói termina exatamente na ficha da mesa) a integridade dos capítulos (todo nó é alcançável, todo destino existe, todo terreno cabe no campo) e o save (retomar devolve o grupo exatamente como estava, e gasto maior que o máximo é cortado em vez de virar número impossível).

## Estrutura

```
index.html            shell das telas
src/
  main.js             boot, roteador de telas, pausa
  rules/              motor de 5e, sem DOM, testável no Node
    dice · statblock · conditions · spells · combat · progression
  data/               fichas, progressões, monstros, capítulos, NPCs, crônicas
  battle/             campo, desenho, IA, animação, sessão
  ui/                 HUD, log, mapa, diálogo, ficha
  engine/             render, áudio, input
  game/campaign.js    a máquina que liga capítulo, mapa, diálogo e batalha
assets/
  manifest.json       registro de arte
  sprites/ portraits/ bg/
legacy/
  v2.3-beat-em-up.html   a versão anterior, um beat 'em up
tests/
```

## Trocar arte

`assets/manifest.json` é o registro de tudo que aparece na tela. Entrada com `src` usa um PNG; entrada com `procedural` é desenhada pelo motor.

Para substituir um inimigo procedural por arte pintada, gere o PNG, coloque em `assets/sprites/` e troque a chave:

```json
"BAAZ": { "src": "assets/sprites/monsters/baaz.png", "frameW": 104, "frameH": 136, "poses": { "idle": 0 } }
```

Nenhuma mudança de código. As poses são `idle`, `attack`, `hurt` e `down`, lado a lado na folha. Pose que faltar cai para `idle` com uma deformação, então arte parcial não quebra nada.

## Depuração

```js
__debug.capitulos()          // lista os capítulos
__debug.save()               // o save atual, ou null
__debug.apagarSave()
__debug.capitulo(4)          // pula para a Descida, no nível certo
__debug.novaCampanha()       // começa do zero, nível 1
__debug.startTestEncounter({ foes: ['SIVAK','AURAK'] })
__debug.campanha()           // a campanha em andamento
```

A sessão de batalha dá acesso a `encounter` (regras), `field` (grid) e `view` (desenho), então dá para montar qualquer cena no console.

## A mesa

| Jogador | Personagem | Classe |
|:--|:--|:--|
| Jean | Darian | Mago da Alta Feitiçaria (Evocação) |
| Meggie | Owo | Patrulheira |
| Marcello | Lathuriel | Bardo das Espadas / Bruxo Hexblade |
| Thiago | Elandrin | Clérigo de Paladine |
| Volnei | Mestre | — |

## Pendências conhecidas

- **A ficha do Owo** é a única que ainda não existe em papel. O kit dela é um Patrulheiro padrão mais o que a campanha confirma, e se declara provisório na tela.
- **Arte:** os inimigos são desenhados pelo motor enquanto não houver PNG pintado. Em ordem de prioridade: três poses novas por herói, retratos de diálogo, depois os inimigos.

## Versão

A versão mostrada na tela de título (`VERSION` em `src/main.js`, espelhada em `package.json`) sobe de **patch a cada commit de bloco ou correção fechado** — não é decorativa, segue o histórico real do repo. O sufixo `-dev` continua enquanto a lista de "Pendências conhecidas" acima não zerar; sai só quando ela zerar.

Toda vez que a versão sobe, o commit também acrescenta uma entrada em `src/data/changelog.js` — o changelog para quem joga, aberto pelo botão "Novidades" na tela de título. Esse arquivo usa linguagem direta ao jogador, sem jargão de dev; o histórico técnico completo, por bloco, continua neste `CHANGELOG.md`.

**Cache do GitHub Pages:** o navegador guarda `src/main.js` e `src/styles.css` em cache, e o GitHub Pages não permite header customizado pra evitar isso. `index.html` referencia os dois com `?v=<versão>` (ex.: `src/main.js?v=4.0.5-dev`) — atualizar essa query junto com `VERSION` a cada bump é o que força o navegador a buscar de novo em vez de servir a cópia antiga sem precisar de Ctrl+R.

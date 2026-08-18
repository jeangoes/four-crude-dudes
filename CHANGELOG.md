# Changelog

Registra a evolução do jogo. Mais recente no topo.

## 2026-08-17 (bloco 6)

### Adicionado
- **Aberturas de capítulo com o texto real das crônicas** (`src/data/interludes.js`). Onde há crônica publicada no Diário de Campanha, o parágrafo é o dela e a tela credita sessão e data. Onde o arco é anterior às crônicas (Vogler e as Catacumbas), o texto é escrito para o jogo e a tela diz isso: crônica que a mesa não jogou não se inventa. Um teste compara os trechos com os arquivos publicados e falha se divergirem.
- **Ficha do grupo**, aberta com I. Mostra o que a mesa consulta no papel: atributos com modificador, CA, iniciativa, deslocamento, CD de magia, espaços por nível, recursos de classe, dados de vida, perícias proficientes, condições ativas e concentração. A ficha do Owo aparece marcada como provisória, porque ainda é aproximação.
- **Áudio de fim de encontro.** Fanfarra de vitória e um toque de derrota que desce meio tom sem resolver. A trilha abaixa durante os dois, para não brigarem.
- Trilha própria para o encontro do Lord Soth: acorde diminuto, 54 bpm. Encontro que não se vence pelo braço não soa como os outros.
- Aviso sonoro a cada rodada nos encontros cronometrados.
- 3 testes de fidelidade dos interlúdios. Total do projeto: 117.

### Verificado
- Tela estreita (375x812): sem rolagem horizontal, campo e menu cabem. O grid fica apertado para toque, o que está registrado no README em vez de escondido.

## 2026-08-17 (bloco 5)

### Adicionado
- **Os cinco capítulos da campanha**, em `src/data/chapters.js`, seguindo o arco que a mesa jogou: a Fuga de Vogler, as Catacumbas de Kalaman, a Infiltração, a Descida e a Cidade Soterrada. Cada capítulo é um grafo de nós de combate, diálogo, descanso e decisão.
- **Mapa de nós** (`src/ui/map.js`): grafo desenhado em canvas, com o nó atual pulsando, os visitados marcados e "CHEFE" sobre o que é. O rodapé mostra PV e espaços de magia de todo mundo, porque é essa a informação que decide se dá para seguir.
- **Tela de diálogo** (`src/ui/dialogue.js`) com testes de perícia de verdade, lidos das fichas. A opção mostra quem rola, contra qual CD e com qual bônus antes de você escolher, e a rolagem fica visível no resultado.
- **O Julgamento dos Dragões** como encontro sem combate. Foi vencido na mesa com a diplomacia do Lathuriel mais a fé do Elandrin, e é assim que se vence aqui: a cena pede **duas vozes**, e uma só não desarma o espírito. Falhar leva a combate. Sacar a arma encerra a conversa na hora.
- **Lord Soth** como encontro de sobrevivência. Ele é invulnerável por bloco de status: a resposta certa é aguentar cinco rodadas até a saída abrir, não bater. O motor ganhou objetivos de encontro (`derrotar`, `sobreviver`, `escapar`).
- **Conde Cornelius** como personagem convidado controlável, no formato de guest character. Só entra na ponte se a conversa tiver corrido bem, e traz o Banquete: devora inteiro um inimigo já abaixo da metade dos PV.
- **Demelin** como nó de diálogo e descanso longo, contando a história certa da Dragonlance (Sarlamir, não Lord Soth: são personagens diferentes e os recaps já confundiram os dois).
- `src/game/campaign.js`: o grupo persiste entre nós. PV, espaços de magia e recursos só voltam em descanso, e descanso é nó limitado. É isso que faz a economia de 5e existir de verdade.
- Atalhos de depuração: `__debug.capitulo(4)` cai direto na Descida, `__debug.capitulos()` lista tudo.
- `tests/campaign.test.js`, 43 testes. Verificam que todo destino de nó existe, que cada capítulo tem um começo só e chega ao fim, que todo nó é alcançável, que o terreno declarado cabe no campo e que todo combate aponta para monstros que existem. Total do projeto: 114.

### Alterado
- Derrota não tem tela de fim de jogo. O grupo recua para o nó, faz descanso longo e tenta de novo, que é o equivalente a voltar amanhã.

### Corrigido
- **A janela de reação abria a cada ataque recebido**, o que dava umas doze por combate com o Clarão Protetor do Elandrin em campo. Ganhou o botão "não perguntar mais neste combate", que silencia aquele gatilho para aquele personagem até o fim do encontro.

## 2026-08-17 (bloco 4)

### Adicionado
- **Kits de classe completos**, em `src/data/talents.js` e `src/data/reactions.js`, separados das fichas para elas não incharem.
  - **Elandrin**: Canalizar Divindade com Radiância do Amanhecer (esfera de 9 m que poupa aliados, dano escalando pelo nível de clérigo e não pelo total) e Expulsar Mortos-Vivos (destrói ND ≤ 1/2 na hora, amedronta o resto, e não faz nada contra draconiano). Mais Segundo Fôlego, Brado de Apoio e Clarão Protetor como reação.
  - **Darian**: Contramágica e Barreiras Prateadas como reações. Contramágica anula sem teste quando o espaço é de nível igual ou maior, e exige teste de conjuração quando é menor.
  - **Lathuriel**: Maldição do Hexblade, que marca o alvo, soma dano, amplia o crítico para 19 contra ele, e cura ao matá-lo. Mais Florear de Lâmina.
- **Os seis inimigos com as mortes do cânone.** Sivak, aurak e morto-vivo de Kalaman entram junto de baaz, kapak e bozak.
  - **Sivak** assume a forma de quem derruba: passa a usar o nome e o sprite da vítima. A faixa vermelha sob os pés é o único tell.
  - **Aurak** não deixa corpo. Vira energia instável que fica no chão contando três rodadas antes de detonar num raio de 4,5 m, o que dá ao grupo a chance de sair de perto em vez de só comer o dano.
  - **Morto-vivo de Kalaman** agarra e segura, e é o alvo do Expulsar do Elandrin.
- **Janela de Contramágica.** Conjuração inimiga marcada com `isSpell` para o jogo e perguntar ao grupo antes de resolver. O motor ganhou `offerReactionToSide`, porque Contramágica não depende de ser o alvo.
- Talentos como categoria própria no menu de comandos, com o recurso restante visível.
- `tests/kits.test.js`, 18 testes. Total do projeto: 71.

### Corrigido
- **O herói caído sumia do campo.** Três causas somadas: a pose deitada girava o quadro para fora da área desenhável, a pose escurecia 35% e a view desenhava com 55% de opacidade. Agora o corpo aparece deitado, com as salvaguardas contra a morte marcadas sobre ele e um pulso vermelho no chão. Achar quem levantar é a decisão do turno e precisa ser visível.
- Perigos com contagem regressiva passaram a ser removidos da lista antes de detonar, para que um efeito que crie outro perigo no mesmo quadrado não seja varrido junto.

## 2026-08-17 (bloco 3)

### Adicionado
- **Batalha jogável no grid.** Campo de 12x8 quadrados de 1,5 m, câmera de cima em ângulo, sprites em pé sobre o quadrado.
  - `battle/field.js` — distância de Chebyshev (a diagonal custa igual, regra padrão do Livro do Jogador), linha de visão por Bresenham, movimento por Dijkstra respeitando terreno difícil e ocupação, e as áreas de efeito de 5e: esfera, cubo, cone e linha.
  - `battle/view.js` — piso, terreno, camadas de destaque (movimento, alcance, área, perigo), caminho pontilhado, cursor, barras de PV, marcas de condição, números flutuantes empilhados e tremor de tela.
  - `battle/ai.js` — três táticas declaradas na ficha: bruto avança e bate, atirador mantém distância e busca linha de visão, guarda protege um aliado. Trocar a tática de um monstro é editar um campo.
  - `battle/animator.js` — caminhada passo a passo, investida, recuo, projétil e estouro de área, tudo aguardável.
  - `battle/session.js` — o laço de turno: menu de comandos, seleção de alvo, prévia da área antes de confirmar, ataque de oportunidade ao sair do alcance, dano de terreno ao começar o turno em cima.
  - `ui/hud.js` e `ui/log.js` — faixa de iniciativa, cartões do grupo, lista de comandos com detalhe da regra, janela de reação e o log rolável.
- **Prévia de área de efeito.** Mirar Bola de Fogo mostra a esfera e destaca em verde os aliados dentro dela. É a decisão que o grid existe para permitir.
- Encontro de teste jogável: os quatro contra uma patrulha draconiana, com entulho e paredes que cortam linha de visão. Botão "Nova campanha" cai direto nele até o bloco 5.
- Baaz, kapak e bozak com as mortes do cânone ligadas ao campo: a estátua vira terreno difícil e prende a arma de quem matou de perto, a poça de ácido queima quem começa o turno nela, e a explosão do bozak pega quem estiver a 3 m.
- `tests/field.test.js`, 21 testes de geometria. Total do projeto: 53.

### Corrigido
- **A batalha travava para sempre se o jogador trocasse de aba.** O fluxo do turno espera as animações terminarem, e `requestAnimationFrame` para de disparar em segundo plano, então a promessa nunca resolvia. O relógio agora tem um watchdog que assume o passo quando o rAF silencia, e para de desenhar (mas não de calcular) com a aba oculta.
- Inimigos eram numerados pela posição na lista, o que produzia "Bozak 4" para o único bozak em campo. A numeração passou a ser por tipo, e tipo único fica sem número.
- O destaque de alcance cobria o tabuleiro inteiro em magias de alcance longo, atrapalhando a leitura da área. Some quando não informa nada.

## 2026-08-17 (bloco 2)

### Adicionado
- **Motor de regras de 5e em `src/rules/`**, sem DOM e sem canvas, testável no Node.
  - `dice.js` — parser de notação (`2d6+3`, `8d6`, `1d8-1`), d20 com vantagem e desvantagem que se cancelam, crítico dobrando dados mas não o fixo, natural 20 e natural 1 como acerto e erro automáticos. Gerador injetável para teste determinístico.
  - `statblock.js` — ficha comum a herói e monstro, com CD de magia derivada, resistência, imunidade e vulnerabilidade, PV temporário que não acumula, espaços de magia que sobem de nível quando o pedido acaba, dados de vida, descanso curto e longo, e salvaguardas contra a morte.
  - `conditions.js` — as condições de 5e declaradas como tabela de efeitos, em vez de `if` espalhado pelo motor.
  - `spells.js` — gasto de espaço, upcast, escala de truque por nível de personagem, concentração (CD 10 ou metade do dano, nova concentração derruba a anterior), resistência para metade do dano, e ganchos de classe.
  - `combat.js` — iniciativa com desempate por Destreza, rodadas, economia de ação e ação bônus e reação, cálculo de vantagem juntando as condições dos dois lados, ataque de oportunidade, e janela de reação assíncrona.
- **Esculpir Magias** e **Truque Potente** do Darian implementados como ganchos, com o limite correto de 1 mais o nível da magia.
- Gancho `onDeath` no bloco de status, que o bloco 4 usa para as mortes dos draconianos.
- `tests/rules.test.js` com 32 testes cobrindo dados, ficha, concentração, magia e encontro. `npm test`.
- `package.json` mínimo, sem dependências, só para habilitar `node --test`.

## 2026-08-17 (bloco 1)

### Alterado
- **Pivô de gênero: de beat 'em up para RPG tático em turno.** O beat 'em up não expressava a campanha: sem decisão, sem iniciativa, sem gestão de recurso, e com três dos quatro heróis parados no menu. Turno resolve os quatro problemas e usa melhor os sprites parados que já existiam.
- Combate passa a seguir D&D 5e de verdade: iniciativa, ação e ação bônus, reação, espaços de magia, concentração, teste de resistência, vantagem e desvantagem.
- Repositório quebrado em módulos ES. O `index.html` de 144 KB com PNG em base64 virou `index.html` enxuto mais `src/` e `assets/`.
- Identidade visual alinhada ao Diário de Campanha (lancebearers): Cinzel, Cormorant Garamond, dourado sobre tomo.

### Adicionado
- `assets/manifest.json`, registro de arte que permite trocar sprite procedural por PNG pintado sem tocar em código.
- Desenhista procedural de draconianos em `src/engine/render.js`, com silhueta, focinho, asas e cauda. Substitui os retângulos coloridos que serviam de inimigo.
- Áudio com SFX em duas camadas (transiente de ruído mais corpo tonal) e trilha por capítulo gerada em WebAudio. Volume e mudo persistidos.
- Input por intenção, com teclado nos menus e ponteiro no campo, incluindo toque.
- README com instruções de execução e de troca de arte.

### Removido
- Ondas de inimigos genéricos (`grunt`, `archer`, `knight`) e o chefe `DARK LORD`. Entram draconianos do cânone no lugar.

### Preservado
- `legacy/v2.3-beat-em-up.html` guarda a versão anterior inteira, jogável.

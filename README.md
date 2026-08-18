# Four Crude Dudes

RPG tático em turno com os quatro personagens da nossa mesa de **Dragonlance: Shadow of the Dragon Queen**. Roda no navegador, sem instalar nada.

Darian, Owo, Lathuriel e Elandrin percorrem o arco da campanha, da fuga de Vogler ao Templo de Paladine, em combates que seguem as regras de D&D 5ª edição de verdade: iniciativa, ação e ação bônus, reação, espaços de magia, concentração, teste de resistência.

## Jogar

O jogo usa módulos ES, então precisa ser servido por HTTP. Abrir o `index.html` direto pelo `file://` não funciona.

```bash
python3 -m http.server
```

Depois abra `http://localhost:8000`.

Aviso para quem for mexer no código: o navegador guarda módulos ES em cache com força, e o `http.server` não manda cabeçalho que impeça isso. Se você editar um arquivo e a mudança não aparecer, não é o seu código. Recarregue ignorando o cache (Ctrl+Shift+R) ou sirva com `Cache-Control: no-store`.

Publicado em `https://jeangoes.github.io/four-crude-dudes/`.

## Controles

| Tecla | Ação |
|:--|:--|
| Setas ou WASD | Navegar menu e campo |
| Enter, Espaço ou Z | Confirmar |
| Esc, X ou Backspace | Cancelar e voltar |
| Tab ou E | Próximo personagem |
| Q | Personagem anterior |
| I | Abrir ficha |
| L | Abrir log de combate |
| M | Mudo |

No celular, toque no campo para escolher quadrado e nos itens de menu para confirmar.

## Estrutura

```
index.html          shell das telas
src/
  main.js           boot e roteador de telas
  rules/            motor de 5e, isolado e sem DOM
  data/             fichas, monstros, magias, capítulos, crônicas
  battle/           grid, IA, animação
  ui/               menus, ficha, log, diálogo (DOM)
  engine/           render, áudio, input
assets/
  manifest.json     registro de arte
  sprites/ portraits/ bg/
legacy/
  v2.3-beat-em-up.html   a versão anterior, um beat 'em up
```

`src/rules/` não conhece DOM nem canvas, então roda no Node direto:

```bash
npm test
```

São testes do motor de 5e com dados determinísticos: crítico dobra dados e não o fixo, vantagem e desvantagem se cancelam, resistência bem-sucedida causa metade, Esculpir Magias poupa exatamente 1 mais o nível da magia, três falhas na salvaguarda matam. Sem dependências: o `package.json` existe só para ligar o `node --test`.

## Trocar arte

`assets/manifest.json` é o registro de tudo que aparece na tela. Entrada com `src` usa um PNG; entrada com `procedural` é desenhada pelo motor.

Para substituir um inimigo procedural por arte pintada: gere o PNG, coloque em `assets/sprites/`, e troque a chave.

```json
"BAAZ": { "src": "assets/sprites/monsters/baaz.png", "frameW": 104, "frameH": 136, "poses": { "idle": 0 } }
```

Nenhuma mudança de código. Poses que faltarem na folha caem para `idle` com uma deformação, então arte parcial não quebra nada.

As poses são `idle`, `attack`, `hurt` e `down`, nessa ordem, lado a lado na folha.

## A mesa

| Jogador | Personagem | Classe |
|:--|:--|:--|
| Jean | Darian | Mago (Evocação) |
| Meggie | Owo | Ranger |
| Marcello | Lathuriel | Bardo (Espadas) / Bruxo (Hexblade) |
| Thiago | Elandrin | Clérigo da Luz |
| Volnei | Mestre | — |

## Depuração

O console expõe `window.__debug`:

```js
__debug.startTestEncounter()                          // patrulha padrão
__debug.startTestEncounter({ foes: ['BOZAK','KAPAK'] })
__debug.game.session                                  // a sessão em andamento
```

A sessão dá acesso a `encounter` (motor de regras), `field` (grid) e `view` (desenho), então dá para montar qualquer cena no console: mover alguém com `session.field.place(c, {x,y})`, baixar PV, e disparar o efeito de morte que você quer ver.

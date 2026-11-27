# Mecânicas especiais por mundo — Mundos das Setas

> **Criado em:** 27/11/2026 (horário de Brasília, UTC−3)
> **Atualizado em:** 27/11/2026 às 18:58 (horário de Brasília, UTC−3): seção [Estado da implementação](#estado-da-implementação).
> **Status:** proposta de design, com 6 mecânicas já implementadas. Os pesos e números abaixo são **estimativas iniciais** e precisam ser calibrados com a engine (`difficultyOf`) e com teste de jogadores.

## Estado da implementação

Estratégia escolhida: **misto**.
- **Caminho A (sobrepor):** as setas das 300 fases continuam as mesmas e a mecânica entra por cima, gravada no `levels.json`.
- **Caminho B (regenerar):** fica para os mundos que mudam o caminho das setas (Tocos, Cânion, Oceano, Montanha).

| Mundo | Mecânica | Situação |
| --- | --- | --- |
| 4 Geleira | Gelo (contador) | ✅ Feito (caminho A) |
| 5 Vulcão | Magma | ✅ Feito (caminho A) |
| 6 Cidade | Mão dupla (só setas retas) | ✅ Feito (caminho A); a fase 111 ficou clássica porque não tem seta reta |
| 7 Selva | Cipós (pares) | ✅ Feito (caminho A) |
| 12 Castelo | Chaves e portões | ✅ Feito (caminho A) |
| 13 Galáxia | Órbita (horária; anti-horária a partir da 15ª fase do mundo) | ✅ Feito (caminho A) |
| 1, 8, 9, 10 | Tocos, Rochas, Redemoinhos, Pedras | ⏳ Caminho B (regenerar), próxima etapa |
| 2, 3, 11, 14, 15 | Maré, Soterradas, Cores, Neblina, Fusão | ⏳ Depois |

**Onde está no código.**

Engine (TypeScript):
- [`src/engine/state.ts`](../src/engine/state.ts): estado da partida e regras de todas as mecânicas (`tap`), solver com limite de nós (`solveState`) e bônus de dificuldade (`mechanicBonus`).
- [`src/engine/overlay.ts`](../src/engine/overlay.ts): sobreposição determinística por mundo, com intensidade 1–4 conforme a posição da fase. Só aceita a fase se o solver achar uma solução sem perder vida. Roda dentro de `npm run levels`.
- [`src/engine/replay.ts`](../src/engine/replay.ts): replay usado pela API falsa.

Servidor (C#):
- [`server/Setas.Api/Engine/GameState.cs`](../server/Setas.Api/Engine/GameState.cs): mesmas regras, usadas pelo `Replay.cs`.
- `vectors.json`: 36 partidas de referência (solução e partida com erros), comparadas toque a toque pelo teste `Mecanicas_IguaisAoJavaScript`.

Tela:
- [`src/game/board.ts`](../src/game/board.ts): desenho das mecânicas (❄, 🔥, ⇄, anel ↻/↺, cipó, portão ♦/♣ e o mesmo símbolo na chave).
- [`src/ui/game.ts`](../src/ui/game.ts): balão de apresentação na 1ª vez de cada mecânica, aviso de seta congelada e de erupção.

**Decisões tomadas na implementação.**
- **Jogada válida:** só toque que tira seta(s). Ela derrete o gelo, gira a órbita, inverte a mão dupla e baixa o magma. Batida não conta.
- **Toque em seta congelada:** não tira vida, não é jogada e não vai para o servidor. Se aparecer numa partida enviada, o servidor recusa.
- **Cipó:** um toque conta como uma jogada e tira as duas setas. Por isso o replay aceita menos jogadas que setas.
- **Dificuldade:** o campo `difficulty` continua medindo só a geometria (a curva por mundo não mudou). O bônus da mecânica fica em `mechanicBonus`. A compensação "mecânica pesada → menos setas" do documento só vale para o caminho B.
- **Ainda fora:** o modo infinito (Geleira II…) e o desafio do dia continuam sem mecânica. As variações avançadas também ficam para depois: sequência de cristais, faixa lenta, trios de cipó, portão temporizado e magma em cadeia. Na revisão (15ª–19ª fase do mundo), a mecânica de um mundo anterior ainda não entra.
> **Base:** documento "Níveis, fases e dificuldade", que trata da fórmula de dificuldade, das 300 fases curadas, do modo infinito e do desafio do dia.

## Resumo

| Pergunta | Resposta |
| --- | --- |
| O que muda? | Cada mundo ganha **uma mecânica própria** que muda o jeito de pensar, e não só o tamanho do tabuleiro. |
| Quantas mecânicas? | **15**, uma por mundo. O mundo 15 (Infinito) mistura as anteriores. |
| Como entra na dificuldade? | Um termo novo na fórmula: `+ bônus_mecânica`. |
| E o platô da fase ~500? | No modo infinito as mecânicas se **combinam e ganham intensidade**, então a dificuldade volta a subir depois que tabuleiro e setas chegam ao limite. |
| O que continua igual? | Fase N igual para todos, solução garantida, 3 vidas, estrelas, ajudas e a mesma lógica em TS e C#. |

### Visão geral

| Mundo | Fases | Nome | Mecânica | Tipo de desafio |
| --- | --- | --- | --- | --- |
| 1 | 1–20 | Bosque | **Tocos** | Obstáculos fixos (introdução) |
| 2 | 21–40 | Praia | **Maré** | Tempo: zonas que abrem e fecham |
| 3 | 41–60 | Deserto | **Setas soterradas** | Informação escondida (direção) |
| 4 | 61–80 | Geleira | **Setas congeladas** | Sequência e combo |
| 5 | 81–100 | Vulcão | **Setas de magma** | Urgência: contagem regressiva |
| 6 | 101–120 | Cidade | **Mão dupla** | Paridade: a seta inverte |
| 7 | 121–140 | Selva | **Cipós** | Setas ligadas que saem juntas |
| 8 | 141–160 | Cânion | **Rochas defletoras** | Caminhos que fazem curva |
| 9 | 161–180 | Oceano | **Redemoinhos** | Portais / teletransporte |
| 10 | 181–200 | Montanha | **Pedras soltas** | Gravidade: o tabuleiro muda |
| 11 | 201–220 | Aurora | **Ciclo de cores** | Ordem obrigatória |
| 12 | 221–240 | Castelo | **Chaves e portões** | Dependências encadeadas |
| 13 | 241–260 | Galáxia | **Órbita** | Rotação de 90° |
| 14 | 261–280 | Nebulosa | **Neblina** | Tabuleiro escondido |
| 15 | 281–300 | Infinito | **Fusão** | Combinação de 2 ou 3 mecânicas |

---

## Regras gerais para todos os mundos

### Ritmo dentro de cada mundo (20 fases)

Todos os mundos seguem o mesmo padrão. O jogador aprende a regra e só depois ela fica difícil.

| Fases do mundo | Papel | O que acontece |
| --- | --- | --- |
| 1ª | **Apresentação** | Tabuleiro pequeno, 1 elemento da mecânica e um balão explicando a regra. Dificuldade base **mais baixa** que o fim do mundo anterior (respiro). |
| 2ª–7ª | **Aprendizado** | Mecânica em intensidade baixa. |
| 8ª–14ª | **Domínio** | Mais elementos e uma variação da regra. |
| 15ª–19ª | **Revisão** | Mecânica do mundo + uma mecânica de um mundo anterior, em intensidade baixa. |
| 20ª | **Fase chefe** | A versão mais dura da mecânica, com um visual especial e uma recompensa maior (moedas, baú). |

> O respiro na 1ª fase é importante: a mecânica nova já deixa a fase mais difícil. Se a base também subir, o jogador sente um "paredão" na entrada do mundo.

### Nova fórmula de dificuldade

```
dificuldade = profundidade × 4
            + quantidade de setas × 0,6
            + (1 − setas livres no início ÷ total de setas) × 12
            + tamanho do tabuleiro
            + bônus_mecânica                      ← novo

bônus_mecânica = Σ (peso da mecânica × intensidade)
               + penalidade de combinação (quando há 2 ou mais mecânicas)
```

- **Peso:** o quanto a mecânica pesa na cabeça do jogador (tabela em [Pesos sugeridos](#pesos-sugeridos)).
- **Intensidade:** de 1 a 5, ligada à quantidade de elementos e à variação ativa (ex.: 1 seta congelada = 1; 4 setas congeladas em sequência numerada = 4).
- **Combinação:** +3 por mecânica extra, porque juntar regras é mais difícil que somar cada uma.

Para a curva continuar suave, o script de curadoria ordena pela **dificuldade total**, mas o alvo de cada mundo continua o mesmo de hoje (~2 pontos a mais por mundo). Ou seja: quando a mecânica pesa mais, o gerador **compensa** com menos setas ou tabuleiro menor. A sensação de dificuldade passa a vir da regra nova, e não só do tamanho.

### Erros, vidas e ajudas

| Regra | Como fica |
| --- | --- |
| **Vida** | Continua igual: só perde vida quando uma seta bate em outra ou quando a mecânica diz isso explicitamente (ex.: erupção do magma). |
| **Toque inválido** | Tocar uma seta que a mecânica trava (congelada, coberta pela maré, cor errada etc.) **não tira vida**: a seta treme e aparece o motivo. Exceções estão marcadas em cada mundo. |
| **Dica** | Passa a usar o **solver** da fase, que conhece a mecânica: destaca a próxima seta de um caminho que resolve a fase a partir do estado atual. |
| **Prévia do caminho** | Mostra curvas (Cânion), portais (Oceano) e pedras que vão cair (Montanha). |
| **Beco sem saída** | Algumas mecânicas mudam o tabuleiro e podem deixar a fase sem solução. A engine detecta isso e mostra "Sem saída! Tentar de novo" (custa 1 vida e reinicia a fase). |

---

## Mundo 1 — Bosque (fases 1–20): Tocos

**Regra.** Algumas células têm **tocos de árvore**: nada passa por elas e elas nunca saem do tabuleiro. Nenhuma seta aponta direto para um toco sem ter outra saída, então eles só servem para dar forma ao tabuleiro e fechar caminhos.

**Na tela.** Toco de madeira ocupando a célula. A prévia do caminho para de forma visível no toco.

**Progressão.**
- Fases 1–3: tutorial atual, sem tocos.
- Fases 4–10: tabuleiro base (o jogador se acostuma com vidas e prévia).
- Fases 11–20: de 1 a 4 tocos. A fase 20 tem um "corredor" de tocos que obriga a limpar em ondas.

**Geração.** Os tocos são reservados antes de colocar as setas. O gerador só aceita setas cujo caminho até a borda não passe por um toco. A solução garantida por construção inversa continua valendo.

---

## Mundo 2 — Praia (fases 21–40): Maré

**Regra.** Uma faixa do tabuleiro (as linhas de baixo, por exemplo) é **zona de maré**. A maré alterna a cada **3 setas removidas**: na **maré baixa** tudo funciona normal; na **maré alta** as setas dentro da água ficam cobertas e não podem ser tocadas.

**Na tela.** Água subindo e descendo com animação, e um contador de ondas (🌊 3 → 2 → 1) mostrando quando a maré muda.

**Progressão.**
- 21–27: maré só nas 2 linhas de baixo, ciclo de 3 jogadas.
- 28–34: faixa maior e ciclo de 2 jogadas.
- 35–39: na maré alta, setas de fora que **passam pela água** também ficam presas.
- 40 (chefe): duas zonas de maré com ciclos diferentes.

**Planejamento que a mecânica pede.** Guardar as setas da zona de maré para quando a maré baixar, usando as jogadas de maré alta nas outras setas.

**Geração.** Agora existe estado (fase da maré), então a construção inversa sozinha não basta: a fase precisa passar pelo **solver** (ver [Implementação](#implementação)).

---

## Mundo 3 — Deserto (fases 41–60): Setas soterradas

**Regra.** Algumas setas estão **cobertas de areia**: o jogador vê as células que a seta ocupa, mas **não vê a direção**. Quando uma seta vizinha sai, o vento leva a areia e a direção aparece. Tocar uma seta soterrada é permitido, mas é um risco: se ela bater, perde vida.

**Na tela.** Monte de areia sobre a seta. A areia voa ao revelar.

**Progressão.**
- 41–47: 1 ou 2 soterradas, sempre com uma vizinha livre por perto.
- 48–54: várias soterradas. Algumas só se revelam depois de 2 ondas.
- 55–59: **tempestade**: a cada 5 jogadas, uma seta já revelada volta a ser coberta (sempre a mesma, por semente).
- 60 (chefe): metade do tabuleiro soterrado.

**Ajudas.** A prévia do caminho não funciona em seta soterrada (mostra "?"). A dica funciona normalmente e é uma boa forma de gastar dicas.

---

## Mundo 4 — Geleira (fases 61–80): Setas congeladas

> Mecânica a partir da sua ideia: para liberar a seta congelada é preciso fazer uma sequência com outras setas.

**Regra base (contador).** A seta congelada mostra um número (❄3). Cada seta removida **em qualquer lugar** derrete uma camada. No zero, ela fica livre. Uma **colisão** recongela 1 camada.

**Regra avançada (sequência de cristais).** A seta congelada fica ligada a 2–4 setas marcadas com o **mesmo cristal** (💎 azul, 💎 roxo…). Para quebrar o gelo, é preciso remover essas setas **em sequência, sem tirar outra seta no meio**.
- Ao remover o 1º cristal, a sequência começa e o gelo racha.
- Se o jogador tirar uma seta que não é do cristal, a sequência quebra: o gelo volta inteiro e os cristais que já saíram viram **gelo de contador** (❄ igual ao número de cristais que faltavam). Assim a fase nunca trava.
- O desafio é **preparar o tabuleiro antes**: deixar todos os cristais com caminho livre na ordem certa e só então começar a sequência.

**Na tela.** Bloco de gelo com rachaduras que aumentam a cada passo da sequência, uma linha de geada ligando a seta aos cristais e um contador "2/3" durante a sequência.

**Progressão.**
| Fases | Variação |
| --- | --- |
| 61–67 | Contador: 1 ou 2 setas congeladas (❄2 a ❄4). |
| 68–71 | Contador com congeladas que bloqueiam o caminho de outras. |
| 72–75 | Sequência de cristais **em qualquer ordem** (2–3 cristais). |
| 76–79 | Sequência **numerada** (💎1 → 💎2 → 💎3): ordem obrigatória, 3–4 cristais. |
| 80 (chefe) | **Gelo em camadas**: a mesma seta precisa de duas sequências (cristais azuis e depois roxos). |

**Toque inválido.** Tocar uma seta congelada: treme e não tira vida. Tocar um cristal numerado fora de ordem: conta como quebrar a sequência.

**Geração.** O gerador escolhe os cristais entre setas que ficam livres em cadeia, ou seja, cada uma é liberada pela anterior ou já está livre. O solver confirma que existe pelo menos uma ordem que fecha a sequência.

---

## Mundo 5 — Vulcão (fases 81–100): Setas de magma

**Regra.** A seta de magma tem uma **contagem regressiva** (🔥5) que cai a cada jogada válida. Se chegar a zero, ela **entra em erupção**: o jogador perde 1 vida e o contador volta ao valor inicial.

**Na tela.** Seta brilhando em vermelho e tremendo mais forte quando faltam 2 jogadas. Na erupção, a tela treme.

**Progressão.**
- 81–87: 1 seta de magma com contador folgado.
- 88–94: 2 ou 3 setas de magma, contadores apertados.
- 95–99: a erupção também deixa **rocha temporária** nas células vizinhas por 2 jogadas, o que pode bloquear caminhos.
- 100 (chefe): magma em cadeia: tirar uma seta de magma soma +2 no contador das outras.

**Planejamento que a mecânica pede.** Priorizar: abrir caminho para o magma rápido, mas sem gastar jogadas à toa.

**Exceção de vida.** Esta é a única mecânica do jogo (além da colisão) que tira vida sozinha. Por isso o contador precisa ficar sempre bem visível.

---

## Mundo 6 — Cidade (fases 101–120): Mão dupla

**Regra.** Setas com a placa ⇄ **invertem a direção (180°)** sempre que outra seta é removida. O jogador precisa tirá-la no momento em que ela aponta para o lado livre.

**Na tela.** Placa de trânsito girando a cada jogada. A prévia do caminho mostra as duas direções e destaca a atual.

**Progressão.**
- 101–107: 1 ou 2 setas de mão dupla, com um dos lados sempre livre.
- 108–114: os dois lados ficam bloqueados no início, e é preciso abrir um deles na jogada certa.
- 115–119: **faixa lenta**: algumas invertem só a cada 2 jogadas (placa amarela).
- 120 (chefe): várias de mão dupla com ritmos diferentes (paridade cruzada).

**Planejamento que a mecânica pede.** Contar jogadas ("se eu tirar mais 1, ela vira para a esquerda").

---

## Mundo 7 — Selva (fases 121–140): Cipós

**Regra.** Um **cipó** liga 2 setas. Tocar em uma faz **as duas saírem juntas**. Os dois caminhos precisam estar livres (considerando que a outra também está saindo). Se qualquer uma bater, perde vida e nenhuma sai.

**Na tela.** Cipó verde ligando as setas. A prévia mostra os dois caminhos ao mesmo tempo.

**Progressão.**
- 121–127: pares de setas próximas, apontando para lados parecidos.
- 128–134: pares longe um do outro e apontando para lados opostos.
- 135–139: **trios** de setas ligadas.
- 140 (chefe): **cipó espinhoso**: um par é cortado quando outra seta passa pelo cipó ao sair, e então as duas setas viram independentes. Cortar ou não cortar vira parte do plano.

**Geração.** Na construção inversa, as setas do cipó são colocadas juntas, no mesmo passo e com caminhos livres. Assim a solução garantida continua por construção.

---

## Mundo 8 — Cânion (fases 141–160): Rochas defletoras

**Regra.** Rochas inclinadas (╱ e ╲) dentro do tabuleiro **desviam a seta 90°** quando ela passa. A seta sai por outra borda.

**Na tela.** Rocha com faixa diagonal. A prévia do caminho desenha a curva.

**Progressão.**
- 141–147: 1 ou 2 rochas, uma curva por caminho.
- 148–154: caminhos com 2 ou 3 curvas.
- 155–159: **rocha rachada**: quebra depois de desviar 1 seta e vira célula livre, mudando o caminho das próximas.
- 160 (chefe): labirinto de rochas com rachadas que abrem um atalho no fim.

**Geração.** O cálculo do caminho passa a seguir as rochas até a borda. O gerador rejeita caminhos que entram em laço.

---

## Mundo 9 — Oceano (fases 161–180): Redemoinhos

**Regra.** Redemoinhos vêm em **pares** (A e A'). A seta que entra em A sai por A' **na mesma direção** e continua o caminho.

**Na tela.** Pares com a mesma cor e um giro animado. A prévia mostra o caminho "pulando".

**Progressão.**
- 161–167: 1 par.
- 168–174: 2 ou 3 pares, com um caminho que usa dois portais seguidos.
- 175–179: **correnteza**: alguns portais giram a direção da seta 90° na saída.
- 180 (chefe): portais que **se alternam** (abertos nas jogadas pares, fechados nas ímpares).

**Geração.** Igual ao Cânion: caminho com teleporte e rejeição de laço. Os portais alternados precisam do solver.

---

## Mundo 10 — Montanha (fases 181–200): Pedras soltas

**Regra.** **Pedras** (que não são setas) ficam no tabuleiro e **caem para baixo** sempre que a célula embaixo delas fica vazia. Pedras nunca saem. Uma pedra que cai pode **fechar** ou **abrir** o caminho de outras setas.

**Na tela.** Pedra com sombra. A prévia mostra uma seta-fantasma indicando onde a pedra vai cair se aquela seta sair.

**Progressão.**
- 181–187: 1 ou 2 pedras que só abrem caminho.
- 188–194: pedras que podem fechar caminhos (a ordem importa).
- 195–199: pedras empilhadas (avalanche em cadeia).
- 200 (chefe): uma avalanche que, na ordem certa, libera metade do tabuleiro de uma vez.

**Beco sem saída.** É a primeira mecânica em que o jogador pode travar a fase. A engine detecta o beco e oferece reiniciar (custa 1 vida). A dica, que usa o solver, evita esses caminhos.

---

## Mundo 11 — Aurora (fases 201–220): Ciclo de cores

**Regra.** As setas têm cores. Uma barra no topo mostra o **ciclo** (ex.: verde → roxo → azul → verde…). A próxima seta removida precisa ser da **cor da vez**. Tirar a cor errada tira 1 vida (é um erro de leitura, como colidir).

**Na tela.** Barra da aurora com a cor atual brilhando. Setas da cor da vez pulsam de leve.

**Progressão.**
- 201–207: 2 cores alternando.
- 208–214: 3 cores.
- 215–219: setas **brancas** (coringa): saem a qualquer momento e **não** avançam o ciclo.
- 220 (chefe): seta **prisma**: ao sair, inverte a ordem do ciclo.

**Toque inválido.** Cor errada **tira vida**. Isso deve aparecer no balão de apresentação.

---

## Mundo 12 — Castelo (fases 221–240): Chaves e portões

**Regra.** **Portões** ocupam células e bloqueiam caminhos. Cada portão tem um símbolo (🗝️ ♦, ♣…). A **seta-chave** com o mesmo símbolo abre o portão quando sai.

**Na tela.** Portão de grade. Ao abrir, a grade sobe com som de corrente.

**Progressão.**
- 221–227: 1 chave e 1 portão.
- 228–234: 2 ou 3 pares, com uma chave atrás de outro portão (cadeia).
- 235–239: **portão temporizado**: fecha de novo depois de 4 jogadas.
- 240 (chefe): cadeia de 4 portões com um deles temporizado.

**Geração.** Na construção inversa, o portão é colocado depois da chave (na ordem inversa), então a solução continua garantida. Os temporizados precisam do solver.

---

## Mundo 13 — Galáxia (fases 241–260): Órbita

**Regra.** Setas com anel orbital **giram 90° no sentido horário** a cada seta removida. O jogador precisa tirá-las quando estiverem apontando para um lado livre.

**Na tela.** Anel girando em volta da seta, com uma setinha mostrando a próxima direção.

**Progressão.**
- 241–247: 1 ou 2 setas em órbita, com 2 lados livres.
- 248–254: só 1 lado livre (precisa contar até 4).
- 255–259: órbitas **anti-horárias** misturadas.
- 260 (chefe): **planeta**: uma célula que faz girar qualquer seta que passa ao lado dela.

**Diferença da Cidade.** Na Cidade são 2 estados (ida e volta). Aqui são 4, e o cálculo fica mais pesado.

---

## Mundo 14 — Nebulosa (fases 261–280): Neblina

**Regra.** Parte do tabuleiro fica coberta de **neblina**: não dá para ver nem as setas embaixo. Ao remover uma seta, a neblina some num raio de 1 célula em volta de onde ela estava. Setas na neblina não podem ser tocadas.

**Na tela.** Nuvem roxa animada. A neblina se dissolve como poeira de estrelas.

**Progressão.**
- 261–267: neblina só nos cantos.
- 268–274: metade do tabuleiro.
- 275–279: **neblina que volta**: áreas reveladas sem nenhuma seta removida por perto durante 5 jogadas são cobertas de novo.
- 280 (chefe): só o centro está visível no início.

**Diferença do Deserto.** No Deserto o jogador vê **onde** está a seta, mas não a direção. Aqui ele não vê nada e precisa abrir espaço para descobrir.

---

## Mundo 15 — Infinito (fases 281–300): Fusão

**Regra.** Cada fase mistura **2 mecânicas** dos mundos anteriores. A fase 300 (chefe final) usa **3**.

**Progressão.**
- 281–290: 2 mecânicas "leves" (Tocos, Maré, Cipós, Chaves, Mão dupla).
- 291–299: 1 leve + 1 pesada (Gelo em sequência, Pedras, Neblina, Ciclo de cores, Órbita).
- 300: 3 mecânicas, escolhidas a dedo (sugestão: Gelo em sequência + Ciclo de cores + Pedras soltas).

### Combinações que não devem acontecer

| Combinação | Motivo |
| --- | --- |
| Soterradas + Neblina | Duas mecânicas de esconder informação: vira adivinhação. |
| Mão dupla + Órbita na mesma seta | Ilegível. Podem estar na mesma fase, mas em setas diferentes. |
| Magma + Maré alta longa | O magma pode explodir sem o jogador conseguir fazer nada. |
| Ciclo de cores + Cipós de cores diferentes | Não fica claro que cor o par tem. Regra: os dois lados do cipó têm a mesma cor. |

---

## Modo infinito (fase 301 em diante)

Hoje a dificuldade estabiliza em ~71–73 depois da fase ~660. As mecânicas resolvem isso porque viram um **eixo novo de crescimento**, que continua subindo quando o tabuleiro e as setas já estão no máximo.

`ciclo` = 2 para as fases 301–600 (Bosque II…), 3 para 601–900, e assim por diante.

| Parâmetro | Ciclo II | Ciclo III | Ciclo IV | Ciclo V em diante |
| --- | --- | --- | --- | --- |
| Mecânica principal | a do mundo | a do mundo | a do mundo | a do mundo |
| Mecânicas extras | 0–1 | 1 | 1–2 | 2 |
| Intensidade (1–5) | 2–3 | 3 | 4 | 5 |
| Fase chefe (20ª) | +1 mecânica | +1 mecânica | +2 mecânicas | +2 mecânicas |

- **Bosque II** usa Tocos como principal + uma extra sorteada, **Praia II** usa Maré + extra, e assim por diante. O jogador revisita cada mecânica em versões mais duras.
- As extras são sorteadas pela **semente da fase** (respeitando a tabela de combinações proibidas), então a fase continua igual para todos.
- **Teto:** no ciclo V, com intensidade 5 e 2 extras, a dificuldade estimada passa de ~72 para algo entre **~85 e ~95**. Depois disso o desafio vem da variedade de combinações.

> Os valores de intensidade em cada ciclo são um ponto de partida. Depois de implementar, vale medir as médias por 100 fases, como no documento atual, e ajustar.

---

## Desafio do dia

- A mecânica do dia é sorteada pela **data** (mesma semente atual, AAAA-MM-DD) entre as 14 mecânicas.
- Intensidade 2–3, para continuar na faixa dos mundos 7 a 13.
- Se o jogador ainda não desbloqueou aquele mundo, aparece um **cartão de apresentação** de 1 tela antes da fase. Isso também funciona como "trailer" dos mundos futuros e dá vontade de avançar.
- Sugestão: **domingo** com 2 mecânicas e recompensa em dobro.

---

## Pesos sugeridos

Estimativas para o `bônus_mecânica`. Calibrar com o solver (quantidade de estados explorados) e com o tempo médio de solução.

| Mecânica | Peso por intensidade | Intensidade 1 | Intensidade 5 | Precisa de solver? |
| --- | --- | --- | --- | --- |
| Tocos | 0,8 | +0,8 | +4 | Não |
| Maré | 1,5 | +1,5 | +7,5 | Sim |
| Soterradas | 1,8 | +1,8 | +9 | Não (só a revelação) |
| Congeladas: contador | 1,2 | +1,2 | +6 | Não |
| Congeladas: sequência | 2,5 | +2,5 | +12,5 | Sim |
| Magma | 2,0 | +2 | +10 | Sim |
| Mão dupla | 1,8 | +1,8 | +9 | Sim |
| Cipós | 1,5 | +1,5 | +7,5 | Não |
| Rochas defletoras | 1,6 | +1,6 | +8 | Não (só rachadas) |
| Redemoinhos | 1,6 | +1,6 | +8 | Não (só alternados) |
| Pedras soltas | 2,5 | +2,5 | +12,5 | Sim |
| Ciclo de cores | 2,2 | +2,2 | +11 | Sim |
| Chaves e portões | 1,4 | +1,4 | +7 | Não (só temporizados) |
| Órbita | 2,2 | +2,2 | +11 | Sim |
| Neblina | 2,0 | +2 | +10 | Não (só a revelação) |

---

## Implementação

### Engine (`src/engine/`)

Cada mecânica vira um módulo com a mesma interface, para o resto da engine não precisar saber qual é:

```ts
interface Mechanic<S> {
  id: MechanicId;                                   // "ice", "tide", "magma"...
  setup(level: Level, rng: Rng): S;                 // estado inicial (só depende da semente)
  canTap(arrow: Arrow, board: Board, s: S): TapResult; // ok | locked(motivo) | penalty
  pathOf?(arrow: Arrow, board: Board, s: S): Cell[];   // Cânion, Oceano
  onRemove(arrow: Arrow, board: Board, s: S): S;    // derreter, girar, cair...
  onError(board: Board, s: S): S;                   // recongelar, quebrar sequência
  weight(s: S): number;                             // contribuição no bônus_mecânica
}
```

- O estado das mecânicas precisa ser **serializável**, para salvar a partida e enviar ao servidor.
- Nada de `Math.random()`: toda aleatoriedade vem do `Rng` da semente da fase.

### Solução garantida

- **Mecânicas sem estado** (Tocos, Cipós, Rochas, Redemoinhos, Chaves, Contador de gelo): a construção inversa continua bastando, com o caminho calculado pela mecânica.
- **Mecânicas com estado** (Maré, Sequência de gelo, Magma, Mão dupla, Pedras, Cores, Órbita, temporizados): depois de gerar, roda um **solver** (busca em largura com limite de nós e memória dos estados já vistos). Se ele não achar solução, o gerador tenta de novo com `semente + tentativa`, o que mantém o resultado determinístico.
- O mesmo solver alimenta a **dica** e o **detector de beco sem saída**.

### Formato em `levels.json`

```json
{
  "id": 72,
  "size": 8,
  "arrows": [ ... ],
  "mechanics": [
    { "type": "ice-sequence", "target": 5, "crystals": [2, 9, 14], "ordered": false }
  ],
  "schemaVersion": 2
}
```

O `schemaVersion` permite o jogo e o servidor recusarem com clareza um formato que não conhecem.

### Servidor C# (`server/Setas.Api/Engine`)

- Cada mecânica precisa existir **igual** em C#. Esse é o maior custo do projeto: 15 mecânicas × 2 linguagens.
- O `npm run vectors` passa a gerar vetores de teste **por mecânica** (estado inicial, lista de jogadas, estado final esperado), e o `npm run api:test` confere todos.
- A partida enviada ao ranking passa a incluir a lista de jogadas. O servidor reproduz tudo, incluindo maré, magma e quedas, antes de aceitar.

### Desempenho

Hoje uma fase infinita leva 2 a 11 ms. Com solver, a meta é ficar **abaixo de 50 ms**:
- limite de nós no solver (ex.: 20.000 estados);
- se estourar o limite, cair para uma variação mais simples da mesma mecânica, de forma determinística;
- gerar a próxima fase em segundo plano enquanto o jogador está na atual.

---

## Ordem de implementação sugerida

Do mais simples para o mais complexo, aproveitando o que cada etapa constrói:

| Etapa | Mecânicas | Por quê |
| --- | --- | --- |
| 1 | Tocos, Chaves e portões, Cipós | Sem estado. Servem para criar a interface `Mechanic` e o novo formato do `levels.json`. |
| 2 | Gelo (contador e depois sequência) | É a ideia original e a vitrine do jogo. A sequência obriga a criar o **solver**. |
| 3 | Rochas defletoras, Redemoinhos | Reaproveitam o cálculo de caminho. A prévia precisa desenhar curvas e saltos. |
| 4 | Mão dupla, Órbita, Maré, Magma | Mecânicas de tempo e estado, já com o solver pronto. |
| 5 | Soterradas, Neblina, Ciclo de cores | Mudam mais a interface e as regras de toque. |
| 6 | Pedras soltas | Precisam do detector de beco sem saída. |
| 7 | Fusão (mundo 15), modo infinito por ciclos, desafio do dia | Dependem de todas as anteriores. |

## Pontos de atenção

1. **As 300 fases atuais vão mudar.** Ao rodar `npm run levels` com mecânicas, as fases deixam de ser as mesmas. Jogadores que já estão no meio do mapa vão encontrar fases diferentes, e o ranking antigo deixa de valer. Sugestão: tratar como uma nova temporada do ranking.
2. **Teste com jogadores antes de fechar os pesos.** A fórmula mede bem tamanho e profundidade, mas mecânicas de leitura (Cores, Neblina) pesam mais na cabeça do que a fórmula consegue capturar.
3. **A apresentação de cada mecânica é tão importante quanto a regra.** Toda 1ª fase de mundo precisa de um tabuleiro onde a regra é a única coisa nova e um balão curto com uma animação de exemplo.
4. **Manter a acessibilidade.** Ciclo de cores e cristais não podem depender só de cor: cada cor tem também um símbolo (▲ ● ■).

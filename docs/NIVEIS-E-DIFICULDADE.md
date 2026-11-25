# Níveis, fases e dificuldade — Bosque das Setas

> **Criado em:** 24/11/2026 às 11:29 (horário de Brasília, UTC−3)
> **Base da análise:** código em `src/engine/` e `scripts/generate-levels.ts`, e as fases de `src/data/levels.json`. Os números foram medidos rodando a própria engine do jogo.

## Resumo

| Pergunta | Resposta |
| --- | --- |
| Quantas fases tem? | **300 fases prontas** (curadas), em **15 mundos de 20 fases**. |
| Tem modo infinito? | **Sim.** Da fase 301 em diante o jogo cria fases novas, sem fim. |
| A fase N é igual para todo mundo? | **Sim**, tanto as 300 prontas quanto as infinitas. Isso é o que permite o ranking e a conferência das partidas no servidor. |
| Tem outros modos? | **Desafio do dia:** uma fase por dia, igual para todos os jogadores. |
| A dificuldade sobe sempre? | Sobe de mundo em mundo até a fase ~500. **Depois disso estabiliza** (ver [Pontos de atenção](#pontos-de-atenção)). |

---

## Como o jogo mede a dificuldade

Cada fase recebe uma **pontuação de dificuldade** calculada pela engine (`difficultyOf` em `src/engine/generator.ts`):

```
dificuldade = profundidade × 4
            + quantidade de setas × 0,6
            + (1 − setas livres no início ÷ total de setas) × 12
            + tamanho do tabuleiro
```

| Fator | O que significa para o jogador |
| --- | --- |
| **Profundidade** | Quantas "ondas" são necessárias para limpar o tabuleiro: tirando todas as setas livres de uma vez, quantas rodadas até acabar. É o fator que mais pesa. |
| **Quantidade de setas** | Mais setas, mais coisa para analisar. |
| **Setas livres no início** | Quanto menos setas podem sair logo de cara, mais difícil começar. |
| **Tamanho do tabuleiro** | De 4×4 até 14×14. |

Toda fase tem **solução garantida**: o gerador só coloca uma seta se o caminho dela estiver livre naquele momento, então tirar as setas na ordem inversa sempre resolve. Os testes (`npm test`) conferem isso para as 300 fases.

### O que torna a partida mais difícil para o jogador

- **3 vidas por fase.** Cada seta que bate em outra tira uma vida.
- **Estrelas:** 3 sem erros, 2 com um erro, 1 com dois erros.
- **Ajudas:** dica (destaca uma seta livre; o jogador começa com 5), prévia do caminho (segurar o dedo na seta) e continuar com +1 vida (assistindo anúncio ou pagando 30 moedas).

---

## As 300 fases prontas (curadas)

Como são criadas (`npm run levels`):
1. O script gera um banco de **1.200 fases candidatas** em várias faixas de dificuldade.
2. Descarta as que têm menos de 4 setas e ordena todas pela pontuação.
3. Escolhe 300 fases espaçadas de forma uniforme, formando uma curva suave.
4. As 3 primeiras são fases de **tutorial** feitas à parte.
5. Dentro de cada mundo, as fases são ordenadas pelo **tamanho do tabuleiro**, para o jogador não pular de 9×9 para 5×5 de uma fase para outra.

### Tutorial (fases 1 a 3)

| Fase | Tabuleiro | Setas | Dificuldade | Ideia |
| --- | --- | --- | --- | --- |
| 1 | 4×4 | 3 | 9,8 | Todas as setas livres: só aprender a tocar. |
| 2 | 4×4 | 4 | 27,4 | Primeira seta bloqueada: aprender sobre vidas. |
| 3 | 5×5 | 7 | 28,1 | Mais bloqueios: aprender a prévia do caminho. |

### Mundo a mundo

Valores medidos nas fases de `levels.json` ("prof." = profundidade).

| Mundo | Fases | Nome | Tabuleiro | Setas (média) | Dificuldade (faixa) | Dificuldade média | Prof. média |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 1–20 | Bosque | 4×4 a 7×7 | 3–12 (8,4) | 9,8–28,1 | 23,0 | 2,2 |
| 2 | 21–40 | Praia | 5×5 a 8×8 | 8–15 (10,1) | 27,6–30,1 | 28,9 | 2,9 |
| 3 | 41–60 | Deserto | 5×5 a 9×9 | 8–17 (11,9) | 30,1–32,9 | 31,5 | 3,1 |
| 4 | 61–80 | Geleira | 6×6 a 9×9 | 9–16 (13,0) | 33,0–35,3 | 34,2 | 3,4 |
| 5 | 81–100 | Vulcão | 5×5 a 10×10 | 7–18 (13,5) | 35,4–37,2 | 36,3 | 3,6 |
| 6 | 101–120 | Cidade | 5×5 a 10×10 | 8–20 (14,0) | 37,2–39,1 | 38,0 | 4,0 |
| 7 | 121–140 | Selva | 6×6 a 10×10 | 9–23 (15,3) | 39,1–40,6 | 39,8 | 3,9 |
| 8 | 141–160 | Cânion | 6×6 a 11×11 | 11–23 (17,0) | 40,6–42,2 | 41,4 | 3,9 |
| 9 | 161–180 | Oceano | 7×7 a 11×11 | 13–24 (18,0) | 42,3–43,8 | 43,0 | 4,1 |
| 10 | 181–200 | Montanha | 7×7 a 12×12 | 11–23 (18,2) | 43,9–45,5 | 44,7 | 4,3 |
| 11 | 201–220 | Aurora | 8×8 a 11×11 | 15–24 (19,8) | 45,6–47,4 | 46,5 | 4,4 |
| 12 | 221–240 | Castelo | 8×8 a 12×12 | 15–27 (20,9) | 47,5–49,2 | 48,4 | 4,6 |
| 13 | 241–260 | Galáxia | 9×9 a 12×12 | 16–29 (22,5) | 49,4–51,6 | 50,5 | 4,7 |
| 14 | 261–280 | Nebulosa | 9×9 a 12×12 | 17–26 (22,3) | 51,7–54,2 | 52,9 | 5,3 |
| 15 | 281–300 | Infinito | 9×9 a 12×12 | 17–30 (23,7) | 54,4–62,4 | 57,6 | 6,3 |

**Leitura:** a dificuldade média **sobe em todos os mundos**, sem nenhuma queda de um mundo para o seguinte. As setas vão de ~8 para ~24 por fase, a profundidade de ~2 para ~6, e o tabuleiro sai de 4×4 e chega a 12×12. Os mundos 2 a 14 sobem em passos pequenos e regulares (~2 pontos por mundo). O mundo 15 dá um salto maior, porque fecha a parte curada com as fases mais difíceis do banco.

---

## Modo infinito (fase 301 em diante)

Não existe um botão "modo infinito": é a **continuação natural do mapa**. Depois da fase 300, o jogo gera cada fase na hora (`generateInfinite` em `src/engine/levels.ts`):

- **Determinística:** a fase N usa sempre a mesma semente, então é igual para todos. O servidor tem a mesma lógica em C# (`server/Setas.Api/Engine`) para conferir as partidas do ranking.
- **Escolhe a mais difícil entre várias candidatas:** gera de 2 a 8 versões da fase e fica com a de maior "dureza" (profundidade, quantidade de setas e setas bloqueadas no início).
- **Mundos continuam:** os 15 nomes se repetem com numeração romana (Bosque II, Praia II…) e o mapa mostra o símbolo ∞.

### Como os parâmetros crescem

`k` = quantas fases depois da 300 (fase 301 → k = 0).

| Parâmetro | Fórmula | Começa em | Para de crescer em |
| --- | --- | --- | --- |
| Tabuleiro | 12 + k÷100 (máx. 14) | 12×12 | **14×14** a partir da fase 501 |
| Comprimento máximo da seta | 6 + k÷120 (máx. 9) | 6 | **9** a partir da fase 661 |
| Preenchimento do tabuleiro | 88% + 1% a cada 25 fases (máx. 95%) | 88% | **95%** a partir da fase 476 |
| Candidatas por fase | 2 + k÷50 (máx. 8) | 2 | **8** a partir da fase 601 |

### Dificuldade medida no modo infinito

Médias de 100 fases seguidas:

| Fases | Tabuleiro | Setas (média) | Prof. média | Dificuldade média | Faixa |
| --- | --- | --- | --- | --- | --- |
| 301–400 | 12×12 | 33,1 | 6,1 | 63,6 | 53,6–78,6 |
| 401–500 | 13×13 | 35,9 | 6,7 | 68,6 | 56,1–80,1 |
| 501–600 | 14×14 | 38,0 | 7,1 | **72,7** | 61,7–86,1 |
| 601–700 | 14×14 | 36,7 | 7,2 | 72,2 | 62,8–83,9 |
| 701–800 | 14×14 | 35,1 | 7,3 | 71,7 | 62,8–89,5 |
| 901–1000 | 14×14 | 34,7 | 7,2 | 71,3 | 60,2–81,9 |
| 1901–2000 | 14×14 | 35,7 | 7,0 | 71,0 | 62,6–82,5 |

Cada fase infinita leva cerca de 2 a 11 ms para ser gerada, então o jogador não percebe espera.

---

## Desafio do dia

- Uma fase por dia, igual para todos (a semente é a data, no formato AAAA-MM-DD).
- Sempre **9×9**, com setas de até 7 células, 15 a 20 setas e dificuldade entre ~39 e ~53, mais ou menos o nível dos **mundos 7 a 13**. Amostra de 5 datas.
- Dá moedas extras e conta a sequência de dias seguidos. Tem um ranking próprio.

---

## Pontos de atenção

1. **A dificuldade estabiliza por volta da fase 500.** Na fase ~660 todos os parâmetros chegam ao limite, e a dificuldade média fica parada em **~71–73 para sempre**. Da fase 600 em diante ela até cai um pouco, porque setas mais longas ocupam mais espaço e sobram menos setas no tabuleiro. Para jogadores que vão longe, o desafio para de crescer.
   - **Possível melhoria:** depois do platô, aumentar outro fator, como a profundidade mínima exigida, mais candidatas por fase ou fases com menos setas livres no início.
2. **Dentro de um mundo, a dificuldade não sobe fase a fase.** Como cada mundo é ordenado pelo tamanho do tabuleiro, há 54 casos nas 300 fases em que uma fase é um pouco mais fácil que a anterior. É de propósito e as diferenças são pequenas (~1 a 2 pontos dentro do mundo).
3. **A passagem da fase 300 para a 301 é suave.** A fase 300 tem dificuldade 62,4 e a média das fases 301–400 é 63,6. As fases 301–400 variam bastante (53,6 a 78,6), então algumas parecem mais fáceis que o fim do mundo 15.
4. **Mudar as regras de geração exige cuidado.** A mesma lógica existe em TypeScript (jogo) e em C# (servidor). Se mudar uma, mude a outra e rode `npm run vectors` e `npm run api:test`, senão o servidor passa a recusar partidas válidas no ranking.

## Como mudar a quantidade de fases prontas

```powershell
npm run levels -- 450   # gera 450 fases curadas (atualiza o jogo e o servidor)
npm test                # confere que todas têm solução
```

O modo infinito começa automaticamente depois da última fase curada, qualquer que seja a quantidade.

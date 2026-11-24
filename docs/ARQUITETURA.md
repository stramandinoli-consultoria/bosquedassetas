# Arquitetura

## Camadas

```
ui/  ──usa──▶  game/board.ts  ──usa──▶  engine/
 │
 └──usa──▶  services/ (interfaces)  ◀──implementa──  ads/admob.ts, ads/web.ts, haptics.ts …
```

- **engine/** não conhece DOM nem plataforma. Tem as regras (`rules.ts`), o gerador (`generator.ts`) e o gerador de números (`rng.ts`). É o que os testes cobrem.
- **game/board.ts** desenha o tabuleiro em SVG e transforma toques em jogadas. Avisa a tela por eventos (`onExit`, `onBump`, `onClear`, `onPreview`).
- **ui/** monta as telas com DOM puro (sem framework), através do helper `h()` de `ui/dom.ts`. O roteador simples fica em `ui/app.ts`.
- **services/** é o "SDK" do jogo. O resto do código só conhece as interfaces (`IAdsService`, `IHaptics`, `IStorage`, `IAudio`, `IAnalytics`). O arquivo `services/index.ts` escolhe a implementação de cada plataforma, como um container de injeção de dependência.

## Por que a engine garante solução

Ao gerar, cada seta nova só é colocada se o raio da cabeça dela estiver livre naquele momento. Se o jogador remover as setas na ordem inversa da colocação, cada uma encontra o caminho livre. Então toda fase gerada tem pelo menos uma solução. Mesmo assim, `npm test` resolve todas as fases de `levels.json` para conferir.

## Dificuldade

`difficultyOf()` em `engine/generator.ts` soma:

- profundidade da cadeia de dependências (quantas "rodadas" para limpar tudo, removendo todas as setas livres a cada rodada) × 4
- quantidade de setas × 0,6
- fração de setas presas no início × 12
- tamanho do tabuleiro

O script `scripts/generate-levels.ts` gera 4 candidatas por fase, ordena pela pontuação, escolhe 300 espaçadas e, dentro de cada mundo de 20, ordena pelo tamanho do tabuleiro. As 3 primeiras são fases de tutorial feitas sob medida.

## Plataformas

O código detecta o app nativo por `window.Capacitor` (injetado pelo Capacitor), sem importar pacotes nativos. Os plugins nativos (Haptics, App, AdMob) são acessados pela ponte do Capacitor (`Capacitor.Plugins.Nome`). Assim:

- o mesmo `dist/` roda no navegador e dentro do app
- o build web não quebra se um plugin nativo não estiver instalado

| Serviço | Web / PWA | Portal CrazyGames | App Android/iOS |
| --- | --- | --- | --- |
| Anúncios | Nenhum (ou simulado em dev) | `CrazyGamesAds` | `AdMobAds` |
| Vibração | Vibration API | Vibration API | `@capacitor/haptics` |
| Salvamento | localStorage | localStorage | localStorage do WebView |
| Botão voltar | — | — | `@capacitor/app` |

## Adicionar uma implementação nova

Exemplo: trocar o analytics de console pelo Firebase.

1. Crie `services/firebase-analytics.ts` implementando `IAnalytics`.
2. Em `services/index.ts`, troque `new ConsoleAnalytics()` pela nova classe.

Nada mais no jogo muda.

## Eventos de analytics já emitidos

`level_win` (level, stars, moves), `level_lose` (level, moves), `reward` (placement), `skin_buy` (id, price).

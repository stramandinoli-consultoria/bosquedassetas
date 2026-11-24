# Setas! — Puzzle Escape (v2)

Puzzle de tirar setas do tabuleiro. Toque numa seta e ela sai na direção em que aponta; se bater em outra, você perde uma vida.

Um único código em **TypeScript + Vite** gera quatro saídas:

| Saída | Como gerar | Para quê |
| --- | --- | --- |
| Site / PWA | `npm run build` → pasta `dist/` | Hospedar (GitHub Pages, Netlify) e instalar no celular pelo navegador |
| Arquivo único | `npm run build:single` → `dist-single/setas.html` | Portais de jogos (CrazyGames, Poki, itch.io) ou abrir com dois cliques |
| App Android | `npm run android` | Play Store (ver `docs/PUBLICACAO-ANDROID.md`) |
| App iOS | `npm run ios` ou build na nuvem | App Store (ver `docs/PUBLICACAO-IOS.md`) |
| Servidor (jogo + API) | `Dockerfile` na raiz | Railway: contas, ranking e progresso na nuvem (ver `docs/RAILWAY.md`) |

## Começando

Requisitos: **Node.js 22 ou mais novo**.

```bash
npm install
npm run dev        # abre em http://localhost:5173 (com anúncios simulados)
npm test           # testes da engine (todas as fases têm solução etc.)
npm run build      # gera dist/ pronto para publicar
```

Para testar no celular na mesma rede Wi-Fi, use o endereço "Network" que o `npm run dev` mostra.

## Fases infinitas, contas e ranking

- As **300 primeiras fases** são curadas (`src/data/levels.json`). Depois delas o jogo **gera fases sem fim**: o tabuleiro cresce até 14x14 e as fases ficam com mais setas e mais dependências. A fase N é sempre igual para todos.
- **Conta opcional** (e-mail, senha e apelido) para entrar no **ranking** e salvar o progresso na nuvem. Sem conta, tudo continua funcionando no aparelho.
- **Ranking geral** (quem chegou mais longe) e **ranking do desafio do dia**.
- **Anti-trapaça**: o servidor refaz cada partida com a mesma engine (portada para C#) antes de aceitar.
- **API em .NET 10** (`server/`): ASP.NET Core + EF Core + PostgreSQL. Testes em `server/Setas.Tests`.

```bash
npm run mock-api   # API falsa em memória para testar o jogo sem .NET
npm run api        # API .NET real (precisa do .NET 10 SDK e de um Postgres)
npm run api:test   # testes da API (inclui a comparação com a engine do jogo)
```

## O que mudou da v1

- **Tela inicial** com botão Jogar, progresso, configurações e instalação como app
- **Mapa de mundos**: 300 fases em 15 mundos de 20, com estrelas e cadeado
- **Fases curadas**: geradas antes (`npm run levels`), ordenadas por dificuldade, todas testadas e com solução garantida
- **Tutorial** nas 3 primeiras fases (mãozinha animada, explicação de vidas e da prévia)
- **Prévia do caminho**: segure o dedo numa seta para ver o caminho (verde = livre, vermelho = bate)
- **Zoom com pinça** nos tabuleiros grandes (botão 1:1 volta ao normal)
- **Desafio do dia** com sequência de dias e moedas extras
- **Moedas, dicas e loja de skins** (6 paletas de cores)
- **Monetização pronta**: anúncio recompensado (+1 vida, +3 dicas, dobrar moedas) e intersticial a cada 3 fases no app
- Vibração, partículas, contador de jogadas, Português e Inglês
- Funciona offline como PWA

## Estrutura

```
src/
  engine/        regras, gerador de fases, dificuldade (sem nada de tela, testável)
  game/board.ts  tabuleiro em SVG: animações, toque, toque longo, pinça
  ui/            telas (home, mapa, jogo, loja, configurações) e modais
  services/      o "SDK" do jogo: interfaces + implementação por plataforma
    ads/         AdMob (app), CrazyGames (portal), simulado (dev), nenhum (PWA)
    haptics.ts   vibração nativa (Capacitor) ou Vibration API (web)
    storage.ts   salvamento do progresso
    audio.ts     efeitos sonoros sintetizados (sem arquivos de áudio)
  state/         progresso do jogador e skins
  i18n/          textos em pt e en
  data/levels.json   as 300 fases
scripts/
  generate-levels.ts  gera data/levels.json
  build-single.mjs    gera o arquivo HTML único
tests/engine.test.ts
public/          manifest do PWA, service worker, ícones
resources/       ícone e splash para gerar os ícones nativos (npm run icons)
docs/            guias de arquitetura e publicação (RAILWAY.md = deploy)
server/
  Setas.Api/      API .NET: contas, ranking, conferência das partidas
    Engine/       engine do jogo portada para C# (mesmas fases)
    Endpoints/    rotas /api/...
    wwwroot/      privacidade.html e excluir-conta.html
  Setas.Tests/    testes (vectors.json = fases de referência geradas pelo TS)
Dockerfile       imagem única para o Railway (jogo + API)
```

Mais detalhes em `docs/ARQUITETURA.md`.

## Configurações importantes

- `src/config.ts`: IDs dos anúncios AdMob (hoje são os **IDs de teste do Google**), preços, vidas, frequência do intersticial.
- `capacitor.config.ts`: `appId` (ID do app nas lojas; **não pode mudar depois de publicar**) e nome.
- `public/manifest.webmanifest`: nome e cores do PWA.

## Mudar a quantidade de fases

```bash
npm run levels -- 450   # gera 450 fases
npm test                # confere que todas têm solução
```

## Publicar como site (PWA)

1. `npm run build`
2. Suba o conteúdo de `dist/` para qualquer hospedagem estática com HTTPS (GitHub Pages, Netlify, Vercel, seu IIS).
3. No Android/Chrome aparece "Instalar app"; no iPhone, Safari → Compartilhar → "Adicionar à Tela de Início". O jogo também mostra esse botão na tela inicial.

## Portais de jogos

`npm run build:single` gera `dist-single/setas.html`. Quando o jogo roda dentro do CrazyGames, o adaptador `CrazyGamesAds` usa o SDK do portal automaticamente.

Para testar o fluxo de anúncios no navegador, abra com `?fakeads` no endereço ou gere com `node scripts/build-single.mjs --fakeads`.

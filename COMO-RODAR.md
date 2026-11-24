# Como rodar o projeto (Setas! — Puzzle Escape)

Guia rápido para rodar o jogo no seu computador (Windows).

---

## 0. Jeito mais rápido (sem instalar nada)

Já existe uma versão pronta em arquivo único:

```
dist-single\setas.html
```

Dê dois cliques nele e o jogo abre no navegador. Serve para jogar e ver como está,
mas **não** reflete mudanças no código até você gerar de novo (`npm run build:single`).

---

## 1. Pré-requisitos

| Ferramenta | Para quê | Obrigatório? |
| --- | --- | --- |
| **Node.js 22 ou mais novo** | Rodar e compilar o jogo | Sim |
| .NET 10 SDK | API real (contas, ranking) | Só se for usar a API real |
| PostgreSQL | Banco da API real | Só se for usar a API real |
| Android Studio / Xcode | Gerar app Android / iOS | Só para os apps |

### Instalar o Node.js

O Node **não está instalado (ou não está no PATH)** nesta máquina. Instale a versão LTS:

- Baixe em https://nodejs.org (versão LTS, 22 ou maior), **ou**
- No PowerShell: `winget install OpenJS.NodeJS.LTS`

Depois **feche e abra o terminal (ou o VS Code)** e confira:

```powershell
node -v   # deve mostrar v22.x ou maior
npm -v
```

---

## 2. Abrir a pasta do projeto

O nome da pasta tem espaços e um travessão (`–`), então use **aspas**:

```powershell
cd "C:\Projetos\Jogos\Puzzles\Arrows – Puzzle Escape"
```

Dica: no VS Code, abra a pasta (Arquivo → Abrir Pasta) e use o terminal integrado
(Ctrl + ') — ele já abre no lugar certo.

---

## 3. Instalar as dependências (só na primeira vez)

```powershell
npm install
```

Isso cria a pasta `node_modules`.

---

## 4. Rodar o jogo em modo desenvolvimento

```powershell
npm run dev
```

Abra no navegador: **http://localhost:5173**

- Ao salvar um arquivo em `src/`, a página atualiza sozinha.
- Os anúncios aparecem **simulados**.
- Para testar no celular (mesma rede Wi-Fi), use o endereço **Network** que aparece no terminal.
- Para parar: **Ctrl + C** no terminal.

> Sem API rodando, o jogo funciona normalmente; só login/ranking não funcionam.

---

## 5. (Opcional) Testar contas e ranking

O jogo em dev manda as chamadas `/api` para `http://localhost:8080`. Você tem duas opções:

### Opção A — API falsa (mais fácil, não precisa de .NET nem banco)

Abra um **segundo terminal** e rode:

```powershell
npm run mock-api
```

Deixe os dois rodando (`npm run dev` + `npm run mock-api`) e use http://localhost:5173.
Os dados ficam só na memória e somem ao fechar.

### Opção B — API .NET real

Precisa do **.NET 10 SDK** e de um **PostgreSQL** rodando em `localhost:5432` com:

- banco: `setas`
- usuário: `postgres`
- senha: `postgres`

(configurado em `server/Setas.Api/appsettings.Development.json`)

Jeito rápido de subir o Postgres com Docker:

```powershell
docker run -d --name setas-db -p 5432:5432 -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=setas postgres:17
```

Depois, em um segundo terminal:

```powershell
npm run api
```

---

## 6. Outros comandos úteis

| Comando | O que faz |
| --- | --- |
| `npm test` | Testes da engine (confere se todas as fases têm solução) |
| `npm run typecheck` | Verifica erros de TypeScript |
| `npm run build` | Gera o site/PWA na pasta `dist/` |
| `npm run preview` | Serve o `dist/` localmente para testar o build final |
| `npm run build:single` | Gera `dist-single/setas.html` (arquivo único) |
| `npm run levels -- 450` | Gera 450 fases (depois rode `npm test`) |
| `npm run api:test` | Testes da API .NET |
| `npm run android` | Compila e abre o projeto no Android Studio |
| `npm run ios` | Compila e abre no Xcode (só no Mac) |

---

## 7. Rodar tudo com Docker (jogo + API juntos)

Se tiver Docker instalado:

```powershell
docker build -t setas .
docker run -p 8080:8080 -e ConnectionStrings__Default="Host=host.docker.internal;Port=5432;Database=setas;Username=postgres;Password=postgres" setas
```

Abra http://localhost:8080. (Precisa do Postgres da Opção B rodando.)
Mais detalhes de deploy em `docs/RAILWAY.md`.

---

## Problemas comuns

| Erro | Solução |
| --- | --- |
| `'node' não é reconhecido...` | Node não instalado ou terminal aberto antes da instalação. Instale e reabra o terminal/VS Code. |
| `Cannot find path ...` ao dar `cd` | Faltaram as aspas no caminho (ver passo 2). |
| `npm run ...` dá erro de execução de scripts no PowerShell | Rode `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` uma vez, ou use o terminal `cmd`. |
| Porta 5173 ou 8080 em uso | Feche o outro processo que está usando a porta (outro `npm run dev` aberto, por exemplo). |
| Login/ranking não funcionam em dev | Falta rodar a API (`npm run mock-api` ou `npm run api`). |

---

Mais informações: `README.md` e `docs/ARQUITETURA.md`.

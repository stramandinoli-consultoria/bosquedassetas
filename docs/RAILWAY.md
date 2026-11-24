# Colocar o Setas! no Railway

Um único serviço no Railway roda **o jogo (site/PWA) e a API** no mesmo endereço, com um banco **PostgreSQL** ao lado.

```
Railway (projeto "setas")
├── setas        ← este repositório (Dockerfile): jogo + API .NET
└── Postgres     ← banco do ranking e das contas
```

Custo: a API e o banco são pequenos e devem caber nos US$ 20 de uso incluídos no plano Pro. Acompanhe em **Usage** no painel.

---

## 0. Antes de tudo: conferir no seu PC

A API foi escrita sem um .NET SDK disponível para compilar. Rode uma vez no seu PC (precisa do **.NET 10 SDK**):

```bash
dotnet test server/Setas.Tests
```

Os testes confirmam que a engine em C# gera **exatamente** as mesmas fases do jogo (comparando com `server/Setas.Tests/vectors.json`, gerado pelo TypeScript). Se algum falhar, corrija antes de publicar: o ranking depende disso.

Para testar tudo localmente com banco de verdade:

```bash
docker run -d --name setas-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=setas -p 5432:5432 postgres:17
npm run api        # API em http://localhost:8080 (cria as tabelas sozinha)
npm run dev        # jogo em http://localhost:5173 (o /api vai para a porta 8080)
```

Sem Docker/.NET, dá para testar o jogo com a API falsa em memória: `npm run mock-api` (mesmo contrato da API real).

---

## 1. Subir o código para o GitHub

```bash
git init
git add .
git commit -m "Setas! v2 com API"
gh repo create stramandinoli-consultoria/setas --private --source=. --push
```

(Ou crie o repositório pelo site do GitHub e faça `git remote add origin …` + `git push -u origin main`.)

## 2. Criar o serviço no Railway

1. No painel do Railway: **New Project → Deploy from GitHub repo** e escolha o repositório `setas`.
   Se quiser usar um projeto que já existe: abra o projeto, clique em **+ Create** (ou **New**) → **GitHub Repo**.
2. O Railway encontra o `Dockerfile` na raiz e usa automaticamente. O primeiro deploy pode falhar por falta de variáveis: é normal, siga os próximos passos.

## 3. Criar o banco PostgreSQL

1. No mesmo projeto: **+ Create → Database → PostgreSQL**.
2. Espere o serviço **Postgres** ficar verde.

## 4. Variáveis do serviço `setas`

Abra o serviço **setas → Variables** e crie:

| Variável | Valor | Para quê |
| --- | --- | --- |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | Conexão com o banco pela rede interna do Railway |
| `JWT_SECRET` | um texto aleatório com 48+ caracteres | Assinar os logins. **Nunca** compartilhe nem mude depois (desloga todo mundo) |
| `CORS_ORIGINS` | opcional, ex.: `https://meusite.com.br` | Só se o jogo também rodar em outro domínio |

Para gerar o `JWT_SECRET` no Windows (PowerShell):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])
```

O nome dentro de `${{ }}` precisa ser o nome do serviço do banco como aparece no painel (normalmente `Postgres`, com P maiúsculo). O app e o banco precisam estar **no mesmo projeto** para a rede interna funcionar.

## 5. Endereço público e verificação de saúde

Em **setas → Settings**:

1. **Networking → Generate Domain**. Se pedir a porta, use **8080**. Você recebe algo como `https://setas-production.up.railway.app`.
2. **Deploy → Healthcheck Path**: `/health`. O Railway só troca para a versão nova quando ela responde.

Depois clique em **Deploy** (ou faça um novo `git push`).

## 6. Conferir

- `https://SEU-ENDERECO/health` → `{"status":"ok"}`
- `https://SEU-ENDERECO/` → o jogo abre
- No jogo: **👤 Entrar → Criar conta**, vença uma fase e abra **🏆 Ranking**
- Nos **Logs** do serviço não deve aparecer erro de banco. Na primeira vez a API cria as tabelas sozinha.

## 7. Apps Android e iOS apontando para a API

O app instalado precisa saber o endereço da API. Crie na raiz do projeto o arquivo `.env.production`:

```
VITE_API_URL=https://setas-production.up.railway.app
```

e gere o app normalmente (`npm run android` / `npm run ios`). O jogo servido pelo próprio Railway não precisa disso: ele usa o mesmo endereço.

## 8. Links que as lojas pedem

| Pedido da loja | Link |
| --- | --- |
| Política de privacidade (Play Store e App Store) | `https://SEU-ENDERECO/privacidade.html` |
| Exclusão de conta pela web (Play Store) | `https://SEU-ENDERECO/excluir-conta.html` |

Antes de publicar, edite `server/Setas.Api/wwwroot/privacidade.html` com seu nome/empresa e e-mail de contato. A exclusão **dentro do app** já existe em **Conta → Excluir minha conta**.

## 9. Atualizações

Cada `git push` na branch principal gera um deploy novo automaticamente. O banco não é apagado.

Se mudar a engine (gerador de fases, regras): rode `npm run levels` (gera fases + vetores), `npm test` e `dotnet test server/Setas.Tests` antes de publicar.

## Como funciona o ranking (resumo)

- O app manda a **lista de setas tocadas** em cada fase vencida. A API refaz a partida com a engine em C# e só conta se todas as setas saíram. Ninguém consegue "inventar" que chegou à fase 5.000.
- A fase precisa ser jogada **em ordem** na conta (não dá para pular para uma bloqueada).
- Quem joga como convidado guarda as partidas numa fila no aparelho; ao criar a conta, elas são enviadas e entram no ranking.
- Ranking geral: maior fase alcançada → mais estrelas → quem chegou primeiro.
- Ranking do dia: menos erros → menos jogadas → quem terminou primeiro.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| Deploy falha com "Defina a variável JWT_SECRET" | Falta a variável ou tem menos de 32 caracteres |
| Logs: "Banco indisponível" repetido | `DATABASE_URL` errada ou o banco está em outro projeto |
| Healthcheck falha | Domínio/porta diferente de 8080, ou a API caiu na inicialização (veja os logs) |
| App Android diz "Servidor não configurado" | Faltou o `.env.production` com `VITE_API_URL` antes do build |
| Ranking não aparece no app | O aparelho estava sem internet: as partidas ficam na fila e são enviadas depois |

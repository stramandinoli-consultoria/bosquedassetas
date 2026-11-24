# Cria o repositorio privado stramandinoli-consultoria/setas e envia este projeto.
# Uso: botao direito neste arquivo -> "Executar com o PowerShell"
#      (ou de dois cliques em publicar-no-github.cmd)
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot
$Repo = 'stramandinoli-consultoria/setas'
$Descricao = 'Setas! - puzzle de setas (web, Android, iOS) com API .NET e ranking'

function Sair($codigo) { Write-Host ''; Read-Host 'Pressione Enter para fechar'; exit $codigo }
function Passo($texto) { Write-Host ''; Write-Host "==> $texto" -ForegroundColor Cyan }

Passo 'Conferindo o Git'
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Host 'Git nao encontrado. Instalando com winget...' -ForegroundColor Yellow
  winget install --id Git.Git -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Write-Host 'Nao consegui instalar o Git. Instale em https://git-scm.com e rode de novo.' -ForegroundColor Red; Sair 1 }
}

Passo 'Conferindo o GitHub CLI (gh)'
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Host 'GitHub CLI nao encontrado. Instalando com winget...' -ForegroundColor Yellow
  winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
  if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { Write-Host 'Nao consegui instalar o gh. Instale em https://cli.github.com e rode de novo.' -ForegroundColor Red; Sair 1 }
}

Passo 'Conferindo o login no GitHub'
gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Vamos entrar na sua conta do GitHub. Copie o codigo que aparecer, pressione Enter e confirme no navegador.' -ForegroundColor Yellow
  gh auth login --hostname github.com --git-protocol https --web
  if ($LASTEXITCODE -ne 0) { Write-Host 'Login nao concluido.' -ForegroundColor Red; Sair 1 }
}
gh auth setup-git | Out-Null
$login = gh api user --jq .login
Write-Host "Conectado como $login"

Passo 'Configurando nome e e-mail dos commits (se ainda nao houver)'
if (-not (git config --global user.name)) {
  $nome = gh api user --jq .name
  if (-not $nome) { $nome = $login }
  git config --global user.name "$nome"
}
if (-not (git config --global user.email)) {
  $id = gh api user --jq .id
  git config --global user.email "$id+$login@users.noreply.github.com"
}

Passo 'Criando o repositorio local'
if (-not (Test-Path -LiteralPath '.git')) { git init -b main }
git add .
git status --short | Select-String -Pattern 'node_modules|\.env$|\.keystore|\.jks' | ForEach-Object {
  Write-Host "ATENCAO: arquivo que nao deveria ir para o GitHub: $_" -ForegroundColor Red
  Sair 1
}
git commit -m 'Setas! v2: jogo, fases infinitas, API .NET, ranking' | Out-Host

Passo "Criando $Repo no GitHub e enviando"
gh repo view $Repo 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  gh repo create $Repo --private --source . --remote origin --push --description $Descricao
  if ($LASTEXITCODE -ne 0) { Write-Host 'Nao consegui criar o repositorio. Confira se sua conta pode criar repositorios na organizacao.' -ForegroundColor Red; Sair 1 }
} else {
  Write-Host 'O repositorio ja existe; enviando o codigo.'
  if (-not (git remote | Select-String -Pattern '^origin$')) { git remote add origin "https://github.com/$Repo.git" }
  git push -u origin main
  if ($LASTEXITCODE -ne 0) { Write-Host 'O push falhou.' -ForegroundColor Red; Sair 1 }
}

Passo 'Pronto!'
Write-Host "Repositorio: https://github.com/$Repo" -ForegroundColor Green
gh repo view $Repo --web
Sair 0

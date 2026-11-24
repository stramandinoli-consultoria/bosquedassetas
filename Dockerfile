# Uma imagem só: o jogo (PWA) + a API .NET, no mesmo endereço.
# O Railway encontra este Dockerfile na raiz e usa automaticamente.

# ---------- 1) build do jogo (Vite) ----------
FROM node:22-alpine AS web
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
# vazio = a API fica no mesmo endereço do site
ENV VITE_API_URL=""
RUN npm run build

# ---------- 2) build da API (.NET) ----------
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api
WORKDIR /src
COPY server/Setas.Api/Setas.Api.csproj server/Setas.Api/
RUN dotnet restore server/Setas.Api/Setas.Api.csproj
COPY server/Setas.Api ./server/Setas.Api
RUN dotnet publish server/Setas.Api/Setas.Api.csproj -c Release -o /app --no-restore

# ---------- 3) imagem final ----------
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=api /app ./
# o build do jogo vai para wwwroot (junto com privacidade.html e excluir-conta.html)
COPY --from=web /web/dist ./wwwroot/
ENV ASPNETCORE_ENVIRONMENT=Production
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "Setas.Api.dll"]

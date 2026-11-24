# Publicar no iPhone

Há dois caminhos. Dá para fazer os dois.

## Caminho 1: PWA (grátis, sem App Store)

O jogo já é um PWA: manifest, ícones e service worker estão prontos.

1. `npm run build`
2. Publique a pasta `dist/` em um site com HTTPS (GitHub Pages, Netlify, Vercel).
3. No iPhone, abra o site no **Safari** → botão **Compartilhar** → **Adicionar à Tela de Início**.

O jogo ganha ícone, abre em tela cheia e funciona offline. Limitações: não aparece na App Store, não tem AdMob e não vibra. A tela inicial do jogo já mostra o botão "Instalar no celular" com essas instruções.

## Caminho 2: App Store

### Pré-requisitos

- **Apple Developer Program**: US$ 99 por ano
- Um Mac com **Xcode 26+** (exigido pelo Capacitor 8) **ou** um serviço de build na nuvem

### Sem Mac: build na nuvem

Serviços como **Capawesome Cloud**, **Capgo Build**, **Codemagic** ou **Xcode Cloud** compilam e assinam o app em Macs na nuvem e enviam para o TestFlight. O fluxo geral:

1. No seu PC: `npm install`, `npm run build`, `npx cap add ios` e `npx cap sync ios`. A pasta `ios/` é criada e entra no Git.
2. No portal da Apple (developer.apple.com): crie o **App ID** com o mesmo `appId` do `capacitor.config.ts`.
3. No App Store Connect: crie o app e gere uma **chave de API**.
4. No serviço de nuvem: conecte o repositório do GitHub, envie a chave de API e o certificado, e dispare o build.
5. O `.ipa` assinado vai para o **TestFlight**; teste no seu iPhone e depois envie para revisão.

### Com Mac

```bash
npm run ios
```

O Xcode abre. Configure o **Team** em Signing & Capabilities, rode no iPhone e use **Product → Archive** para enviar ao App Store Connect.

### Anúncios no iOS (AdMob)

1. Instale o plugin (ver `docs/PUBLICACAO-ANDROID.md`, passo 4) e rode `npx cap sync ios`.
2. Em `ios/App/App/Info.plist` adicione:
   - `GADApplicationIdentifier` com o App ID do AdMob para iOS (o que tem `~`)
   - `NSUserTrackingUsageDescription` com uma frase como "Usamos este identificador para mostrar anúncios mais relevantes."
   - `SKAdNetworkItems` com a lista de redes do Google (copie da documentação do AdMob para iOS)
3. Troque os IDs de iOS em `src/config.ts`.

O jogo já pede a permissão de rastreamento (App Tracking Transparency) antes de iniciar os anúncios no iOS.

## Checklist rápido

- [ ] Conta Apple Developer ativa
- [ ] `appId` igual no `capacitor.config.ts`, no App ID da Apple e no App Store Connect
- [ ] Ícones gerados (`npm run icons`)
- [ ] Info.plist com as chaves do AdMob
- [ ] Política de privacidade e "App Privacy" preenchidos no App Store Connect
- [ ] Testado no TestFlight

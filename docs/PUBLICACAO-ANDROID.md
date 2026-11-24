# Publicar no Android (Google Play)

## 1. Pré-requisitos

- Node.js 22+
- **Android Studio** atualizado (Capacitor 8 pede o Android Studio Otter 2025.2.1 ou mais novo), com o Android SDK 36
- Conta Google Play Console (taxa única de US$ 25)

## 2. Criar o projeto Android (uma vez só)

```bash
npm install
npm run build
npx cap add android
```

Isso cria a pasta `android/`. Ela entra no Git: é onde ficam ícones, permissões e configurações nativas.

## 3. Ícones e splash

Os arquivos-fonte estão em `resources/`. Para gerar todos os tamanhos:

```bash
npm run icons
```

## 4. Anúncios (AdMob)

1. Crie o app no [AdMob](https://admob.google.com) e crie dois blocos de anúncio: **Premiado** (rewarded) e **Intersticial**.
2. Instale o plugin e sincronize:

   ```bash
   npm install @capacitor-community/admob@latest
   npx cap sync android
   ```

   Antes, confira na página do plugin qual versão é compatível com o Capacitor 8. Se o plugin ainda não tiver versão para o Capacitor 8, a alternativa é o `@capgo/capacitor-admob` (v8): nesse caso só o arquivo `src/services/ads/admob.ts` precisa ser adaptado à API dele.

3. Em `android/app/src/main/AndroidManifest.xml`, dentro de `<application>`, adicione o **App ID** do AdMob (o que tem `~`):

   ```xml
   <meta-data
       android:name="com.google.android.gms.ads.APPLICATION_ID"
       android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
   ```

4. Em `src/config.ts`, troque os IDs de **teste** pelos IDs dos seus blocos (os que têm `/`).

> Enquanto estiver testando, mantenha os IDs de teste. Clicar nos próprios anúncios reais pode bloquear a conta do AdMob.

## 5. Testar no celular

```bash
npm run android
```

O Android Studio abre. Conecte o celular com a depuração USB ativada e clique em Run.

## 6. Gerar o arquivo para a Play Store (.aab)

1. No Android Studio: **Build → Generate Signed App Bundle / APK → Android App Bundle**.
2. Crie uma **keystore** nova e **guarde o arquivo e as senhas em lugar seguro**. Sem ela você não consegue publicar atualizações.
3. Escolha `release`. O arquivo sai em `android/app/release/app-release.aab`.

A cada versão nova, aumente `versionCode` (e `versionName`) em `android/app/build.gradle`.

## 7. Play Console

1. Crie o app, preencha a ficha da loja (descrição, capturas de tela, ícone 512×512 em `public/icons/icon-512.png`).
2. Preencha **Política de privacidade** (obrigatória por causa do AdMob), **Classificação de conteúdo** e **Segurança dos dados** (declare o ID de publicidade).
3. O app precisa ter como alvo o **Android 16 (API 36)**. O Capacitor 8 já gera o projeto assim.

### Teste fechado obrigatório (conta pessoal)

Contas pessoais criadas depois de 13/11/2023 precisam rodar um **teste fechado com pelo menos 12 testadores, inscritos continuamente por 14 dias**, antes de liberar a produção.

- Recrute uns 20 testadores (amigos, família, grupos de testadores), porque se alguém sair a contagem pode voltar.
- Use a faixa **Teste fechado** (o teste interno não conta).
- Depois dos 14 dias, peça acesso à produção no Play Console.

Contas de **organização** (empresa) ficam isentas, mas exigem número D-U-N-S.

## Checklist rápido

- [ ] `appId` definitivo em `capacitor.config.ts`
- [ ] IDs reais do AdMob em `src/config.ts` e App ID no AndroidManifest
- [ ] Ícones gerados (`npm run icons`)
- [ ] Keystore guardada em local seguro
- [ ] Política de privacidade publicada (pode ser uma página simples no GitHub Pages)
- [ ] 12+ testadores por 14 dias no teste fechado

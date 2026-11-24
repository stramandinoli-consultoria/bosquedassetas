import { defineConfig } from 'vite';

// base relativa: o mesmo build funciona no site, no PWA e dentro do Capacitor
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    // No Windows, vigiar um arquivo travado derruba o Vite com EBUSY. Isso acontece com:
    // - server/: a API .NET gera temporários em obj/ e bin/ durante o build
    // - imagens soltas na raiz (kits de UI de referência) enquanto ainda estão sendo salvas
    // O jogo só usa o que está em src/, public/ e index.html.
    watch: {
      ignored: [
        '**/server/**',
        '**/dist/**',
        '**/dist-single/**',
        '**/legacy/**',
        '**/docs/**',
        '**/resources/**',
        (p: string) => /^[^\\/]+\.(png|jpe?g|webp|psd|tmp)$/i.test(p.slice(__dirname.length + 1)),
      ],
    },
    // em desenvolvimento, /api vai para a API .NET local (dotnet run) ou para a API falsa (npm run mock-api)
    proxy: {
      '/api': 'http://localhost:8080',
    },
  },
});

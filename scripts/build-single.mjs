/**
 * Gera dist-single/setas.html: o jogo inteiro em UM arquivo HTML.
 * Útil para enviar a portais de jogos (CrazyGames, Poki, itch.io)
 * ou para abrir com dois cliques no PC.
 *
 *   npm run build:single
 *   node scripts/build-single.mjs --fakeads   (com anúncios simulados)
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fakeAds = process.argv.includes('--fakeads');

const result = await build({
  entryPoints: [resolve(root, 'src/main.ts')],
  bundle: true,
  minify: true,
  format: 'esm',
  target: 'es2020',
  write: false,
  outdir: 'out',
  // imagens do tema viram data: URL, para tudo caber em um arquivo só
  loader: { '.json': 'json', '.png': 'dataurl', '.jpg': 'dataurl', '.woff2': 'dataurl', '.woff': 'dataurl' },
  define: {
    'import.meta.env': JSON.stringify({ DEV: fakeAds, PROD: false, MODE: 'single', VITE_API_URL: process.env.VITE_API_URL ?? '' }),
  },
  logLevel: 'warning',
});

const js = result.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = result.outputFiles.find((f) => f.path.endsWith('.css'))?.text ?? '';

let html = readFileSync(resolve(root, 'index.html'), 'utf8');
html = html
  .replace(/\s*<link rel="(manifest|icon|apple-touch-icon)"[^>]*>/g, '')
  .replace('</head>', `<style>${css}</style>\n</head>`)
  .replace(/<script type="module" src="[^"]+"><\/script>/, () => `<script type="module">${js.replace(/<\/script/g, '<\\/script')}</script>`);

const out = resolve(root, 'dist-single/setas.html');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, html);
console.log(`OK: ${out} (${(html.length / 1024).toFixed(0)} KB)`);

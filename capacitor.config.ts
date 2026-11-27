import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Troque o appId antes de publicar: ele vira o ID do app na Play Store e na App Store
 * e NÃO pode ser mudado depois da primeira publicação.
 */
const config: CapacitorConfig = {
  appId: 'br.com.stramandinoli.setas',
  appName: 'Mundo das Setas',
  webDir: 'dist',
  backgroundColor: '#0d1b2e',
  android: {
    backgroundColor: '#0d1b2e',
  },
  ios: {
    backgroundColor: '#0d1b2e',
    contentInset: 'never',
  },
};

export default config;

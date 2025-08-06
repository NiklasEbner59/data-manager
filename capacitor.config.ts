import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.ionic.starter',
  appName: 'data-manager',
  webDir: 'dist',
  plugins: {
    // Aktiviert Edge-to-Edge-Support für Android
    EdgeToEdge: {
      backgroundColor: '#1e1e1e'
    }
  },
  android: {
    // Erzwingt die Anpassung der WebView-Margen für Edge-to-Edge
    adjustMarginsForEdgeToEdge: 'force'
  }
};

export default config;
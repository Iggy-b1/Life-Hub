import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  build: { target: 'es2022', rollupOptions: { input: { main: 'index.html', map: 'map.html' } } },
  esbuild: { target: 'es2022' },
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', includeAssets: ['assets/icons/*.png'],
    manifest: { name: 'Life Hub', short_name: 'Life Hub', start_url: '/', display: 'standalone', background_color: '#120d1f', theme_color: '#120d1f',
      icons: [{ src: 'assets/icons/pwa-192.png', sizes: '192x192', type: 'image/png' }, { src: 'assets/icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
              { src: 'assets/icons/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }] },
    workbox: { navigateFallbackDenylist: [/^\/map\.html/], globIgnores: ['**/data/**'] } })],
});

import { defineConfig, loadEnv } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Same-origin ('/api/...') in dev via the proxy below; an absolute backend URL in production.
  const apiRuntimeCachePattern = env.VITE_API_URL
    ? new RegExp(`^${env.VITE_API_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/api/.*`, 'i')
    : /^\/api\/.*/i

  return {
    plugins: [
      react(),
      babel({ presets: [reactCompilerPreset()] }),
      VitePWA({
        manifest: {
          name: 'BIMOED - Flood Early Warning System',
          short_name: 'BIMOED',
          description: 'AI-driven flood prediction with community validation',
          theme_color: '#4F8EF7',
          background_color: '#080A0F',
          display: 'standalone',
          scope: '/',
          start_url: '/',
        },
        registerType: 'autoUpdate',
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2,ttf,eot}'],
          runtimeCaching: [
            {
              urlPattern: apiRuntimeCachePattern,
              handler: 'NetworkFirst',
              options: {
                cacheName: 'bimoed-api-cache',
                networkTimeoutSeconds: 5,
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 5 * 60, // 5 minutes
                },
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                },
              },
            },
          ],
        },
        devOptions: {
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    server: {
      proxy: {
        '/api': 'http://localhost:8000',
        '/health': 'http://localhost:8000',
      },
    },
  }
})

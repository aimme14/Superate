import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import removeConsole from 'vite-plugin-remove-console'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
      workbox: {
        // En SPA, usar index como fallback evita falsos "sin conexión"
        // cuando hay red pero ocurre un miss de navegación.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/__/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 120,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          },
          {
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365
              }
            }
          }
        ]
      },
      devOptions: {
        enabled: false
      }
    }),
    // En producción: elimina log, warn, info, debug. Mantiene console.error para depuración.
    removeConsole({ includes: ['log', 'warn', 'info', 'debug'] }),
  ],

  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  },

  /* shadcn/ui */
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '#': path.resolve(__dirname, './src/components')
    }
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Librerías pesadas en chunks separados para mejor cache y carga inicial.
          // MUI no se agrupa en un solo chunk para evitar "Cannot access 'or' before initialization"
          // por orden de ejecución en el bundle de producción.
          if (id.includes('node_modules/katex')) return 'katex'
          if (id.includes('node_modules/mathlive')) return 'mathlive'
          if (id.includes('node_modules/firebase')) return 'firebase'
          if (id.includes('node_modules/@google/generative-ai')) return 'generative-ai'
          if (id.includes('node_modules/@radix-ui/')) return 'radix'
          if (id.includes('node_modules/framer-motion')) return 'framer-motion'
          if (id.includes('node_modules/@tanstack/')) return 'tanstack'
          // React, ReactDOM y React Router en el mismo chunk para evitar
          // "Cannot read properties of undefined (reading 'createContext')" en producción.
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/') || id.includes('node_modules/react-router')) return 'react-vendor'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    chunkSizeWarningLimit: 600
  }
})
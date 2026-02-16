import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],

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
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) return 'react-vendor'
          if (id.includes('node_modules/react-router')) return 'react-router'
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    },
    chunkSizeWarningLimit: 600
  }
})
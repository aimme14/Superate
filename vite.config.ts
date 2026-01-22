import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import path from 'path'
import obfuscator from 'rollup-plugin-obfuscator'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isProduction = mode === 'production'

  return {
    plugins: [
      react(),
      // Ofuscación solo en producción
      ...(isProduction
        ? [
            obfuscator({
              // Ofuscar el bundle completo
              global: false, // Ofuscar por archivo (más seguro para React)
              include: ['**/*.js', '**/*.ts'], // Incluir archivos JS y TS
              exclude: ['node_modules/**'], // Excluir node_modules
              // Opciones de javascript-obfuscator
              options: {
                // Configuración balanceada: protege el código sin afectar el rendimiento
                compact: true,
                controlFlowFlattening: false, // Desactivado para mejor rendimiento
                deadCodeInjection: false, // Desactivado para evitar problemas
                debugProtection: false, // Desactivado para evitar problemas con DevTools
                disableConsoleOutput: false, // Mantener console para debugging en producción si es necesario
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: false, // Desactivado para mejor rendimiento
                renameGlobals: false, // Puede causar problemas con librerías externas
                selfDefending: false, // Puede causar problemas con algunos navegadores
                simplify: true,
                splitStrings: false, // Desactivado para mejor rendimiento
                stringArray: true,
                stringArrayCallsTransform: false,
                stringArrayEncoding: ['base64'],
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 1,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 2,
                stringArrayWrappersType: 'function',
                stringArrayThreshold: 0.75,
                transformObjectKeys: false, // Puede causar problemas con objetos de React
                unicodeEscapeSequence: false
              }
            })
          ]
        : [])
    ],

    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true
    },

    build: {
      // Optimizaciones de minificación
      minify: 'terser', // Usar terser para mejor minificación
      terserOptions: {
        compress: {
          drop_console: false, // Mantener console.log (cambiar a true si quieres eliminarlos)
          drop_debugger: true,
          pure_funcs: ['console.debug', 'console.trace'] // Eliminar solo estos console
        },
        format: {
          comments: false // Eliminar comentarios
        }
      },
      // Optimizar chunks
      rollupOptions: {
        output: {
          // Ofuscar nombres de archivos
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
          // Manual chunks para mejor optimización
          manualChunks: (id) => {
            // Separar vendor chunks
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom')) {
                return 'vendor-react'
              }
              if (id.includes('firebase')) {
                return 'vendor-firebase'
              }
              if (id.includes('@radix-ui')) {
                return 'vendor-radix'
              }
              return 'vendor'
            }
          }
        }
      },
      // Optimizaciones adicionales
      sourcemap: false, // Desactivar sourcemaps en producción para mayor protección
      reportCompressedSize: true,
      chunkSizeWarningLimit: 1000
    },

    /* shadcn/ui */
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '#': path.resolve(__dirname, './src/components')
      }
    }
  }
})
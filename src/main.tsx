import { installProductionErrorHandler } from '@/utils/productionErrorHandler'

installProductionErrorHandler()

/** Firestore con persistencia antes de cualquier otro módulo que use getFirestore. */
import '@/services/db'

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import queryClient from '@/lib/queryClient'
import { clearPersistedCache, persistOptions } from '@/lib/queryPersist'
import ReactDOM from 'react-dom/client'
import React from 'react'
import App from './App'
import './index.css'

const rootElement = document.getElementById('root')

try {
  if (!rootElement) throw new Error('No se encontró #root')
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={persistOptions}
        onError={() => {
          clearPersistedCache()
        }}
      >
        <App />
      </PersistQueryClientProvider>
    </React.StrictMode>
  )
} catch (error) {
  console.error('Error de arranque de la aplicación:', error)
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#05070d;color:#e4e4e7;padding:24px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif">
        <div style="max-width:560px;width:100%;text-align:center;background:#111827;border:1px solid #27272a;border-radius:12px;padding:24px">
          <h1 style="margin:0 0 10px;font-size:22px;color:#fff">Error al iniciar Supérate.IA</h1>
          <p style="margin:0 0 18px;line-height:1.45;color:#cbd5e1">Ocurrió un problema al cargar la aplicación en este navegador.</p>
          <button id="superate-reload-btn" style="background:#2563eb;color:#fff;border:none;border-radius:8px;padding:10px 16px;cursor:pointer">Recargar</button>
        </div>
      </div>
    `
    const btn = document.getElementById('superate-reload-btn')
    btn?.addEventListener('click', () => window.location.reload())
  }
}
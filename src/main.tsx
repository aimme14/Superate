import { installProductionErrorHandler } from '@/utils/productionErrorHandler'

installProductionErrorHandler()

/** Firestore con persistencia antes de cualquier otro módulo que use getFirestore. */
import '@/services/db'

import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import queryClient from '@/lib/queryClient'
import { persistOptions } from '@/lib/queryPersist'
import ReactDOM from 'react-dom/client'
import React from 'react'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <App />
    </PersistQueryClientProvider>
  </React.StrictMode>
)
import { clearIndexedDbPersistence, getFirestore } from 'firebase/firestore'
import { clearPdfViewerCache } from '@/lib/pdfViewerCache'
import { clearRutaPreparacionCache } from '@/lib/rutaPreparacionLocalCache'
import { persister, PERSIST_CACHE_KEY } from '@/lib/queryPersist'

const LOCAL_PREFIXES = [
  'superate:',
  'superate_',
  PERSIST_CACHE_KEY,
] as const

const SESSION_PREFIXES = ['quiz_data:', 'quiz_validation_ok:'] as const

function removeLocalStorageByPrefixes(): void {
  if (typeof window === 'undefined') return
  const toRemove: string[] = []
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i)
    if (!k) continue
    if (
      LOCAL_PREFIXES.some((p) => k === p || k.startsWith(p)) ||
      k === 'dashboard-color-palette'
    ) {
      toRemove.push(k)
    }
  }
  toRemove.forEach((k) => window.localStorage.removeItem(k))
}

function removeSessionStorageByPrefixes(): void {
  if (typeof window === 'undefined') return
  const toRemove: string[] = []
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const k = window.sessionStorage.key(i)
    if (!k) continue
    if (SESSION_PREFIXES.some((p) => k.startsWith(p))) {
      toRemove.push(k)
    }
  }
  toRemove.forEach((k) => window.sessionStorage.removeItem(k))
}

/** Intenta vaciar IndexedDB de Firestore (best-effort). */
function scheduleClearFirestoreIndexedDb(): void {
  void (async () => {
    try {
      const { firebaseApp } = await import('@/services/db')
      await clearIndexedDbPersistence(getFirestore(firebaseApp))
    } catch {
      // listeners activos, pestaña compartida, etc.
    }
  })()
}

/**
 * Limpia toda la caché local de la app (logout).
 * Conserva solo preferencias globales del dispositivo (p. ej. `theme`).
 */
export function clearAllAppCache(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(PERSIST_CACHE_KEY)
    removeLocalStorageByPrefixes()
    clearRutaPreparacionCache()
    removeSessionStorageByPrefixes()
    void clearPdfViewerCache()
    void persister.removeClient()
    scheduleClearFirestoreIndexedDb()
  } catch {
    // modo privado, storage bloqueado
  }
}

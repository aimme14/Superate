import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { clearIndexedDbPersistence, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/db'
import { clearRutaPreparacionCache } from '@/lib/rutaPreparacionLocalCache'

/** Clave en localStorage para la caché persistida. Usar para limpiar en logout. */
export const PERSIST_CACHE_KEY = 'superate-query-cache'

/** Sin límite de tiempo: la caché se mantiene hasta cerrar sesión o borrar datos del sitio. */
const PERSIST_MAX_AGE_MS = Infinity

/**
 * Persistimos queries útiles al reabrir la app (misma sesión Auth en el navegador).
 * No persistimos rutas admin (datos sensibles / listados amplios).
 */
function shouldDehydrateQuery(query: { queryKey: readonly unknown[] }): boolean {
  const key = query.queryKey[0]
  if (key === 'admin' || (typeof key === 'string' && key.startsWith('admin'))) {
    return false
  }
  if (key === 'currentUser') return true
  if (key === 'institutions') return true
  if (key === 'simulacros') return true
  if (key === 'study-plan-data') return true
  if (key === 'student-evaluations') return true
  /** Preguntas del banco (Resultados «Ver pregunta»); persiste entre visitas hasta cerrar sesión. */
  if (key === 'question-bank') return true
  if (key === 'students') return true
  if (key === 'teacher-students') return true
  if (key === 'student-subjects-data' || key === 'student-phases-data') return true
  if (key === 'registration') return true
  if (typeof key === 'string' && key.startsWith('rector-')) return true
  if (typeof key === 'string' && key.startsWith('teacher-')) return true
  if (typeof key === 'string' && key.startsWith('coordinator-')) return true
  if (typeof key === 'string' && key.startsWith('studentPhase')) return true
  if (typeof key === 'string' && key.startsWith('phaseAccess')) return true
  return false
}

const noopStorage: Storage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
}

export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : noopStorage,
  key: PERSIST_CACHE_KEY,
  throttleTime: 1000,
})

export const persistOptions = {
  persister,
  maxAge: PERSIST_MAX_AGE_MS as number,
  dehydrateOptions: { shouldDehydrateQuery },
} as const

/** Intenta vaciar IndexedDB de Firestore al cerrar sesión (best-effort; puede fallar si hay listeners activos). */
function scheduleClearFirestoreIndexedDb(): void {
  void (async () => {
    try {
      await clearIndexedDbPersistence(getFirestore(firebaseApp))
    } catch {
      // Ignorar: pestaña compartida, Firestore en uso, etc.
    }
  })()
}

/** Limpia la caché persistida (llamar en logout). */
export function clearPersistedCache(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PERSIST_CACHE_KEY)
      clearRutaPreparacionCache()
      scheduleClearFirestoreIndexedDb()
    }
  } catch {
    // Ignorar si storage no disponible (SSR, privado, etc.)
  }
}

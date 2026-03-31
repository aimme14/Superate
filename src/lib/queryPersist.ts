import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import type { Persister } from '@tanstack/query-persist-client-core'
import { clearIndexedDbPersistence, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/db'
import { clearRutaPreparacionCache } from '@/lib/rutaPreparacionLocalCache'
import { clearPdfViewerCache } from '@/lib/pdfViewerCache'
import { clearViewerPdfHandoffKeys } from '@/utils/simulacroViewerUrl'

/** Clave en localStorage para la caché persistida. Usar para limpiar en logout. */
export const PERSIST_CACHE_KEY = 'superate-query-cache'

/**
 * Cambiar al invalidar el formato de caché o tras cambios que rompan compatibilidad con datos guardados.
 * Evita hidratar estados corruptos y fuerza un esquema coherente con `persistQueryClientRestore`.
 */
export const QUERY_CACHE_BUSTER = 'superate-2026-03-v2'

/** Sin límite de tiempo: la caché se mantiene hasta cerrar sesión o borrar datos del sitio. */
const PERSIST_MAX_AGE_MS = Infinity

/**
 * Persistimos queries útiles al reabrir la app (misma sesión Auth en el navegador).
 * No persistimos rutas admin (datos sensibles / listados amplios).
 * `currentUser` se persiste con buster + refetch al montar; el perfil depende de reglas Firestore correctas.
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

const syncPersister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : noopStorage,
  key: PERSIST_CACHE_KEY,
  throttleTime: 1000,
})

/**
 * El core de persistencia usa `await persister.restoreClient()` / `persistClient` / `removeClient`.
 * El persister síncrono devuelve valores inmediatos; envolverlos en `Promise.resolve` garantiza
 * `Promisable<T>` y evita incompatibilidades con versiones mezcladas de `@tanstack/query-*`.
 */
export const persister: Persister = {
  persistClient: (persistedClient) => Promise.resolve(syncPersister.persistClient(persistedClient)),
  restoreClient: () => Promise.resolve(syncPersister.restoreClient()),
  removeClient: () => Promise.resolve(syncPersister.removeClient()),
}

export const persistOptions = {
  persister,
  buster: QUERY_CACHE_BUSTER,
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
      void clearPdfViewerCache()
      clearViewerPdfHandoffKeys()
      scheduleClearFirestoreIndexedDb()
    }
  } catch {
    // Ignorar si storage no disponible (SSR, privado, etc.)
  }
}

import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

/** Clave en localStorage para la caché persistida. Usar para limpiar en logout. */
export const PERSIST_CACHE_KEY = 'superate-query-cache'

/** Sin límite de tiempo: la caché se mantiene hasta cerrar sesión o borrar datos del sitio. */
const PERSIST_MAX_AGE_MS = Infinity

/**
 * Persistimos queries que aportan valor al arranque y cambian poco:
 * - currentUser: perfil del usuario actual.
 * - institutions: lista de instituciones.
 * - simulacros: lista de simulacros (ruta académica); reduce lecturas al reabrir.
 * - study-plan-data: plan de estudio IA por estudiante/fase; reduce lecturas al reabrir.
 * - student-evaluations: evaluaciones del estudiante; reduce lecturas al reabrir.
 */
function shouldDehydrateQuery(query: { queryKey: readonly unknown[] }): boolean {
  const key = query.queryKey[0]
  if (key === 'currentUser') return true
  if (key === 'institutions') return true
  if (key === 'simulacros') return true
  if (key === 'study-plan-data') return true
  if (key === 'student-evaluations') return true
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

/** Limpia la caché persistida (llamar en logout). */
export function clearPersistedCache(): void {
  try {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(PERSIST_CACHE_KEY)
    }
  } catch {
    // Ignorar si storage no disponible (SSR, privado, etc.)
  }
}

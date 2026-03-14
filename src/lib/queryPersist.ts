import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'

/** Clave en localStorage para la caché persistida. Usar para limpiar en logout. */
export const PERSIST_CACHE_KEY = 'superate-query-cache'

const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 h

/**
 * Solo persistimos queries que aportan valor al arranque y cambian poco:
 * - currentUser: perfil del usuario actual (carga instantánea al recargar).
 * - institutions: lista de instituciones (referencia usada en muchos formularios).
 */
function shouldDehydrateQuery(query: { queryKey: readonly unknown[] }): boolean {
  const key = query.queryKey[0]
  if (key === 'currentUser') return true
  if (key === 'institutions') return true
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
  maxAge: PERSIST_MAX_AGE_MS,
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

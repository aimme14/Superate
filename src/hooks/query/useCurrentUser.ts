import { useQuery } from '@tanstack/react-query'
import { getUserById } from '@/controllers/user.controller'

/** Clave de caché compartida con AuthContext para el usuario actual */
export const currentUserQueryKey = (uid: string) => ['currentUser', uid] as const

// 24h: reduce al máximo lecturas por navegación/recuperación de caché.
const STALE_TIME_MS = 24 * 60 * 60 * 1000

/**
 * Hook para obtener los datos del usuario actual desde Firestore.
 * Comparte caché con AuthContext/getById: una sola carga y reutilización en toda la app.
 * @param uid - UID del usuario (p. ej. user?.uid del contexto de auth)
 */
export function useCurrentUser(uid: string | undefined) {
  return useQuery({
    queryKey: currentUserQueryKey(uid ?? ''),
    queryFn: async () => {
      if (!uid) return undefined
      const result = await getUserById(uid)
      return result.success ? result.data : undefined
    },
    enabled: Boolean(uid),
    staleTime: STALE_TIME_MS,
    // Para reducir lecturas: si hay data persistida, no revalidar automáticamente.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
}

import { useQuery } from '@tanstack/react-query'
import { getUserById } from '@/controllers/user.controller'

/** Clave de caché compartida con AuthContext para el usuario actual */
export const currentUserQueryKey = (uid: string) => ['currentUser', uid] as const

// Misma política que QueryClient: frescos hasta cerrar sesión (invalidación explícita si cambia el usuario).
const STALE_TIME_MS = Infinity

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
    gcTime: Infinity,
    // Para reducir lecturas: si hay data persistida, no revalidar automáticamente.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
}

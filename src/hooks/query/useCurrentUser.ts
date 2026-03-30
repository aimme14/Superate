import { useQuery } from '@tanstack/react-query'
import { getUserById } from '@/controllers/user.controller'
import type { User } from '@/interfaces/db.interface'

/** Clave de caché compartida con AuthContext para el usuario actual */
export const currentUserQueryKey = (uid: string) => ['currentUser', uid] as const

// Misma política que QueryClient: frescos hasta cerrar sesión (invalidación explícita si cambia el usuario).
const STALE_TIME_MS = Infinity

/**
 * Hook para obtener los datos del usuario actual desde Firestore.
 * Comparte caché con AuthContext/getById: una sola carga y reutilización en toda la app.
 *
 * TanStack Query v5 no permite que `queryFn` resuelva con `undefined`; si falla `getUserById`,
 * se lanza el error real. `retry: false` evita multiplicar lecturas en fallo.
 * @param uid - UID del usuario (p. ej. user?.uid del contexto de auth)
 */
export function useCurrentUser(uid: string | undefined) {
  return useQuery({
    queryKey: currentUserQueryKey(uid ?? ''),
    queryFn: async (): Promise<User> => {
      if (!uid) {
        throw new Error('currentUser: uid no disponible')
      }
      const result = await getUserById(uid)
      if (!result.success) {
        throw result.error
      }
      return result.data
    },
    enabled: Boolean(uid),
    staleTime: STALE_TIME_MS,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
}

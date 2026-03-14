import { useQuery } from '@tanstack/react-query'
import { getUserById } from '@/controllers/user.controller'

/** Clave de caché compartida con AuthContext para el usuario actual */
export const currentUserQueryKey = (uid: string) => ['currentUser', uid] as const

const STALE_TIME_MS = 10 * 60 * 1000 // 10 min (persistido en localStorage; revalidar en background)

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
  })
}

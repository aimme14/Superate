import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthContext } from '@/context/AuthContext'
import { institutionKeys } from '@/hooks/query/useInstitutionQuery'
import { getAllInstitutions } from '@/controllers/institution.controller'

/** Roles que suelen necesitar la lista de instituciones en el dashboard. */
const ROLES_THAT_USE_INSTITUTIONS = ['admin', 'rector', 'principal', 'teacher']

/**
 * Prefetch de instituciones cuando el usuario autenticado tiene un rol que las usa.
 * Así la primera pantalla que las pida ya las tiene en caché.
 */
export function PrefetchInstitutions() {
  const { user } = useAuthContext()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user?.role || !ROLES_THAT_USE_INSTITUTIONS.includes(user.role)) return
    void queryClient.prefetchQuery({
      queryKey: institutionKeys.lists(),
      queryFn: async () => {
        const result = await getAllInstitutions()
        if (result.success) return result.data
        throw new Error(result.error.message)
      },
      staleTime: Infinity,
      gcTime: Infinity,
    })
  }, [user?.uid, user?.role, queryClient])

  return null
}

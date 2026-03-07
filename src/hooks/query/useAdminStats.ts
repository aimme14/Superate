import { useQuery } from '@tanstack/react-query'
import { getAdminStats } from '@/controllers/admin.controller'

const REFETCH_STATS_MS = 5 * 60 * 1000 // 5 minutos

/**
 * Hook para obtener estadísticas del dashboard del administrador.
 * Actualización automática cada 5 minutos vía React Query.
 */
export const useAdminStats = () => {
  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const result = await getAdminStats()
      if (!result.success) throw result.error
      return result.data
    },
    refetchInterval: REFETCH_STATS_MS,
    staleTime: REFETCH_STATS_MS,
    gcTime: 10 * 60 * 1000,
  })

  const data = statsQuery.data
  return {
    totalUsers: data?.totalUsers ?? 0,
    totalInstitutions: data?.totalInstitutions ?? 0,
    activeSessions: data?.activeSessions ?? 0,
    systemUptimeDays: data?.systemUptimeDays ?? 0,
    totalCompletedExams: data?.totalCompletedExams ?? 0,
    isLoading: statsQuery.isLoading,
    error: statsQuery.error,
    refetch: statsQuery.refetch,
  }
}


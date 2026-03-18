import { useQuery } from '@tanstack/react-query'
import { getAdminStats } from '@/controllers/admin.controller'

/**
 * Hook para obtener estadísticas del dashboard del administrador.
 * Optimizado: evitar lecturas repetitivas en segundo plano.
 */
export const useAdminStats = () => {
  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const result = await getAdminStats()
      if (!result.success) throw result.error
      return result.data
    },
    // Cache largo para evitar re-ejecución periódica.
    staleTime: 24 * 60 * 60 * 1000, // 24h
    gcTime: 24 * 60 * 60 * 1000, // 24h
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
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


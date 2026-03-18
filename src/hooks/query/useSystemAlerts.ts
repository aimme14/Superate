import { useQuery } from '@tanstack/react-query'
import { getSystemAlerts } from '@/controllers/admin.controller'

/**
 * Hook para obtener alertas del sistema
 * @returns Alertas del sistema con actualización automática
 */
export const useSystemAlerts = () => {
  const alertsQuery = useQuery({
    queryKey: ['admin', 'system-alerts'],
    queryFn: async () => {
      const result = await getSystemAlerts()
      if (!result.success) throw result.error
      return result.data
    },
    // Cache largo: reduce lecturas cuando el admin mantiene abierta la pestaña.
    staleTime: 12 * 60 * 60 * 1000, // 12h
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return {
    alerts: alertsQuery.data || [],
    isLoading: alertsQuery.isLoading,
    error: alertsQuery.error,
    refetch: alertsQuery.refetch
  }
}


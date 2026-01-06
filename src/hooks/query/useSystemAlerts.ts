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
    refetchInterval: 2 * 60 * 1000, // Refetch cada 2 minutos
    staleTime: 1 * 60 * 1000, // Los datos se consideran frescos por 1 minuto
  })

  return {
    alerts: alertsQuery.data || [],
    isLoading: alertsQuery.isLoading,
    error: alertsQuery.error,
    refetch: alertsQuery.refetch
  }
}


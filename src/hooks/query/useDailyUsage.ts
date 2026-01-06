import { useQuery } from '@tanstack/react-query'
import { examRegistryService } from '@/services/firebase/examRegistry.service'

/**
 * Hook para obtener datos de uso diario
 * @param {number} days - Número de días a obtener (7 para semana, 30 para mes)
 * @returns Datos de uso diario con actualización automática
 */
export const useDailyUsage = (days: number = 7) => {
  const usageQuery = useQuery({
    queryKey: ['admin', 'daily-usage', days],
    queryFn: async () => {
      const result = await examRegistryService.getDailyUsage(days)
      if (!result.success) throw result.error
      return result.data
    },
    refetchInterval: 5 * 60 * 1000, // Refetch cada 5 minutos
    staleTime: 2 * 60 * 1000, // Los datos se consideran frescos por 2 minutos
  })

  return {
    data: usageQuery.data || [],
    isLoading: usageQuery.isLoading,
    error: usageQuery.error,
    refetch: usageQuery.refetch
  }
}


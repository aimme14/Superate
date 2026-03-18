import { useQuery } from '@tanstack/react-query'
import { getUsersByInstitution } from '@/controllers/admin.controller'

/**
 * Hook para obtener el conteo de usuarios por institución
 * @param year - Año para filtrar usuarios (por defecto año actual)
 * @returns Datos de usuarios por institución con actualización automática
 */
export const useInstitutionUserCounts = (year?: number) => {
  const query = useQuery({
    queryKey: ['admin', 'institution-user-counts', year],
    queryFn: async () => {
      const result = await getUsersByInstitution(year)
      if (!result.success) throw result.error
      return result.data
    },
    // Cache largo: evita lecturas periódicas.
    staleTime: 24 * 60 * 60 * 1000, // 24h
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  }
}


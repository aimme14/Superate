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
    refetchInterval: 5 * 60 * 1000, // Refetch cada 5 minutos
    staleTime: 2 * 60 * 1000, // Los datos se consideran frescos por 2 minutos
  })

  return {
    data: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch
  }
}


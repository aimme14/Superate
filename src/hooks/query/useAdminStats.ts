import { useQuery } from '@tanstack/react-query'
import { getAdminStats } from '@/controllers/admin.controller'
import { useEffect, useState } from 'react'

/**
 * Hook para obtener estadísticas del dashboard del administrador
 * @returns Estadísticas del sistema con actualización automática
 */
export const useAdminStats = () => {
  const [activeSessions, setActiveSessions] = useState(0)

  // Consulta principal de estadísticas
  const statsQuery = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: async () => {
      const result = await getAdminStats()
      if (!result.success) throw result.error
      return result.data
    },
    refetchInterval: 5 * 60 * 1000, // Refetch cada 5 minutos para sesiones activas
    staleTime: 2 * 60 * 1000, // Los datos se consideran frescos por 2 minutos
  })

  // Actualizar sesiones activas cada 5 minutos
  useEffect(() => {
    if (statsQuery.data) {
      setActiveSessions(statsQuery.data.activeSessions)
    }

    const interval = setInterval(async () => {
      try {
        const result = await getAdminStats()
        if (result.success && result.data) {
          setActiveSessions(result.data.activeSessions)
        }
      } catch (error) {
        console.error('Error al actualizar sesiones activas:', error)
      }
    }, 5 * 60 * 1000) // Cada 5 minutos

    return () => clearInterval(interval)
  }, [statsQuery.data])

  return {
    totalUsers: statsQuery.data?.totalUsers || 0,
    totalInstitutions: statsQuery.data?.totalInstitutions || 0,
    activeSessions: activeSessions || statsQuery.data?.activeSessions || 0,
    systemUptimeDays: statsQuery.data?.systemUptimeDays || 0,
    totalCompletedExams: statsQuery.data?.totalCompletedExams || 0,
    isLoading: statsQuery.isLoading,
    error: statsQuery.error,
    refetch: statsQuery.refetch
  }
}


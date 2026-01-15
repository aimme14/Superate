import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRegistrationConfig, updateRegistrationConfig } from '@/controllers/admin.controller'
import { useAuthContext } from '@/context/AuthContext'
import { useNotification } from '@/hooks/ui/useNotification'

/**
 * Hook para obtener la configuración de registro
 * @returns Configuración de registro con react-query
 */
export const useRegistrationConfig = () => {
  const query = useQuery({
    queryKey: ['registration', 'config'],
    queryFn: async () => {
      const result = await getRegistrationConfig()
      if (!result.success) throw result.error
      return result.data
    },
    staleTime: 30 * 1000, // 30 segundos
    gcTime: 5 * 60 * 1000, // 5 minutos
  })

  return {
    config: query.data,
    isEnabled: query.data?.enabled ?? true, // Por defecto habilitado
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Hook para actualizar la configuración de registro
 * @returns Mutación para actualizar la configuración
 */
export const useUpdateRegistrationConfig = () => {
  const queryClient = useQueryClient()
  const { user } = useAuthContext()
  const { notifySuccess, notifyError } = useNotification()

  const mutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      const userId = user?.uid || 'system'
      const result = await updateRegistrationConfig(enabled, userId)
      if (!result.success) throw result.error
      return result.data
    },
    onSuccess: (data) => {
      // Invalidar la query para refrescar los datos
      queryClient.invalidateQueries({ queryKey: ['registration', 'config'] })
      notifySuccess({
        title: 'Configuración actualizada',
        message: `El registro de usuarios ha sido ${data.enabled ? 'habilitado' : 'deshabilitado'} correctamente`,
      })
    },
    onError: (error) => {
      notifyError({
        title: 'Error',
        message: error instanceof Error ? error.message : 'Error al actualizar la configuración de registro',
      })
    },
  })

  return {
    updateConfig: mutation.mutateAsync,
    isLoading: mutation.isPending,
    error: mutation.error,
  }
}

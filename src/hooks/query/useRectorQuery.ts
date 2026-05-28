import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ADMIN_LIST_CACHE } from '@/config/adminQueryCache'
import { 
  getAllRectors, 
  getRectorByUserId,
  createRector, 
  updateRector, 
  deleteRector,
  CreateRectorData,
  UpdateRectorData
} from '@/controllers/rector.controller'
import { useAuthContext } from '@/context/AuthContext'
import { useNotification } from '@/hooks/ui/useNotification'
import { DASHBOARD_RECTOR_CACHE } from '@/config/dashboardRectorCache'

// Query Keys
export const rectorKeys = {
  all: ['rectors'] as const,
  lists: () => [...rectorKeys.all, 'list'] as const,
  list: (filters: string) => [...rectorKeys.lists(), { filters }] as const,
  details: () => [...rectorKeys.all, 'detail'] as const,
  detail: (id: string) => [...rectorKeys.details(), id] as const,
}

// Hook para obtener todos los rectores (admin / listados)
export const useRectors = () => {
  return useQuery({
    queryKey: rectorKeys.lists(),
    queryFn: async () => {
      const result = await getAllRectors()
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    ...ADMIN_LIST_CACHE,
  })
}

/**
 * Obtiene solo el rector actual por uid (dashboard rector).
 * 1 lectura (getAllInstitutions) en lugar de ~690 (getAllRectors → getAllUsers).
 */
export const useCurrentRector = () => {
  const { user } = useAuthContext()
  return useQuery({
    queryKey: [...rectorKeys.details(), 'current', user?.uid ?? ''],
    queryFn: async () => {
      if (!user?.uid) return null
      const result = await getRectorByUserId(user.uid)
      if (result.success) return result.data
      if (result.error?.statusCode === 404) return null
      throw new Error(result.error?.message)
    },
    enabled: !!user?.uid,
    staleTime: DASHBOARD_RECTOR_CACHE.staleTimeMs,
    gcTime: DASHBOARD_RECTOR_CACHE.gcTimeMs,
    refetchOnWindowFocus: false,
  })
}

// Mutations
export const useRectorMutations = () => {
  const queryClient = useQueryClient()
  const { notifySuccess, notifyError } = useNotification()

  const createRectorMutation = useMutation({
    mutationFn: async (data: CreateRectorData) => {
      const result = await createRector(data)
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Error al crear el rector')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rectorKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
    onError: (error) => {
      console.error('Error al crear rector:', error)
      notifyError({ 
        title: 'Error', 
        message: error instanceof Error ? error.message : 'Error al crear el rector' 
      })
    }
  })

  const updateRectorMutation = useMutation({
    mutationFn: ({ institutionId, rectorId, data, oldInstitutionId }: { institutionId: string; rectorId: string; data: UpdateRectorData; oldInstitutionId?: string }) => 
      updateRector(institutionId, rectorId, data, oldInstitutionId),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: rectorKeys.lists() })
        // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
        queryClient.invalidateQueries({ queryKey: ['institutions'] })
        notifySuccess({ 
          title: 'Éxito', 
          message: 'Rector actualizado correctamente' 
        })
      } else {
        notifyError({ 
          title: 'Error', 
          message: result.error?.message || 'Error al actualizar el rector' 
        })
      }
    },
    onError: (error) => {
      console.error('Error al actualizar rector:', error)
      notifyError({ 
        title: 'Error', 
        message: error instanceof Error ? error.message : 'Error al actualizar el rector' 
      })
    }
  })

  const deleteRectorMutation = useMutation({
    mutationFn: async ({ institutionId, rectorId }: { institutionId: string; rectorId: string }) => {
      const result = await deleteRector(institutionId, rectorId)
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Error al eliminar el rector')
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rectorKeys.lists() })
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  return {
    createRector: createRectorMutation,
    updateRector: updateRectorMutation,
    deleteRector: deleteRectorMutation,
  }
}


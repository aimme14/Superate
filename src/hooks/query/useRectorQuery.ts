import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getAllRectors, 
  createRector, 
  updateRector, 
  deleteRector,
  CreateRectorData,
  UpdateRectorData
} from '@/controllers/rector.controller'
import { useNotification } from '@/hooks/ui/useNotification'

// Query Keys
export const rectorKeys = {
  all: ['rectors'] as const,
  lists: () => [...rectorKeys.all, 'list'] as const,
  list: (filters: string) => [...rectorKeys.lists(), { filters }] as const,
  details: () => [...rectorKeys.all, 'detail'] as const,
  detail: (id: string) => [...rectorKeys.details(), id] as const,
}

// Hook para obtener todos los rectores
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
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

// Mutations
export const useRectorMutations = () => {
  const queryClient = useQueryClient()
  const { notifySuccess, notifyError } = useNotification()

  const createRectorMutation = useMutation({
    mutationFn: (data: CreateRectorData) => createRector(data),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: rectorKeys.lists() })
        // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
        queryClient.invalidateQueries({ queryKey: ['institutions'] })
        notifySuccess({ 
          title: 'Éxito', 
          message: 'Rector creado correctamente. Tu sesión se cerrará automáticamente, deberás volver a iniciar sesión.' 
        })
      } else {
        notifyError({ 
          title: 'Error', 
          message: result.error?.message || 'Error al crear el rector' 
        })
      }
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
    mutationFn: ({ institutionId, rectorId, adminEmail, adminPassword }: { institutionId: string; rectorId: string; adminEmail?: string; adminPassword?: string }) => 
      deleteRector(institutionId, rectorId, adminEmail, adminPassword),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: rectorKeys.lists() })
        // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
        queryClient.invalidateQueries({ queryKey: ['institutions'] })
        notifySuccess({ 
          title: 'Éxito', 
          message: 'Rector eliminado correctamente' 
        })
      } else {
        notifyError({ 
          title: 'Error', 
          message: result.error?.message || 'Error al eliminar el rector' 
        })
      }
    },
    onError: (error) => {
      console.error('Error al eliminar rector:', error)
      notifyError({ 
        title: 'Error', 
        message: error instanceof Error ? error.message : 'Error al eliminar el rector' 
      })
    }
  })

  return {
    createRector: createRectorMutation,
    updateRector: updateRectorMutation,
    deleteRector: deleteRectorMutation,
  }
}

// Hook para filtrar rectores
export const useFilteredRectors = (filters: {
  searchTerm?: string
  institutionId?: string
  isActive?: boolean
}) => {
  const { data: rectors, isLoading, error } = useRectors()

  const filteredRectors = rectors?.filter(rector => {
    const matchesSearch = !filters.searchTerm || 
      rector.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      rector.email.toLowerCase().includes(filters.searchTerm.toLowerCase())

    const matchesInstitution = !filters.institutionId || 
      rector.institutionId === filters.institutionId

    const matchesStatus = filters.isActive === undefined || 
      rector.isActive === filters.isActive

    return matchesSearch && matchesInstitution && matchesStatus
  }) || []

  return {
    rectors: filteredRectors,
    isLoading,
    error,
    total: rectors?.length || 0,
    filtered: filteredRectors.length
  }
}



import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getAllRectors, 
  createRector, 
  updateRector, 
  deleteRector,
  CreateRectorData,
  UpdateRectorData
} from '@/controllers/rector.controller'

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

  const createRectorMutation = useMutation({
    mutationFn: (data: CreateRectorData) => createRector(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rectorKeys.lists() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  const updateRectorMutation = useMutation({
    mutationFn: ({ institutionId, rectorId, data }: { institutionId: string; rectorId: string; data: UpdateRectorData }) => 
      updateRector(institutionId, rectorId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rectorKeys.lists() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  const deleteRectorMutation = useMutation({
    mutationFn: ({ institutionId, rectorId }: { institutionId: string; rectorId: string }) => 
      deleteRector(institutionId, rectorId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: rectorKeys.lists() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
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


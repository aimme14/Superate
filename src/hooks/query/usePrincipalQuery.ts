import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getAllPrincipals, 
  createPrincipal, 
  updatePrincipal, 
  deletePrincipal,
  CreatePrincipalData,
  UpdatePrincipalData
} from '@/controllers/principal.controller'

// Query Keys
export const principalKeys = {
  all: ['principals'] as const,
  lists: () => [...principalKeys.all, 'list'] as const,
  list: (filters: string) => [...principalKeys.lists(), { filters }] as const,
  details: () => [...principalKeys.all, 'detail'] as const,
  detail: (id: string) => [...principalKeys.details(), id] as const,
}

// Hook para obtener todos los rectores
export const usePrincipals = () => {
  return useQuery({
    queryKey: principalKeys.lists(),
    queryFn: async () => {
      const result = await getAllPrincipals()
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

// Mutations
export const usePrincipalMutations = () => {
  const queryClient = useQueryClient()

  const createPrincipalMutation = useMutation({
    mutationFn: (data: CreatePrincipalData) => createPrincipal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: principalKeys.lists() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  const updatePrincipalMutation = useMutation({
    mutationFn: ({ institutionId, campusId, principalId, data, oldInstitutionId, oldCampusId }: { institutionId: string; campusId: string; principalId: string; data: UpdatePrincipalData; oldInstitutionId?: string; oldCampusId?: string }) => 
      updatePrincipal(institutionId, campusId, principalId, data, oldInstitutionId, oldCampusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: principalKeys.lists() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  const deletePrincipalMutation = useMutation({
    mutationFn: ({ institutionId, campusId, principalId, adminEmail, adminPassword }: { institutionId: string; campusId: string; principalId: string; adminEmail?: string; adminPassword?: string }) => 
      deletePrincipal(institutionId, campusId, principalId, adminEmail, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: principalKeys.lists() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  return {
    createPrincipal: createPrincipalMutation,
    updatePrincipal: updatePrincipalMutation,
    deletePrincipal: deletePrincipalMutation,
  }
}

// Hook para filtrar rectores
export const useFilteredPrincipals = (filters: {
  searchTerm?: string
  institutionId?: string
  isActive?: boolean
}) => {
  const { data: principals, isLoading, error } = usePrincipals()

  const filteredPrincipals = principals?.filter(principal => {
    const matchesSearch = !filters.searchTerm || 
      principal.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      principal.email.toLowerCase().includes(filters.searchTerm.toLowerCase())

    const matchesInstitution = !filters.institutionId || 
      principal.institutionId === filters.institutionId

    const matchesStatus = filters.isActive === undefined || 
      principal.isActive === filters.isActive

    return matchesSearch && matchesInstitution && matchesStatus
  }) || []

  return {
    principals: filteredPrincipals,
    isLoading,
    error,
    total: principals?.length || 0,
    filtered: filteredPrincipals.length
  }
}

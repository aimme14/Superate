import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ADMIN_LIST_CACHE } from '@/config/adminQueryCache'
import { 
  getAllPrincipals,
  getPrincipalsByInstitution,
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
  byInstitution: (institutionId: string) => [...principalKeys.all, 'institution', institutionId] as const,
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
    ...ADMIN_LIST_CACHE,
  })
}

// Hook para obtener coordinadores por institución (evita lecturas globales)
export const usePrincipalsByInstitution = (institutionId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: principalKeys.byInstitution(institutionId),
    queryFn: async () => {
      const result = await getPrincipalsByInstitution(institutionId)
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    enabled: enabled && !!institutionId,
    ...ADMIN_LIST_CACHE,
  })
}

// Mutations
export const usePrincipalMutations = () => {
  const queryClient = useQueryClient()

  const createPrincipalMutation = useMutation({
    mutationFn: async (data: CreatePrincipalData) => {
      const result = await createPrincipal(data)
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Error al crear el coordinador')
      }
      return result.data
    },
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
    mutationFn: async ({ institutionId, campusId, principalId }: { institutionId: string; campusId: string; principalId: string }) => {
      const result = await deletePrincipal(institutionId, campusId, principalId)
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Error al eliminar el coordinador')
      }
      return result
    },
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
  const hasInstitution = !!filters.institutionId

  // No se puede condicionar la llamada a hooks: consultamos ambos con `enabled`.
  const {
    data: principalsAll,
    isLoading: principalsAllLoading,
    error: principalsAllError
  } = usePrincipals()

  const {
    data: principalsByInstitution,
    isLoading: principalsByInstitutionLoading,
    error: principalsByInstitutionError
  } = usePrincipalsByInstitution(filters.institutionId || '', hasInstitution)

  const principals = hasInstitution ? principalsByInstitution : principalsAll
  const isLoading = hasInstitution ? principalsByInstitutionLoading : principalsAllLoading
  const error = hasInstitution ? principalsByInstitutionError : principalsAllError

  const filteredPrincipals = principals?.filter(principal => {
    // Validar búsqueda por texto
    const matchesSearch = !filters.searchTerm || 
      principal.name?.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      principal.email?.toLowerCase().includes(filters.searchTerm.toLowerCase())

    // Validar institución - CRÍTICO: debe coincidir exactamente
    // Verificar tanto institutionId como inst para compatibilidad
    const principalInstitutionId = principal.institutionId || principal.inst
    const matchesInstitution = !filters.institutionId || 
      (principalInstitutionId && principalInstitutionId === filters.institutionId)

    // Validar estado activo
    const matchesStatus = filters.isActive === undefined || 
      principal.isActive === filters.isActive

    // Solo incluir si TODOS los filtros coinciden
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

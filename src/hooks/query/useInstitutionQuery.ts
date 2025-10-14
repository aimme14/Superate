import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getAllInstitutions, 
  getInstitutionById, 
  createInstitution, 
  updateInstitution, 
  deleteInstitution,
  createCampus,
  updateCampus,
  deleteCampus,
  createGrade,
  updateGrade,
  deleteGrade,
  CreateInstitutionData,
  UpdateInstitutionData,
  CreateCampusData,
  UpdateCampusData,
  CreateGradeData,
  UpdateGradeData
} from '@/controllers/institution.controller'
// import { Institution, Campus, Grade } from '@/interfaces/db.interface'

// Query Keys
export const institutionKeys = {
  all: ['institutions'] as const,
  lists: () => [...institutionKeys.all, 'list'] as const,
  list: (filters: string) => [...institutionKeys.lists(), { filters }] as const,
  details: () => [...institutionKeys.all, 'detail'] as const,
  detail: (id: string) => [...institutionKeys.details(), id] as const,
}

// Hook para obtener todas las instituciones
export const useInstitutions = () => {
  return useQuery({
    queryKey: institutionKeys.lists(),
    queryFn: async () => {
      const result = await getAllInstitutions()
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

// Hook para obtener una institución específica
export const useInstitution = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: institutionKeys.detail(id),
    queryFn: async () => {
      const result = await getInstitutionById(id)
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    enabled: enabled && !!id,
  })
}

// Hook para obtener instituciones como opciones para select
export const useInstitutionOptions = () => {
  const { data: institutions, isLoading, error } = useInstitutions()
  
  const options = institutions?.map(institution => ({
    label: institution.name,
    value: institution.id,
    type: institution.type,
    campuses: institution.campuses
  })) || []

  return {
    options,
    isLoading,
    error
  }
}

// Hook para obtener sedes de una institución específica
export const useCampusOptions = (institutionId: string) => {
  const { data: institution, isLoading } = useInstitution(institutionId, !!institutionId)
  
  const options = institution?.campuses.map(campus => ({
    label: campus.name,
    value: campus.id,
    address: campus.address,
    grades: campus.grades
  })) || []

  return {
    options,
    isLoading,
    institution
  }
}

// Hook para obtener grados de una sede específica
export const useGradeOptions = (institutionId: string, campusId: string) => {
  const { data: institution, isLoading } = useInstitution(institutionId, !!institutionId)
  
  const campus = institution?.campuses.find(c => c.id === campusId)
  const options = campus?.grades.map(grade => ({
    label: grade.name,
    value: grade.id,
    level: grade.level
  })) || []

  return {
    options,
    isLoading,
    campus
  }
}

// Hook para obtener todas las opciones de grados de todas las instituciones
export const useAllGradeOptions = () => {
  const { data: institutions, isLoading, error } = useInstitutions()
  
  const options = institutions?.flatMap(institution =>
    institution.campuses.flatMap(campus =>
      campus.grades.map(grade => ({
        label: grade.name,
        value: grade.id,
        level: grade.level,
        institutionId: institution.id,
        institutionName: institution.name,
        campusId: campus.id,
        campusName: campus.name
      }))
    )
  ) || []

  return {
    options,
    isLoading,
    error
  }
}

// Mutations
export const useInstitutionMutations = () => {
  const queryClient = useQueryClient()

  const createInstitutionMutation = useMutation({
    mutationFn: (data: CreateInstitutionData) => createInstitution(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: institutionKeys.lists() })
    },
  })

  const updateInstitutionMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateInstitutionData }) => 
      updateInstitution(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: institutionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: institutionKeys.detail(id) })
    },
  })

  const deleteInstitutionMutation = useMutation({
    mutationFn: (id: string) => deleteInstitution(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: institutionKeys.lists() })
    },
  })

  const createCampusMutation = useMutation({
    mutationFn: (data: CreateCampusData) => createCampus(data),
    onSuccess: (_, { institutionId }) => {
      queryClient.invalidateQueries({ queryKey: institutionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: institutionKeys.detail(institutionId) })
    },
  })

  const updateCampusMutation = useMutation({
    mutationFn: ({ institutionId, campusId, data }: { institutionId: string; campusId: string; data: UpdateCampusData }) => 
      updateCampus(institutionId, campusId, data),
    onSuccess: (_, { institutionId }) => {
      queryClient.invalidateQueries({ queryKey: institutionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: institutionKeys.detail(institutionId) })
    },
  })

  const deleteCampusMutation = useMutation({
    mutationFn: ({ institutionId, campusId }: { institutionId: string; campusId: string }) => 
      deleteCampus(institutionId, campusId),
    onSuccess: (_, { institutionId }) => {
      queryClient.invalidateQueries({ queryKey: institutionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: institutionKeys.detail(institutionId) })
    },
  })

  const createGradeMutation = useMutation({
    mutationFn: (data: CreateGradeData) => createGrade(data),
    onSuccess: (_, { institutionId }) => {
      queryClient.invalidateQueries({ queryKey: institutionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: institutionKeys.detail(institutionId) })
    },
  })

  const updateGradeMutation = useMutation({
    mutationFn: ({ institutionId, campusId, gradeId, data }: { institutionId: string; campusId: string; gradeId: string; data: UpdateGradeData }) => 
      updateGrade(institutionId, campusId, gradeId, data),
    onSuccess: (_, { institutionId }) => {
      queryClient.invalidateQueries({ queryKey: institutionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: institutionKeys.detail(institutionId) })
    },
  })

  const deleteGradeMutation = useMutation({
    mutationFn: ({ institutionId, campusId, gradeId }: { institutionId: string; campusId: string; gradeId: string }) => 
      deleteGrade(institutionId, campusId, gradeId),
    onSuccess: (_, { institutionId }) => {
      queryClient.invalidateQueries({ queryKey: institutionKeys.lists() })
      queryClient.invalidateQueries({ queryKey: institutionKeys.detail(institutionId) })
    },
  })

  return {
    createInstitution: createInstitutionMutation,
    updateInstitution: updateInstitutionMutation,
    deleteInstitution: deleteInstitutionMutation,
    createCampus: createCampusMutation,
    updateCampus: updateCampusMutation,
    deleteCampus: deleteCampusMutation,
    createGrade: createGradeMutation,
    updateGrade: updateGradeMutation,
    deleteGrade: deleteGradeMutation,
  }
}

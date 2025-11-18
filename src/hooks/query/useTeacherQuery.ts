import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  getAllTeachers, 
  getTeacherById, 
  createTeacher, 
  updateTeacher, 
  deleteTeacher,
  deleteTeacherFromGrade,
  updateTeacherInGrade,
  getTeachersByInstitution,
  getTeachersByCampus,
  assignStudentToTeacher,
  removeStudentFromTeacher,
  getTeacherStats,
  CreateTeacherData,
  UpdateTeacherData
} from '@/controllers/teacher.controller'

// Query Keys
export const teacherKeys = {
  all: ['teachers'] as const,
  lists: () => [...teacherKeys.all, 'list'] as const,
  list: (filters: string) => [...teacherKeys.lists(), { filters }] as const,
  details: () => [...teacherKeys.all, 'detail'] as const,
  detail: (id: string) => [...teacherKeys.details(), id] as const,
  byInstitution: (institutionId: string) => [...teacherKeys.all, 'institution', institutionId] as const,
  byCampus: (campusId: string) => [...teacherKeys.all, 'campus', campusId] as const,
  stats: () => [...teacherKeys.all, 'stats'] as const,
}

// Hook para obtener todos los docentes
export const useTeachers = () => {
  return useQuery({
    queryKey: teacherKeys.lists(),
    queryFn: async () => {
      const result = await getAllTeachers()
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  })
}

// Hook para obtener un docente específico
export const useTeacher = (id: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: teacherKeys.detail(id),
    queryFn: async () => {
      const result = await getTeacherById(id)
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    enabled: enabled && !!id,
  })
}

// Hook para obtener docentes por institución
export const useTeachersByInstitution = (institutionId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: teacherKeys.byInstitution(institutionId),
    queryFn: async () => {
      const result = await getTeachersByInstitution(institutionId)
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    enabled: enabled && !!institutionId,
  })
}

// Hook para obtener docentes por sede
export const useTeachersByCampus = (campusId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: teacherKeys.byCampus(campusId),
    queryFn: async () => {
      const result = await getTeachersByCampus(campusId)
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    enabled: enabled && !!campusId,
  })
}

// Hook para obtener estadísticas de docentes
export const useTeacherStats = () => {
  return useQuery({
    queryKey: teacherKeys.stats(),
    queryFn: async () => {
      const result = await getTeacherStats()
      if (result.success) {
        return result.data
      }
      throw new Error(result.error.message)
    },
    staleTime: 10 * 60 * 1000, // 10 minutos
  })
}

// Hook para obtener docentes como opciones para select
export const useTeacherOptions = () => {
  const { data: teachers, isLoading, error } = useTeachers()
  
  const options = teachers?.map(teacher => ({
    label: teacher.name,
    value: teacher.id,
    email: teacher.email,
    subjects: teacher.subjects,
    institutionId: teacher.institutionId,
    campusId: teacher.campusId
  })) || []

  return {
    options,
    isLoading,
    error
  }
}

// Mutations
export const useTeacherMutations = () => {
  const queryClient = useQueryClient()

  const createTeacherMutation = useMutation({
    mutationFn: (data: CreateTeacherData) => createTeacher(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teacherKeys.lists() })
      queryClient.invalidateQueries({ queryKey: teacherKeys.stats() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  const updateTeacherMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeacherData }) => 
      updateTeacher(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: teacherKeys.lists() })
      queryClient.invalidateQueries({ queryKey: teacherKeys.detail(id) })
      queryClient.invalidateQueries({ queryKey: teacherKeys.stats() })
    },
  })

  const deleteTeacherMutation = useMutation({
    mutationFn: (id: string) => deleteTeacher(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teacherKeys.lists() })
      queryClient.invalidateQueries({ queryKey: teacherKeys.stats() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  const deleteTeacherFromGradeMutation = useMutation({
    mutationFn: ({ institutionId, campusId, gradeId, teacherId, adminEmail, adminPassword }: { institutionId: string; campusId: string; gradeId: string; teacherId: string; adminEmail?: string; adminPassword?: string }) => 
      deleteTeacherFromGrade(institutionId, campusId, gradeId, teacherId, adminEmail, adminPassword),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teacherKeys.lists() })
      queryClient.invalidateQueries({ queryKey: teacherKeys.stats() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  const updateTeacherInGradeMutation = useMutation({
    mutationFn: ({ institutionId, campusId, gradeId, teacherId, data, oldInstitutionId, oldCampusId, oldGradeId }: { institutionId: string; campusId: string; gradeId: string; teacherId: string; data: UpdateTeacherData; oldInstitutionId?: string; oldCampusId?: string; oldGradeId?: string }) => 
      updateTeacherInGrade(institutionId, campusId, gradeId, teacherId, data, oldInstitutionId, oldCampusId, oldGradeId),
    onSuccess: (_, { teacherId }) => {
      queryClient.invalidateQueries({ queryKey: teacherKeys.lists() })
      queryClient.invalidateQueries({ queryKey: teacherKeys.detail(teacherId) })
      queryClient.invalidateQueries({ queryKey: teacherKeys.stats() })
      // También invalidar las consultas de instituciones para actualizar la estructura jerárquica
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
    },
  })

  const assignStudentMutation = useMutation({
    mutationFn: ({ teacherId, studentId }: { teacherId: string; studentId: string }) => 
      assignStudentToTeacher(teacherId, studentId),
    onSuccess: (_, { teacherId }) => {
      queryClient.invalidateQueries({ queryKey: teacherKeys.detail(teacherId) })
      queryClient.invalidateQueries({ queryKey: teacherKeys.lists() })
    },
  })

  const removeStudentMutation = useMutation({
    mutationFn: ({ teacherId, studentId }: { teacherId: string; studentId: string }) => 
      removeStudentFromTeacher(teacherId, studentId),
    onSuccess: (_, { teacherId }) => {
      queryClient.invalidateQueries({ queryKey: teacherKeys.detail(teacherId) })
      queryClient.invalidateQueries({ queryKey: teacherKeys.lists() })
    },
  })

  return {
    createTeacher: createTeacherMutation,
    updateTeacher: updateTeacherMutation,
    deleteTeacher: deleteTeacherMutation,
    deleteTeacherFromGrade: deleteTeacherFromGradeMutation,
    updateTeacherInGrade: updateTeacherInGradeMutation,
    assignStudent: assignStudentMutation,
    removeStudent: removeStudentMutation,
  }
}

// Hook para filtrar docentes
export const useFilteredTeachers = (filters: {
  searchTerm?: string
  institutionId?: string
  campusId?: string
  isActive?: boolean
}) => {
  const { data: teachers, isLoading, error } = useTeachers()

  const filteredTeachers = teachers?.filter(teacher => {
    const matchesSearch = !filters.searchTerm || 
      teacher.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      teacher.email.toLowerCase().includes(filters.searchTerm.toLowerCase())

    const matchesInstitution = !filters.institutionId || 
      teacher.institutionId === filters.institutionId

    const matchesCampus = !filters.campusId || 
      teacher.campusId === filters.campusId

    const matchesStatus = filters.isActive === undefined || 
      teacher.isActive === filters.isActive

    return matchesSearch && matchesInstitution && matchesCampus && matchesStatus
  }) || []

  return {
    teachers: filteredTeachers,
    isLoading,
    error,
    total: teachers?.length || 0,
    filtered: filteredTeachers.length
  }
}

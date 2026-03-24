import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { ADMIN_LIST_CACHE } from '@/config/adminQueryCache'
import { 
  createStudent, 
  getFilteredStudents, 
  getStudentsByTeacher, 
  getStudentsByPrincipal,
  updateStudent,
  deleteStudent,
  CreateStudentData,
  UpdateStudentData,
  StudentFilters
} from '@/controllers/student.controller'
import { useNotification } from '@/hooks/ui/useNotification'

/**
 * Hook para obtener estudiantes filtrados
 */
export const useFilteredStudents = (filters: StudentFilters) => {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['students', 'filtered', filters],
    queryFn: async () => {
      const result = await getFilteredStudents(filters)
      if (result.success) return result.data
      throw new Error(result.error?.message ?? 'Error al cargar estudiantes')
    },
    ...ADMIN_LIST_CACHE,
    placeholderData: keepPreviousData,
  })

  return {
    students: data || [],
    isLoading,
    error,
    refetch,
    isFetching,
  }
}

/**
 * Hook para obtener estudiantes de un docente específico
 */
export const useStudentsByTeacher = (teacherId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['students', 'by-teacher', teacherId],
    queryFn: async () => {
      const result = await getStudentsByTeacher(teacherId)
      return result
    },
    enabled: enabled && !!teacherId,
    ...ADMIN_LIST_CACHE,
    placeholderData: keepPreviousData,
    select: (data) => {
      const students = data.success ? data.data : []
      return students
    }
  })
}

/**
 * Hook para obtener estudiantes de un rector específico
 */
export const useStudentsByPrincipal = (principalId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['students', 'by-principal', principalId],
    queryFn: () => getStudentsByPrincipal(principalId),
    enabled: enabled && !!principalId,
    ...ADMIN_LIST_CACHE,
    placeholderData: keepPreviousData,
    select: (data) => data.success ? data.data : []
  })
}

/**
 * Hook para mutaciones de estudiantes
 */
export const useStudentMutations = () => {
  const queryClient = useQueryClient()
  const { notifySuccess, notifyError } = useNotification()

  const createStudentMutation = useMutation({
    mutationFn: async (studentData: CreateStudentData) => {
      const result = await createStudent(studentData)
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Error al crear el estudiante')
      }
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
    onError: (error) => {
      notifyError({ 
        title: 'Error', 
        message: error instanceof Error ? error.message : 'Error al crear el estudiante' 
      })
    }
  })

  const updateStudentMutation = useMutation({
    mutationFn: ({ studentId, studentData }: { studentId: string, studentData: UpdateStudentData }) => 
      updateStudent(studentId, studentData),
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['students'] })
        notifySuccess({ 
          title: 'Éxito', 
          message: 'Estudiante actualizado correctamente' 
        })
      } else {
        notifyError({ 
          title: 'Error', 
          message: result.error?.message || 'Error al actualizar el estudiante' 
        })
      }
    },
    onError: (error) => {
      notifyError({ 
        title: 'Error', 
        message: error instanceof Error ? error.message : 'Error al actualizar el estudiante' 
      })
    }
  })

  const deleteStudentMutation = useMutation({
    mutationFn: async ({ studentId }: { studentId: string }) => {
      const result = await deleteStudent(studentId)
      if (!result.success) {
        throw new Error(result.error?.message ?? 'Error al eliminar el estudiante')
      }
      return result
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] })
    },
  })

  return {
    createStudent: createStudentMutation,
    updateStudent: updateStudentMutation,
    deleteStudent: deleteStudentMutation
  }
}

/**
 * Hook para obtener opciones de estudiantes para formularios
 */
export const useStudentOptions = (institutionId?: string, campusId?: string, gradeId?: string) => {
  const filters: StudentFilters = {}
  
  if (institutionId) filters.institutionId = institutionId
  if (campusId) filters.campusId = campusId
  if (gradeId) filters.gradeId = gradeId
  filters.isActive = true

  const { students, isLoading } = useFilteredStudents(filters)

  const options = students?.map((student: any) => ({
    value: student.id,
    label: student.name,
    email: student.email,
    grade: student.grade,
    institution: student.inst,
    campus: student.campus
  })) || []

  return {
    options,
    isLoading,
    students: students || []
  }
}

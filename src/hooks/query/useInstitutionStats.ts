import { useQuery } from '@tanstack/react-query'
import { getFilteredStudents } from '@/controllers/student.controller'
import { getTeachersByInstitution } from '@/controllers/teacher.controller'

/**
 * Hook para obtener estadísticas de usuarios por institución
 * @param institutionId - ID de la institución
 * @param enabled - Si la consulta debe estar habilitada
 * @returns Contadores de estudiantes y docentes
 */
export const useInstitutionStats = (institutionId: string, enabled: boolean = true) => {
  // Consulta para estudiantes de la institución
  const studentsQuery = useQuery({
    queryKey: ['students', 'by-institution', institutionId],
    queryFn: async () => {
      const result = await getFilteredStudents({ 
        institutionId, 
        isActive: true 
      })
      return result.success ? result.data : []
    },
    enabled: enabled && !!institutionId,
    staleTime: 30 * 1000, // 30 segundos para actualizaciones más frecuentes
    refetchInterval: 60 * 1000, // Refetch cada minuto para datos en tiempo real
  })

  // Consulta para docentes de la institución
  const teachersQuery = useQuery({
    queryKey: ['teachers', 'by-institution', institutionId],
    queryFn: async () => {
      const result = await getTeachersByInstitution(institutionId)
      return result.success ? result.data : []
    },
    enabled: enabled && !!institutionId,
    staleTime: 30 * 1000, // 30 segundos para actualizaciones más frecuentes
    refetchInterval: 60 * 1000, // Refetch cada minuto para datos en tiempo real
  })

  return {
    studentCount: studentsQuery.data?.length || 0,
    teacherCount: teachersQuery.data?.length || 0,
    isLoading: studentsQuery.isLoading || teachersQuery.isLoading,
    error: studentsQuery.error || teachersQuery.error,
    students: studentsQuery.data || [],
    teachers: teachersQuery.data || []
  }
}

/**
 * Hook para obtener solo el contador de estudiantes por institución
 * @param institutionId - ID de la institución
 * @param enabled - Si la consulta debe estar habilitada
 */
export const useInstitutionStudentCount = (institutionId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['students', 'count', 'by-institution', institutionId],
    queryFn: async () => {
      const result = await getFilteredStudents({ 
        institutionId, 
        isActive: true 
      })
      return result.success ? result.data.length : 0
    },
    enabled: enabled && !!institutionId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

/**
 * Hook para obtener solo el contador de docentes por institución
 * @param institutionId - ID de la institución
 * @param enabled - Si la consulta debe estar habilitada
 */
export const useInstitutionTeacherCount = (institutionId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['teachers', 'count', 'by-institution', institutionId],
    queryFn: async () => {
      const result = await getTeachersByInstitution(institutionId)
      return result.success ? result.data.length : 0
    },
    enabled: enabled && !!institutionId,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
  })
}

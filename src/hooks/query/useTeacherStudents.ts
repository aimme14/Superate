import { useQuery } from '@tanstack/react-query'
import { useAuthContext } from '@/context/AuthContext'
import { User } from '@/interfaces/context.interface'
import { getStudentsByTeacher } from '@/controllers/student.controller'
import { ESTUDIANTE_SESSION_CACHE } from '@/config/rutaPreparacionCache'

// Hook para obtener estudiantes específicos de un docente
export const useTeacherStudents = () => {
  const { user } = useAuthContext()
  
  return useQuery({
    queryKey: ['teacher-students', user?.uid],
    queryFn: async (): Promise<User[]> => {
      if (!user?.uid) {
        return []
      }

      const result = await getStudentsByTeacher(user.uid)
      return result.success ? result.data : []
    },
    enabled: !!user && user.role === 'teacher',
    ...ESTUDIANTE_SESSION_CACHE,
  })
}

// Hook para obtener estadísticas de estudiantes del docente
export const useTeacherStudentStats = () => {
  const { data: students, isLoading, error } = useTeacherStudents()
  
  const stats = {
    totalStudents: students?.length || 0,
    activeStudents: students?.filter(s => s.isActive).length || 0,
    averageGrade: 0, // Se calcularía basado en las calificaciones
    attendanceRate: 95, // Se calcularía basado en la asistencia
  }

  return {
    stats,
    isLoading,
    error
  }
}

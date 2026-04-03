import { useAuthContext } from '@/context/AuthContext'
import { useStudentsByTeacher } from './useStudentQuery'
import { useCurrentUser } from './useCurrentUser'
import { useMemo } from 'react'

export const useTeacherDashboardStats = () => {
  const { user } = useAuthContext()

  // Obtener perfil del docente actual desde la estructura nueva (evita lectura legacy global de teachers).
  const {
    data: currentTeacher,
    isLoading: teacherLoading,
    error: teacherError,
  } = useCurrentUser(user?.uid, !!user?.uid)

  // Obtener estudiantes del docente usando getStudentsByTeacher (filtra por jornada).
  const teacherId = currentTeacher?.id || user?.uid || ''
  const { data: teacherStudents, isLoading: studentsLoading, error: studentsError } = useStudentsByTeacher(
    teacherId, 
    !!teacherId
  )

  const isLoading = teacherLoading || (!!teacherId && studentsLoading)
  const hasError = teacherError || studentsError

  // Calcular estadísticas reales del docente
  const stats = useMemo(() => {
    if (!currentTeacher) {
      return {
        totalStudents: 0,
        teacherName: user?.displayName || 'Docente',
        institutionName: user?.institution || 'Institución',
        campusName: user?.campus || 'Sede',
        gradeName: user?.grade || 'Grado',
        teacherEmail: user?.email || '',
        campusId: '',
        institutionId: '',
        gradeId: '',
        jornada: '',
        performanceMetrics: {
          overallAverage: 0,
          attendanceRate: 0,
          studentsCount: 0
        }
      }
    }

    const students = teacherStudents || []

    return {
      // Estadísticas básicas - datos reales
      totalStudents: students.length,
      
      // Información del docente - datos reales
      teacherName: (currentTeacher as any).name || user?.displayName || 'Docente',
      institutionName: (currentTeacher as any).institutionName || user?.institution || 'Institución',
      campusName: (currentTeacher as any).campusName || user?.campus || 'Sede',
      gradeName: (currentTeacher as any).gradeName || user?.grade || 'Grado',
      teacherEmail: (currentTeacher as any).email || user?.email || '',
      campusId: (currentTeacher as any).campusId || (currentTeacher as any).sedeId || '',
      institutionId: (currentTeacher as any).institutionId || '',
      gradeId: (currentTeacher as any).gradeId || '',
      jornada: (currentTeacher as any).jornada || '',
      
      // Métricas de rendimiento (usando datos reales donde sea posible)
      performanceMetrics: {
        overallAverage: 82.5, // TODO: Calcular basado en datos reales de exámenes
        attendanceRate: 91.2, // TODO: Calcular basado en datos reales de asistencia
        studentsCount: students.length // Datos reales
      }
    }
  }, [currentTeacher, teacherStudents, user])

  return {
    stats,
    isLoading,
    hasError,
    currentTeacher,
    students: teacherStudents || []
  }
}


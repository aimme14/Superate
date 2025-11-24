import { useAuthContext } from '@/context/AuthContext'
import { useTeachers } from './useTeacherQuery'
import { useFilteredStudents } from './useStudentQuery'
import { useMemo } from 'react'

export const useTeacherDashboardStats = () => {
  const { user } = useAuthContext()
  
  // Obtener todos los docentes y encontrar el actual
  const { data: teachers, isLoading: teachersLoading, error: teachersError } = useTeachers()
  
  // Encontrar el docente actual por email o uid
  const currentTeacher = useMemo(() => {
    if (!teachers || !user) return null
    
    // Buscar por email primero
    let teacher = teachers.find(t => 
      t.email?.toLowerCase() === user.email?.toLowerCase()
    )
    
    // Si no se encuentra por email, buscar por id
    if (!teacher && user.uid) {
      teacher = teachers.find(t => 
        t.id === user.uid
      )
    }
    
    return teacher || null
  }, [teachers, user])
  
  // Obtener estudiantes de la sede y grado del docente (solo si tenemos campusId y gradeId)
  const institutionId = currentTeacher?.institutionId
  const campusId = currentTeacher?.campusId
  const gradeId = currentTeacher?.gradeId
  
  const { students: teacherStudents, isLoading: studentsLoading, error: studentsError } = useFilteredStudents({
    campusId: campusId || undefined,
    institutionId: institutionId || undefined,
    gradeId: gradeId || undefined,
    isActive: true
  })

  const isLoading = teachersLoading || (!!currentTeacher && studentsLoading)
  const hasError = teachersError || studentsError

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
      teacherName: currentTeacher.name || user?.displayName || 'Docente',
      institutionName: currentTeacher.institutionName || user?.institution || 'Institución',
      campusName: currentTeacher.campusName || user?.campus || 'Sede',
      gradeName: currentTeacher.gradeName || user?.grade || 'Grado',
      teacherEmail: currentTeacher.email || user?.email || '',
      campusId: currentTeacher.campusId || '',
      institutionId: currentTeacher.institutionId || '',
      gradeId: currentTeacher.gradeId || '',
      
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


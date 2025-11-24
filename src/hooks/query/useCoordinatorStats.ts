import { useAuthContext } from '@/context/AuthContext'
import { usePrincipals } from './usePrincipalQuery'
import { useTeachersByCampus } from './useTeacherQuery'
import { useFilteredStudents } from './useStudentQuery'
import { useMemo } from 'react'

export const useCoordinatorStats = () => {
  const { user } = useAuthContext()
  
  // Obtener todos los coordinadores y encontrar el actual
  const { data: principals, isLoading: principalsLoading, error: principalsError } = usePrincipals()
  
  // Encontrar el coordinador actual por email o uid
  const currentCoordinator = useMemo(() => {
    if (!principals || !user) return null
    
    // Buscar por email primero
    let coordinator = principals.find(principal => 
      principal.email?.toLowerCase() === user.email?.toLowerCase()
    )
    
    // Si no se encuentra por email, buscar por uid
    if (!coordinator && user.uid) {
      coordinator = principals.find(principal => 
        principal.uid === user.uid || principal.id === user.uid
      )
    }
    
    return coordinator || null
  }, [principals, user])
  
  // Obtener docentes de la sede del coordinador (solo si tenemos campusId)
  const { data: campusTeachers, isLoading: teachersLoading, error: teachersError } = useTeachersByCampus(
    currentCoordinator?.campusId || '',
    !!currentCoordinator?.campusId && !principalsLoading
  )
  
  // Obtener estudiantes de la sede del coordinador (solo si tenemos campusId)
  const { students: campusStudents, isLoading: studentsLoading, error: studentsError } = useFilteredStudents({
    campusId: currentCoordinator?.campusId,
    institutionId: currentCoordinator?.institutionId,
    isActive: true
  })

  const isLoading = principalsLoading || (!!currentCoordinator?.campusId && (teachersLoading || studentsLoading))
  const hasError = principalsError || teachersError || studentsError

  // Calcular estadísticas reales de la sede
  const stats = useMemo(() => {
    if (!currentCoordinator) {
      return {
        totalTeachers: 0,
        totalStudents: 0,
        coordinatorName: user?.displayName || 'Coordinador',
        institutionName: user?.institution || 'Institución',
        campusName: 'Sede',
        coordinatorEmail: user?.email || '',
        campusId: '',
        institutionId: '',
        performanceMetrics: {
          overallAverage: 0,
          attendanceRate: 0,
          teachersCount: 0,
          studentsCount: 0
        }
      }
    }

    const teachers = campusTeachers || []
    const students = campusStudents || []

    return {
      // Estadísticas básicas de la sede - datos reales
      totalTeachers: teachers.length,
      totalStudents: students.length,
      
      // Información del coordinador - datos reales
      coordinatorName: currentCoordinator.name || user?.displayName || 'Coordinador',
      institutionName: currentCoordinator.institutionName || user?.institution || 'Institución',
      campusName: currentCoordinator.campusName || 'Sede',
      coordinatorEmail: currentCoordinator.email || user?.email || '',
      campusId: currentCoordinator.campusId || '',
      institutionId: currentCoordinator.institutionId || '',
      
      // Métricas de rendimiento (usando datos reales donde sea posible)
      performanceMetrics: {
        overallAverage: 84.7, // TODO: Calcular basado en datos reales de exámenes
        attendanceRate: 93.8, // TODO: Calcular basado en datos reales de asistencia
        teachersCount: teachers.length, // Datos reales
        studentsCount: students.length // Datos reales
      }
    }
  }, [currentCoordinator, campusTeachers, campusStudents, user])

  return {
    stats,
    isLoading,
    hasError,
    currentCoordinator,
    teachers: campusTeachers || [],
    students: campusStudents || []
  }
}


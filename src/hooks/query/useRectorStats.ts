import { useAuthContext } from '@/context/AuthContext'
import { useRectors } from './useRectorQuery'
import { useFilteredPrincipals } from './usePrincipalQuery'
import { useFilteredTeachers } from './useTeacherQuery'
import { useFilteredStudents } from './useStudentQuery'

export const useRectorStats = () => {
  const { user } = useAuthContext()
  
  // Obtener datos del rector actual
  const { data: rectors, isLoading: rectorsLoading } = useRectors()
  const currentRector = rectors?.find(rector => rector.email === user?.email)
  
  // Obtener coordinadores de la institución del rector
  const { principals: coordinators, isLoading: coordinatorsLoading } = useFilteredPrincipals({
    institutionId: currentRector?.institutionId,
    isActive: true
  })
  
  // Obtener docentes de la institución del rector
  const { teachers: institutionTeachers, isLoading: teachersLoading } = useFilteredTeachers({
    institutionId: currentRector?.institutionId,
    isActive: true
  })
  
  // Obtener estudiantes de la institución del rector
  const { students: institutionStudents, isLoading: studentsLoading } = useFilteredStudents({
    institutionId: currentRector?.institutionId,
    isActive: true
  })

  const isLoading = rectorsLoading || coordinatorsLoading || teachersLoading || studentsLoading

  // Calcular estadísticas reales
  const stats = {
    // Estadísticas básicas - usar datos reales de las consultas
    totalCampuses: currentRector?.campusCount || 0,
    totalPrincipals: coordinators?.length || 0, // Usar datos reales de coordinadores
    totalTeachers: institutionTeachers?.length || 0, // Usar datos reales de docentes
    totalStudents: institutionStudents?.length || 0, // Usar datos reales de estudiantes
    
    // Información del rector
    rectorName: currentRector?.name || user?.displayName || 'Rector',
    institutionName: currentRector?.institutionName || user?.institution || 'Institución',
    rectorEmail: currentRector?.email || user?.email || '',
    
    // Métricas de rendimiento (estas pueden ser calculadas o venir de datos reales)
    performanceMetrics: {
      overallAverage: 84.7, // TODO: Calcular basado en datos reales de exámenes
      attendanceRate: 93.8, // TODO: Calcular basado en datos reales de asistencia
      coordinatorsCount: coordinators?.length || 0, // Contador real de coordinadores
      teacherRetention: 95.5 // TODO: Calcular basado en datos reales de retención
    },
    
    // Resumen de sedes con datos reales
    campusOverview: coordinators?.map((coordinator: any, index: number) => ({
      id: coordinator.id,
      name: coordinator.campusName || `Sede ${index + 1}`,
      students: coordinator.studentCount || 0,
      teachers: institutionTeachers?.filter((teacher: any) => teacher.campusId === coordinator.campusId)?.length || 0,
      average: 84.7, // TODO: Calcular promedio real por sede
      principal: coordinator.name || 'Sin asignar'
    })) || []
  }

  return {
    stats,
    isLoading,
    currentRector,
    coordinators,
    teachers: institutionTeachers,
    students: institutionStudents
  }
}

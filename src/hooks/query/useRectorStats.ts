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
  
  // Obtener el institutionId del rector - validar que exista
  // Verificar tanto institutionId como inst para compatibilidad
  const rectorInstitutionId = currentRector?.institutionId || currentRector?.inst
  
  // Validar que el rector tenga una institución asignada
  const hasValidInstitution = !!rectorInstitutionId && rectorInstitutionId.trim() !== ''
  
  // Obtener coordinadores de la institución del rector - SOLO si tiene institución válida
  const { principals: coordinators, isLoading: coordinatorsLoading } = useFilteredPrincipals({
    institutionId: hasValidInstitution ? rectorInstitutionId : undefined,
    isActive: true
  })
  
  // Obtener docentes de la institución del rector - SOLO si tiene institución válida
  const { teachers: institutionTeachers, isLoading: teachersLoading } = useFilteredTeachers({
    institutionId: hasValidInstitution ? rectorInstitutionId : undefined,
    isActive: true
  })
  
  // Obtener estudiantes de la institución del rector - SOLO si tiene institución válida
  const { students: institutionStudents, isLoading: studentsLoading } = useFilteredStudents({
    institutionId: hasValidInstitution ? rectorInstitutionId : undefined,
    isActive: true
  })

  const isLoading = rectorsLoading || coordinatorsLoading || teachersLoading || studentsLoading

  // Validación adicional: Filtrar usuarios que realmente pertenezcan a la institución del rector
  // Esto es una capa extra de seguridad para asegurar que no se muestren usuarios de otras instituciones
  const validCoordinators = coordinators?.filter((coordinator: any) => {
    const coordinatorInstitutionId = coordinator.institutionId || coordinator.inst
    return coordinatorInstitutionId && coordinatorInstitutionId === rectorInstitutionId
  }) || []

  const validTeachers = institutionTeachers?.filter((teacher: any) => {
    const teacherInstitutionId = teacher.institutionId || teacher.inst
    return teacherInstitutionId && teacherInstitutionId === rectorInstitutionId
  }) || []

  const validStudents = institutionStudents?.filter((student: any) => {
    const studentInstitutionId = student.institutionId || student.inst
    return studentInstitutionId && studentInstitutionId === rectorInstitutionId
  }) || []

  // Calcular el número de sedes únicas basándose en los coordinadores válidos
  // Primero intentar por campusId, luego por campusName, y finalmente contar coordinadores únicos
  const uniqueCampuses = validCoordinators && validCoordinators.length > 0
    ? (() => {
        // Filtrar coordinadores que tienen campusId o campusName
        const coordinatorsWithCampus = validCoordinators.filter((c: any) => c.campusId || c.campusName)
        
        if (coordinatorsWithCampus.length === 0) {
          // Si ningún coordinador tiene sede asignada, retornar 0
          return 0
        }
        
        // Crear un Set con identificadores únicos (campusId si existe, sino campusName)
        const uniqueCampusIds = new Set(
          coordinatorsWithCampus.map((c: any) => c.campusId || c.campusName)
        )
        
        return uniqueCampusIds.size
      })()
    : 0

  // Calcular estadísticas reales usando solo usuarios válidos
  const stats = {
    // Estadísticas básicas - usar datos reales de las consultas VALIDADAS
    totalCampuses: uniqueCampuses, // Contar sedes únicas basadas en coordinadores válidos
    totalPrincipals: validCoordinators.length, // Usar solo coordinadores válidos
    totalTeachers: validTeachers.length, // Usar solo docentes válidos
    totalStudents: validStudents.length, // Usar solo estudiantes válidos
    
    // Información del rector
    rectorName: currentRector?.name || user?.displayName || 'Rector',
    institutionName: currentRector?.institutionName || user?.institution || 'Institución',
    rectorEmail: currentRector?.email || user?.email || '',
    
    // Métricas de rendimiento (estas pueden ser calculadas o venir de datos reales)
    performanceMetrics: {
      overallAverage: 84.7, // TODO: Calcular basado en datos reales de exámenes
      attendanceRate: 93.8, // TODO: Calcular basado en datos reales de asistencia
      coordinatorsCount: validCoordinators.length, // Contador real de coordinadores válidos
      teacherRetention: 95.5 // TODO: Calcular basado en datos reales de retención
    },
    
    // Resumen de sedes con datos reales - solo de coordinadores válidos
    campusOverview: validCoordinators.map((coordinator: any, index: number) => ({
      id: coordinator.id,
      name: coordinator.campusName || `Sede ${index + 1}`,
      students: coordinator.studentCount || 0,
      teachers: validTeachers.filter((teacher: any) => {
        const teacherCampusId = teacher.campusId || teacher.campus
        const coordinatorCampusId = coordinator.campusId || coordinator.campus
        return teacherCampusId && coordinatorCampusId && teacherCampusId === coordinatorCampusId
      }).length || 0,
      average: 84.7, // TODO: Calcular promedio real por sede
      principal: coordinator.name || 'Sin asignar'
    })) || []
  }

  return {
    stats,
    isLoading,
    currentRector,
    coordinators: validCoordinators, // Retornar solo coordinadores válidos
    teachers: validTeachers, // Retornar solo docentes válidos
    students: validStudents // Retornar solo estudiantes válidos
  }
}

import { useAuthContext } from '@/context/AuthContext'
import { useCurrentRector } from './useRectorQuery'
import { useFilteredTeachers } from './useTeacherQuery'
import { useFilteredStudents } from './useStudentQuery'

export const useRectorStats = () => {
  const { user } = useAuthContext()

  // Rector actual por uid: 1 lectura (getAllInstitutions) en lugar de ~690 (getAllRectors)
  const { data: currentRector, isLoading: rectorsLoading } = useCurrentRector()

  // Obtener el institutionId del rector - validar que exista
  const rectorInstitutionId = currentRector?.institutionId || currentRector?.inst
  
  // Validar que el rector tenga una institución asignada
  const hasValidInstitution = !!rectorInstitutionId && rectorInstitutionId.trim() !== ''
  
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

  const isLoading = rectorsLoading || teachersLoading || studentsLoading

  const validTeachers = institutionTeachers?.filter((teacher: any) => {
    const teacherInstitutionId = teacher.institutionId || teacher.inst
    return teacherInstitutionId && teacherInstitutionId === rectorInstitutionId
  }) || []

  const validStudents = institutionStudents?.filter((student: any) => {
    const studentInstitutionId = student.institutionId || student.inst
    return studentInstitutionId && studentInstitutionId === rectorInstitutionId
  }) || []

  // Con la eliminación del rol principal/coordinador, ya no se calculan sedes vía coordinadores.
  const uniqueCampuses = 0

  // Calcular estadísticas reales usando solo usuarios válidos
  const stats = {
    // Estadísticas básicas - usar datos reales de las consultas VALIDADAS
    totalCampuses: uniqueCampuses, // Contar sedes únicas basadas en coordinadores válidos
    totalPrincipals: 0,
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
      coordinatorsCount: 0,
      teacherRetention: 95.5 // TODO: Calcular basado en datos reales de retención
    },
    
    campusOverview: []
  }

  return {
    stats,
    isLoading,
    currentRector,
    coordinators: [],
    teachers: validTeachers, // Retornar solo docentes válidos
    students: validStudents // Retornar solo estudiantes válidos
  }
}

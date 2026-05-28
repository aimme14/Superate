import { dbService } from '@/services/firebase/db.service'
import { logger } from '@/utils/logger'

/**
 * Función para diagnosticar los datos del formulario vs los datos reales de Firebase
 */
export const debugFormData = async (formData: {
  institutionId: string
  campusId: string
  gradeId: string
}) => {
  try {
    logger.debug('🔍 DIAGNÓSTICO: Comparando datos del formulario con Firebase')
    logger.debug('📝 Datos del formulario:', formData)
    
    // 1. Obtener todas las instituciones
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) {
      console.error('❌ Error al obtener instituciones:', institutionsResult.error)
      return
    }

    const institutions = institutionsResult.data
    logger.debug('📋 Instituciones en Firebase:', institutions.length)
    
    // 2. Buscar la institución del formulario
    const targetInstitution = institutions.find(inst => inst.id === formData.institutionId)
    if (!targetInstitution) {
      console.error('❌ INSTITUCIÓN NO ENCONTRADA:', formData.institutionId)
      logger.debug('📋 Instituciones disponibles:', institutions.map(i => `${i.name} (ID: ${i.id})`))
      return
    }
    
    logger.debug('✅ Institución encontrada:', targetInstitution.name)
    logger.debug('🏢 Sedes en la institución:', targetInstitution.campuses.length)
    
    // 3. Buscar la sede del formulario
    const targetCampus = targetInstitution.campuses.find((campus: any) => campus.id === formData.campusId)
    if (!targetCampus) {
      console.error('❌ SEDE NO ENCONTRADA:', formData.campusId)
      logger.debug('📋 Sedes disponibles:', targetInstitution.campuses.map((c: any) => `${c.name} (ID: ${c.id})`))
      return
    }
    
    logger.debug('✅ Sede encontrada:', targetCampus.name)
    logger.debug('🎓 Grados en la sede:', targetCampus.grades.length)
    
    // 4. Buscar el grado del formulario
    const targetGrade = targetCampus.grades.find((grade: any) => grade.id === formData.gradeId)
    if (!targetGrade) {
      console.error('❌ GRADO NO ENCONTRADO:', formData.gradeId)
      logger.debug('📋 Grados disponibles:', targetCampus.grades.map((g: any) => `${g.name} (ID: ${g.id})`))
      return
    }
    
    logger.debug('✅ Grado encontrado:', targetGrade.name)
    logger.debug('👨‍🏫 Docentes en el grado:', targetGrade.teachers?.length || 0)
    
    if (targetGrade.teachers && targetGrade.teachers.length > 0) {
      logger.debug('📋 Docentes existentes:', targetGrade.teachers.map((t: any) => t.name))
    }
    
    logger.debug('🎉 DIAGNÓSTICO COMPLETADO: Todos los IDs son válidos')
    return {
      institution: targetInstitution,
      campus: targetCampus,
      grade: targetGrade,
      isValid: true
    }
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error)
    return { isValid: false, error }
  }
}

// Hacer la función disponible globalmente
if (typeof window !== 'undefined') {
  (window as any).debugFormData = debugFormData
}

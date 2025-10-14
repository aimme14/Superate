import { dbService } from '@/services/firebase/db.service'

/**
 * Función para diagnosticar los datos del formulario vs los datos reales de Firebase
 */
export const debugFormData = async (formData: {
  institutionId: string
  campusId: string
  gradeId: string
}) => {
  try {
    console.log('🔍 DIAGNÓSTICO: Comparando datos del formulario con Firebase')
    console.log('📝 Datos del formulario:', formData)
    
    // 1. Obtener todas las instituciones
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) {
      console.error('❌ Error al obtener instituciones:', institutionsResult.error)
      return
    }

    const institutions = institutionsResult.data
    console.log('📋 Instituciones en Firebase:', institutions.length)
    
    // 2. Buscar la institución del formulario
    const targetInstitution = institutions.find(inst => inst.id === formData.institutionId)
    if (!targetInstitution) {
      console.error('❌ INSTITUCIÓN NO ENCONTRADA:', formData.institutionId)
      console.log('📋 Instituciones disponibles:', institutions.map(i => `${i.name} (ID: ${i.id})`))
      return
    }
    
    console.log('✅ Institución encontrada:', targetInstitution.name)
    console.log('🏢 Sedes en la institución:', targetInstitution.campuses.length)
    
    // 3. Buscar la sede del formulario
    const targetCampus = targetInstitution.campuses.find((campus: any) => campus.id === formData.campusId)
    if (!targetCampus) {
      console.error('❌ SEDE NO ENCONTRADA:', formData.campusId)
      console.log('📋 Sedes disponibles:', targetInstitution.campuses.map((c: any) => `${c.name} (ID: ${c.id})`))
      return
    }
    
    console.log('✅ Sede encontrada:', targetCampus.name)
    console.log('🎓 Grados en la sede:', targetCampus.grades.length)
    
    // 4. Buscar el grado del formulario
    const targetGrade = targetCampus.grades.find((grade: any) => grade.id === formData.gradeId)
    if (!targetGrade) {
      console.error('❌ GRADO NO ENCONTRADO:', formData.gradeId)
      console.log('📋 Grados disponibles:', targetCampus.grades.map((g: any) => `${g.name} (ID: ${g.id})`))
      return
    }
    
    console.log('✅ Grado encontrado:', targetGrade.name)
    console.log('👨‍🏫 Docentes en el grado:', targetGrade.teachers?.length || 0)
    
    if (targetGrade.teachers && targetGrade.teachers.length > 0) {
      console.log('📋 Docentes existentes:', targetGrade.teachers.map((t: any) => t.name))
    }
    
    console.log('🎉 DIAGNÓSTICO COMPLETADO: Todos los IDs son válidos')
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

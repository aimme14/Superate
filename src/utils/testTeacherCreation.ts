import { dbService } from '@/services/firebase/db.service'
import { createTeacher } from '@/controllers/teacher.controller'

/**
 * Función para probar la creación de docentes
 * Esta función se puede llamar desde la consola del navegador
 */
export const testTeacherCreation = async () => {
  try {
    console.log('🧪 Iniciando prueba de creación de docentes...')
    
    // 1. Obtener todas las instituciones disponibles
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) {
      console.error('❌ Error al obtener instituciones:', institutionsResult.error)
      return { success: false, error: institutionsResult.error }
    }

    const institutions = institutionsResult.data
    console.log('📋 Instituciones disponibles:', institutions.length)
    
    if (institutions.length === 0) {
      console.error('❌ No hay instituciones en la base de datos')
      return { success: false, error: 'No hay instituciones disponibles' }
    }

    // 2. Mostrar la estructura de la primera institución
    const firstInstitution = institutions[0]
    console.log('🏫 Primera institución:', firstInstitution.name)
    console.log('📊 Sedes disponibles:', firstInstitution.campuses.length)
    
    if (firstInstitution.campuses.length === 0) {
      console.error('❌ No hay sedes en la institución')
      return { success: false, error: 'No hay sedes disponibles' }
    }

    const firstCampus = firstInstitution.campuses[0]
    console.log('🏢 Primera sede:', firstCampus.name)
    console.log('📚 Grados disponibles:', firstCampus.grades.length)
    
    if (firstCampus.grades.length === 0) {
      console.error('❌ No hay grados en la sede')
      return { success: false, error: 'No hay grados disponibles' }
    }

    const firstGrade = firstCampus.grades[0]
    console.log('🎓 Primer grado:', firstGrade.name)
    
    // 3. Crear un docente de prueba
    const testTeacherData = {
      name: 'Prof. Prueba Test',
      email: 'prof.prueba@test.com',
      institutionId: firstInstitution.id,
      campusId: firstCampus.id,
      gradeId: firstGrade.id,
      subjects: ['Matemáticas', 'Física'],
      phone: '+57 300 123 4567'
    }

    console.log('👨‍🏫 Creando docente de prueba...')
    console.log('📝 Datos del docente:', testTeacherData)

    const result = await createTeacher(testTeacherData)
    
    if (result.success) {
      console.log('✅ Docente creado exitosamente!')
      console.log('👨‍🏫 Docente creado:', result.data)
      
      // 4. Verificar que el docente se almacenó correctamente
      console.log('🔍 Verificando almacenamiento...')
      const institutionAfter = await dbService.getInstitutionById(firstInstitution.id)
      
      if (institutionAfter.success) {
        const updatedCampus = institutionAfter.data.campuses.find((c: any) => c.id === firstCampus.id)
        const updatedGrade = updatedCampus?.grades.find((g: any) => g.id === firstGrade.id)
        
        if (updatedGrade?.teachers && updatedGrade.teachers.length > 0) {
          console.log('✅ Docente almacenado correctamente en el grado!')
          console.log('👨‍🏫 Docentes en el grado:', updatedGrade.teachers.length)
          console.log('📋 Lista de docentes:', updatedGrade.teachers.map((t: any) => t.name))
        } else {
          console.error('❌ El docente no se almacenó en el grado')
        }
      }
      
      return { success: true, data: result.data }
    } else {
      console.error('❌ Error al crear docente:', result.error)
      return { success: false, error: result.error }
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error)
    return { success: false, error: error }
  }
}

// Hacer la función disponible globalmente para uso en consola
if (typeof window !== 'undefined') {
  (window as any).testTeacherCreation = testTeacherCreation
}

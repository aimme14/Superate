import { initializeTeachers } from './initializeTeachers'
import { initializeInstitutions } from './initializeInstitutions'

/**
 * Script para ejecutar todas las inicializaciones necesarias
 * Ejecuta este archivo para poblar la base de datos con datos de ejemplo
 */
export const runAllInitializations = async () => {
  console.log('🚀 Iniciando proceso de inicialización...')
  
  try {
    // 1. Inicializar instituciones
    console.log('📚 Inicializando instituciones...')
    await initializeInstitutions()
    console.log('✅ Instituciones inicializadas correctamente')
    
    // 2. Inicializar docentes
    console.log('👨‍🏫 Inicializando docentes...')
    await initializeTeachers()
    console.log('✅ Docentes inicializados correctamente')
    
    console.log('🎉 ¡Inicialización completada exitosamente!')
    console.log('Ahora puedes ver los docentes en el dashboard del administrador.')
    
  } catch (error) {
    console.error('❌ Error durante la inicialización:', error)
    throw error
  }
}

// Si se ejecuta directamente, correr la inicialización
if (import.meta.env.DEV) {
  runAllInitializations()
    .then(() => {
      console.log('Script completado')
      process.exit(0)
    })
    .catch((error) => {
      console.error('Error en el script:', error)
      process.exit(1)
    })
}

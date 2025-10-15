import { dbService } from '@/services/db'

/**
 * Script para recalcular todos los contadores de estudiantes
 * Este script corrige los contadores de usuarios existentes
 */
export const recalculateStudentCounts = async () => {
  try {
    console.log('🚀 Iniciando script de recálculo de contadores...')
    
    const result = await dbService.recalculateAllStudentCounts()
    
    if (result.success) {
      console.log('✅ Script completado exitosamente')
      console.log('📊 Los contadores de estudiantes han sido actualizados')
      console.log('🔄 Recarga la página para ver los cambios')
    } else {
      console.error('❌ Error en el script:', result.error)
    }
    
    return result
  } catch (error) {
    console.error('❌ Error inesperado en el script:', error)
    return { success: false, error }
  }
}

// Si se ejecuta directamente
if (require.main === module) {
  recalculateStudentCounts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}

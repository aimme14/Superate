/**
 * Script para crear el usuario administrador inicial
 * Ejecutar solo una vez al configurar el sistema
 */

import { createAdminUser } from '../utils/adminSetup'

const runCreateAdmin = async () => {
  console.log('🚀 Iniciando creación del usuario administrador...')
  
  try {
    const result = await createAdminUser()
    
    if (result.success) {
      console.log('✅ Usuario administrador creado exitosamente!')
      console.log('📧 Email: superate06@gmail.com')
      console.log('🔑 Contraseña: Fx570es$#')
      console.log('')
      console.log('⚠️  IMPORTANTE: Guarda estas credenciales de forma segura')
      console.log('⚠️  El usuario debe verificar su email antes de poder iniciar sesión')
    } else {
      console.error('❌ Error al crear usuario administrador:', result.message)
      if (result.error) {
        console.error('Detalles del error:', result.error)
      }
    }
  } catch (error) {
    console.error('❌ Error inesperado:', error)
  }
}

// Ejecutar solo si se llama directamente
if (require.main === module) {
  runCreateAdmin()
}

export default runCreateAdmin

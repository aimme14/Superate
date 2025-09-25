import { authService } from '@/services/firebase/auth.service'
import { dbService } from '@/services/firebase/db.service'

/**
 * Función para crear el usuario administrador
 * Esta función debe ejecutarse una vez para crear el usuario admin
 */
export const createAdminUser = async () => {
  try {
    console.log('🚀 Creando usuario administrador...')
    
    const adminEmail = 'superate06@gmail.com'
    const adminPassword = 'Fx570es$#'
    const adminName = 'Administrador Sistema'

    // Crear usuario en Firebase Auth
    console.log('📧 Creando cuenta en Firebase Auth...')
    const authResult = await authService.registerAccount(adminName, adminEmail, adminPassword)
    
    if (!authResult.success) {
      console.error('❌ Error al crear usuario en Firebase Auth:', authResult.error)
      return { success: false, error: authResult.error?.message || 'Error en Firebase Auth' }
    }

    console.log('✅ Usuario creado en Firebase Auth')

    // Crear documento en Firestore
    console.log('💾 Creando documento en Firestore...')
    const userData = {
      role: 'admin',
      name: adminName,
      email: adminEmail,
      grade: 'N/A',
      inst: 'Sistema',
      userdoc: adminPassword,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: 'system'
    }

    const dbResult = await dbService.createUser(authResult.data, userData)
    
    if (!dbResult.success) {
      console.error('❌ Error al crear usuario en Firestore:', dbResult.error)
      return { success: false, error: dbResult.error?.message || 'Error en Firestore' }
    }

    console.log('✅ Usuario creado en Firestore')

    // Enviar verificación de email
    console.log('📬 Enviando verificación de email...')
    const emailVerification = await authService.sendEmailVerification()
    
    if (!emailVerification.success) {
      console.warn('⚠️ No se pudo enviar verificación de email:', emailVerification.error)
    } else {
      console.log('✅ Email de verificación enviado')
    }

    console.log('🎉 Usuario administrador creado exitosamente!')
    console.log('📧 Email:', adminEmail)
    console.log('🔑 Contraseña:', adminPassword)
    console.log('')
    console.log('⚠️ IMPORTANTE: Verifica tu email antes de iniciar sesión')

    return { 
      success: true, 
      message: 'Usuario administrador creado exitosamente',
      credentials: {
        email: adminEmail,
        password: adminPassword
      }
    }

  } catch (error) {
    console.error('❌ Error inesperado:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

// Función para verificar si el usuario admin ya existe
export const checkAdminExists = async () => {
  try {
    // Esta es una verificación simple - en producción sería más robusta
    console.log('🔍 Verificando si el usuario administrador existe...')
    return { exists: false } // Por ahora siempre intentamos crear
  } catch (error) {
    console.error('Error al verificar administrador:', error)
    return { exists: false }
  }
}

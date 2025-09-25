import { authService } from '@/services/firebase/auth.service'
import { dbService } from '@/services/firebase/db.service'
import { useNotification } from '@/hooks/ui/useNotification'

/**
 * Función para crear el usuario administrador inicial
 * Solo debe ejecutarse una vez al configurar el sistema
 */
export const createAdminUser = async () => {
  try {
    const adminEmail = 'superate06@gmail.com'
    const adminPassword = 'Fx570es$#'
    const adminName = 'Administrador Sistema'

    // Nota: En un entorno real, aquí verificarías si el usuario ya existe
    // Por ahora, procedemos con la creación

    // Crear usuario en Firebase Auth
    const authResult = await authService.registerAccount(adminName, adminEmail, adminPassword)
    
    if (!authResult.success) {
      throw new Error('Error al crear usuario en Firebase Auth')
    }

    // Crear documento en Firestore con rol de admin
    const userData = {
      role: 'admin',
      name: adminName,
      email: adminEmail,
      grade: 'N/A',
      inst: 'Sistema',
      userdoc: adminPassword,
      createdAt: new Date().toISOString(),
      isActive: true
    }

    const dbResult = await dbService.createUser(authResult.data, userData)
    
    if (!dbResult.success) {
      throw new Error('Error al crear usuario en base de datos')
    }

    console.log('Usuario administrador creado exitosamente')
    return { success: true, message: 'Usuario administrador creado exitosamente' }

  } catch (error) {
    console.error('Error al crear usuario administrador:', error)
    return { 
      success: false, 
      message: 'Error al crear usuario administrador',
      error: error instanceof Error ? error.message : 'Error desconocido'
    }
  }
}

/**
 * Función para verificar si el usuario administrador existe
 */
export const checkAdminExists = async (): Promise<boolean> => {
  try {
    // Esta función debería verificar en la base de datos si existe un usuario con rol 'admin'
    // Por ahora retornamos true para evitar crear múltiples admins
    return true
  } catch (error) {
    console.error('Error al verificar administrador:', error)
    return false
  }
}

/**
 * Hook para inicializar el sistema con el usuario administrador
 */
export const useAdminSetup = () => {
  const { notifySuccess, notifyError } = useNotification()

  const initializeAdmin = async () => {
    try {
      const result = await createAdminUser()
      
      if (result.success) {
        notifySuccess({ 
          title: 'Sistema Inicializado', 
          message: result.message 
        })
      } else {
        notifyError({ 
          title: 'Error de Inicialización', 
          message: result.message 
        })
      }
      
      return result
    } catch (error) {
      notifyError({ 
        title: 'Error', 
        message: 'Error al inicializar el sistema' 
      })
      return { 
        success: false, 
        message: 'Error al inicializar el sistema' 
      }
    }
  }

  return { initializeAdmin }
}

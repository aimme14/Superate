import { authService as authFB } from "@/services/firebase/auth.service"
import { success, failure, Result } from "@/interfaces/db.interface"
import { dbService } from "@/services/firebase/db.service"
import ErrorAPI from "@/errors/index"
import { normalizeError } from "@/errors/handler"
import { User as UserFB } from "firebase/auth"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"
import { firebaseApp } from "@/services/firebase/db.service"

interface CreateUserData {
  username: string
  email: string
  role: 'teacher' | 'principal'
  institution: string
  campus?: string
  grade?: string
  password: string
}

/**
 * Crea un nuevo usuario (docente o rector) - Solo para administradores
 * @param {CreateUserData} userData - Los datos del usuario a crear
 * @returns {Promise<Result<UserFB>>} - El usuario creado o un error
 */
export const createUserByAdmin = async (userData: CreateUserData): Promise<Result<UserFB>> => {
  try {
    const { username, email, role, institution, campus, grade, password } = userData

    // Validar que el rol sea válido para creación por admin
    if (role !== 'teacher' && role !== 'principal') {
      throw new Error('Solo se pueden crear usuarios con rol de docente o rector')
    }

    // Validar que la institución esté activa
    if (institution) {
      const institutionResult = await dbService.getInstitutionById(institution)
      if (!institutionResult.success) {
        return failure(new ErrorAPI({ message: 'Institución no encontrada', statusCode: 404 }))
      }
      
      const institutionData = institutionResult.data
      if (institutionData.isActive !== true) {
        return failure(new ErrorAPI({ 
          message: 'No se pueden crear usuarios para una institución inactiva. Por favor, activa la institución primero.', 
          statusCode: 400 
        }))
      }
    }

    // Crear cuenta en Firebase Auth
    const userAccount = await authFB.registerAccount(username, email, password)
    if (!userAccount.success) throw userAccount.error

    // Crear documento en Firestore usando la nueva estructura jerárquica
    const dbUserData = {
      role,
      name: username,
      email,
      grade: grade || 'N/A',
      institutionId: institution, // Usar institutionId para nueva estructura
      inst: institution, // Mantener inst para retrocompatibilidad
      campus: campus || '',
      campusId: campus || '', // Mantener campusId para consistencia
      userdoc: password,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: 'admin' // Marcar que fue creado por admin
    }

    // Usar directamente la nueva estructura si tiene institutionId
    let dbResult
    if (institution && (role === 'teacher' || role === 'principal')) {
      console.log('Creando usuario usando nueva estructura jerárquica')
      dbResult = await dbService.createUserInNewStructure(userAccount.data, dbUserData)
    } else {
      // Fallback a método general (que tiene retrocompatibilidad)
      dbResult = await dbService.createUser(userAccount.data, dbUserData)
    }
    
    if (!dbResult.success) throw dbResult.error

    // Enviar verificación de email
    const emailVerification = await authFB.sendEmailVerification()
    if (!emailVerification.success) {
      console.warn('No se pudo enviar verificación de email:', emailVerification.error)
    }

    return success(userAccount.data)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'creación de usuario por administrador')))
  }
}

/**
 * Obtiene todos los usuarios del sistema - Solo para administradores
 * @returns {Promise<Result<any[]>>} - Lista de usuarios
 */
export const getAllSystemUsers = async (): Promise<Result<any[]>> => {
  try {
    const result = await dbService.getAllUsers()
    if (!result.success) throw result.error
    
    return success(result.data)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'obtener usuarios del sistema')))
  }
}

/**
 * Actualiza un usuario existente - Solo para administradores
 * @param {string} userId - ID del usuario
 * @param {Partial<any>} updateData - Datos a actualizar
 * @returns {Promise<Result<void>>} - Resultado de la actualización
 */
export const updateUserByAdmin = async (userId: string, updateData: Partial<any>): Promise<Result<void>> => {
  try {
    const result = await dbService.updateUser(userId, updateData)
    if (!result.success) throw result.error
    
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'actualización de usuario por administrador')))
  }
}

/**
 * Desactiva un usuario - Solo para administradores
 * @param {string} userId - ID del usuario
 * @returns {Promise<Result<void>>} - Resultado de la desactivación
 */
export const deactivateUser = async (userId: string): Promise<Result<void>> => {
  try {
    const updateData = {
      isActive: false,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: 'admin'
    }
    
    const result = await dbService.updateUser(userId, updateData)
    if (!result.success) throw result.error
    
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'desactivación de usuario')))
  }
}

/**
 * Activa un usuario - Solo para administradores
 * @param {string} userId - ID del usuario
 * @returns {Promise<Result<void>>} - Resultado de la activación
 */
export const activateUser = async (userId: string): Promise<Result<void>> => {
  try {
    const updateData = {
      isActive: true,
      activatedAt: new Date().toISOString(),
      activatedBy: 'admin'
    }
    
    const result = await dbService.updateUser(userId, updateData)
    if (!result.success) throw result.error
    
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'activación de usuario')))
  }
}

/**
 * Recalcula todos los contadores de estudiantes - Solo para administradores
 * @returns {Promise<Result<void>>} - Resultado del recálculo
 */
export const recalculateStudentCounts = async (): Promise<Result<void>> => {
  try {
    console.log('Administrador ejecutando recálculo de contadores...')
    const result = await dbService.recalculateAllStudentCounts()
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'recalcular contadores de estudiantes')))
  }
}

/**
 * Conteos globales (estudiantes, docentes, rectores, instituciones) vía agregaciones Firestore.
 * No lista usuarios: solo totales.
 */
export const getAdminEntityCounts = async (): Promise<Result<{
  institutions: number
  students: number
  teachers: number
  rectors: number
}>> => {
  return dbService.getAdminDashboardEntityCounts()
}

/**
 * Interfaz para la configuración de registro
 */
export interface RegistrationConfig {
  enabled: boolean
  updatedAt?: Date
  updatedBy?: string
}

/**
 * Obtiene la configuración de registro del sistema
 * @returns {Promise<Result<RegistrationConfig>>} - Configuración de registro
 */
export const getRegistrationConfig = async (): Promise<Result<RegistrationConfig>> => {
  try {
    const db = getFirestore(firebaseApp)
    const configRef = doc(db, 'superate', 'auth', 'system', 'registration')
    const configSnap = await getDoc(configRef)
    
    if (!configSnap.exists()) {
      // Si no existe, devolver valor por defecto sin escribir.
      // Esto evita "permission-denied" cuando un usuario no autenticado abre la home.
      const defaultConfig: RegistrationConfig = {
        enabled: true,
        updatedAt: new Date(),
      }
      return success(defaultConfig)
    }
    
    const data = configSnap.data() as any
    let updatedAt: Date | undefined = undefined
    
    if (data.updatedAt) {
      if (typeof data.updatedAt.toDate === 'function') {
        // Firestore Timestamp
        updatedAt = data.updatedAt.toDate()
      } else if (data.updatedAt instanceof Date) {
        // Ya es un Date
        updatedAt = data.updatedAt
      } else if (data.updatedAt.seconds) {
        // Firestore Timestamp en formato {seconds, nanoseconds}
        updatedAt = new Date(data.updatedAt.seconds * 1000)
      }
    }
    
    return success({
      enabled: data.enabled ?? true, // Por defecto habilitado si no existe
      updatedAt,
      updatedBy: data.updatedBy,
    })
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'obtener configuración de registro')))
  }
}

/**
 * Actualiza la configuración de registro del sistema
 * @param {boolean} enabled - Estado de habilitación del registro
 * @param {string} updatedBy - ID del usuario que realiza la actualización
 * @returns {Promise<Result<RegistrationConfig>>} - Configuración actualizada
 */
export const updateRegistrationConfig = async (
  enabled: boolean,
  updatedBy: string
): Promise<Result<RegistrationConfig>> => {
  try {
    const db = getFirestore(firebaseApp)
    const configRef = doc(db, 'superate', 'auth', 'system', 'registration')
    
    const config: RegistrationConfig = {
      enabled,
      updatedAt: new Date(),
      updatedBy,
    }
    
    await setDoc(configRef, config, { merge: true })
    
    return success(config)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'actualizar configuración de registro')))
  }
}

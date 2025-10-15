import { authService as authFB } from "@/services/firebase/auth.service"
import { success, failure, Result } from "@/interfaces/db.interface"
import { dbService } from "@/services/firebase/db.service"
import ErrorAPI from "@/errors/index"
import { normalizeError } from "@/errors/handler"
import { User as UserFB } from "firebase/auth"

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

    // Crear cuenta en Firebase Auth
    const userAccount = await authFB.registerAccount(username, email, password)
    if (!userAccount.success) throw userAccount.error

    // Crear documento en Firestore
    const dbUserData = {
      role,
      name: username,
      email,
      grade: grade || 'N/A',
      inst: institution,
      campus: campus || '',
      userdoc: password,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: 'admin' // Marcar que fue creado por admin
    }

    const dbResult = await dbService.createUser(userAccount.data, dbUserData)
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
    console.log('🔄 Administrador ejecutando recálculo de contadores...')
    const result = await dbService.recalculateAllStudentCounts()
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'recalcular contadores de estudiantes')))
  }
}
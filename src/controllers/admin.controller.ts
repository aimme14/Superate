import { success, failure, Result } from "@/interfaces/db.interface"
import { dbService } from "@/services/firebase/db.service"
import ErrorAPI from "@/errors/index"
import { normalizeError } from "@/errors/handler"
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"
import { firebaseApp } from "@/services/firebase/db.service"

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

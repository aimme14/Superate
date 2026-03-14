import { success, failure, Result } from "@/interfaces/db.interface";
import { normalizeError } from "@/errors/handler"
import ErrorAPI, { NotFound } from "@/errors"
import { firebaseApp } from "@/services/db"

import {
  CollectionReference,
  getFirestore,
  collection,
  updateDoc,
  deleteDoc,
  Firestore,
  getDocs,
  setDoc,
  getDoc,
  query,
  where,
  doc,
  writeBatch,
} from "firebase/firestore"
import { User } from "firebase/auth"
import { logger } from "@/utils/logger"

export { firebaseApp };

/**
 * @argument uid(auth) represent the id of the user authenticate
 */
class DatabaseService {
  db: Firestore;
  static instance: DatabaseService;
  constructor() { this.db = getFirestore(firebaseApp) }
  static getInstance() {
    if (!DatabaseService.instance) { DatabaseService.instance = new DatabaseService() }
    return DatabaseService.instance
  }

  /*-----------------> users <-----------------*/
  /**
   * Obtiene todos los usuarios
   * NUEVA ESTRUCTURA: Obtiene usuarios exclusivamente de la nueva estructura jerárquica.
   * La ruta antigua 'users' ha sido eliminada completamente.
   * @returns {Promise<Result<any[]>>} Una lista de usuarios.
   */
  async getAllUsers(): Promise<Result<any[]>> {
    try {
      const allUsers: any[] = []
      const userIds = new Set<string>() // Para evitar duplicados

      // Obtener usuarios de la nueva estructura jerárquica
      const roles = ['rector', 'principal', 'teacher', 'student']
      for (const role of roles) {
        const roleUsersResult = await this.getAllUsersByRoleFromNewStructure(role)
        if (roleUsersResult.success) {
          roleUsersResult.data.forEach(user => {
            if (!userIds.has(user.id)) {
              allUsers.push(user)
              userIds.add(user.id)
            }
          })
        }
      }
      
      console.log(`✅ Usuarios obtenidos de nueva estructura: ${allUsers.length}`)
      return success(allUsers)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'obtener usuarios'))) 
    }
  }

  /**
   * id represent the uid of the user (this is the name folder of each user)
   * NUEVA ESTRUCTURA: Busca primero en la nueva estructura jerárquica.
   * Si no encuentra, busca en estructura antigua SOLO si es admin (los admins no tienen institutionId).
   * @param {string} id - El identificador del usuario, corresponde al uid del usuario en cuestión (auth).
   * @returns {Promise<Result<any>>} Un usuario.
   */
  async getUserById(id: string): Promise<Result<any>> {
    try {
      // PRIMERO: Buscar en la nueva estructura jerárquica
      const newStructureResult = await this.getUserByIdFromNewStructure(id)
      if (newStructureResult.success) {
        return newStructureResult
      }

      // SEGUNDO: Si no se encuentra en nueva estructura, buscar en estructura antigua
      // SOLO para admin (los admins no tienen institutionId y no están en nueva estructura)
      try {
        const docRef = doc(this.getCollection('users'), id)
        const docSnap = await getDoc(docRef)
        
        if (!docSnap.exists()) {
          return failure(new NotFound({ message: 'Usuario no encontrado' }))
        }
        
        const userData = { id: docSnap.id, ...docSnap.data() } as any
        
        // Verificar que sea admin - si no es admin, no debería estar en estructura antigua
        if (userData.role !== 'admin') {
          return failure(new NotFound({ 
            message: 'Usuario no encontrado. Este usuario debería estar en la nueva estructura jerárquica.' 
          }))
        }
        
        return success(userData)
      } catch (oldStructureError: any) {
        // Si falla la búsqueda en estructura antigua, retornar el error de la nueva estructura
        return newStructureResult
      }
    } catch (e: any) { 
      return failure(new ErrorAPI(normalizeError(e, 'obtener usuario'))) 
    }
  }

  /**
   * Permite buscar usuarios por nombre.
   * NUEVA ESTRUCTURA: Busca exclusivamente en la nueva estructura jerárquica.
   * La ruta antigua 'users' ha sido eliminada completamente.
   * @param {string} searchTerm - El término de búsqueda.
   * @returns {Promise<Result<any>>} Una lista de usuarios.
   */
  async getUserByQuery(searchTerm: string): Promise<Result<any>> {
    try {
      // Buscar en nueva estructura jerárquica
      const allUsers: any[] = []
      const roles = ['rector', 'principal', 'teacher', 'student']
      
      for (const role of roles) {
        const roleUsersResult = await this.getAllUsersByRoleFromNewStructure(role)
        if (roleUsersResult.success) {
          const filtered = roleUsersResult.data.filter(user => 
            user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email?.toLowerCase().includes(searchTerm.toLowerCase())
          )
          allUsers.push(...filtered)
        }
      }
      
      return success(allUsers)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'buscar usuarios'))) 
    }
  }
  
  /**
   * Crea un usuario con las credenciales del usuario asociado.
   * NUEVA ESTRUCTURA: Usa exclusivamente la estructura jerárquica por institución y rol.
   * La ruta antigua 'users' ha sido eliminada completamente.
   * @param {object} credentials - Corresponde a las credenciales del usuario, contiene el rol del usuario en validacion.
   */
  async createUser(auth: User, credentials: any): Promise<Result<any>> {
    try {
      const institutionId = credentials.institutionId || credentials.inst
      const role = credentials.role

      // Validar que tenga institutionId y rol válido (requerido para nueva estructura)
      if (!institutionId) {
        return failure(new ErrorAPI({ 
          message: 'institutionId es requerido. La estructura antigua ha sido eliminada.', 
          statusCode: 400 
        }))
      }

      if (!role || !['rector', 'principal', 'teacher', 'student'].includes(role)) {
        return failure(new ErrorAPI({ 
          message: 'Rol válido es requerido. Roles válidos: rector, principal, teacher, student', 
          statusCode: 400 
        }))
      }

      console.log('🆕 Creando usuario en nueva estructura jerárquica')
      return await this.createUserInNewStructure(auth, credentials)
    } catch (e) { 
      console.log('❌ Error al guardar usuario en Firestore:', e)
      return failure(new ErrorAPI(normalizeError(e, 'Registrar credenciales del usuario'))) 
    }
  }

  /**
   * Limpia recursivamente valores undefined, null problemáticos y normaliza los datos
   * @param obj - Objeto a limpiar
   * @param depth - Profundidad actual para evitar recursión infinita
   * @param excludeFields - Campos a excluir en el nivel raíz
   * @returns Objeto limpio
   */
  private deepCleanData(obj: any, depth: number = 0, excludeFields: string[] = ['role', 'uid', 'id', 'createdAt']): any {
    // Protección contra recursión infinita
    if (depth > 10) {
      console.warn('⚠️ Profundidad máxima alcanzada al limpiar datos')
      return null
    }

    // Manejar null y undefined
    if (obj === null || obj === undefined) {
      return undefined // Retornar undefined para que se filtre
    }

    // Manejar arrays
    if (Array.isArray(obj)) {
      const cleaned = obj
        .map(item => this.deepCleanData(item, depth + 1, []))
        .filter(item => item !== null && item !== undefined)
      return cleaned.length > 0 ? cleaned : undefined
    }

    // Manejar objetos
    if (typeof obj === 'object' && obj.constructor === Object) {
      const cleaned: any = {}
      let hasValidFields = false
      
      for (const [key, value] of Object.entries(obj)) {
        // Excluir campos que no deben actualizarse solo en el nivel raíz
        if (depth === 0 && excludeFields.includes(key)) {
          continue
        }
        
        // PRESERVAR el nombre original de la clave (no capitalizar)
        // Limpiar recursivamente (sin excluir campos en niveles anidados)
        const cleanedValue = this.deepCleanData(value, depth + 1, [])
        
        // Solo agregar si el valor no es undefined
        // PERMITIR valores falsy válidos: 0, '', false, null (si es intencional)
        if (cleanedValue !== undefined) {
          // Preservar el nombre de la clave original
          cleaned[key] = cleanedValue
          hasValidFields = true
        }
      }
      
      return hasValidFields ? cleaned : undefined
    }

    // Manejar fechas - convertir a string ISO
    if (obj instanceof Date) {
      return obj.toISOString().split('T')[0]
    }

    // Retornar valores primitivos tal cual (string, number, boolean)
    // Incluyendo valores falsy válidos como 0, '', false
    return obj
  }

  /**
   * Ejecuta una actualización con reintentos y manejo robusto de errores
   * @param updateFn - Función que ejecuta la actualización
   * @param maxRetries - Número máximo de reintentos (default: 3)
   * @returns Resultado de la actualización
   */
  private async executeUpdateWithRetry<T>(
    updateFn: () => Promise<T>,
    maxRetries: number = 3
  ): Promise<Result<T>> {
    let lastError: any = null
    
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await updateFn()
        if (attempt > 0) {
          console.log(`✅ Actualización exitosa en el intento ${attempt + 1}`)
        }
        return success(result)
      } catch (error: any) {
        lastError = error
        
        // Si es un error de permisos o no encontrado, no reintentar
        if (error?.code === 'permission-denied' || 
            error?.code === 'not-found' ||
            error?.code === 'unauthenticated') {
          console.error(`❌ Error no recuperable (${error?.code}), no se reintentará`)
          break
        }
        
        // Si es un error de red o timeout, reintentar
        if (attempt < maxRetries - 1) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000) // Backoff exponencial, máximo 5s
          console.warn(`⚠️ Error en intento ${attempt + 1}/${maxRetries}, reintentando en ${delay}ms...`)
          console.warn(`   Error: ${error?.message || error}`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    
    return failure(new ErrorAPI(normalizeError(lastError, 'actualizar datos')))
  }

  /**
   * Actualiza un usuario existente con manejo robusto de errores y validaciones.
   * NUEVA ESTRUCTURA: Ahora actualiza primero en la nueva estructura, luego en la antigua si no se encuentra.
   * @param {string} id - ID del usuario a actualizar
   * @param {Partial<User>} user - El usuario con los nuevos datos.
   * @returns {Promise<Result<void>>} Resultado de la actualización
   */
  async updateUser(id: string, { ...user }: any, options?: { skipValidation?: boolean, currentUserData?: any }): Promise<Result<void>> {
    try {
      // Validar que el ID sea válido
      if (!id || typeof id !== 'string' || id.trim() === '') {
        return failure(new ErrorAPI({ 
          message: 'ID de usuario inválido', 
          statusCode: 400 
        }))
      }

      // Limpiar datos - versión simplificada y rápida
      const cleanedData: any = {}
      const excludeFields = ['role', 'uid', 'id', 'createdAt']
      
      for (const [key, value] of Object.entries(user)) {
        // Excluir campos protegidos
        if (excludeFields.includes(key)) continue
        
        // Solo agregar si el valor no es undefined
        if (value !== undefined) {
          // Manejar fechas
          if (value instanceof Date) {
            cleanedData[key] = value.toISOString().split('T')[0]
          } else if (value !== null) {
            cleanedData[key] = value
          }
        }
      }
      
      // Validar que haya datos para actualizar
      if (Object.keys(cleanedData).length === 0) {
        return failure(new ErrorAPI({ 
          message: 'No se proporcionaron datos válidos para actualizar', 
          statusCode: 400 
        }))
      }
      
      // Asegurar que updatedAt esté presente SIEMPRE
      cleanedData.updatedAt = new Date().toISOString().split('T')[0]
      
      // Validar institución activa SOLO si:
      // 1. Se está activando un usuario (isActive === true)
      // 2. No se está saltando la validación
      // 3. Tenemos datos del usuario actual (para evitar llamada adicional)
      if (!options?.skipValidation && cleanedData.isActive === true && options?.currentUserData) {
        const currentUser = options.currentUserData
        const currentIsActive = currentUser.isActive
        
        // Solo validar si el usuario está pasando de inactivo a activo
        if ((currentIsActive === false || currentIsActive === undefined) && currentUser.role === 'student') {
          const institutionId = cleanedData.inst || cleanedData.institutionId || currentUser.inst || currentUser.institutionId
          if (institutionId) {
            try {
              const institutionResult = await this.getInstitutionById(institutionId)
              if (institutionResult.success && institutionResult.data.isActive === false) {
                return failure(new ErrorAPI({ 
                  message: 'No se puede activar un estudiante de una institución inactiva. Por favor, activa la institución primero.', 
                  statusCode: 400 
                }))
              }
            } catch (validationError) {
              // Si falla la validación, continuar con la actualización (no bloquear)
              console.warn('⚠️ Error en validación de institución, continuando con actualización')
            }
          }
        }
      }
      
      // Actualizar exclusivamente en la nueva estructura jerárquica
      const newStructureResult = await this.updateUserInNewStructure(id, cleanedData)
      if (newStructureResult.success) {
        console.log('✅ Usuario actualizado en nueva estructura jerárquica')
        return newStructureResult
      }
      
      // Si no se encuentra en nueva estructura, retornar error
      return failure(new ErrorAPI({ 
        message: 'Usuario no encontrado. La estructura antigua ha sido eliminada.', 
        statusCode: 404 
      }))
    } catch (e: any) {
      return failure(new ErrorAPI(normalizeError(e, 'actualizar usuario'))) 
    }
  }

  /**
   * Elimina un usuario existente
   * NUEVA ESTRUCTURA: Elimina exclusivamente de la nueva estructura jerárquica.
   * La ruta antigua 'users' ha sido eliminada completamente.
   * @param {string} id - El identificador del documento usuario, representa el uid (auth)
   * @returns {Promise<Result<void>>} Elimina un usuario
   */
  async deleteUser(id: string): Promise<Result<void>> {
    try {
      let deleted = false
      
      // PRIMERO: Intentar eliminar de la nueva estructura jerárquica
      const deleteResult = await this.deleteUserFromNewStructure(id)
      if (deleteResult.success) {
        deleted = true
      }
      
      // SEGUNDO: También intentar eliminar de la colección antigua 'users' si existe
      try {
        const usersCollection = this.getCollection('users')
        const userDocRef = doc(usersCollection, id)
        const userDocSnap = await getDoc(userDocRef)
        
        if (userDocSnap.exists()) {
          await deleteDoc(userDocRef)
          console.log(`✅ Usuario eliminado de colección antigua users: ${id}`)
          deleted = true
        }
      } catch (oldStructureError: any) {
        // Si no existe en la colección antigua, no es un error
        console.log('ℹ️ Usuario no encontrado en colección antigua users')
      }
      
      if (deleted) {
        return success(undefined)
      }
      
      // Si no se encontró en ninguna ubicación, retornar error
      return failure(new NotFound({ message: 'Usuario no encontrado en ninguna estructura' }))
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'eliminar usuario'))) 
    }
  }
  /*----------------------------------------------------*/

  /*-----------------> test <-----------------*/
  async setInitialTestState() {
    try {
      return await setDoc(doc(this.getCollection('test'), 'global'), { test_1: false, test_2: false, test_3: false }).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'inicializar estado de pruebas'))) }
  }

  async getTestState() {
    try {
      const docSnap = await getDoc(doc(this.getCollection('test'), 'global'))
      if (!docSnap.exists()) {// Inicializar estado por defecto si no existe
        await this.setInitialTestState()
        return success({ test_1: false, test_2: false, test_3: false })
      }
      return success(docSnap.data())
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener estado de pruebas'))) }
  }

  async toggleTest(testNumber: number) {
    try {
      const currentState = await this.getTestState()
      if (!currentState.success) throw currentState.error

      const testKey = `test_${testNumber}`
      const newState = {
        ...currentState.data,
        [testKey]: !currentState.data[testKey as keyof typeof currentState.data]
      }
      return await setDoc(doc(this.getCollection('test'), 'global'), newState).then(() => success(newState))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'actualizar estado de prueba'))) }
  }
  /*----------------------------------------------------*/

  /*-----------------> institutions <-----------------*/
  /**
   * Obtiene todas las instituciones
   * @returns {Promise<Result<any[]>>} Una lista de instituciones.
   */
  async getAllInstitutions(): Promise<Result<any[]>> {
    try {
      const snapshot = await getDocs(this.getCollection('institutions'))
      return success(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener instituciones'))) }
  }

  /**
   * Obtiene una institución por ID
   * @param {string} id - El identificador de la institución.
   * @returns {Promise<Result<any>>} Una institución.
   */
  async getInstitutionById(id: string): Promise<Result<any>> {
    try {
      const docSnap = await getDoc(doc(this.getCollection('institutions'), id))
      if (!docSnap.exists()) return failure(new NotFound({ message: 'Institución no encontrada' }))
      const institutionData = { id: docSnap.id, ...docSnap.data() } as any
      
      // Asegurar que isActive esté definido (por defecto true para retrocompatibilidad)
      if (institutionData.isActive === undefined) {
        institutionData.isActive = true
      }
      
      return success(institutionData)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener institución'))) }
  }

  /**
   * Crea una nueva institución
   * @param {object} institutionData - Los datos de la institución a crear.
   * @returns {Promise<Result<any>>} La institución creada.
   */
  async createInstitution(institutionData: any): Promise<Result<any>> {
    try {
      // Asegurar que isActive esté definido (por defecto true)
      const institutionWithDefaults = {
        ...institutionData,
        isActive: institutionData.isActive !== undefined ? institutionData.isActive : true
      }
      
      const docRef = doc(this.getCollection('institutions'))
      const institutionWithId = {
        ...institutionWithDefaults,
        id: docRef.id,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      }
      await setDoc(docRef, institutionWithId)
      return success(institutionWithId)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'crear institución'))) }
  }

  /**
   * Actualiza una institución existente
   * @param {string} id - El identificador de la institución.
   * @param {object} institutionData - Los nuevos datos de la institución.
   * @returns {Promise<Result<any>>} La institución actualizada.
   */
  // Función para limpiar valores undefined de un objeto (mantener para retrocompatibilidad)
  private cleanUndefinedValues(obj: any): any {
    return this.deepCleanData(obj)
  }

  /**
   * Desactiva o activa todos los usuarios de una institución en cascada
   * @param institutionId - ID de la institución
   * @param isActive - Estado a aplicar (true = activar, false = desactivar)
   */
  private async updateUsersByInstitution(institutionId: string, isActive: boolean): Promise<void> {
    try {
      console.log(`🔄 ${isActive ? 'Activando' : 'Desactivando'} usuarios de la institución ${institutionId}...`)
      
      // Esperar un momento para asegurar que la actualización de la institución se haya completado completamente
      console.log('⏳ Esperando a que la actualización de la institución se complete...')
      await new Promise(resolve => setTimeout(resolve, 2000)) // Aumentado a 2 segundos para dar más tiempo
      
      // Verificar nuevamente la institución para asegurar que tenemos los datos más recientes
      let institutionResult = await this.getInstitutionById(institutionId)
      let retries = 3
      
      while (!institutionResult.success && retries > 0) {
        console.log(`⚠️ No se pudo obtener la institución, reintentando... (${retries} intentos restantes)`)
        await new Promise(resolve => setTimeout(resolve, 1000)) // Esperar 1 segundo antes de reintentar
        institutionResult = await this.getInstitutionById(institutionId)
        retries--
      }
      
      if (!institutionResult.success) {
        console.warn('⚠️ No se pudo obtener la institución para actualización en cascada después de varios intentos')
        return
      }
      
      console.log(`✅ Institución verificada, procediendo a actualizar usuarios...`)
      
      // Actualizar usuarios en nueva estructura jerárquica
      const allUserDocs: any[] = []
      const roles = ['rector', 'principal', 'teacher', 'student']
      
      // Obtener usuarios de cada rol en la nueva estructura
      for (const role of roles) {
        try {
          const roleUsersResult = await this.getAllUsersByRoleFromNewStructure(role)
          if (roleUsersResult.success) {
            roleUsersResult.data.forEach(user => {
              // Solo usuarios de esta institución
              if (user.institutionId === institutionId || user.inst === institutionId) {
                if (!allUserDocs.find(d => d.id === user.id)) {
                  allUserDocs.push({ id: user.id, data: user })
                }
              }
            })
          }
        } catch (error) {
          console.warn(`⚠️ Error al obtener usuarios de rol ${role}:`, error)
        }
      }
      
      console.log(`✅ Usuarios encontrados en nueva estructura: ${allUserDocs.length}`)
      
      // Filtrar solo usuarios que no sean admin (los admins no pertenecen a instituciones)
      const usersToUpdate = allUserDocs.filter(user => {
        const role = user.data?.role
        return role && ['student', 'teacher', 'principal', 'rector'].includes(role)
      })
      
      console.log(`📊 Usuarios encontrados para ${isActive ? 'activar' : 'desactivar'}: ${usersToUpdate.length}`)
      
      if (usersToUpdate.length === 0) {
        console.log('✅ No hay usuarios para actualizar')
        return
      }
      
      // Usar batch para actualizar todos los usuarios de una vez (máximo 500 por batch)
      const batchSize = 500
      const batches: any[] = []
      
      for (let i = 0; i < usersToUpdate.length; i += batchSize) {
        const batch = writeBatch(this.db)
        const chunk = usersToUpdate.slice(i, i + batchSize)
        
        chunk.forEach(user => {
          // Actualizar en nueva estructura jerárquica
          const userData = user.data
          const role = userData?.role
          const userId = user.id
          
          if (!role || !institutionId) return
          
          // Determinar la colección según el rol
          let collectionPath: string
          if (role === 'rector') {
            collectionPath = `superate/auth/institutions/${institutionId}/rectores`
          } else if (role === 'principal') {
            collectionPath = `superate/auth/institutions/${institutionId}/coordinadores`
          } else if (role === 'teacher') {
            collectionPath = `superate/auth/institutions/${institutionId}/profesores`
          } else if (role === 'student') {
            collectionPath = `superate/auth/institutions/${institutionId}/estudiantes`
          } else {
            return // Rol no válido
          }
          
          const userRef = doc(this.db, collectionPath, userId)
          const updateData: any = {
            isActive: isActive,
            updatedAt: new Date().toISOString().split('T')[0]
          }
          
          if (isActive) {
            // Si se está activando, eliminar el campo deactivatedAt si existe
            updateData.activatedAt = new Date().toISOString().split('T')[0]
          } else {
            // Si se está desactivando, agregar el campo deactivatedAt
            updateData.deactivatedAt = new Date().toISOString().split('T')[0]
          }
          
          batch.update(userRef, updateData)
        })
        
        batches.push(batch)
      }
      
      // Ejecutar todos los batches con delays entre ellos para no sobrecargar Firebase
      for (let i = 0; i < batches.length; i++) {
        let batchRetries = 3
        let batchSuccess = false
        const chunkSize = Math.min(batchSize, usersToUpdate.length - (i * batchSize))
        
        while (batchRetries > 0 && !batchSuccess) {
          try {
            await batches[i].commit()
            console.log(`✅ Batch ${i + 1}/${batches.length} completado (${chunkSize} usuarios actualizados)`)
            batchSuccess = true
            
            // Delay entre batches para no sobrecargar Firebase y dar tiempo a que se procesen
            if (i < batches.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1500)) // Aumentado a 1.5 segundos
            }
          } catch (error) {
            batchRetries--
            if (batchRetries > 0) {
              console.warn(`⚠️ Error al ejecutar batch ${i + 1}, reintentando... (${batchRetries} intentos restantes)`)
              await new Promise(resolve => setTimeout(resolve, 2000)) // Esperar 2 segundos antes de reintentar
            } else {
              console.error(`❌ Error al ejecutar batch ${i + 1} después de reintentos:`, error)
              // Continuar con los siguientes batches aunque uno falle
            }
          }
        }
      }
      
      console.log(`✅ ${usersToUpdate.length} usuario(s) ${isActive ? 'activado(s)' : 'desactivado(s)'} exitosamente`)
      
      // Esperar un momento adicional para asegurar que todas las actualizaciones se hayan propagado
      await new Promise(resolve => setTimeout(resolve, 1000))
      
    } catch (e) {
      console.error(`❌ Error al ${isActive ? 'activar' : 'desactivar'} usuarios de la institución:`, e)
      // No lanzar error para no bloquear la actualización de la institución
      // Solo loguear el error
    }
  }

  async updateInstitution(id: string, institutionData: any): Promise<Result<any>> {
    try {
      // Validar que el ID sea válido
      if (!id || typeof id !== 'string' || id.trim() === '') {
        return failure(new ErrorAPI({ 
          message: 'ID de institución inválido', 
          statusCode: 400 
        }))
      }

      console.log('🔍 Iniciando actualización de institución con ID:', id)
      console.log('📊 Datos recibidos para actualizar:', Object.keys(institutionData))
      
      // Obtener el estado actual de la institución para detectar cambios en isActive
      let currentInstitutionResult = await this.getInstitutionById(id)
      let retries = 3
      
      // Reintentar si falla la primera vez
      while (!currentInstitutionResult.success && retries > 0) {
        console.warn(`⚠️ No se pudo obtener la institución, reintentando... (${retries} intentos restantes)`)
        await new Promise(resolve => setTimeout(resolve, 1000))
        currentInstitutionResult = await this.getInstitutionById(id)
        retries--
      }
      
      if (!currentInstitutionResult.success) {
        return failure(currentInstitutionResult.error)
      }
      
      const currentInstitution = currentInstitutionResult.data
      const currentIsActive = currentInstitution?.isActive ?? true // Por defecto true si no está definido
      const newIsActive = institutionData.isActive !== undefined ? institutionData.isActive : currentIsActive
      
      // Detectar si se está cambiando el estado de activación
      const isActivationChange = newIsActive !== currentIsActive
      
      // Si hay cambio de activación, actualizar campus y grados en los datos antes de guardar
      if (isActivationChange && currentInstitution.campuses && currentInstitution.campuses.length > 0) {
        console.log(`🔄 Actualizando campus y grados en cascada: ${newIsActive ? 'activando' : 'desactivando'}`)
        institutionData.campuses = currentInstitution.campuses.map((campus: any) => ({
          ...campus,
          isActive: newIsActive,
          updatedAt: new Date().toISOString().split('T')[0],
          grades: campus.grades ? campus.grades.map((grade: any) => ({
            ...grade,
            isActive: newIsActive,
            updatedAt: new Date().toISOString().split('T')[0]
          })) : []
        }))
      } else if (!institutionData.campuses && currentInstitution.campuses) {
        // Si no se están actualizando campus, mantener los existentes
        institutionData.campuses = currentInstitution.campuses
      }
      
      // Limpiar datos recursivamente antes de guardar
      const cleanedData = this.deepCleanData(institutionData)
      
      // Validar que haya datos para actualizar
      if (!cleanedData || Object.keys(cleanedData).length === 0) {
        console.warn('⚠️ No hay datos válidos para actualizar')
        return failure(new ErrorAPI({ 
          message: 'No se proporcionaron datos válidos para actualizar', 
          statusCode: 400 
        }))
      }
      
      // Asegurar que updatedAt esté presente SIEMPRE
      cleanedData.updatedAt = new Date().toISOString().split('T')[0]
      
      console.log('📋 Campos después de limpiar:', Object.keys(cleanedData))
      console.log('📊 Total de campos a actualizar:', Object.keys(cleanedData).length)
      
      const document = doc(this.getCollection('institutions'), id)
      
      // Ejecutar actualización con reintentos
      const updateResult = await this.executeUpdateWithRetry(async () => {
        await updateDoc(document, cleanedData)
        console.log('✅ Institución guardada exitosamente en Firebase')
        return undefined
      }, 3)
      
      if (!updateResult.success) {
        return failure(updateResult.error)
      }
      
      // Construir la respuesta con los datos actualizados sin necesidad de leer de nuevo
      const updatedInstitution = {
        ...currentInstitution,
        ...cleanedData,
        id: id
      }
      
      // Retornar inmediatamente sin esperar el proceso en cascada
      const result = success(updatedInstitution)
      
      // Si se cambió el estado de activación, actualizar usuarios en cascada (completamente en segundo plano)
      if (isActivationChange) {
        console.log(`🔄 Estado de activación cambió: ${currentIsActive} → ${newIsActive}`)
        console.log(`⏳ Iniciando actualización en cascada de usuarios en segundo plano...`)
        
        // Ejecutar completamente en segundo plano sin bloquear - usar setTimeout para dar tiempo a que se complete la transacción
        setTimeout(() => {
          // Ejecutar en segundo plano sin bloquear
          this.updateUsersByInstitution(id, newIsActive)
            .then(() => {
              console.log(`✅ Proceso en cascada completado para institución ${id}`)
            })
            .catch(error => {
              console.error('❌ Error al actualizar usuarios en cascada (no crítico):', error)
            })
        }, 500) // Esperar 500ms antes de iniciar el proceso en cascada para asegurar que la transacción se complete
      }
      
      return result
    } catch (e: any) { 
      console.error('❌ Error general al actualizar institución:', e)
      
      // Manejar errores específicos
      if (e?.code === 'not-found') {
        return failure(new ErrorAPI({ 
          message: 'Institución no encontrada en la base de datos', 
          statusCode: 404 
        }))
      }
      
      if (e?.code === 'permission-denied') {
        return failure(new ErrorAPI({ 
          message: 'No tienes permisos para actualizar esta institución. Verifica que eres administrador.', 
          statusCode: 403 
        }))
      }
      
      return failure(new ErrorAPI(normalizeError(e, 'actualizar institución'))) 
    }
  }

  /**
   * Elimina una institución
   * @param {string} id - El identificador de la institución.
   * @returns {Promise<Result<void>>} Resultado de la eliminación.
   */
  async deleteInstitution(id: string): Promise<Result<void>> {
    try {
      await deleteDoc(doc(this.getCollection('institutions'), id))
      return success(undefined)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'eliminar institución'))) }
  }

  /**
   * Actualiza una institución agregando una nueva sede
   * @param {string} institutionId - El identificador de la institución.
   * @param {object} campusData - Los datos de la sede a agregar.
   * @returns {Promise<Result<any>>} La sede creada.
   */
  async addCampusToInstitution(institutionId: string, campusData: any): Promise<Result<any>> {
    try {
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const newCampus = {
        id: `${institutionId}-${Date.now()}`,
        ...campusData,
        grades: [],
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updatedCampuses = [...(institution.campuses || []), newCampus]
      const updatedInstitution = {
        ...institution,
        campuses: updatedCampuses,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        return success(newCampus)
      }
      return failure(updateResult.error)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'agregar sede a institución'))) }
  }

  /**
   * Actualiza una institución agregando un nuevo grado a una sede
   * @param {string} institutionId - El identificador de la institución.
   * @param {string} campusId - El identificador de la sede.
   * @param {object} gradeData - Los datos del grado a agregar.
   * @returns {Promise<Result<any>>} El grado creado.
   */
  async addGradeToCampus(institutionId: string, campusId: string, gradeData: any): Promise<Result<any>> {
    try {
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
      
      if (campusIndex === -1) {
        return failure(new NotFound({ message: 'Sede no encontrada' }))
      }

      const newGrade = {
        id: `${campusId}-${Date.now()}`,
        ...gradeData,
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updatedCampuses = [...institution.campuses]
      updatedCampuses[campusIndex] = {
        ...updatedCampuses[campusIndex],
        grades: [...(updatedCampuses[campusIndex].grades || []), newGrade],
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updatedInstitution = {
        ...institution,
        campuses: updatedCampuses,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        return success(newGrade)
      }
      return failure(updateResult.error)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'agregar grado a sede'))) }
  }

  /**
   * Actualiza una institución agregando un coordinador a una sede
   * @param {string} institutionId - El identificador de la institución.
   * @param {string} campusId - El identificador de la sede.
   * @param {object} principalData - Los datos del coordinador a agregar.
   * @returns {Promise<Result<any>>} El coordinador creado.
   */
  async addPrincipalToCampus(institutionId: string, campusId: string, principalData: any): Promise<Result<any>> {
    try {
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
      
      if (campusIndex === -1) {
        return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
      }

      // Usar el UID del usuario creado en Firebase Auth como ID
      const principalId = principalData.uid || principalData.id
      if (!principalId) {
        return failure(new ErrorAPI({ message: 'UID del coordinador es requerido', statusCode: 400 }))
      }
      
      const newPrincipal = {
        id: principalId,
        ...principalData,
        role: 'principal',
        studentCount: 0,
        students: [],
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      }
      
      // Limpiar valores undefined del coordinador
      const cleanedPrincipal = this.cleanUndefinedValues(newPrincipal)
      console.log('🧹 Coordinador limpiado de valores undefined')

      // Actualizar la institución agregando el coordinador a la sede
      const updatedCampuses = [...institution.campuses]
      updatedCampuses[campusIndex] = {
        ...updatedCampuses[campusIndex],
        principal: cleanedPrincipal,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updatedInstitution = {
        ...institution,
        campuses: updatedCampuses,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      console.log('🔍 Preparando para actualizar institución con coordinador...')
      console.log('📊 Coordinador creado:', newPrincipal.name)
      
      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        console.log('✅ Institución actualizada exitosamente con coordinador')
        return success(cleanedPrincipal)
      }
      console.error('❌ Error al actualizar institución:', updateResult.error)
      return failure(updateResult.error)
    } catch (e) {       return failure(new ErrorAPI(normalizeError(e, 'agregar coordinador a sede'))) }
  }

  /**
   * Actualiza un coordinador existente en una sede
   * @param {string} institutionId - El identificador de la institución.
   * @param {string} campusId - El identificador de la sede.
   * @param {string} principalId - El identificador del coordinador a actualizar.
   * @param {object} principalData - Los nuevos datos del coordinador.
   * @returns {Promise<Result<any>>} El coordinador actualizado.
   */
  async updatePrincipalInCampus(institutionId: string, campusId: string, principalId: string, principalData: any): Promise<Result<any>> {
    try {
      // Obtener la institución
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
      
      if (campusIndex === -1) {
        return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
      }

      // Verificar que el coordinador existe en la sede
      if (!institution.campuses[campusIndex].principal || institution.campuses[campusIndex].principal.id !== principalId) {
        return failure(new ErrorAPI({ message: 'Coordinador no encontrado en la sede', statusCode: 404 }))
      }

      // Filtrar campos undefined y campos que no deben actualizarse
      const fieldsToExclude = ['adminEmail', 'adminPassword', 'currentPassword', 'password']
      const cleanedPrincipalData = Object.fromEntries(
        Object.entries(principalData).filter(([key, value]) => 
          value !== undefined && !fieldsToExclude.includes(key)
        )
      ) as any

      // Si no hay datos para actualizar, retornar el coordinador actual
      if (Object.keys(cleanedPrincipalData).length === 0) {
        return success(institution.campuses[campusIndex].principal)
      }

      // Actualizar el coordinador en la sede
      const updatedCampuses = [...institution.campuses]
      updatedCampuses[campusIndex] = {
        ...updatedCampuses[campusIndex],
        principal: {
          ...updatedCampuses[campusIndex].principal,
          ...cleanedPrincipalData,
          updatedAt: new Date().toISOString().split('T')[0]
        },
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updatedInstitution = {
        ...institution,
        campuses: updatedCampuses,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        return success(updatedCampuses[campusIndex].principal)
      }
      return failure(updateResult.error)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'actualizar coordinador en sede'))) 
    }
  }

  /**
   * Elimina un coordinador de una sede específica
   * @param {string} institutionId - El identificador de la institución.
   * @param {string} campusId - El identificador de la sede.
   * @param {string} principalId - El identificador del coordinador a eliminar.
   * @returns {Promise<Result<void>>} Resultado de la eliminación.
   */
  async deletePrincipalFromCampus(institutionId: string, campusId: string, principalId: string): Promise<Result<void>> {
    try {
      // Obtener la institución
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
      
      if (campusIndex === -1) {
        return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
      }

      // Verificar que el coordinador existe en la sede
      if (!institution.campuses[campusIndex].principal || institution.campuses[campusIndex].principal.id !== principalId) {
        return failure(new ErrorAPI({ message: 'Coordinador no encontrado en la sede', statusCode: 404 }))
      }

      // Remover el coordinador de la sede
      const updatedCampuses = [...institution.campuses]
      updatedCampuses[campusIndex] = {
        ...updatedCampuses[campusIndex],
        principal: null,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updatedInstitution = {
        ...institution,
        campuses: updatedCampuses,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        return success(undefined)
      }
      return failure(updateResult.error)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'eliminar coordinador de sede'))) 
    }
  }

  /*-----------------> rectors <-----------------*/
  /**
   * Actualiza una institución agregando un rector
   * @param {string} institutionId - El identificador de la institución.
   * @param {object} rectorData - Los datos del rector a agregar.
   * @returns {Promise<Result<any>>} El rector creado.
   */
  async addRectorToInstitution(institutionId: string, rectorData: any): Promise<Result<any>> {
    try {
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data

      // Usar el UID del usuario creado en Firebase Auth como ID
      const rectorId = rectorData.uid || rectorData.id
      if (!rectorId) {
        return failure(new ErrorAPI({ message: 'UID del rector es requerido', statusCode: 400 }))
      }
      
      const newRector = {
        id: rectorId,
        ...rectorData,
        role: 'rector',
        studentCount: 0,
        students: [],
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      }
      
      // Limpiar valores undefined del rector
      const cleanedRector = this.cleanUndefinedValues(newRector)
      console.log('🧹 Rector limpiado de valores undefined')

      // Actualizar la institución agregando el rector
      const updatedInstitution = {
        ...institution,
        rector: cleanedRector,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      console.log('🔍 Preparando para actualizar institución con rector...')
      console.log('📊 Rector creado:', newRector.name)
      
      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        console.log('✅ Institución actualizada exitosamente con rector')
        return success(cleanedRector)
      }
      console.error('❌ Error al actualizar institución:', updateResult.error)
      return failure(updateResult.error)
    } catch (e) {       
      return failure(new ErrorAPI(normalizeError(e, 'agregar rector a institución'))) 
    }
  }

  /**
   * Actualiza un rector existente en una institución
   * @param {string} institutionId - El identificador de la institución.
   * @param {string} rectorId - El identificador del rector a actualizar.
   * @param {object} rectorData - Los nuevos datos del rector.
   * @returns {Promise<Result<any>>} El rector actualizado.
   */
  async updateRectorInInstitution(institutionId: string, rectorId: string, rectorData: any): Promise<Result<any>> {
    try {
      // Obtener la institución
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data

      // Verificar que el rector existe en la institución
      if (!institution.rector || institution.rector.id !== rectorId) {
        return failure(new ErrorAPI({ message: 'Rector no encontrado en la institución', statusCode: 404 }))
      }

      // Filtrar campos undefined y campos que no deben actualizarse
      const fieldsToExclude = ['adminEmail', 'adminPassword', 'currentPassword', 'password']
      const cleanedRectorData = Object.fromEntries(
        Object.entries(rectorData).filter(([key, value]) => 
          value !== undefined && !fieldsToExclude.includes(key)
        )
      ) as any

      // Si no hay datos para actualizar, retornar el rector actual
      if (Object.keys(cleanedRectorData).length === 0) {
        return success(institution.rector)
      }

      // Actualizar el rector en la institución
      const updatedInstitution = {
        ...institution,
        rector: {
          ...institution.rector,
          ...cleanedRectorData,
          updatedAt: new Date().toISOString().split('T')[0]
        },
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        return success(updatedInstitution.rector)
      }
      return failure(updateResult.error)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'actualizar rector en institución'))) 
    }
  }

  /**
   * Elimina un rector de una institución específica
   * @param {string} institutionId - El identificador de la institución.
   * @param {string} rectorId - El identificador del rector a eliminar.
   * @returns {Promise<Result<void>>} Resultado de la eliminación.
   */
  async deleteRectorFromInstitution(institutionId: string, rectorId: string): Promise<Result<void>> {
    try {
      // Obtener la institución
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data

      // Verificar que el rector existe en la institución
      if (!institution.rector || institution.rector.id !== rectorId) {
        return failure(new ErrorAPI({ message: 'Rector no encontrado en la institución', statusCode: 404 }))
      }

      // Remover el rector de la institución
      const updatedInstitution = {
        ...institution,
        rector: null,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        return success(undefined)
      }
      return failure(updateResult.error)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'eliminar rector de institución'))) 
    }
  }

  /*-----------------> teachers <-----------------*/
  /**
   * Obtiene todos los docentes (incluyendo los almacenados en grados)
   * @returns {Promise<Result<any[]>>} Una lista de docentes.
   */
  async getAllTeachers(): Promise<Result<any[]>> {
    try {
      // Obtener docentes de la colección tradicional
      const snapshot = await getDocs(this.getCollection('teachers'))
      const traditionalTeachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Obtener docentes de los grados
      const institutionsResult = await this.getAllInstitutions()
      if (!institutionsResult.success) {
        return failure(institutionsResult.error)
      }

      const gradeTeachers: any[] = []
      institutionsResult.data.forEach((institution: any) => {
        institution.campuses.forEach((campus: any) => {
          campus.grades.forEach((grade: any) => {
            if (grade.teachers && grade.teachers.length > 0) {
              gradeTeachers.push(...grade.teachers.map((teacher: any) => ({
                ...teacher,
                institutionId: institution.id,
                campusId: campus.id,
                gradeId: grade.id,
                institutionName: institution.name,
                campusName: campus.name,
                gradeName: grade.name
              })))
            }
          })
        })
      })

      // Combinar ambos tipos de docentes
      const allTeachers = [...traditionalTeachers, ...gradeTeachers]
      return success(allTeachers)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener docentes'))) }
  }

  /**
   * Obtiene un docente por ID
   * @param {string} id - El identificador del docente.
   * @returns {Promise<Result<any>>} Un docente.
   */
  async getTeacherById(id: string): Promise<Result<any>> {
    try {
      const docSnap = await getDoc(doc(this.getCollection('teachers'), id))
      if (!docSnap.exists()) return failure(new NotFound({ message: 'Docente no encontrado' }))
      return success({ id: docSnap.id, ...docSnap.data() })
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener docente'))) }
  }

  /**
   * Crea un nuevo docente
   * @param {object} teacherData - Los datos del docente a crear.
   * @returns {Promise<Result<any>>} El docente creado.
   */
  async createTeacher(teacherData: any): Promise<Result<any>> {
    try {
      const docRef = doc(this.getCollection('teachers'))
      const teacherWithId = {
        ...teacherData,
        id: docRef.id,
        role: 'teacher',
        studentCount: 0,
        students: [],
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      }
      await setDoc(docRef, teacherWithId)
      return success(teacherWithId)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'crear docente'))) }
  }

  /**
   * Crea un nuevo docente dentro de un grado específico
   * @param {object} teacherData - Los datos del docente a crear.
   * @returns {Promise<Result<any>>} El docente creado.
   */
  async createTeacherInGrade(teacherData: any): Promise<Result<any>> {
    try {
      const { institutionId, campusId, gradeId } = teacherData
      
      // Obtener la institución
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
      
      if (campusIndex === -1) {
        return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
      }

      const gradeIndex = institution.campuses[campusIndex].grades.findIndex((g: any) => g.id === gradeId)
      if (gradeIndex === -1) {
        return failure(new ErrorAPI({ message: 'Grado no encontrado', statusCode: 404 }))
      }

      // Usar el UID del usuario creado en Firebase Auth como ID
      const teacherId = teacherData.uid || teacherData.id
      if (!teacherId) {
        return failure(new ErrorAPI({ message: 'UID del docente es requerido', statusCode: 400 }))
      }
      
      const newTeacher = {
        id: teacherId,
        ...teacherData,
        role: 'teacher',
        studentCount: 0,
        students: [],
        createdAt: new Date().toISOString().split('T')[0],
        updatedAt: new Date().toISOString().split('T')[0]
      }
      
      // Limpiar valores undefined del docente
      const cleanedTeacher = this.cleanUndefinedValues(newTeacher)
      console.log('🧹 Docente limpiado de valores undefined')

      // Actualizar la institución agregando el docente al grado
      const updatedCampuses = [...institution.campuses]
      const updatedGrades = [...updatedCampuses[campusIndex].grades]
      updatedGrades[gradeIndex] = {
        ...updatedGrades[gradeIndex],
        teachers: [...(updatedGrades[gradeIndex].teachers || []), cleanedTeacher],
        updatedAt: new Date().toISOString().split('T')[0]
      }

      updatedCampuses[campusIndex] = {
        ...updatedCampuses[campusIndex],
        grades: updatedGrades,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updatedInstitution = {
        ...institution,
        campuses: updatedCampuses,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      console.log('🔍 Preparando para actualizar institución...')
      console.log('📊 Docente creado:', newTeacher.name)
      console.log('📊 Total de docentes en el grado:', updatedGrades[gradeIndex].teachers.length)
      
      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        console.log('✅ Institución actualizada exitosamente')
        return success(cleanedTeacher)
      }
      console.error('❌ Error al actualizar institución:', updateResult.error)
      return failure(updateResult.error)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'crear docente en grado'))) }
  }

  /**
   * Actualiza un docente existente
   * @param {string} id - El identificador del docente.
   * @param {object} teacherData - Los nuevos datos del docente.
   * @returns {Promise<Result<any>>} El docente actualizado.
   */
  async updateTeacher(id: string, teacherData: any): Promise<Result<any>> {
    try {
      const document = doc(this.getCollection('teachers'), id)
      const updatedData = {
        ...teacherData,
        updatedAt: new Date().toISOString().split('T')[0]
      }
      await updateDoc(document, updatedData)
      const updatedTeacher = await this.getTeacherById(id)
      return updatedTeacher
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'actualizar docente'))) }
  }

  /**
   * Elimina un docente
   * @param {string} id - El identificador del docente.
   * @returns {Promise<Result<void>>} Resultado de la eliminación.
   */
  async deleteTeacher(id: string): Promise<Result<void>> {
    try {
      await deleteDoc(doc(this.getCollection('teachers'), id))
      return success(undefined)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'eliminar docente'))) }
  }

  /**
   * Elimina un docente de un grado específico
   * @param {string} institutionId - El identificador de la institución.
   * @param {string} campusId - El identificador de la sede.
   * @param {string} gradeId - El identificador del grado.
   * @param {string} teacherId - El identificador del docente a eliminar.
   * @returns {Promise<Result<void>>} Resultado de la eliminación.
   */
  async deleteTeacherFromGrade(institutionId: string, campusId: string, gradeId: string, teacherId: string): Promise<Result<void>> {
    try {
      // Obtener la institución
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
      
      if (campusIndex === -1) {
        return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
      }

      const gradeIndex = institution.campuses[campusIndex].grades.findIndex((g: any) => g.id === gradeId)
      if (gradeIndex === -1) {
        return failure(new ErrorAPI({ message: 'Grado no encontrado', statusCode: 404 }))
      }

      // Verificar que el docente existe en el grado
      const teachers = institution.campuses[campusIndex].grades[gradeIndex].teachers || []
      const teacherIndex = teachers.findIndex((t: any) => t.id === teacherId)
      if (teacherIndex === -1) {
        return failure(new ErrorAPI({ message: 'Docente no encontrado en el grado', statusCode: 404 }))
      }

      // Remover el docente del grado
      const updatedCampuses = [...institution.campuses]
      const updatedGrades = [...updatedCampuses[campusIndex].grades]
      updatedGrades[gradeIndex] = {
        ...updatedGrades[gradeIndex],
        teachers: teachers.filter((t: any) => t.id !== teacherId),
        updatedAt: new Date().toISOString().split('T')[0]
      }

      updatedCampuses[campusIndex] = {
        ...updatedCampuses[campusIndex],
        grades: updatedGrades,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updatedInstitution = {
        ...institution,
        campuses: updatedCampuses,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        return success(undefined)
      }
      return failure(updateResult.error)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'eliminar docente del grado'))) 
    }
  }

  /**
   * Actualiza un docente dentro de un grado específico
   * @param {string} institutionId - El identificador de la institución.
   * @param {string} campusId - El identificador de la sede.
   * @param {string} gradeId - El identificador del grado.
   * @param {string} teacherId - El identificador del docente a actualizar.
   * @param {object} teacherData - Los nuevos datos del docente.
   * @returns {Promise<Result<any>>} El docente actualizado.
   */
  async updateTeacherInGrade(institutionId: string, campusId: string, gradeId: string, teacherId: string, teacherData: any): Promise<Result<any>> {
    try {
      // Obtener la institución
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const campusIndex = institution.campuses.findIndex((c: any) => c.id === campusId)
      
      if (campusIndex === -1) {
        return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
      }

      const gradeIndex = institution.campuses[campusIndex].grades.findIndex((g: any) => g.id === gradeId)
      if (gradeIndex === -1) {
        return failure(new ErrorAPI({ message: 'Grado no encontrado', statusCode: 404 }))
      }

      // Verificar que el docente existe en el grado
      const teachers = institution.campuses[campusIndex].grades[gradeIndex].teachers || []
      const teacherIndex = teachers.findIndex((t: any) => t.id === teacherId)
      if (teacherIndex === -1) {
        return failure(new ErrorAPI({ message: 'Docente no encontrado en el grado', statusCode: 404 }))
      }

      // Filtrar campos undefined y campos que no deben actualizarse
      const fieldsToExclude = ['adminEmail', 'adminPassword', 'currentPassword', 'password']
      const cleanedTeacherData = Object.fromEntries(
        Object.entries(teacherData).filter(([key, value]) => 
          value !== undefined && !fieldsToExclude.includes(key)
        )
      ) as any

      // Si no hay datos para actualizar, retornar el docente actual
      if (Object.keys(cleanedTeacherData).length === 0) {
        return success(teachers[teacherIndex])
      }

      // Actualizar el docente en el grado
      const updatedCampuses = [...institution.campuses]
      const updatedGrades = [...updatedCampuses[campusIndex].grades]
      const updatedTeachers = [...teachers]
      
      updatedTeachers[teacherIndex] = {
        ...updatedTeachers[teacherIndex],
        ...cleanedTeacherData,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      updatedGrades[gradeIndex] = {
        ...updatedGrades[gradeIndex],
        teachers: updatedTeachers,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      updatedCampuses[campusIndex] = {
        ...updatedCampuses[campusIndex],
        grades: updatedGrades,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updatedInstitution = {
        ...institution,
        campuses: updatedCampuses,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      const updateResult = await this.updateInstitution(institutionId, updatedInstitution)
      if (updateResult.success) {
        return success(updatedTeachers[teacherIndex])
      }
      return failure(updateResult.error)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'actualizar docente en grado'))) 
    }
  }

  /**
   * Obtiene docentes por institución (incluyendo los de grados)
   * @param {string} institutionId - El identificador de la institución.
   * @returns {Promise<Result<any[]>>} Lista de docentes de la institución.
   */
  async getTeachersByInstitution(institutionId: string): Promise<Result<any[]>> {
    try {
      // Obtener docentes de la colección tradicional
      const queryRef = query(
        this.getCollection('teachers'),
        where('institutionId', '==', institutionId)
      )
      const snapshot = await getDocs(queryRef)
      const traditionalTeachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Obtener docentes de los grados de la institución
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const gradeTeachers: any[] = []
      institutionResult.data.campuses.forEach((campus: any) => {
        campus.grades.forEach((grade: any) => {
          if (grade.teachers && grade.teachers.length > 0) {
            gradeTeachers.push(...grade.teachers.map((teacher: any) => ({
              ...teacher,
              institutionId: institutionResult.data.id,
              campusId: campus.id,
              gradeId: grade.id,
              institutionName: institutionResult.data.name,
              campusName: campus.name,
              gradeName: grade.name,
              studentCount: (grade.students || []).length // Contar estudiantes reales del grado
            })))
          }
        })
      })

      // Enriquecer docentes tradicionales con nombres
      const enrichedTraditionalTeachers = traditionalTeachers.map((teacher: any) => ({
        ...teacher,
        institutionName: institutionResult.data.name,
        campusName: teacher.campusId ? 
          institutionResult.data.campuses.find((c: any) => c.id === teacher.campusId)?.name || teacher.campusId :
          'N/A',
        gradeName: teacher.gradeId ?
          institutionResult.data.campuses
            .flatMap((c: any) => c.grades)
            .find((g: any) => g.id === teacher.gradeId)?.name || teacher.gradeId :
          'N/A'
      }))

      // Combinar ambos tipos de docentes
      const allTeachers = [...enrichedTraditionalTeachers, ...gradeTeachers]
      return success(allTeachers)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener docentes por institución'))) }
  }

  /**
   * Obtiene docentes por sede (incluyendo los de grados)
   * @param {string} campusId - El identificador de la sede.
   * @returns {Promise<Result<any[]>>} Lista de docentes de la sede.
   */
  async getTeachersByCampus(campusId: string): Promise<Result<any[]>> {
    try {
      // Obtener docentes de la colección tradicional
      const queryRef = query(
        this.getCollection('teachers'),
        where('campusId', '==', campusId)
      )
      const snapshot = await getDocs(queryRef)
      const traditionalTeachers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))

      // Obtener docentes de los grados de la sede
      const institutionsResult = await this.getAllInstitutions()
      if (!institutionsResult.success) {
        return failure(institutionsResult.error)
      }

      const gradeTeachers: any[] = []
      let campusInfo: any = null
      let institutionInfo: any = null

      institutionsResult.data.forEach((institution: any) => {
        const campus = institution.campuses.find((c: any) => c.id === campusId)
        if (campus) {
          campusInfo = campus
          institutionInfo = institution
          campus.grades.forEach((grade: any) => {
            if (grade.teachers && grade.teachers.length > 0) {
              gradeTeachers.push(...grade.teachers.map((teacher: any) => ({
                ...teacher,
                institutionId: institution.id,
                campusId: campus.id,
                gradeId: grade.id,
                institutionName: institution.name,
                campusName: campus.name,
                gradeName: grade.name,
                studentCount: (grade.students || []).length // Contar estudiantes reales del grado
              })))
            }
          })
        }
      })

      // Enriquecer docentes tradicionales con nombres
      const enrichedTraditionalTeachers = traditionalTeachers.map((teacher: any) => ({
        ...teacher,
        institutionName: institutionInfo?.name || teacher.institutionId,
        campusName: campusInfo?.name || teacher.campusId,
        gradeName: teacher.gradeId ?
          campusInfo?.grades.find((g: any) => g.id === teacher.gradeId)?.name || teacher.gradeId :
          'N/A'
      }))

      // Combinar ambos tipos de docentes
      const allTeachers = [...enrichedTraditionalTeachers, ...gradeTeachers]
      return success(allTeachers)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener docentes por sede'))) }
  }

  /**
   * Obtiene docentes por grado específico
   * @param {string} institutionId - El identificador de la institución.
   * @param {string} campusId - El identificador de la sede.
   * @param {string} gradeId - El identificador del grado.
   * @returns {Promise<Result<any[]>>} Lista de docentes del grado.
   */
  async getTeachersByGrade(institutionId: string, campusId: string, gradeId: string): Promise<Result<any[]>> {
    try {
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const campus = institution.campuses.find((c: any) => c.id === campusId)
      
      if (!campus) {
        return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
      }

      const grade = campus.grades.find((g: any) => g.id === gradeId)
      if (!grade) {
        return failure(new ErrorAPI({ message: 'Grado no encontrado', statusCode: 404 }))
      }

      // Enriquecer los docentes del grado con nombres y contador de estudiantes
      const enrichedTeachers = (grade.teachers || []).map((teacher: any) => ({
        ...teacher,
        institutionId: institution.id,
        campusId: campus.id,
        gradeId: grade.id,
        institutionName: institution.name,
        campusName: campus.name,
        gradeName: grade.name,
        studentCount: (grade.students || []).length // Contar estudiantes reales del grado
      }))

      return success(enrichedTeachers)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener docentes por grado'))) }
  }
  /*----------------------------------------------------*/

  /*-----------------> students <-----------------*/
  /**
   * Obtiene estudiantes filtrados por criterios específicos
   * NUEVA ESTRUCTURA: Busca primero en la nueva estructura jerárquica, luego combina con la antigua
   * @param {object} filters - Filtros para la búsqueda
   * @returns {Promise<Result<any[]>>} Lista de estudiantes filtrados
   */
  async getFilteredStudents(filters: any): Promise<Result<any[]>> {
    try {
      let allStudents: any[] = []
      const studentIds = new Set<string>()

      // PRIMERO: Buscar estudiantes en la nueva estructura jerárquica
      try {
        if (filters.institutionId) {
          // Obtener estudiantes de la institución específica desde la nueva estructura
          const studentsResult = await this.getUsersByInstitutionFromNewStructure(filters.institutionId, 'student')
          if (studentsResult.success) {
            studentsResult.data.forEach((student: any) => {
              if (!studentIds.has(student.id)) {
                // Aplicar filtros en memoria
                let matches = true

                if (filters.campusId) {
                  const studentCampus = student.campus || student.campusId
                  if (studentCampus !== filters.campusId) {
                    matches = false
                  }
                }
                if (filters.gradeId) {
                  const studentGrade = student.grade || student.gradeId
                  if (studentGrade !== filters.gradeId) {
                    matches = false
                  }
                }
                if (filters.jornada && student.jornada !== filters.jornada) {
                  matches = false
                }
                if (filters.isActive !== undefined && student.isActive !== filters.isActive) {
                  matches = false
                }
                if (filters.searchTerm) {
                  const searchTerm = filters.searchTerm.toLowerCase()
                  const matchesSearch = 
                    student.name?.toLowerCase().includes(searchTerm) ||
                    student.email?.toLowerCase().includes(searchTerm)
                  if (!matchesSearch) {
                    matches = false
                  }
                }

                if (matches) {
                  allStudents.push(student)
                  studentIds.add(student.id)
                }
              }
            })
          }
        } else {
          // Sin institutionId: limitar carga para evitar exceso de lecturas y memoria (máx 500)
          const MAX_STUDENTS_WITHOUT_INSTITUTION = 500
          const institutionsResult = await this.getAllInstitutions()
          if (institutionsResult.success) {
            for (const inst of institutionsResult.data) {
              if (allStudents.length >= MAX_STUDENTS_WITHOUT_INSTITUTION) break
              const studentsResult = await this.getUsersByInstitutionFromNewStructure(inst.id, 'student')
              if (!studentsResult.success) continue
              for (const student of studentsResult.data) {
                if (allStudents.length >= MAX_STUDENTS_WITHOUT_INSTITUTION) break
                if (studentIds.has(student.id)) continue
                let matches = true
                if (filters.campusId && (student.campus || student.campusId) !== filters.campusId) matches = false
                if (filters.gradeId && (student.grade || student.gradeId) !== filters.gradeId) matches = false
                if (filters.jornada && student.jornada !== filters.jornada) matches = false
                if (filters.isActive !== undefined && student.isActive !== filters.isActive) matches = false
                if (filters.searchTerm) {
                  const term = filters.searchTerm.toLowerCase()
                  if (!student.name?.toLowerCase().includes(term) && !student.email?.toLowerCase().includes(term)) matches = false
                }
                if (matches) {
                  allStudents.push(student)
                  studentIds.add(student.id)
                }
              }
            }
            if (allStudents.length >= MAX_STUDENTS_WITHOUT_INSTITUTION) {
              logger.warn('getFilteredStudents: resultado limitado a', MAX_STUDENTS_WITHOUT_INSTITUTION, '(sin institutionId). Use institutionId para listados completos.')
            }
          }
        }
      } catch (error) {
        // Error al obtener estudiantes de nueva estructura
      }

      // La estructura antigua ha sido eliminada - solo usar nueva estructura
      
      // Aplicar filtro de búsqueda por texto si se proporciona (si no se aplicó ya en el loop)
      if (filters.searchTerm && !filters.institutionId) {
        const searchTerm = filters.searchTerm.toLowerCase()
        allStudents = allStudents.filter((student: any) => 
          student.name?.toLowerCase().includes(searchTerm) ||
          student.email?.toLowerCase().includes(searchTerm)
        )
      }

      let students = allStudents

      // OPTIMIZADO: Enriquecer datos usando caché para evitar múltiples llamadas
      // Agrupar estudiantes por institución para hacer una sola llamada por institución
      const institutionCache = new Map<string, any>()
      
      const enrichedStudents = await Promise.all(
        students.map(async (student: any) => {
          try {
            const institutionId = student.inst || student.institutionId
            const campusId = student.campus || student.campusId
            const gradeId = student.grade || student.gradeId
            
            let institutionName = institutionId
            let campusName = campusId
            let gradeName = gradeId
            
            // Solo enriquecer si tenemos IDs válidos
            if (institutionId) {
              // Usar caché para evitar llamadas duplicadas
              if (!institutionCache.has(institutionId)) {
                try {
                  const institutionDoc = await getDoc(doc(this.getCollection('institutions'), institutionId))
                  if (institutionDoc.exists()) {
                    institutionCache.set(institutionId, institutionDoc.data())
                  }
                } catch (error: any) {
                  // Si es error de cuota, no intentar más
                  if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
                    console.warn('⚠️ Cuota excedida, omitiendo enriquecimiento de datos')
                    return student // Retornar sin enriquecer
                  }
                }
              }
              
              const institutionData = institutionCache.get(institutionId)
              if (institutionData) {
                institutionName = institutionData.name || institutionId
                
                // Buscar sede y grado en los datos cacheados
                if (campusId && institutionData.campuses && Array.isArray(institutionData.campuses)) {
                  const campus = institutionData.campuses.find((c: any) => c.id === campusId)
                  if (campus) {
                    campusName = campus.name || campusId
                    
                    if (gradeId && campus.grades && Array.isArray(campus.grades)) {
                      const grade = campus.grades.find((g: any) => g.id === gradeId)
                      if (grade) {
                        gradeName = grade.name || gradeId
                      }
                    }
                  }
                }
              }
            }

            return {
              ...student,
              institutionName,
              campusName,
              gradeName
            }
          } catch (error: any) {
            // Si es error de cuota, retornar sin enriquecer
            if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
              return student
            }
            console.warn(`Error al enriquecer datos del estudiante ${student.id}:`, error)
            return student
          }
        })
      )

      return success(enrichedStudents)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'obtener estudiantes filtrados'))) 
    }
  }

  /**
   * Enriquece los datos de un usuario con nombres de institución, sede y grado.
   * Optimizado: una sola lectura del documento de institución para todo.
   */
  async enrichUserData(user: any): Promise<Result<any>> {
    try {
      let institutionName = user.inst || user.institutionId
      let campusName = user.campus || user.campusId
      let gradeName = user.grade || user.gradeId
      const institutionId = user.inst || user.institutionId
      const campusId = user.campus || user.campusId
      const gradeId = user.grade || user.gradeId

      if (!institutionId) {
        return success({ ...user, institutionName, campusName, gradeName })
      }

      // Una sola lectura del documento de institución
      const institutionDoc = await getDoc(doc(this.getCollection('institutions'), institutionId))
      if (!institutionDoc.exists()) {
        return success({ ...user, institutionName, campusName, gradeName })
      }

      const institutionData = institutionDoc.data()
      institutionName = institutionData.name || institutionId

      if (campusId && institutionData.campuses && Array.isArray(institutionData.campuses)) {
        const campus = institutionData.campuses.find((c: any) => c.id === campusId)
        if (campus) {
          campusName = campus.name || campusId
          if (gradeId && campus.grades && Array.isArray(campus.grades)) {
            const grade = campus.grades.find((g: any) => g.id === gradeId)
            if (grade) gradeName = grade.name || gradeId
          }
        }
      }

      return success({
        ...user,
        institutionName,
        campusName,
        gradeName,
      })
    } catch (error) {
      logger.warn('Error al enriquecer datos del usuario:', user?.id, error)
      return failure(new ErrorAPI(normalizeError(error, 'enriquecer datos del usuario')))
    }
  }

  /**
   * Obtiene estudiantes asignados a un docente específico
   * @param {string} teacherId - ID del docente
   * @returns {Promise<Result<any[]>>} Lista de estudiantes del docente
   */
  async getStudentsByTeacher(teacherId: string): Promise<Result<any[]>> {
    try {
      logger.debug('getStudentsByTeacher:', teacherId)
      
      // Obtener información del docente para saber su institución, sede y grado
      // Usar getUserById para obtener desde la nueva estructura jerárquica (incluye jornada)
      const teacherResult = await this.getUserById(teacherId)
      if (!teacherResult.success) {
        console.error('❌ getStudentsByTeacher - Error al obtener docente:', teacherResult.error)
        return failure(teacherResult.error)
      }

      const teacher = teacherResult.data
      
      // Verificar que sea un docente
      if (teacher.role !== 'teacher') {
        console.error('❌ getStudentsByTeacher - El usuario no es un docente:', teacher.role)
        return failure(new ErrorAPI({ message: 'El usuario no es un docente', statusCode: 400 }))
      }
      
      // Obtener jornada del docente - verificar múltiples ubicaciones posibles
      // IMPORTANTE: Verificar directamente en el objeto teacher sin asumir estructura
      let teacherJornada = (teacher as any).jornada
      
      // Si no está en la raíz, verificar en otros lugares posibles
      if (!teacherJornada) {
        teacherJornada = (teacher as any).jornada || undefined
      }
      
      // Normalizar jornada si existe (trim y verificar que no esté vacío)
      if (teacherJornada && typeof teacherJornada === 'string') {
        teacherJornada = teacherJornada.trim()
        if (teacherJornada === '') {
          teacherJornada = undefined
        }
      }
      
      console.log('👨‍🏫 getStudentsByTeacher - Datos del docente COMPLETOS:', {
        name: teacher.name,
        institutionId: teacher.institutionId,
        campusId: teacher.campusId,
        gradeId: teacher.gradeId,
        jornada: teacherJornada || 'NO DEFINIDA',
        jornadaType: typeof teacherJornada,
        jornadaValue: teacherJornada,
        // También verificar campos alternativos
        inst: teacher.inst,
        campus: teacher.campus,
        grade: teacher.grade,
        // Debug: mostrar todos los campos del docente para verificar si jornada está presente
        allFields: Object.keys(teacher),
        // Verificar si jornada está en el objeto
        hasJornadaField: 'jornada' in teacher,
        jornadaInObject: (teacher as any).jornada,
        // Mostrar el objeto completo del docente para debug
        teacherObject: JSON.parse(JSON.stringify(teacher)) // Serializar para ver todos los campos
      })
      
      // Advertencia si el docente no tiene jornada
      if (!teacherJornada || teacherJornada.trim() === '') {
        console.error(`❌ ERROR CRÍTICO: El docente "${teacher.name}" NO tiene jornada definida. Se mostrarán TODOS los estudiantes del grado sin filtrar por jornada.`)
        console.error(`❌ Verificar en Firestore que el documento del docente tenga el campo "jornada" con valor "mañana", "tarde" o "única".`)
        console.error(`❌ Ruta esperada: superate/auth/institutions/{institutionId}/profesores/{teacherId}`)
      } else {
        console.log(`✅ Docente tiene jornada definida: "${teacherJornada}"`)
      }
      
      // Validar que la jornada sea válida
      if (teacherJornada && !['mañana', 'tarde', 'única'].includes(teacherJornada)) {
        console.warn(`⚠️ Jornada del docente no es válida: "${teacherJornada}". Se tratará como sin jornada.`)
      }
      
      // Usar los campos correctos (pueden ser inst/campus/grade o institutionId/campusId/gradeId)
      const institutionId = teacher.institutionId || teacher.inst
      const campusId = teacher.campusId || teacher.campus
      const gradeId = teacher.gradeId || teacher.grade
      
      // Preparar filtros para estudiantes
      const filters: any = {
        institutionId: institutionId,
        campusId: campusId,
        gradeId: gradeId,
        isActive: true
      }
      
      // NO agregar filtro de jornada aquí - lo haremos después en memoria para tener control total
      // Esto asegura que el filtro funcione correctamente sin depender de getFilteredStudents
      
      console.log('🔍 getStudentsByTeacher - Filtros a aplicar:', filters)
      
      // Buscar estudiantes que coincidan con la institución, sede y grado del docente
      // NO incluir filtro de jornada aquí, lo haremos después para tener control total
      const studentsResult = await this.getFilteredStudents(filters)
      
      // Filtrar estudiantes por jornada según la jornada del docente
      let filteredStudents = studentsResult.success ? studentsResult.data : []
      
      if (studentsResult.success) {
        const beforeCount = studentsResult.data.length
        
        // Verificar si el docente tiene jornada definida y válida
        const hasValidJornada = teacherJornada && 
                                typeof teacherJornada === 'string' && 
                                teacherJornada.trim() !== '' && 
                                teacherJornada !== 'única'
        
        if (hasValidJornada) {
          // Si el docente tiene jornada específica (mañana/tarde), solo mostrar estudiantes con esa jornada exacta
          console.log(`🔍 FILTRANDO por jornada: docente tiene jornada "${teacherJornada}"`)
          
          // Normalizar jornadas para comparación (trim y lowercase para evitar problemas de formato)
          const normalizedTeacherJornada = teacherJornada.trim().toLowerCase()
          
          // Contar estudiantes por jornada antes del filtro
          const jornadaCountsBefore: Record<string, number> = {}
          studentsResult.data.forEach((s: any) => {
            const j = s.jornada || 'sin jornada'
            jornadaCountsBefore[j] = (jornadaCountsBefore[j] || 0) + 1
          })
          console.log(`📊 Estudiantes por jornada ANTES del filtro:`, jornadaCountsBefore)
          
          // Filtrar estrictamente por jornada exacta
          filteredStudents = studentsResult.data.filter((student: any) => {
            const studentJornada = student.jornada
            if (!studentJornada || typeof studentJornada !== 'string') {
              // Excluir estudiantes sin jornada
              return false
            }
            
            const normalizedStudentJornada = studentJornada.trim().toLowerCase()
            
            // Comparación estricta: deben ser exactamente iguales
            const matches = normalizedStudentJornada === normalizedTeacherJornada
            
            return matches
          })
          
          // Contar estudiantes por jornada después del filtro
          const jornadaCountsAfter: Record<string, number> = {}
          filteredStudents.forEach((s: any) => {
            const j = s.jornada || 'sin jornada'
            jornadaCountsAfter[j] = (jornadaCountsAfter[j] || 0) + 1
          })
          console.log(`📊 Estudiantes por jornada DESPUÉS del filtro:`, jornadaCountsAfter)
          
          console.log(`✅ FILTRADO COMPLETADO: docente="${teacherJornada}", estudiantes antes=${beforeCount}, después=${filteredStudents.length}`)
          
          // Validación final: verificar que ningún estudiante tenga jornada incorrecta
          const incorrectJornada = filteredStudents.filter((s: any) => {
            if (!s.jornada) return false
            const sJornada = s.jornada.trim().toLowerCase()
            const tJornada = normalizedTeacherJornada
            return sJornada !== tJornada
          })
          
          if (incorrectJornada.length > 0) {
            console.error(`❌ ERROR CRÍTICO: Se encontraron ${incorrectJornada.length} estudiantes con jornada incorrecta después del filtro`)
            incorrectJornada.forEach((s: any) => {
              console.error(`  - ${s.name || s.email}: jornada="${s.jornada}" (debería ser "${teacherJornada}")`)
            })
            // Filtrar nuevamente para asegurar que solo queden estudiantes con jornada correcta
            filteredStudents = filteredStudents.filter((s: any) => {
              if (!s.jornada) return false
              const sJornada = s.jornada.trim().toLowerCase()
              const tJornada = normalizedTeacherJornada
              return sJornada === tJornada
            })
            console.log(`✅ Re-filtrado completado: ${filteredStudents.length} estudiantes con jornada correcta`)
          }
        } else {
          // Si el docente tiene jornada 'única' o no tiene jornada, mostrar todos los estudiantes del grado
          console.log(`⚠️ Docente sin jornada específica (jornada: "${teacherJornada || 'no definida'}"). Mostrando TODOS los estudiantes del grado sin filtrar por jornada.`)
          console.log(`📊 Total estudiantes del grado: ${beforeCount}`)
          
          // Contar estudiantes por jornada para información
          const jornadaCounts: Record<string, number> = {}
          studentsResult.data.forEach((s: any) => {
            const j = s.jornada || 'sin jornada'
            jornadaCounts[j] = (jornadaCounts[j] || 0) + 1
          })
          console.log(`📊 Estudiantes por jornada:`, jornadaCounts)
          
          filteredStudents = studentsResult.data
        }
      }

      // Validación final: verificar que ningún estudiante tenga jornada incorrecta
      if (teacherJornada && teacherJornada !== 'única' && filteredStudents.length > 0) {
        const incorrectJornadaStudents = filteredStudents.filter((s: any) => {
          const sJornada = s.jornada?.trim().toLowerCase()
          const tJornada = teacherJornada.trim().toLowerCase()
          return sJornada && sJornada !== tJornada
        })
        
        if (incorrectJornadaStudents.length > 0) {
          console.error(`❌ ERROR CRÍTICO: Se encontraron ${incorrectJornadaStudents.length} estudiantes con jornada incorrecta después del filtro`)
          incorrectJornadaStudents.forEach((s: any) => {
            console.error(`  - ${s.name || s.email}: jornada="${s.jornada}" (debería ser "${teacherJornada}")`)
          })
          // Filtrar nuevamente para asegurar que solo queden estudiantes con jornada correcta
          filteredStudents = filteredStudents.filter((s: any) => {
            const sJornada = s.jornada?.trim().toLowerCase()
            const tJornada = teacherJornada.trim().toLowerCase()
            return sJornada === tJornada
          })
        }
      }
      
      console.log('✅ getStudentsByTeacher - Resultado FINAL:', {
        success: studentsResult.success,
        countBeforeFilter: studentsResult.success ? studentsResult.data.length : 0,
        countAfterFilter: filteredStudents.length,
        teacherJornada: teacherJornada || 'no especificada',
        teacherName: teacher.name,
        jornadasEstudiantes: filteredStudents.map((s: any) => s.jornada).filter((j: any) => j)
      })

      if (!studentsResult.success) {
        return studentsResult
      }

      return success(filteredStudents)
    } catch (e) { 
      console.error('❌ getStudentsByTeacher - Excepción:', e)
      return failure(new ErrorAPI(normalizeError(e, 'obtener estudiantes por docente'))) 
    }
  }

  /**
   * Obtiene estudiantes asignados a un coordinador específico
   * @param {string} principalId - ID del coordinador
   * @returns {Promise<Result<any[]>>} Lista de estudiantes del coordinador
   */
  async getStudentsByPrincipal(principalId: string): Promise<Result<any[]>> {
    try {
      // Obtener información del coordinador para saber su institución y sede
      const principalResult = await this.getPrincipalById(principalId)
      if (!principalResult.success) {
        return failure(principalResult.error)
      }

      const principal = principalResult.data
      
      // Buscar estudiantes que coincidan con la institución y sede del coordinador
      const studentsResult = await this.getFilteredStudents({
        institutionId: principal.institutionId,
        campusId: principal.campusId,
        isActive: true
      })

      return studentsResult
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'obtener estudiantes por coordinador'))) 
    }
  }

  /**
   * Obtiene un coordinador por ID (busca en todas las instituciones)
   * @param {string} principalId - ID del coordinador
   * @returns {Promise<Result<any>>} El coordinador encontrado
   */
  async getPrincipalById(principalId: string): Promise<Result<any>> {
    try {
      const institutionsResult = await this.getAllInstitutions()
      if (!institutionsResult.success) {
        return failure(institutionsResult.error)
      }

      for (const institution of institutionsResult.data) {
        for (const campus of institution.campuses) {
          if (campus.principal && campus.principal.id === principalId) {
            return success({
              ...campus.principal,
              institutionId: institution.id,
              campusId: campus.id,
              institutionName: institution.name,
              campusName: campus.name
            })
          }
        }
      }

      return failure(new NotFound({ message: 'Coordinador no encontrado' }))
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'obtener coordinador por ID'))) 
    }
  }

  /**
   * Obtiene el coordinador de una sede específica
   * @param {string} institutionId - ID de la institución
   * @param {string} campusId - ID de la sede
   * @returns {Promise<Result<any>>} El coordinador de la sede
   */
  async getPrincipalByCampus(institutionId: string, campusId: string): Promise<Result<any>> {
    try {
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      const campus = institution.campuses.find((c: any) => c.id === campusId)
      
      if (!campus) {
        return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
      }

      if (!campus.principal) {
        return failure(new ErrorAPI({ message: 'No hay coordinador asignado a esta sede', statusCode: 404 }))
      }

      return success({
        ...campus.principal,
        institutionId: institution.id,
        campusId: campus.id,
        institutionName: institution.name,
        campusName: campus.name
      })
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'obtener coordinador por sede'))) 
    }
  }

  /**
   * Asigna un estudiante a un docente
   * @param {string} teacherId - ID del docente
   * @param {string} studentId - ID del estudiante
   * @returns {Promise<Result<void>>} Resultado de la asignación
   */
  async assignStudentToTeacher(teacherId: string, studentId: string): Promise<Result<void>> {
    try {
      // Obtener información del docente para saber su institución, sede y grado
      const teacherResult = await this.getTeacherById(teacherId)
      if (!teacherResult.success) {
        console.warn('No se pudo obtener información del docente:', teacherResult.error)
        return failure(teacherResult.error)
      }

      const teacher = teacherResult.data
      
      // Obtener los estudiantes actuales del docente
      const currentStudents = teacher.students || []
      
      // Verificar si el estudiante ya está asignado
      if (!currentStudents.includes(studentId)) {
        // Agregar el estudiante a la lista
        const updatedStudents = [...currentStudents, studentId]
        
        // Actualizar el docente con la nueva lista de estudiantes y contador
        await this.updateTeacherInGrade(
          teacher.institutionId,
          teacher.campusId,
          teacher.gradeId,
          teacherId,
          { 
            students: updatedStudents,
            studentCount: updatedStudents.length 
          }
        )

        console.log(`✅ Estudiante ${studentId} asignado al docente ${teacherId}. Total estudiantes: ${updatedStudents.length}`)
      } else {
        console.log(`⚠️ Estudiante ${studentId} ya está asignado al docente ${teacherId}`)
      }

      return success(undefined)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'asignar estudiante a docente'))) 
    }
  }

  /**
   * Asigna un estudiante a un coordinador
   * @param {string} principalId - ID del coordinador
   * @param {string} studentId - ID del estudiante
   * @returns {Promise<Result<void>>} Resultado de la asignación
   */
  async assignStudentToPrincipal(principalId: string, studentId: string): Promise<Result<void>> {
    try {
      // Obtener información del coordinador para saber su institución y sede
      const principalResult = await this.getPrincipalById(principalId)
      if (!principalResult.success) {
        console.warn('No se pudo obtener información del coordinador:', principalResult.error)
        return failure(principalResult.error)
      }

      const principal = principalResult.data
      
      // Obtener los estudiantes actuales del coordinador
      const currentStudents = principal.students || []
      
      // Verificar si el estudiante ya está asignado
      if (!currentStudents.includes(studentId)) {
        // Agregar el estudiante a la lista
        const updatedStudents = [...currentStudents, studentId]
        
        // Actualizar el coordinador con la nueva lista de estudiantes y contador
        await this.updatePrincipalInCampus(
          principal.institutionId, 
          principal.campusId, 
          principalId, 
          { 
            students: updatedStudents,
            studentCount: updatedStudents.length 
          }
        )

        console.log(`✅ Estudiante ${studentId} asignado al coordinador ${principalId}. Total estudiantes: ${updatedStudents.length}`)
      } else {
        console.log(`⚠️ Estudiante ${studentId} ya está asignado al coordinador ${principalId}`)
      }

      return success(undefined)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'asignar estudiante a coordinador'))) 
    }
  }

  /**
   * Obtiene el rector de una institución
   * @param {string} institutionId - ID de la institución
   * @returns {Promise<Result<any>>} El rector de la institución
   */
  async getRectorByInstitution(institutionId: string): Promise<Result<any>> {
    try {
      const institutionResult = await this.getInstitutionById(institutionId)
      if (!institutionResult.success) {
        return failure(institutionResult.error)
      }

      const institution = institutionResult.data
      
      if (!institution.rector) {
        return failure(new ErrorAPI({ message: 'No se encontró rector para la institución', statusCode: 404 }))
      }

      return success(institution.rector)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'obtener rector por institución'))) 
    }
  }

  /**
   * Obtiene un rector por su ID (busca en todas las instituciones)
   * @param {string} rectorId - ID del rector
   * @returns {Promise<Result<any>>} El rector encontrado
   */
  async getRectorById(rectorId: string): Promise<Result<any>> {
    try {
      const institutionsResult = await this.getAllInstitutions()
      if (!institutionsResult.success) {
        return failure(institutionsResult.error)
      }

      for (const institution of institutionsResult.data) {
        if (institution.rector && institution.rector.id === rectorId) {
          return success({
            ...institution.rector,
            institutionId: institution.id
          })
        }
      }

      return failure(new ErrorAPI({ message: 'Rector no encontrado', statusCode: 404 }))
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'obtener rector por ID'))) 
    }
  }

  /**
   * Asigna un estudiante a un rector
   * @param {string} rectorId - ID del rector
   * @param {string} studentId - ID del estudiante
   * @returns {Promise<Result<void>>} Resultado de la asignación
   */
  async assignStudentToRector(rectorId: string, studentId: string): Promise<Result<void>> {
    try {
      // Obtener información del rector para saber su institución
      const rectorResult = await this.getRectorById(rectorId)
      if (!rectorResult.success) {
        console.warn('No se pudo obtener información del rector:', rectorResult.error)
        return failure(rectorResult.error)
      }

      const rector = rectorResult.data
      
      // Obtener los estudiantes actuales del rector
      const currentStudents = rector.students || []
      
      // Verificar si el estudiante ya está asignado
      if (!currentStudents.includes(studentId)) {
        // Agregar el estudiante a la lista
        const updatedStudents = [...currentStudents, studentId]
        
        // Actualizar el rector con la nueva lista de estudiantes y contador
        await this.updateRectorInInstitution(
          rector.institutionId, 
          rectorId, 
          { 
            students: updatedStudents,
            studentCount: updatedStudents.length 
          }
        )

        console.log(`✅ Estudiante ${studentId} asignado al rector ${rectorId}. Total estudiantes: ${updatedStudents.length}`)
      } else {
        console.log(`⚠️ Estudiante ${studentId} ya está asignado al rector ${rectorId}`)
      }

      return success(undefined)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'asignar estudiante a rector'))) 
    }
  }

  /**
   * Remueve un estudiante de un docente
   * @param {string} teacherId - ID del docente
   * @param {string} studentId - ID del estudiante
   * @returns {Promise<Result<void>>} Resultado de la remoción
   */
  async removeStudentFromTeacher(teacherId: string, studentId: string): Promise<Result<void>> {
    try {
      // Esta función se implementaría si se necesita almacenar las asignaciones
      console.log(`✅ Estudiante ${studentId} removido del docente ${teacherId}`)
      return success(undefined)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'remover estudiante de docente'))) 
    }
  }

  /**
   * Recalcula y actualiza los contadores de estudiantes para todos los usuarios
   * Esta función debe ejecutarse una vez para corregir los contadores existentes
   * @returns {Promise<Result<void>>} Resultado del recálculo
   */
  async recalculateAllStudentCounts(): Promise<Result<void>> {
    try {
      console.log('🔄 Iniciando recálculo de contadores de estudiantes...')
      
      // Obtener todas las instituciones
      const institutionsResult = await this.getAllInstitutions()
      if (!institutionsResult.success) {
        return failure(institutionsResult.error)
      }

      let totalUpdated = 0

      for (const institution of institutionsResult.data) {
        console.log(`📊 Procesando institución: ${institution.name}`)
        
        // Recalcular contador del rector
        if (institution.rector) {
          const rectorStudentsResult = await this.getFilteredStudents({
            institutionId: institution.id,
            isActive: true
          })
          
          if (rectorStudentsResult.success) {
            const studentCount = rectorStudentsResult.data.length
            await this.updateRectorInInstitution(institution.id, institution.rector.id, {
              studentCount,
              students: rectorStudentsResult.data.map(s => s.id)
            })
            console.log(`✅ Rector ${institution.rector.name}: ${studentCount} estudiantes`)
            totalUpdated++
          }
        }

        // Procesar sedes
        for (const campus of institution.campuses) {
          console.log(`🏫 Procesando sede: ${campus.name}`)
          
          // Recalcular contador del coordinador
          if (campus.principal) {
            const principalStudentsResult = await this.getFilteredStudents({
              institutionId: institution.id,
              campusId: campus.id,
              isActive: true
            })
            
            if (principalStudentsResult.success) {
              const studentCount = principalStudentsResult.data.length
              await this.updatePrincipalInCampus(institution.id, campus.id, campus.principal.id, {
                studentCount,
                students: principalStudentsResult.data.map(s => s.id)
              })
              console.log(`✅ Coordinador ${campus.principal.name}: ${studentCount} estudiantes`)
              totalUpdated++
            }
          }

          // Procesar grados
          for (const grade of campus.grades) {
            console.log(`📚 Procesando grado: ${grade.name}`)
            
            // Recalcular contadores de docentes
            for (const teacher of grade.teachers || []) {
              const teacherStudentsResult = await this.getFilteredStudents({
                institutionId: institution.id,
                campusId: campus.id,
                gradeId: grade.id,
                isActive: true
              })
              
              if (teacherStudentsResult.success) {
                const studentCount = teacherStudentsResult.data.length
                await this.updateTeacherInGrade(institution.id, campus.id, grade.id, teacher.id, {
                  studentCount,
                  students: teacherStudentsResult.data.map(s => s.id)
                })
                console.log(`✅ Docente ${teacher.name}: ${studentCount} estudiantes`)
                totalUpdated++
              }
            }
          }
        }
      }

      console.log(`🎉 Recálculo completado. ${totalUpdated} usuarios actualizados.`)
      return success(undefined)
    } catch (e) { 
      console.error('❌ Error en recálculo:', e)
      return failure(new ErrorAPI(normalizeError(e, 'recalcular contadores de estudiantes'))) 
    }
  }

  /**
   * Remueve un estudiante de un coordinador
   * @param {string} principalId - ID del coordinador
   * @param {string} studentId - ID del estudiante
   * @returns {Promise<Result<void>>} Resultado de la remoción
   */
  async removeStudentFromPrincipal(principalId: string, studentId: string): Promise<Result<void>> {
    try {
      // Esta función se implementaría si se necesita almacenar las asignaciones
      console.log(`✅ Estudiante ${studentId} removido del coordinador ${principalId}`)
      return success(undefined)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'remover estudiante de coordinador'))) 
    }
  }
  /*----------------------------------------------------*/

  /*---------------> Nueva Estructura Jerárquica de Usuarios <---------------*/
  /**
   * Obtiene una referencia a la colección de rectores de una institución
   * Nueva estructura: superate/auth/institutions/{institutionId}/rectores/{rectorId}
   * @param {string} institutionId - ID de la institución
   * @returns {CollectionReference} Referencia a la colección de rectores
   */
  getRectoresCollection(institutionId: string): CollectionReference {
    return collection(this.db, 'superate', 'auth', 'institutions', institutionId, 'rectores')
  }

  /**
   * Obtiene una referencia a la colección de coordinadores de una institución
   * Nueva estructura: superate/auth/institutions/{institutionId}/coordinadores/{coordinadorId}
   * @param {string} institutionId - ID de la institución
   * @returns {CollectionReference} Referencia a la colección de coordinadores
   */
  getCoordinadoresCollection(institutionId: string): CollectionReference {
    return collection(this.db, 'superate', 'auth', 'institutions', institutionId, 'coordinadores')
  }

  /**
   * Obtiene una referencia a la colección de profesores de una institución
   * Nueva estructura: superate/auth/institutions/{institutionId}/profesores/{profesorId}
   * @param {string} institutionId - ID de la institución
   * @returns {CollectionReference} Referencia a la colección de profesores
   */
  getProfesoresCollection(institutionId: string): CollectionReference {
    return collection(this.db, 'superate', 'auth', 'institutions', institutionId, 'profesores')
  }

  /**
   * Obtiene una referencia a la colección de estudiantes de una institución
   * Nueva estructura: superate/auth/institutions/{institutionId}/estudiantes/{estudianteId}
   * @param {string} institutionId - ID de la institución
   * @returns {CollectionReference} Referencia a la colección de estudiantes
   */
  getEstudiantesCollection(institutionId: string): CollectionReference {
    return collection(this.db, 'superate', 'auth', 'institutions', institutionId, 'estudiantes')
  }

  /**
   * Obtiene el nombre de la colección según el rol del usuario
   * @param {string} role - Rol del usuario (rector, principal, teacher, student)
   * @returns {string} Nombre de la colección
   */
  private getRoleCollectionName(role: string): string {
    const roleMap: Record<string, string> = {
      'rector': 'rectores',
      'principal': 'coordinadores',
      'teacher': 'profesores',
      'student': 'estudiantes'
    }
    return roleMap[role] || 'users'
  }

  /** Mapeo inverso: nombre de colección → rol (para userLookup y fallback) */
  private getRoleFromCollectionName(roleCollection: string): string {
    const map: Record<string, string> = {
      'rectores': 'rector',
      'coordinadores': 'principal',
      'profesores': 'teacher',
      'estudiantes': 'student'
    }
    return map[roleCollection] || 'student'
  }

  /**
   * Escribe o actualiza la entrada en userLookup para acceso O(1) por uid.
   * Ruta: superate/auth/userLookup/{uid} → { institutionId, role, updatedAt }
   */
  private async setUserLookup(uid: string, institutionId: string, role: string): Promise<void> {
    try {
      const lookupRef = doc(this.getCollection('userLookup'), uid)
      await setDoc(lookupRef, {
        institutionId,
        role,
        updatedAt: new Date().toISOString(),
      })
      logger.debug('userLookup actualizado:', uid, institutionId, role)
    } catch (e) {
      logger.warn('Error al escribir userLookup (no crítico):', e)
    }
  }

  /**
   * Elimina la entrada de userLookup al borrar un usuario.
   */
  private async deleteUserLookup(uid: string): Promise<void> {
    try {
      const lookupRef = doc(this.getCollection('userLookup'), uid)
      await deleteDoc(lookupRef)
      logger.debug('userLookup eliminado:', uid)
    } catch (e) {
      logger.warn('Error al eliminar userLookup (no crítico):', e)
    }
  }

  /**
   * Obtiene una referencia a la colección de usuarios según rol e institución
   * @param {string} institutionId - ID de la institución
   * @param {string} role - Rol del usuario
   * @returns {CollectionReference} Referencia a la colección correspondiente
   */
  private getUserRoleCollection(institutionId: string, role: string): CollectionReference {
    const collectionName = this.getRoleCollectionName(role)
    return collection(this.db, 'superate', 'auth', 'institutions', institutionId, collectionName)
  }

  /**
   * Crea un usuario en la nueva estructura jerárquica
   * @param {User} auth - Usuario de Firebase Auth
   * @param {any} credentials - Credenciales del usuario (debe incluir role e institutionId)
   * @returns {Promise<Result<any>>} Usuario creado
   */
  async createUserInNewStructure(auth: User, credentials: any): Promise<Result<any>> {
    try {
      const { role, institutionId, inst } = credentials
      const finalInstitutionId = institutionId || inst

      if (!finalInstitutionId) {
        return failure(new ErrorAPI({ 
          message: 'institutionId es requerido para la nueva estructura', 
          statusCode: 400 
        }))
      }

      if (!role) {
        return failure(new ErrorAPI({ 
          message: 'role es requerido', 
          statusCode: 400 
        }))
      }

      // Validar que el rol sea válido para la nueva estructura
      const validRoles = ['rector', 'principal', 'teacher', 'student']
      if (!validRoles.includes(role)) {
        // Si es admin, usar la estructura antigua temporalmente
        return await this.createUser(auth, credentials)
      }

      // Preparar datos del usuario
      const userData = {
        ...credentials,
        email: auth.email,
        name: auth.displayName || credentials.name,
        uid: auth.uid,
        id: auth.uid, // Asegurar que id esté presente
        isActive: credentials.isActive !== undefined ? credentials.isActive : true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Filtrar campos undefined
      const cleanUserData = Object.fromEntries(
        Object.entries(userData).filter(([_, value]) => value !== undefined)
      )

      // Obtener referencia a la colección correcta según el rol
      const userCollection = this.getUserRoleCollection(finalInstitutionId, role)
      const userDocRef = doc(userCollection, auth.uid)

      logger.debug('Creando usuario en nueva estructura:', userDocRef.path)

      await setDoc(userDocRef, cleanUserData)
      await this.setUserLookup(auth.uid, finalInstitutionId, role)

      return success(cleanUserData)
    } catch (e) {
      logger.error('Error al guardar usuario en nueva estructura:', e)
      return failure(new ErrorAPI(normalizeError(e, 'Registrar credenciales del usuario en nueva estructura')))
    }
  }

  /**
   * Obtiene un usuario por ID desde la nueva estructura jerárquica.
   * Optimizado: primero consulta el índice userLookup (2 lecturas); si no existe, hace fallback
   * y rellena el lookup para la próxima vez.
   * @param {string} id - ID del usuario (uid)
   * @returns {Promise<Result<any>>} Usuario encontrado
   */
  async getUserByIdFromNewStructure(id: string): Promise<Result<any>> {
    try {
      // 1) Ruta rápida: índice userLookup (1 lectura + 1 lectura al documento)
      const lookupRef = doc(this.getCollection('userLookup'), id)
      const lookupSnap = await getDoc(lookupRef)
      if (lookupSnap.exists()) {
        const { institutionId, role } = lookupSnap.data() as { institutionId: string; role: string }
        if (institutionId && role) {
          const userDocRef = doc(this.getUserRoleCollection(institutionId, role), id)
          const userSnap = await getDoc(userDocRef)
          if (userSnap.exists()) {
            const userData = { id: userSnap.id, ...userSnap.data() } as any
            return success(userData)
          }
          // Documento movido/eliminado; borrar lookup y continuar al fallback
          await this.deleteUserLookup(id)
        }
      }

      // 2) Fallback: buscar en todas las instituciones (retrocompatibilidad y migración gradual)
      const institutionsResult = await this.getAllInstitutions()
      if (!institutionsResult.success) {
        return failure(institutionsResult.error)
      }

      const roles = ['rectores', 'coordinadores', 'profesores', 'estudiantes']

      for (const institution of institutionsResult.data) {
        const institutionId = institution.id
        for (const roleCollection of roles) {
          try {
            const userCollection = collection(
              this.db,
              'superate',
              'auth',
              'institutions',
              institutionId,
              roleCollection
            )
            const userDocRef = doc(userCollection, id)
            const docSnap = await getDoc(userDocRef)

            if (docSnap.exists()) {
              const userData = { id: docSnap.id, ...docSnap.data() } as any
              // Rellenar lookup para la próxima vez (migración gradual)
              await this.setUserLookup(id, institutionId, this.getRoleFromCollectionName(roleCollection))
              return success(userData)
            }
          } catch (error: any) {
            logger.warn('Error al buscar usuario en fallback:', roleCollection, institutionId, error?.message)
            continue
          }
        }
      }

      return failure(new NotFound({ message: 'Usuario no encontrado en nueva estructura' }))
    } catch (e: any) {
      logger.error('Error al obtener usuario de nueva estructura:', e?.message)
      return failure(new ErrorAPI(normalizeError(e, 'obtener usuario de nueva estructura')))
    }
  }

  /**
   * Obtiene todos los usuarios de un rol específico desde todas las instituciones
   * @param {string} role - Rol a buscar (rector, principal, teacher, student)
   * @returns {Promise<Result<any[]>>} Lista de usuarios
   */
  async getAllUsersByRoleFromNewStructure(role: string): Promise<Result<any[]>> {
    try {
      const validRoles = ['rector', 'principal', 'teacher', 'student']
      if (!validRoles.includes(role)) {
        return failure(new ErrorAPI({ 
          message: 'Rol inválido', 
          statusCode: 400 
        }))
      }

      const roleCollectionName = this.getRoleCollectionName(role)
      const allUsers: any[] = []

      // Obtener todas las instituciones
      const institutionsResult = await this.getAllInstitutions()
      if (!institutionsResult.success) {
        return failure(institutionsResult.error)
      }

      // Buscar usuarios en cada institución
      for (const institution of institutionsResult.data) {
        try {
          const userCollection = collection(
            this.db,
            'superate',
            'auth',
            'institutions',
            institution.id,
            roleCollectionName
          )
          const snapshot = await getDocs(userCollection)
          
          snapshot.docs.forEach(doc => {
            allUsers.push({
              id: doc.id,
              ...doc.data(),
              institutionId: institution.id,
              institutionName: institution.name
            })
          })
        } catch (error) {
          logger.warn('Error al obtener usuarios por institución:', institution.id, roleCollectionName, error)
          continue
        }
      }

      return success(allUsers)
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, `obtener todos los ${role}s de nueva estructura`)))
    }
  }

  /**
   * Actualiza un usuario en la nueva estructura jerárquica
   * @param {string} userId - ID del usuario (uid)
   * @param {any} updateData - Datos a actualizar
   * @returns {Promise<Result<void>>} Resultado de la actualización
   */
  async updateUserInNewStructure(userId: string, updateData: any): Promise<Result<void>> {
    try {
      // Primero encontrar el usuario en la nueva estructura
      const userResult = await this.getUserByIdFromNewStructure(userId)
      if (!userResult.success) {
        return failure(userResult.error)
      }

      const user = userResult.data
      const institutionId = user.institutionId || user.inst
      const role = user.role

      if (!institutionId || !role) {
        return failure(new ErrorAPI({ 
          message: 'No se pudo determinar la institución o rol del usuario', 
          statusCode: 400 
        }))
      }

      // Limpiar datos
      const cleanedData: any = {}
      const excludeFields = ['role', 'uid', 'id', 'createdAt', 'institutionId', 'inst']
      
      for (const [key, value] of Object.entries(updateData)) {
        if (excludeFields.includes(key)) continue
        if (value !== undefined) {
          if (value instanceof Date) {
            cleanedData[key] = value.toISOString()
          } else if (value !== null) {
            cleanedData[key] = value
          }
        }
      }

      if (Object.keys(cleanedData).length === 0) {
        return failure(new ErrorAPI({ 
          message: 'No se proporcionaron datos válidos para actualizar', 
          statusCode: 400 
        }))
      }

      cleanedData.updatedAt = new Date().toISOString()

      // Obtener referencia al documento del usuario
      const userCollection = this.getUserRoleCollection(institutionId, role)
      const userDocRef = doc(userCollection, userId)

      await updateDoc(userDocRef, cleanedData)
      console.log(`✅ Usuario actualizado en nueva estructura: ${userDocRef.path}`)

      return success(undefined)
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, 'actualizar usuario en nueva estructura')))
    }
  }

  /**
   * Elimina un usuario de la nueva estructura jerárquica
   * @param {string} userId - ID del usuario (uid)
   * @param {string} institutionId - ID de la institución (opcional, si se proporciona evita buscar primero)
   * @param {string} role - Rol del usuario (opcional, si se proporciona evita buscar primero)
   * @returns {Promise<Result<void>>} Resultado de la eliminación
   */
  async deleteUserFromNewStructure(userId: string, institutionId?: string, role?: string): Promise<Result<void>> {
    try {
      let targetInstitutionId = institutionId
      let targetRole = role

      // Si no se proporcionaron institutionId y role, buscar primero el usuario
      if (!targetInstitutionId || !targetRole) {
        const userResult = await this.getUserByIdFromNewStructure(userId)
        if (!userResult.success) {
          // Si no se encuentra y tampoco se proporcionaron institutionId y role, retornar error
          if (!targetInstitutionId || !targetRole) {
            return failure(userResult.error)
          }
        } else {
          // Si se encontró, usar los datos del usuario
          const user = userResult.data
          targetInstitutionId = targetInstitutionId || user.institutionId || user.inst
          targetRole = targetRole || user.role
        }
      }

      if (!targetInstitutionId || !targetRole) {
        return failure(new ErrorAPI({ 
          message: 'No se pudo determinar la institución o rol del usuario', 
          statusCode: 400 
        }))
      }

      // Eliminar el documento
      const userCollection = this.getUserRoleCollection(targetInstitutionId, targetRole)
      const userDocRef = doc(userCollection, userId)

      // Verificar que el documento existe antes de intentar eliminarlo
      const docSnap = await getDoc(userDocRef)
      if (!docSnap.exists()) {
        logger.warn('Usuario no encontrado al eliminar (puede estar ya eliminado):', userDocRef.path)
        await this.deleteUserLookup(userId)
        return success(undefined)
      }

      await deleteDoc(userDocRef)
      await this.deleteUserLookup(userId)

      return success(undefined)
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, 'eliminar usuario de nueva estructura')))
    }
  }

  /**
   * Obtiene usuarios filtrados por institución y rol desde la nueva estructura
   * @param {string} institutionId - ID de la institución
   * @param {string} role - Rol del usuario (opcional)
   * @returns {Promise<Result<any[]>>} Lista de usuarios
   */
  async getUsersByInstitutionFromNewStructure(institutionId: string, role?: string): Promise<Result<any[]>> {
    try {
      const allUsers: any[] = []
      const rolesToSearch = role 
        ? [this.getRoleCollectionName(role)] 
        : ['rectores', 'coordinadores', 'profesores', 'estudiantes']

      for (const roleCollection of rolesToSearch) {
        try {
          const userCollection = collection(
            this.db,
            'superate',
            'auth',
            'institutions',
            institutionId,
            roleCollection
          )
          const snapshot = await getDocs(userCollection)
          
          snapshot.docs.forEach(doc => {
            allUsers.push({
              id: doc.id,
              ...doc.data(),
              institutionId
            })
          })
        } catch (error) {
          console.warn(`⚠️ Error al obtener ${roleCollection} de institución ${institutionId}:`, error)
          continue
        }
      }

      return success(allUsers)
    } catch (e) {
      return failure(new ErrorAPI(normalizeError(e, 'obtener usuarios por institución de nueva estructura')))
    }
  }

  /*---------------> getReferences <---------------*/
  /**
   * Obtiene una referencia a una subcolección desde la colección principal (auth).
   * DEPRECATED: Esta función sigue existiendo para retrocompatibilidad,
   * pero se recomienda usar los métodos específicos de la nueva estructura jerárquica.
   * @param {string} name - El nombre de la subcolección a obtener.
   * @returns {CollectionReference} Una referencia a la subcolección.
   * @deprecated Use los métodos específicos de la nueva estructura jerárquica
   */
  getCollection(name: string): CollectionReference { return collection(this.db, 'superate', 'auth', name) }
}

export const dbService = DatabaseService.getInstance()
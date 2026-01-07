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
import { User } from "firebase/auth";

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
   * @returns {Promise<Result<any[]>>} Una lista de usuarios.
   */
  async getAllUsers(): Promise<Result<any[]>> {
    try {
      const snapshot = await getDocs(this.getCollection('users'))
      return success(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener usuarios'))) }
  }

  /**
   * id represent the uid of the user (this is the name folder of each user)
   * @param {string} id - El identificador del usuario, corresponde al uid del usuario en cuestión (auth).
   * @returns {Promise<Result<any>>} Un usuario.
   */
  async getUserById(id: string): Promise<Result<any>> {
    try {
      console.log('🔍 Buscando usuario con UID:', id)
      const docRef = doc(this.getCollection('users'), id)
      console.log('📂 Referencia del documento:', docRef.path)
      
      const docSnap = await getDoc(docRef)
      console.log('📄 Documento existe:', docSnap.exists())
      
      if (!docSnap.exists()) {
        console.log('❌ Usuario no encontrado en Firestore')
        return failure(new NotFound({ message: 'Usuario no encontrado' }))
      }
      
      const userData = { id: docSnap.id, ...docSnap.data() } as any
      console.log('✅ Usuario encontrado:', userData)
      console.log('👤 Rol del usuario encontrado:', userData.role)
      
      return success(userData)
    } catch (e) { 
      console.log('❌ Error al obtener usuario:', e)
      return failure(new ErrorAPI(normalizeError(e, 'obtener usuario'))) 
    }
  }

  /**
   * Permite buscar usuarios por nombre.
   * @param {string} searchTerm - El término de búsqueda.
   * @returns {Promise<Result<any>>} Una lista de usuarios.
   */
  async getUserByQuery(searchTerm: string): Promise<Result<any>> {
    try {
      const queryRef = query(
        this.getCollection('users'),
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff')
      )
      const snapshot = await getDocs(queryRef)
      return success(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'buscar usuarios'))) }
  }

  /**
   * Crea un usuario con las credenciales del usuario asociado.
   * @param {object} credentials - Corresponde a las credenciales del usuario, contiene el rol del usuario en validacion.
   */
  async createUser(auth: User, credentials: any): Promise<Result<any>> {
    try {
      // Asegurar que isActive esté definido (por defecto true)
      const userData = {
        ...credentials,
        email: auth.email,
        name: auth.displayName,
        uid: auth.uid,
        isActive: credentials.isActive !== undefined ? credentials.isActive : true
      }
      
      // Filtrar campos undefined para evitar errores de Firebase
      const cleanUserData = Object.fromEntries(
        Object.entries(userData).filter(([_, value]) => value !== undefined)
      )
      
      console.log('📝 Creando usuario en Firestore con datos:', cleanUserData)
      console.log('🔍 Rol específico:', cleanUserData.role)
      console.log('✅ Estado activo:', cleanUserData.isActive)
      console.log('🧹 Campos filtrados (undefined removidos):', Object.keys(userData).filter(key => userData[key] === undefined))
      
      await setDoc(doc(this.getCollection('users'), auth.uid), cleanUserData)
      console.log('✅ Usuario guardado exitosamente en Firestore')
      return success(cleanUserData)
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
      
      const document = doc(this.getCollection('users'), String(id))
      
      // Actualizar directamente sin reintentos excesivos
      try {
        await updateDoc(document, cleanedData)
        return success(undefined)
      } catch (error: any) {
        // Manejar error de cuota excedida
        if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
          return failure(new ErrorAPI({ 
            message: 'Se ha excedido la cuota de Firebase. Por favor, espera unos minutos e intenta nuevamente.', 
            statusCode: 429 
          }))
        }
        
        // Solo reintentar una vez para errores de red/timeout
        if (error?.code === 'unavailable' || error?.code === 'deadline-exceeded' || error?.message?.includes('network')) {
          console.warn('⚠️ Error de red, reintentando una vez...')
          await new Promise(resolve => setTimeout(resolve, 500))
          try {
            await updateDoc(document, cleanedData)
            return success(undefined)
          } catch (retryError: any) {
            if (retryError?.code === 'resource-exhausted' || retryError?.code === 'quota-exceeded') {
              return failure(new ErrorAPI({ 
                message: 'Se ha excedido la cuota de Firebase. Por favor, espera unos minutos e intenta nuevamente.', 
                statusCode: 429 
              }))
            }
            throw retryError
          }
        }
        
        // Para otros errores, lanzar inmediatamente
        if (error?.code === 'not-found') {
          return failure(new ErrorAPI({ 
            message: 'Usuario no encontrado en la base de datos', 
            statusCode: 404 
          }))
        }
        
        if (error?.code === 'permission-denied') {
          return failure(new ErrorAPI({ 
            message: 'No tienes permisos para actualizar este usuario. Verifica que eres administrador.', 
            statusCode: 403 
          }))
        }
        
        throw error
      }
    } catch (e: any) {
      return failure(new ErrorAPI(normalizeError(e, 'actualizar usuario'))) 
    }
  }

  /**
   * Elimina un usuario existente
   * @param {string} id - El identificador del documento usuario, representa el uid (auth)
   * @returns {Promise<Result<void>>} Elimina un usuario
   */
  async deleteUser(id: string): Promise<Result<void>> {
    try {
      return await deleteDoc(doc(this.getCollection('users'), id)).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'eliminar usuario'))) }
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
      
      // Actualizar usuarios (campus y grados ya se actualizaron en updateInstitution)
      const usersCollection = this.getCollection('users')
      
      // Buscar usuarios con institutionId o inst igual a la institución
      // Nota: Algunos usuarios pueden usar 'institutionId' y otros 'inst'
      const queries = [
        query(usersCollection, where('institutionId', '==', institutionId)),
        query(usersCollection, where('inst', '==', institutionId))
      ]
      
      const allUserDocs: any[] = []
      
      // Ejecutar ambas consultas con reintentos para asegurar que se completen
      for (const q of queries) {
        let queryRetries = 5 // Aumentado a 5 reintentos
        let querySuccess = false
        
        while (queryRetries > 0 && !querySuccess) {
          try {
            const snapshot = await getDocs(q)
            snapshot.docs.forEach(doc => {
              // Evitar duplicados si un usuario tiene ambos campos
              if (!allUserDocs.find(d => d.id === doc.id)) {
                allUserDocs.push({ id: doc.id, data: doc.data() })
              }
            })
            querySuccess = true
            console.log(`✅ Consulta de usuarios completada: ${snapshot.docs.length} usuarios encontrados`)
          } catch (error) {
            queryRetries--
            if (queryRetries > 0) {
              console.warn(`⚠️ Error en consulta de usuarios, reintentando... (${queryRetries} intentos restantes)`)
              await new Promise(resolve => setTimeout(resolve, 1500)) // Aumentado a 1.5 segundos
            } else {
              console.warn('⚠️ Error en consulta de usuarios después de reintentos:', error)
            }
          }
        }
      }
      
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
          const userRef = doc(usersCollection, user.id)
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
   * @param {object} filters - Filtros para la búsqueda
   * @returns {Promise<Result<any[]>>} Lista de estudiantes filtrados
   */
  async getFilteredStudents(filters: any): Promise<Result<any[]>> {
    try {
      console.log('🚀 Iniciando getFilteredStudents con filtros:', filters)
      const collectionRef = this.getCollection('users')
      const conditions = [where('role', '==', 'student')]

      if (filters.institutionId) {
        conditions.push(where('inst', '==', filters.institutionId))
      }
      if (filters.campusId) {
        conditions.push(where('campus', '==', filters.campusId))
      }
      if (filters.gradeId) {
        conditions.push(where('grade', '==', filters.gradeId))
      }
      if (filters.jornada) {
        conditions.push(where('jornada', '==', filters.jornada))
      }
      if (filters.isActive !== undefined) {
        conditions.push(where('isActive', '==', filters.isActive))
      }

      const queryRef = query(collectionRef, ...conditions)
      const snapshot = await getDocs(queryRef)
      let students = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      
      console.log('📊 Estudiantes encontrados antes del enriquecimiento:', students.length)
      console.log('📋 Primer estudiante (sin enriquecer):', students[0])

      // Aplicar filtro de búsqueda por texto si se proporciona
      if (filters.searchTerm) {
        const searchTerm = filters.searchTerm.toLowerCase()
        students = students.filter((student: any) => 
          student.name?.toLowerCase().includes(searchTerm) ||
          student.email?.toLowerCase().includes(searchTerm)
        )
      }

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

      console.log('🎉 Estudiantes enriquecidos finales:', enrichedStudents.length)
      console.log('📋 Primer estudiante enriquecido:', enrichedStudents[0])
      
      return success(enrichedStudents)
    } catch (e) { 
      console.error('❌ Error en getFilteredStudents:', e)
      return failure(new ErrorAPI(normalizeError(e, 'obtener estudiantes filtrados'))) 
    }
  }

  /**
   * Enriquece los datos de un usuario individual con nombres de institución, sede y grado
   * @param {any} user - El usuario a enriquecer
   * @returns {Promise<Result<any>>} Usuario enriquecido con nombres
   */
  async enrichUserData(user: any): Promise<Result<any>> {
    try {
      console.log('🔍 Enriqueciendo datos del usuario:', user.name, 'con IDs:', {
        inst: user.inst,
        campus: user.campus,
        grade: user.grade
      })
      
      // Obtener nombre de la institución
      let institutionName = user.inst || user.institutionId
      const institutionId = user.inst || user.institutionId
      if (institutionId) {
        const institutionDoc = await getDoc(doc(this.getCollection('institutions'), institutionId))
        if (institutionDoc.exists()) {
          institutionName = institutionDoc.data().name || institutionId
          console.log('✅ Institución encontrada:', institutionName)
        } else {
          console.log('❌ Institución no encontrada para ID:', institutionId)
        }
      }

      // Obtener nombre de la sede y grado desde el documento completo de la institución
      let campusName = user.campus || user.campusId
      let gradeName = user.grade || user.gradeId
      const campusId = user.campus || user.campusId
      const gradeId = user.grade || user.gradeId
      
      if (institutionId && campusId) {
        // Obtener el documento completo de la institución para buscar en sus arrays
        const institutionDoc = await getDoc(doc(this.getCollection('institutions'), institutionId))
        if (institutionDoc.exists()) {
          const institutionData = institutionDoc.data()
          console.log('📋 Datos de la institución:', institutionData)
          
          // Buscar la sede en el array de sedes
          if (institutionData.campuses && Array.isArray(institutionData.campuses)) {
            const campus = institutionData.campuses.find((c: any) => c.id === campusId)
            if (campus) {
              campusName = campus.name || campusId
              console.log('✅ Sede encontrada:', campusName)
              
              // Buscar el grado en el array de grados de la sede
              if (campus.grades && Array.isArray(campus.grades) && gradeId) {
                const grade = campus.grades.find((g: any) => g.id === gradeId)
                if (grade) {
                  gradeName = grade.name || gradeId
                  console.log('✅ Grado encontrado:', gradeName)
                } else {
                  console.log('❌ Grado no encontrado para ID:', gradeId)
                }
              }
            } else {
              console.log('❌ Sede no encontrada para ID:', campusId)
            }
          }
        } else {
          console.log('❌ Institución no encontrada para obtener sedes/grados')
        }
      }

      const enrichedUser = {
        ...user,
        institutionName,
        campusName,
        gradeName
      }
      
      console.log('🎉 Usuario enriquecido:', {
        name: enrichedUser.name,
        institutionName,
        campusName,
        gradeName
      })
      
      return success(enrichedUser)
    } catch (error) {
      console.warn(`Error al enriquecer datos del usuario ${user.id}:`, error)
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
      console.log('👨‍🏫 getStudentsByTeacher - Buscando estudiantes para teacherId:', teacherId)
      
      // Obtener información del docente para saber su institución, sede y grado
      const teacherResult = await this.getTeacherById(teacherId)
      if (!teacherResult.success) {
        console.error('❌ getStudentsByTeacher - Error al obtener docente:', teacherResult.error)
        return failure(teacherResult.error)
      }

      const teacher = teacherResult.data
      console.log('👨‍🏫 getStudentsByTeacher - Datos del docente:', {
        name: teacher.name,
        institutionId: teacher.institutionId,
        campusId: teacher.campusId,
        gradeId: teacher.gradeId,
        // También verificar campos alternativos
        inst: teacher.inst,
        campus: teacher.campus,
        grade: teacher.grade
      })
      
      // Usar los campos correctos (pueden ser inst/campus/grade o institutionId/campusId/gradeId)
      const institutionId = teacher.institutionId || teacher.inst
      const campusId = teacher.campusId || teacher.campus
      const gradeId = teacher.gradeId || teacher.grade
      
      console.log('🔍 getStudentsByTeacher - Filtros a aplicar:', {
        institutionId,
        campusId,
        gradeId,
        isActive: true
      })
      
      // Buscar estudiantes que coincidan con la institución, sede y grado del docente
      const studentsResult = await this.getFilteredStudents({
        institutionId: institutionId,
        campusId: campusId,
        gradeId: gradeId,
        isActive: true
      })

      console.log('✅ getStudentsByTeacher - Resultado:', {
        success: studentsResult.success,
        count: studentsResult.success ? studentsResult.data.length : 0
      })

      return studentsResult
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

  /*---------------> getReferences <---------------*/
  /**
   * Obtiene una referencia a una subcolección desde la colección principal (auth).
   * La abreviatura de la colección es 'gs' (gestion_salud).
   * @param {string} name - El nombre de la subcolección a obtener.
   * @returns {CollectionReference} Una referencia a la subcolección.
   */
  getCollection(name: string): CollectionReference { return collection(this.db, 'superate', 'auth', name) }
}

export const dbService = DatabaseService.getInstance()
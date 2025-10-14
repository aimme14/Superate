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
      const userData = {
        ...credentials,
        email: auth.email,
        name: auth.displayName,
        uid: auth.uid
      }
      
      // Filtrar campos undefined para evitar errores de Firebase
      const cleanUserData = Object.fromEntries(
        Object.entries(userData).filter(([_, value]) => value !== undefined)
      )
      
      console.log('📝 Creando usuario en Firestore con datos:', cleanUserData)
      console.log('🔍 Rol específico:', cleanUserData.role)
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
   * Actualiza un usuario existente.
   * @param {Partial<User>} user - El usuario con los nuevos datos.
   * @returns {Promise<Result<void>>} Actualiza un usuario.
   */
  async updateUser(id: string, { ...user }: any): Promise<Result<void>> {
    try {
      console.log('🔄 Actualizando usuario:', id)
      
      // Filtrar campos undefined para evitar errores de Firebase
      const cleanUserData = Object.fromEntries(
        Object.entries(user).filter(([_, value]) => value !== undefined)
      ) as any
      
      console.log('🧹 Datos limpios para actualización:', cleanUserData)
      
      const document = doc(this.getCollection('users'), String(id))
      return await updateDoc(document, cleanUserData).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'actualizar usuario'))) }
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
      return success({ id: docSnap.id, ...docSnap.data() })
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener institución'))) }
  }

  /**
   * Crea una nueva institución
   * @param {object} institutionData - Los datos de la institución a crear.
   * @returns {Promise<Result<any>>} La institución creada.
   */
  async createInstitution(institutionData: any): Promise<Result<any>> {
    try {
      const docRef = doc(this.getCollection('institutions'))
      const institutionWithId = {
        ...institutionData,
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
  // Función para limpiar valores undefined de un objeto
  private cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item))
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {}
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(value)
        }
      }
      return cleaned
    }
    
    return obj
  }

  async updateInstitution(id: string, institutionData: any): Promise<Result<any>> {
    try {
      console.log('🔍 Actualizando institución con ID:', id)
      console.log('📊 Tamaño de datos a actualizar:', JSON.stringify(institutionData).length, 'caracteres')
      
      const document = doc(this.getCollection('institutions'), id)
      const updatedData = {
        ...institutionData,
        updatedAt: new Date().toISOString().split('T')[0]
      }
      
      // Limpiar valores undefined antes de guardar
      const cleanedData = this.cleanUndefinedValues(updatedData)
      console.log('🧹 Datos limpiados de valores undefined')
      
      console.log('💾 Guardando datos en Firebase...')
      await updateDoc(document, cleanedData)
      console.log('✅ Datos guardados exitosamente')
      
      const updatedInstitution = await this.getInstitutionById(id)
      return updatedInstitution
    } catch (e) { 
      console.error('❌ Error al actualizar institución:', e)
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

      // Crear el coordinador con ID único
      const principalId = `principal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newPrincipal = {
        id: principalId,
        ...principalData,
        role: 'principal',
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

      // Actualizar el coordinador en la sede
      const updatedCampuses = [...institution.campuses]
      updatedCampuses[campusIndex] = {
        ...updatedCampuses[campusIndex],
        principal: {
          ...updatedCampuses[campusIndex].principal,
          ...principalData,
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

      // Crear el rector con ID único
      const rectorId = `rector-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const newRector = {
        id: rectorId,
        ...rectorData,
        role: 'rector',
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

      // Actualizar el rector en la institución
      const updatedInstitution = {
        ...institution,
        rector: {
          ...institution.rector,
          ...rectorData,
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

      // Crear el docente con ID único
      const teacherId = `teacher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
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

      // Actualizar el docente en el grado
      const updatedCampuses = [...institution.campuses]
      const updatedGrades = [...updatedCampuses[campusIndex].grades]
      const updatedTeachers = [...teachers]
      
      updatedTeachers[teacherIndex] = {
        ...updatedTeachers[teacherIndex],
        ...teacherData,
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
              gradeName: grade.name
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
                gradeName: grade.name
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

      // Enriquecer los docentes del grado con nombres
      const enrichedTeachers = (grade.teachers || []).map((teacher: any) => ({
        ...teacher,
        institutionId: institution.id,
        campusId: campus.id,
        gradeId: grade.id,
        institutionName: institution.name,
        campusName: campus.name,
        gradeName: grade.name
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

      // Enriquecer los datos de estudiantes con nombres de institución, sede y grado
      const enrichedStudents = await Promise.all(
        students.map(async (student: any) => {
          try {
            console.log('🔍 Enriqueciendo estudiante:', student.name, 'con IDs:', {
              inst: student.inst,
              campus: student.campus,
              grade: student.grade
            })
            
            // Obtener nombre de la institución
            let institutionName = student.inst || student.institutionId
            const institutionId = student.inst || student.institutionId
            if (institutionId) {
              // Usar la misma ruta que getAllInstitutions que sí funciona
              const institutionDoc = await getDoc(doc(this.getCollection('institutions'), institutionId))
              if (institutionDoc.exists()) {
                institutionName = institutionDoc.data().name || institutionId
                console.log('✅ Institución encontrada:', institutionName)
              } else {
                console.log('❌ Institución no encontrada para ID:', institutionId)
              }
            }

            // Obtener nombre de la sede y grado desde el documento completo de la institución
            let campusName = student.campus || student.campusId
            let gradeName = student.grade || student.gradeId
            const campusId = student.campus || student.campusId
            const gradeId = student.grade || student.gradeId
            
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

            const enrichedStudent = {
              ...student,
              institutionName,
              campusName,
              gradeName
            }
            
            console.log('🎉 Estudiante enriquecido:', {
              name: enrichedStudent.name,
              institutionName,
              campusName,
              gradeName
            })
            
            return enrichedStudent
          } catch (error) {
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
   * Obtiene estudiantes asignados a un docente específico
   * @param {string} teacherId - ID del docente
   * @returns {Promise<Result<any[]>>} Lista de estudiantes del docente
   */
  async getStudentsByTeacher(teacherId: string): Promise<Result<any[]>> {
    try {
      // Obtener información del docente para saber su institución, sede y grado
      const teacherResult = await this.getTeacherById(teacherId)
      if (!teacherResult.success) {
        return failure(teacherResult.error)
      }

      const teacher = teacherResult.data
      
      // Buscar estudiantes que coincidan con la institución, sede y grado del docente
      const studentsResult = await this.getFilteredStudents({
        institutionId: teacher.institutionId,
        campusId: teacher.campusId,
        gradeId: teacher.gradeId,
        isActive: true
      })

      return studentsResult
    } catch (e) { 
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
      
      // Contar estudiantes que coinciden con la institución, sede y grado del docente
      const studentsResult = await this.getFilteredStudents({
        institutionId: teacher.institutionId,
        campusId: teacher.campusId,
        gradeId: teacher.gradeId,
        isActive: true
      })

      if (!studentsResult.success) {
        console.warn('No se pudieron obtener los estudiantes:', studentsResult.error)
        return failure(studentsResult.error)
      }

      const studentCount = studentsResult.data.length

      // Actualizar el contador de estudiantes del docente
      await this.updateTeacherInGrade(
        teacher.institutionId,
        teacher.campusId,
        teacher.gradeId,
        teacherId,
        { studentCount }
      )

      console.log(`✅ Estudiante ${studentId} asignado automáticamente al docente ${teacherId}. Total estudiantes: ${studentCount}`)
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
      
      // Contar estudiantes que coinciden con la institución y sede del coordinador
      const studentsResult = await this.getFilteredStudents({
        institutionId: principal.institutionId,
        campusId: principal.campusId,
        isActive: true
      })

      if (!studentsResult.success) {
        console.warn('No se pudieron obtener los estudiantes:', studentsResult.error)
        return failure(studentsResult.error)
      }

      const studentCount = studentsResult.data.length

      // Actualizar el contador de estudiantes del coordinador
      await this.updatePrincipalInCampus(principal.institutionId, principal.campusId, principalId, { studentCount })

      console.log(`✅ Estudiante ${studentId} asignado automáticamente al coordinador ${principalId}. Total estudiantes: ${studentCount}`)
      return success(undefined)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'asignar estudiante a coordinador'))) 
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
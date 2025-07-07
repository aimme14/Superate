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
      const docSnap = await getDoc(doc(this.getCollection('users'), id))
      if (!docSnap.exists()) return failure(new NotFound({ message: 'Usuario no encontrado' }))
      return success({ id: docSnap.id, ...docSnap.data() })
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener usuario'))) }
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
      return await setDoc(doc(this.getCollection('users'), auth.uid), {
        ...credentials,
        email: auth.email,
        name: auth.displayName
      }).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'Registrar credenciales del usuario'))) }
  }

  /**
   * Actualiza un usuario existente.
   * @param {Partial<User>} user - El usuario con los nuevos datos.
   * @returns {Promise<Result<void>>} Actualiza un usuario.
   */
  async updateUser(id: string, { ...user }: any): Promise<Result<void>> {
    try {
      console.log(id)
      const document = doc(this.getCollection('users'), String(id))
      return await updateDoc(document, { ...user }).then(() => success(undefined))
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
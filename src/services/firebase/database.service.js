import { normalizeError } from "@/errors/handler"
import ErrorAPI, { NotFound } from "@/errors"
import { firebaseApp } from "@/services/db"

import { success, failure } from "@/interfaces/db.interface";

import {
  getFirestore,
  collection,
  updateDoc,
  deleteDoc,
  getDocs,
  setDoc,
  getDoc,
  query,
  where,
  doc
} from "firebase/firestore"

/**
 * Allow us conect with database firebase through an instance firestore
 * This class provides us various methods CRUD, among them we have the following
 * Business => to keep data important about business context like photoUrl etc.
 * Products => to save the diferents products of each business
 * 
 * ¿who are estructured the database?
 * 
 * Superate (database)
 *   ===> auth (document)
 *       ===>> users (folder)
 *           ===>>> uid (default) (document)
 *               ===>>>> {name: string, email: string, phone: string, photoURL: string[]...}
 * 
 * @argument uid(auth) represent the id of the business authenticate,
 * so we use this uid to identify the products of the business (crud).
 */
class DatabaseService {
  static instance
  db
  constructor() { this.db = getFirestore(firebaseApp) }

  static getInstance() {
    if (!DatabaseService.instance) { DatabaseService.instance = new DatabaseService() }
    return DatabaseService.instance
  }

  /*-----------------> business <-----------------*/
  /**
   * Obtiene todos los negocios
   * @returns {Promise<Result<Business[]>>} Una lista de negocios.
   */
  async getAllUsers() {
    try {
      const snapshot = await getDocs(this.getCollection('users'))
      return success(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener negocios'))) }
  }

  /**
   * id represent the uid of the business (this is the name folder of each business)
   * @param {string} id - El identificador del negocio, corresponde al uid del negocio en cuestión (auth).
   * @returns {Promise<Result<Business>>} Un negocio.
   */
  async getUserById(id) {
    try {
      const docSnap = await getDoc(doc(this.getCollection('users'), id))
      if (!docSnap.exists()) return failure(new NotFound({ message: 'Negocio no encontrado' }))
      return success({ id: docSnap.id, ...docSnap.data() })
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'obtener negocio'))) }
  }

  /**
   * Permite buscar usuarios por nombre.
   * @param {string} searchTerm - El término de búsqueda.
   * @returns {Promise<Result<Business[]>>} Una lista de negocios.
  */
  async getUserByQuery(searchTerm) {
    try {
      const queryRef = query(
        this.getCollection('users'),
        where('name', '>=', searchTerm),
        where('name', '<=', searchTerm + '\uf8ff')
      )
      const snapshot = await getDocs(queryRef)
      return success(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'buscar negocios'))) }
  }

  /**
   * Crea un usuario con las credenciales del usuario asociado.
   * Utilizamos el unique id (UID) del usuario para establecer el uid del documento (negocio)
   * De este modo una cuenta (correo) está relacionada a su emprendimeinto correspondiente
   * @param {object} credentials - Corresponde a las credenciales del usuario, contiene el rol del usuario en validacion.
   */
  async createUser(auth, credentials) {
    try {
      return await setDoc(doc(this.getCollection('users'), auth.uid), {
        ...credentials,
        email: auth.email,
        name: auth.displayName
      }).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'Registrar credenciales del usuario'))) }
  }

  /**
   * Actualiza un negocio existente.
   * @param {Partial<Business>} business - El negocio con los nuevos datos.
   * @returns {Promise<Result<void>>} Actualiza un negocio.
   */
  async updateUser({ id, ...user }) {
    try {
      return await updateDoc(doc(this.getCollection('users'), id), { ...user }).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'actualizar usuario'))) }
  }

  /**
   * Elimina un negocio existente
   * @param {string} id - El identificador del documento negocio, representa el uid (auth)
   * @returns {Promise<Result<void>>} Elimina un negocio
   */
  async deleteUser(id) {
    try {
      return await deleteDoc(doc(this.getCollection('users'), id)).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'eliminar usuario'))) }
  }
  /*----------------------------------------------------*/

  /*---------------> getReferences <---------------*/
  /**
   * Obtiene una referencia a una subcolección desde la colección principal (auth).
   * La abreviatura de la colección es 'gs' (gestion_salud).
   * @param {string} name - El nombre de la subcolección a obtener.
   * @returns {CollectionReference} Una referencia a la subcolección.
  */
  getCollection(name) { return collection(this.db, 'superate', 'auth', name) }
}

export const databaseService = DatabaseService.getInstance()
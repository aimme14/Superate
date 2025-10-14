import { failure, Result, success } from "@/interfaces/db.interface"
import { normalizeError } from "@/errors/handler"
import ErrorAPI, { NotFound } from "@/errors"
import { firebaseApp } from "@/services/db"


import {
  sendEmailVerification as sendEmailVerificationFB,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile,
  getAuth,
  signOut,
  deleteUser,
  Auth,
  User,
} from "firebase/auth"

/**
 * Consist on a class that works above an instance auth
 * Have various functions like observer, verification or overwrite data
 */
class AuthService {
  auth: Auth;
  static instance: AuthService;
  constructor() { this.auth = getAuth(firebaseApp) }

  static getInstance() {
    if (!AuthService.instance) { AuthService.instance = new AuthService() }
    return AuthService.instance
  }

  /*---------------> authentication <---------------*/
  /**
   * Es un observador que ejecuta un callback cuando el estado de la sesion cambia.
   * @param {(user: any) => void} callback - Accion a desencadenar tras el cambio en el estado del usuario
   */
  observeAuth(callback: (user: User | null) => void) {
    onAuthStateChanged(this.auth, callback)
  }

  /**
   * Crea una autenticación por medio de la verificación de credenciales.
   * @param {string} email - El email del usuario.
   * @param {string} password - La contraseña del usuario.
   * @returns {Promise<Result<User>>} - Retorna el usuario si las credenciales son válidas, o un error si no lo son.
   */
  async login(email: string, password: string): Promise<Result<User>> {
    try {
      return await signInWithEmailAndPassword(this.auth, email, password).then(res => success(res.user))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'verificar credenciales'))) }
  }

  /**
   * Permite cerrar la sessión del usuario en contexto
   * @returns {Promise<Result<void>>} - Retorna un mensaje de éxito si la sesión se cierra correctamente.
   */
  async logout(): Promise<Result<void>> {
    try { return await signOut(this.auth).then(() => success(undefined)) }
    catch (e) { return failure(new ErrorAPI(normalizeError(e, 'cerrar sesión'))) }
  }
  /*----------------------------------------------------*/

  /*---------------> create and update <---------------*/
  /**
   * Crea un usuario con credenciales en Firebase.
   * @param {string} username - El nombre de usuario.
   * @param {string} email - El correo del usuario.
   * @param {string} password - La contraseña del usuario.
   * @returns {Promise<Result<User>>} El usuario auth de firebase creado.
   */
  async registerAccount(username: string, email: string, password: string): Promise<Result<User>> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password)
      const profileUpdate = await this.updateProfile(userCredential.user, { displayName: username })
      if (!profileUpdate.success) throw profileUpdate.error
      return success(userCredential.user)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'registrar cuenta'))) }
  }

  /**
   * Actualiza el perfil del usuario en Firebase.
   * Los campos editables son limitados: displayName, photoURL;
   * @param {User} user - El usuario de firebase, representa la autenticación.
   * @param {Partial<User>} profile - El campo a actualizar.
   */
  async updateProfile(user: User, profile: Partial<User>) {
    try {
      return await updateProfile(user, profile).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'actualizar perfil'))) }
  }

  /**
   * Elimina un usuario de Firebase Auth.
   * @param {User} user - El usuario de firebase a eliminar.
   * @returns {Promise<Result<void>>} Resultado de la eliminación.
   */
  async deleteUserAccount(user: User): Promise<Result<void>> {
    try {
      return await deleteUser(user).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'eliminar cuenta de usuario'))) }
  }

  /**
   * Elimina un usuario de Firebase Auth por UID.
   * Nota: Esta función requiere autenticación de administrador.
   * @param {string} _uid - El UID del usuario a eliminar.
   * @returns {Promise<Result<void>>} Resultado de la eliminación.
   */
  async deleteUserByUid(_uid: string): Promise<Result<void>> {
    try {
      // Para eliminar un usuario por UID, necesitamos usar Firebase Admin SDK
      // Por ahora, solo eliminamos de Firestore y dejamos la cuenta de Auth
      console.warn('⚠️ Eliminación de Firebase Auth requiere Firebase Admin SDK')
      return success(undefined)
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'eliminar cuenta de usuario por UID'))) }
  }
  /*----------------------------------------------------*/

  /*---------------> verification <---------------*/
  /**
   * Envia un correo de verificación de cuenta al correo suministrado por el usuario
   * Anteriormente manejaba un enlace de redireccionamiento, pero se ha eliminado por cuestiones de reutilización..
   */
  async sendEmailVerification() {
    try {
      if (!this.auth.currentUser) throw new NotFound({ message: 'Usuario (auth)' })
      return await sendEmailVerificationFB(this.auth.currentUser).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'enviar email de verificación'))) }
  }

  /**
   * Envia un correo de restablecimiento de contraseña al correo suministrado por el usuario.
   * Enlace de redireccion esta definido en el archivo de configuracion de firebase (templates).
   * @param {string} email - El email del usuario.
   * @returns {Promise<Result<void>>} 
   */
  async sendEmailResetPassword(email: string): Promise<Result<void>> {
    try {
      return await sendPasswordResetEmail(this.auth, email).then(() => success(undefined))
    } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'enviar email de restablecimiento'))) }
  }
}

export const authService = AuthService.getInstance()
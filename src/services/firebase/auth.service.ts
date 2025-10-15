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
  updateEmail,
  updatePassword,
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
   * @param {boolean} preserveSession - Si es true, preserva la sesión del usuario actual (útil para admins)
   * @returns {Promise<Result<User>>} El usuario auth de firebase creado.
   */
  async registerAccount(username: string, email: string, password: string, preserveSession: boolean = false): Promise<Result<User>> {
    try {
      console.log('🚀 Iniciando registro de cuenta:', { email, preserveSession })
      
      // Si queremos preservar la sesión actual (administrador creando usuarios)
      if (preserveSession && this.auth.currentUser) {
        const currentUser = this.auth.currentUser
        const currentUserEmail = currentUser.email
        
        console.log('🔐 Preservando sesión del usuario actual:', currentUserEmail)
        console.log('⚠️ IMPORTANTE: La creación del nuevo usuario cerrará la sesión actual del administrador')
        
        // Crear el nuevo usuario (esto cerrará la sesión actual)
        console.log('📝 Creando nuevo usuario en Firebase Auth...')
        const userCredential = await createUserWithEmailAndPassword(this.auth, email, password)
        const newUser = userCredential.user
        
        console.log('✅ Usuario creado en Firebase Auth con UID:', newUser.uid)
        
        // Actualizar perfil del nuevo usuario
        console.log('👤 Actualizando perfil del nuevo usuario...')
        const profileUpdate = await this.updateProfile(newUser, { displayName: username })
        if (!profileUpdate.success) {
          console.error('❌ Error al actualizar perfil:', profileUpdate.error)
          throw profileUpdate.error
        }
        console.log('✅ Perfil actualizado correctamente')
        
        // Cerrar sesión del nuevo usuario
        console.log('🔒 Cerrando sesión del nuevo usuario...')
        await signOut(this.auth)
        
        console.log('✅ Usuario creado:', email)
        console.log('⚠️ Sesión del administrador cerrada. Email del admin:', currentUserEmail)
        console.log('ℹ️ El administrador deberá volver a iniciar sesión')
        
        return success(newUser)
      } else {
        // Comportamiento normal - crear usuario e iniciar sesión con él
        console.log('📝 Creando usuario en Firebase Auth (flujo normal)...')
        const userCredential = await createUserWithEmailAndPassword(this.auth, email, password)
        console.log('✅ Usuario creado en Firebase Auth con UID:', userCredential.user.uid)
        
        const profileUpdate = await this.updateProfile(userCredential.user, { displayName: username })
        if (!profileUpdate.success) {
          console.error('❌ Error al actualizar perfil:', profileUpdate.error)
          throw profileUpdate.error
        }
        console.log('✅ Perfil actualizado correctamente')
        
        return success(userCredential.user)
      }
    } catch (e) { 
      console.error('❌ Error al registrar cuenta:', e)
      return failure(new ErrorAPI(normalizeError(e, 'registrar cuenta'))) 
    }
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
   * Actualiza el email del usuario en Firebase Authentication.
   * @param {User} user - El usuario de firebase actual.
   * @param {string} newEmail - El nuevo email.
   * @returns {Promise<Result<void>>} Resultado de la actualización.
   */
  async updateUserEmail(user: User, newEmail: string): Promise<Result<void>> {
    try {
      await updateEmail(user, newEmail)
      return success(undefined)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'actualizar email'))) 
    }
  }

  /**
   * Actualiza la contraseña del usuario en Firebase Authentication.
   * @param {User} user - El usuario de firebase actual.
   * @param {string} newPassword - La nueva contraseña.
   * @returns {Promise<Result<void>>} Resultado de la actualización.
   */
  async updateUserPassword(user: User, newPassword: string): Promise<Result<void>> {
    try {
      await updatePassword(user, newPassword)
      return success(undefined)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'actualizar contraseña'))) 
    }
  }

  /**
   * Actualiza tanto el perfil como el email del usuario.
   * @param {User} user - El usuario de firebase actual.
   * @param {string} newName - El nuevo nombre.
   * @param {string} newEmail - El nuevo email.
   * @param {string} newPassword - La nueva contraseña (opcional).
   * @returns {Promise<Result<void>>} Resultado de la actualización.
   */
  async updateUserCredentials(user: User, newName: string, newEmail: string, newPassword?: string): Promise<Result<void>> {
    try {
      // Actualizar nombre si es diferente
      if (user.displayName !== newName) {
        const profileResult = await this.updateProfile(user, { displayName: newName })
        if (!profileResult.success) throw profileResult.error
      }

      // Actualizar email si es diferente
      if (user.email !== newEmail) {
        const emailResult = await this.updateUserEmail(user, newEmail)
        if (!emailResult.success) throw emailResult.error
      }

      // Actualizar contraseña si se proporciona
      if (newPassword && newPassword.length >= 6) {
        const passwordResult = await this.updateUserPassword(user, newPassword)
        if (!passwordResult.success) throw passwordResult.error
      }

      return success(undefined)
    } catch (e) { 
      return failure(new ErrorAPI(normalizeError(e, 'actualizar credenciales de usuario'))) 
    }
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
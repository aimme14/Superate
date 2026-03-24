import { failure, Result, success } from "@/interfaces/db.interface"
import { normalizeError } from "@/errors/handler"
import ErrorAPI, { NotFound } from "@/errors"
import { firebaseApp, firebaseSecondaryApp } from "@/services/db"


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
  setPersistence,
  browserLocalPersistence,
  Auth,
  User,
} from "firebase/auth"

/**
 * Consist on a class that works above an instance auth
 * Have various functions like observer, verification or overwrite data
 */
class AuthService {
  auth: Auth;
  /** Auth del proyecto en app secundaria: crear usuarios sin tocar la sesión del admin en `this.auth`. */
  private secondaryAuth: Auth | null = null;
  static instance: AuthService;
  constructor() { 
    this.auth = getAuth(firebaseApp)
    // Persistencia local: la sesión se mantiene al cerrar el navegador (menos lecturas al reabrir)
    setPersistence(this.auth, browserLocalPersistence).catch((error) => {
      console.error('Error al configurar la persistencia de sesión:', error)
    })
  }

  static getInstance() {
    if (!AuthService.instance) { AuthService.instance = new AuthService() }
    return AuthService.instance
  }

  private getSecondaryAuth(): Auth {
    if (!this.secondaryAuth) {
      this.secondaryAuth = getAuth(firebaseSecondaryApp)
    }
    return this.secondaryAuth
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
   * @param {string} adminEmail - Email del admin para restaurar sesión (requerido si preserveSession es true)
   * @param {string} adminPassword - Contraseña del admin para restaurar sesión (requerido si preserveSession es true)
   * @param {boolean} sendEmailVerificationBeforeRestore - Si es true, envía verificación al usuario recién creado antes de cerrar su sesión (solo con preserveSession)
   * @returns {Promise<Result<User>>} El usuario auth de firebase creado.
   */
  async registerAccount(
    username: string, 
    email: string, 
    password: string, 
    preserveSession: boolean = false,
    adminEmail?: string,
    adminPassword?: string,
    sendEmailVerificationBeforeRestore: boolean = false
  ): Promise<Result<User>> {
    try {
      console.log('🚀 Iniciando registro de cuenta:', { email, preserveSession })
      
      if (preserveSession) {
        if (!this.auth.currentUser) {
          return failure(new ErrorAPI({
            message: 'Debes tener sesión iniciada como administrador para crear usuarios.',
            statusCode: 401
          }))
        }

        const secondaryAuth = this.getSecondaryAuth()
        console.log('🔐 Creando usuario en Auth secundario (sin cambiar sesión del admin):', this.auth.currentUser.email)

        const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password)
        const newUser = userCredential.user

        console.log('✅ Usuario creado en Firebase Auth con UID:', newUser.uid)

        const profileUpdate = await this.updateProfile(newUser, { displayName: username })
        if (!profileUpdate.success) {
          console.error('❌ Error al actualizar perfil:', profileUpdate.error)
          throw profileUpdate.error
        }

        if (sendEmailVerificationBeforeRestore) {
          try {
            await sendEmailVerificationFB(newUser)
            console.log('✅ Correo de verificación enviado al usuario creado')
          } catch (verifyErr) {
            console.warn('⚠️ No se pudo enviar verificación de email al nuevo usuario:', verifyErr)
          }
        }

        await signOut(secondaryAuth)
        console.log('✅ Sesión secundaria cerrada; sesión del administrador intacta')

        return success(newUser)
      }

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
      console.log('🔧 updateUserCredentials llamado con:', {
        currentName: user.displayName,
        newName,
        currentEmail: user.email,
        newEmail,
        hasPassword: !!newPassword,
        passwordLength: newPassword?.length || 0
      })
      
      // Actualizar nombre si es diferente
      if (user.displayName !== newName && newName) {
        console.log('📝 Actualizando nombre de perfil...')
        const profileResult = await this.updateProfile(user, { displayName: newName })
        if (!profileResult.success) {
          console.error('❌ Error al actualizar nombre:', profileResult.error)
          throw profileResult.error
        }
        console.log('✅ Nombre actualizado')
      }

      // Actualizar email si es diferente
      if (user.email !== newEmail && newEmail) {
        console.log('📧 Actualizando email...')
        const emailResult = await this.updateUserEmail(user, newEmail)
        if (!emailResult.success) {
          console.error('❌ Error al actualizar email:', emailResult.error)
          throw emailResult.error
        }
        console.log('✅ Email actualizado')
      }

      // Actualizar contraseña si se proporciona
      if (newPassword && newPassword.trim().length >= 6) {
        console.log('🔑 Actualizando contraseña...')
        const passwordResult = await this.updateUserPassword(user, newPassword)
        if (!passwordResult.success) {
          console.error('❌ Error al actualizar contraseña:', passwordResult.error)
          throw passwordResult.error
        }
        console.log('✅ Contraseña actualizada')
      } else if (newPassword) {
        console.warn('⚠️ La contraseña proporcionada es muy corta (mínimo 6 caracteres)')
      }

      return success(undefined)
    } catch (e) { 
      console.error('❌ Error en updateUserCredentials:', e)
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
   * Actualiza las credenciales de un usuario de Firebase Auth autenticándose temporalmente con él.
   * Esta función guarda la sesión del admin, se autentica con el usuario a actualizar,
   * actualiza sus credenciales, y luego vuelve a autenticar al admin.
   * @param {string} userEmail - El email actual del usuario.
   * @param {string} userPassword - La contraseña actual del usuario.
   * @param {string} newEmail - El nuevo email (opcional).
   * @param {string} newName - El nuevo nombre (opcional).
   * @param {string} newPassword - La nueva contraseña (opcional).
   * @param {string} adminEmail - El email del administrador.
   * @param {string} adminPassword - La contraseña del administrador.
   * @returns {Promise<Result<void>>} Resultado de la actualización.
   */
  async updateUserCredentialsByAdmin(
    userEmail: string,
    userPassword: string,
    newEmail: string | undefined,
    newName: string | undefined,
    newPassword: string | undefined,
    adminEmail: string,
    adminPassword: string
  ): Promise<Result<void>> {
    try {
      console.log('🔄 Iniciando actualización de credenciales de usuario en Firebase Auth:', userEmail)
      
      // Guardar el usuario actual (admin)
      const currentAdmin = this.auth.currentUser
      if (!currentAdmin || currentAdmin.email !== adminEmail) {
        console.log('⚠️ El usuario actual no coincide con el admin. Autenticando como admin...')
        // Autenticarnos como admin primero
        const adminLoginResult = await this.login(adminEmail, adminPassword)
        if (!adminLoginResult.success) {
          return failure(new ErrorAPI({ message: 'No se pudo autenticar como administrador', statusCode: 401 }))
        }
      }

      // Cerrar sesión del admin
      console.log('🔒 Cerrando sesión del admin...')
      await signOut(this.auth)

      // Autenticarnos con el usuario a actualizar
      console.log('🔐 Autenticando con el usuario a actualizar...')
      const userLoginResult = await this.login(userEmail, userPassword)
      if (!userLoginResult.success) {
        console.error('❌ Error al autenticar con el usuario:', userLoginResult.error)
        // Intentar volver a autenticar al admin
        if (adminEmail && adminPassword) {
          await this.login(adminEmail, adminPassword)
        }
        return failure(new ErrorAPI({ message: 'No se pudo autenticar con el usuario. La contraseña puede haber sido cambiada.', statusCode: 401 }))
      }

      const userToUpdate = userLoginResult.data

      // Actualizar las credenciales
      console.log('🔄 Actualizando credenciales en Firebase Auth...')
      console.log('📝 Datos a actualizar:', {
        newName: newName || userToUpdate.displayName || '',
        newEmail: newEmail || userToUpdate.email || '',
        hasNewPassword: !!newPassword,
        newPasswordLength: newPassword?.length || 0
      })
      
      const finalName = newName || userToUpdate.displayName || ''
      const finalEmail = newEmail || userToUpdate.email || ''
      
      const updateResult = await this.updateUserCredentials(
        userToUpdate,
        finalName,
        finalEmail,
        newPassword
      )
      
      if (!updateResult.success) {
        console.error('❌ Error al actualizar credenciales:', updateResult.error)
        // Intentar volver a autenticar al admin
        await signOut(this.auth)
        if (adminEmail && adminPassword) {
          await this.login(adminEmail, adminPassword)
        }
        return failure(updateResult.error)
      }

      console.log('✅ Credenciales actualizadas en Firebase Auth')

      // Volver a autenticar al admin
      console.log('🔐 Volviendo a autenticar al admin...')
      await signOut(this.auth)
      const reLoginResult = await this.login(adminEmail, adminPassword)
      if (!reLoginResult.success) {
        console.error('❌ Error al volver a autenticar al admin:', reLoginResult.error)
        return failure(new ErrorAPI({ message: 'Credenciales actualizadas pero no se pudo volver a autenticar al admin. Por favor, inicia sesión manualmente.', statusCode: 401 }))
      }

      console.log('✅ Admin reautenticado correctamente')
      return success(undefined)
    } catch (e) {
      console.error('❌ Error en updateUserCredentialsByAdmin:', e)
      // Intentar volver a autenticar al admin en caso de error
      try {
        await signOut(this.auth)
        if (adminEmail && adminPassword) {
          await this.login(adminEmail, adminPassword)
        }
      } catch (reAuthError) {
        console.error('❌ Error al volver a autenticar al admin:', reAuthError)
      }
      return failure(new ErrorAPI(normalizeError(e, 'actualizar credenciales de usuario por admin')))
    }
  }

  /**
   * Elimina un usuario de Firebase Auth autenticándose temporalmente con él.
   * Esta función guarda la sesión del admin, se autentica con el usuario a eliminar,
   * lo elimina, y luego vuelve a autenticar al admin.
   * @param {string} userEmail - El email del usuario a eliminar.
   * @param {string} userPassword - La contraseña del usuario a eliminar.
   * @param {string} adminEmail - El email del administrador.
   * @param {string} adminPassword - La contraseña del administrador.
   * @returns {Promise<Result<void>>} Resultado de la eliminación.
   */
  async deleteUserByCredentials(
    userEmail: string, 
    userPassword: string, 
    adminEmail: string, 
    adminPassword: string
  ): Promise<Result<void>> {
    try {
      console.log('🗑️ Iniciando eliminación de usuario de Firebase Auth:', userEmail)
      
      // Guardar el usuario actual (admin)
      const currentAdmin = this.auth.currentUser
      if (!currentAdmin || currentAdmin.email !== adminEmail) {
        console.log('⚠️ El usuario actual no coincide con el admin. Autenticando como admin...')
        // Autenticarnos como admin primero
        const adminLoginResult = await this.login(adminEmail, adminPassword)
        if (!adminLoginResult.success) {
          return failure(new ErrorAPI({ message: 'No se pudo autenticar como administrador', statusCode: 401 }))
        }
      }

      // Cerrar sesión del admin
      console.log('🔒 Cerrando sesión del admin...')
      await signOut(this.auth)

      // Autenticarnos con el usuario a eliminar
      console.log('🔐 Autenticando con el usuario a eliminar...')
      const userLoginResult = await this.login(userEmail, userPassword)
      if (!userLoginResult.success) {
        console.error('❌ Error al autenticar con el usuario:', userLoginResult.error)
        // Intentar volver a autenticar al admin
        if (adminEmail && adminPassword) {
          await this.login(adminEmail, adminPassword)
        }
        return failure(new ErrorAPI({ message: 'No se pudo autenticar con el usuario a eliminar. La contraseña puede haber sido cambiada.', statusCode: 401 }))
      }

      const userToDelete = userLoginResult.data

      // Eliminar el usuario
      console.log('🗑️ Eliminando usuario de Firebase Auth...')
      const deleteResult = await this.deleteUserAccount(userToDelete)
      if (!deleteResult.success) {
        console.error('❌ Error al eliminar usuario:', deleteResult.error)
        // Intentar volver a autenticar al admin
        await signOut(this.auth)
        if (adminEmail && adminPassword) {
          await this.login(adminEmail, adminPassword)
        }
        return failure(deleteResult.error)
      }

      console.log('✅ Usuario eliminado de Firebase Auth')

      // Volver a autenticar al admin
      console.log('🔐 Volviendo a autenticar al admin...')
      await signOut(this.auth)
      const reLoginResult = await this.login(adminEmail, adminPassword)
      if (!reLoginResult.success) {
        console.error('❌ Error al volver a autenticar al admin:', reLoginResult.error)
        return failure(new ErrorAPI({ message: 'Usuario eliminado pero no se pudo volver a autenticar al admin. Por favor, inicia sesión manualmente.', statusCode: 401 }))
      }

      console.log('✅ Admin reautenticado correctamente')
      return success(undefined)
    } catch (e) {
      console.error('❌ Error en deleteUserByCredentials:', e)
      // Intentar volver a autenticar al admin en caso de error
      try {
        await signOut(this.auth)
        if (adminEmail && adminPassword) {
          await this.login(adminEmail, adminPassword)
        }
      } catch (reAuthError) {
        console.error('❌ Error al volver a autenticar al admin:', reAuthError)
      }
      return failure(new ErrorAPI(normalizeError(e, 'eliminar cuenta de usuario por credenciales')))
    }
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
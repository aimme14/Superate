/** Este módulo proporciona funciones para la autenticación y gestión de usuarios */
import { authService as authFB } from "@/services/firebase/auth.service"
import { success, failure, Result } from "@/interfaces/db.interface"
import { dbService } from "@/services/firebase/db.service"
import { RegisterFormProps } from "@/schemas/auth.schema"
import ErrorAPI, { Unauthorized } from "@/errors/index"
import { normalizeError } from "@/errors/handler"
import { User as UserFB } from "firebase/auth"

/**
 * Maneja el proceso de inicio de sesión del usuario.
 * @param {Request} req - Objeto de solicitud Express. Debe contener email y password en el body.
 * @argument photoURL - Hace parte del profile del usuario autenticado (lo usamos para la verificacion de email)
 * @returns {Promise<void>} - Envía el usuario autenticado o un mensaje de error.
 */
export const login = async ({ email, password }: { email: string, password: string }): Promise<Result<UserFB>> => {
  try {
    console.log('🔐 Intentando login para:', email)
    
    const result = await authFB.login(email, password)
    if (!result.success) {
      console.log('❌ Error en login de Firebase Auth:', result.error)
      throw result.error
    }
    
    console.log('✅ Login de Firebase Auth exitoso para UID:', result.data.uid)
    
    // Verificar el rol del usuario para determinar si requiere verificación de email
    const userData = await dbService.getUserById(result.data.uid)
    console.log('📊 Datos del usuario obtenidos:', userData)
    
    if (userData.success && userData.data) {
      const userRole = userData.data.role
      console.log('👤 Rol del usuario:', userRole)
      
      // Solo estudiantes requieren verificación de email
      // Docentes, coordinadores y administradores no requieren verificación
      if (userRole === 'student' && !result.data.emailVerified) {
        console.log('⚠️ Email no verificado para estudiante')
        return failure(new Unauthorized({ message: 'Email no verificado' }))
      }
      
      console.log('✅ Login completado exitosamente')
      return success(result.data)
    } else {
      console.log('❌ No se pudieron obtener los datos del usuario:', userData.success ? 'Sin datos' : userData.error)
      return failure(new ErrorAPI({ message: 'Datos del usuario no encontrados', statusCode: 404 }))
    }
    
  } catch (e) { 
    console.log('❌ Error en login:', e)
    return failure(new ErrorAPI(normalizeError(e, 'inicio de sesión'))) 
  }
}

/**
 * Maneja el proceso de registro de un nuevo usuario.
 * registramos la cuenta con la respectiva verificación de correo.
 * @param {RegisterFormProps} user - Los datos del negocio y del nuevo usuario.
 * @returns {Promise<void>} - Envía el usuario creado o un mensaje de error.
 */
export const register = async (user: RegisterFormProps): Promise<Result<void>> => {
  try {
    const { role, userdoc, email, grade, inst, username } = user
    
    // Verificar que solo se registren estudiantes
    if (role !== 'student') {
      return failure(new Unauthorized({ message: 'Solo los estudiantes pueden registrarse públicamente. Los docentes y coordinadores deben ser creados por un administrador.' }))
    }
    
    // Generamos la contraseña automáticamente a partir del documento más un 0
    const generatedPassword = userdoc + '0'

    const userAccount = await authFB.registerAccount(username, email, generatedPassword)
    if (!userAccount.success) throw userAccount.error

    // También almacenamos el documento+0 en la base de datos para futuras consultas
    const userData = await dbService.createUser(userAccount.data, { role, grade, inst, userdoc: generatedPassword })
    if (!userData.success) throw userData.error

    const emailVerification = await authFB.sendEmailVerification()
    if (!emailVerification.success) throw emailVerification.error
    return success(undefined)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'registro de usuario'))) }
}

/**
 * Maneja el proceso de cierre de sesión del usuario.
 * @returns {Promise<void>} - Envía un mensaje de éxito.
 */
export const logout = async (): Promise<Result<void>> => {
  try {
    const result = await authFB.logout()
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) { return failure(new ErrorAPI(normalizeError(e, 'cierre de sesión'))) }
}

/**
 * Maneja el proceso de restablecimiento de contraseña.
 * Establece un token de restablecimiento de contraseña para el usuario
 * Envia un email con el token de restablecimiento de contraseña el cual expirará en 1 hora.
 * @returns {Promise<void>} - Envía un mensaje de éxito si el email se envía correctamente.
 */
export const forgotPassword = async (email: string): Promise<Result<void>> => {
  try {
    const result = await authFB.sendEmailResetPassword(email);
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) { return failure(normalizeError(e, 'envio de correo de restablecimiento de contraseña')) }
}
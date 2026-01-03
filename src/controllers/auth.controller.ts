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
      const isActive = userData.data.isActive !== false // Por defecto true si no está definido
      
      console.log('👤 Rol del usuario:', userRole)
      console.log('👤 Usuario activo:', isActive)
      
      // Verificar si el usuario está activo
      if (!isActive) {
        console.log('⚠️ Usuario desactivado o eliminado')
        return failure(new Unauthorized({ message: 'Usuario no encontrado' }))
      }
      
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
      // Si el usuario no existe en Firestore pero sí en Firebase Auth, significa que fue eliminado
      return failure(new ErrorAPI({ message: 'Usuario no encontrado', statusCode: 404 }))
    }
    
  } catch (e) { 
    console.log('❌ Error en login:', e)
    return failure(new ErrorAPI(normalizeError(e, 'inicio de sesión'))) 
  }
}

/**
 * Asigna automáticamente un estudiante a todos los docentes del mismo grado
 * @param {string} studentId - ID del estudiante
 * @param {string} institutionId - ID de la institución
 * @param {string} campusId - ID de la sede
 * @param {string} gradeId - ID del grado
 */
const assignStudentToTeachers = async (studentId: string, institutionId: string, campusId: string, gradeId: string): Promise<void> => {
  try {
    // Obtener todos los docentes del grado específico
    const teachersResult = await dbService.getTeachersByGrade(institutionId, campusId, gradeId)
    if (!teachersResult.success) {
      console.warn('No se pudieron obtener los docentes del grado:', teachersResult.error)
      return
    }

    // Asignar el estudiante a cada docente del grado
    for (const teacher of teachersResult.data) {
      await dbService.assignStudentToTeacher(teacher.id, studentId)
    }

    console.log(`✅ Estudiante ${studentId} asignado a ${teachersResult.data.length} docentes del grado ${gradeId}`)
  } catch (error) {
    console.error('Error al asignar estudiante a docentes:', error)
  }
}

/**
 * Asigna automáticamente un estudiante al coordinador de la sede
 * @param {string} studentId - ID del estudiante
 * @param {string} institutionId - ID de la institución
 * @param {string} campusId - ID de la sede
 */
const assignStudentToPrincipal = async (studentId: string, institutionId: string, campusId: string): Promise<void> => {
  try {
    // Obtener el coordinador de la sede
    const principalResult = await dbService.getPrincipalByCampus(institutionId, campusId)
    if (!principalResult.success) {
      console.warn('No se encontró coordinador para la sede:', principalResult.error)
      return
    }

    // Asignar el estudiante al coordinador
    await dbService.assignStudentToPrincipal(principalResult.data.id, studentId)

    console.log(`✅ Estudiante ${studentId} asignado al coordinador ${principalResult.data.name}`)
  } catch (error) {
    console.error('Error al asignar estudiante al coordinador:', error)
  }
}

/**
 * Asigna automáticamente un estudiante al rector de la institución
 * @param {string} studentId - ID del estudiante
 * @param {string} institutionId - ID de la institución
 */
const assignStudentToRector = async (studentId: string, institutionId: string): Promise<void> => {
  try {
    // Obtener el rector de la institución
    const rectorResult = await dbService.getRectorByInstitution(institutionId)
    if (!rectorResult.success) {
      console.warn('No se encontró rector para la institución:', rectorResult.error)
      return
    }

    // Asignar el estudiante al rector
    await dbService.assignStudentToRector(rectorResult.data.id, studentId)

    console.log(`✅ Estudiante ${studentId} asignado al rector ${rectorResult.data.name}`)
  } catch (error) {
    console.error('Error al asignar estudiante al rector:', error)
  }
}

/**
 * Maneja el proceso de registro de un nuevo usuario.
 * Los estudiantes registrados desde la página pública se crean como si fueran creados por el administrador.
 * @param {RegisterFormProps} user - Los datos del negocio y del nuevo usuario.
 * @returns {Promise<void>} - Envía el usuario creado o un mensaje de error.
 */
export const register = async (user: RegisterFormProps): Promise<Result<void>> => {
  try {
    const { role, userdoc, email, grade, inst, campus, username, representativePhone, academicYear } = user
    
    // Verificar que solo se registren estudiantes
    if (role !== 'student') {
      return failure(new Unauthorized({ message: 'Solo los estudiantes pueden registrarse públicamente. Los docentes, coordinadores y rectores deben ser creados por un administrador.' }))
    }

    // Validar que se proporcionen todos los campos necesarios
    if (!inst || !campus || !grade) {
      return failure(new ErrorAPI({ message: 'Institución, sede y grado son obligatorios para el registro', statusCode: 400 }))
    }
    
    // Generamos la contraseña automáticamente a partir del documento más un 0
    const generatedPassword = userdoc + '0'

    // Crear cuenta en Firebase Auth
    const userAccount = await authFB.registerAccount(username, email, generatedPassword)
    if (!userAccount.success) throw userAccount.error

    // Crear documento en Firestore con los mismos campos que cuando se crea por admin
    const dbUserData: any = {
      role: 'student',
      name: username,
      email,
      grade,
      inst,
      campus,
      userdoc: generatedPassword,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: 'admin' // Marcar como creado por admin para que aparezca en la gestión de usuarios
    }

    // Agregar teléfono del representante si se proporciona
    if (representativePhone) {
      dbUserData.representativePhone = representativePhone
    }

    // Agregar año académico (obligatorio)
    if (!academicYear) {
      return failure(new ErrorAPI({ message: 'El año académico es obligatorio', statusCode: 400 }))
    }
    dbUserData.academicYear = academicYear

    const dbResult = await dbService.createUser(userAccount.data, dbUserData)
    if (!dbResult.success) throw dbResult.error

    // Asignar automáticamente a docentes del mismo grado
    await assignStudentToTeachers(userAccount.data.uid, inst, campus, grade)

    // Asignar automáticamente al coordinador de la sede
    await assignStudentToPrincipal(userAccount.data.uid, inst, campus)

    // Asignar automáticamente al rector de la institución
    await assignStudentToRector(userAccount.data.uid, inst)

    // Enviar verificación de email
    const emailVerification = await authFB.sendEmailVerification()
    if (!emailVerification.success) {
      console.warn('No se pudo enviar verificación de email:', emailVerification.error)
    }

    return success(undefined)
  } catch (e) { 
    return failure(new ErrorAPI(normalizeError(e, 'registro de usuario'))) 
  }
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
/** Este módulo proporciona funciones para la autenticación y gestión de usuarios */
import { authService as authFB } from "@/services/firebase/auth.service"
import { success, failure, Result } from "@/interfaces/db.interface"
import { dbService } from "@/services/firebase/db.service"
import { getRegistrationConfig } from "@/controllers/admin.controller"
import { RegisterFormProps } from "@/schemas/auth.schema"
import ErrorAPI, { Unauthorized } from "@/errors/index"
import { normalizeError } from "@/errors/handler"
import {
  resolveCampusNameFromInstitution,
  resolveGradeNameFromInstitution,
} from "@/utils/resolveGradeNameFromInstitution"
import { User as UserFB, getIdTokenResult } from "firebase/auth"

/** Payload de login: usuario de Auth + documento de Firestore ya validado (sin lecturas extra en el cliente). */
export type LoginSuccessPayload = { firebaseUser: UserFB; profile: Record<string, unknown> }

/**
 * Maneja el proceso de inicio de sesión del usuario.
 * @param {Request} req - Objeto de solicitud Express. Debe contener email y password en el body.
 * @argument photoURL - Hace parte del profile del usuario autenticado (lo usamos para la verificacion de email)
 * @returns {Promise<void>} - Envía el usuario autenticado o un mensaje de error.
 */
export const login = async ({ email, password }: { email: string, password: string }): Promise<Result<LoginSuccessPayload>> => {
  try {
    console.log('🔐 Intentando login para:', email)
    
    const result = await authFB.login(email, password)
    if (!result.success) {
      console.log('❌ Error en login de Firebase Auth:', result.error)
      throw result.error
    }
    
    console.log('✅ Login de Firebase Auth exitoso para UID:', result.data.uid)

    // Refrescar token antes de lecturas a Firestore: las reglas usan claims en isAdminOrToken()
    // (p. ej. listados admin). El perfil por uid ya no depende de listar todas las instituciones.
    try {
      await result.data.getIdToken(true)
      await getIdTokenResult(result.data)
    } catch (tokenErr) {
      console.warn('⚠️ No se pudo refrescar token antes de cargar perfil:', tokenErr)
    }

    // Verificar el rol del usuario para determinar si requiere verificación de email
    const userData = await dbService.getUserById(result.data.uid, {
      authEmail: result.data.email ?? null,
    })
    console.log('📊 Datos del usuario obtenidos:', userData)
    
    if (userData.success && userData.data) {
      const userRole = userData.data.role
      const isActive = userData.data.isActive === true // Debe ser explícitamente true
      
      console.log('👤 Rol del usuario:', userRole)
      console.log('👤 Usuario activo:', isActive)
      
      // Verificar si el usuario está activo
      if (!isActive) {
        console.log('⚠️ Usuario inactivo - acceso denegado')
        return failure(new Unauthorized({ 
          message: 'Tu cuenta ha sido desactivada. No puedes iniciar sesión. Por favor, contacta al administrador del sistema para reactivar tu cuenta.' 
        }))
      }
      
      // Verificar si la institución del usuario está activa (si tiene institución)
      if (userData.data.institutionId || userData.data.inst) {
        const institutionId = userData.data.institutionId || userData.data.inst
        const institutionResult = await dbService.getInstitutionById(institutionId)
        
        if (institutionResult.success && institutionResult.data) {
          const institutionIsActive = institutionResult.data.isActive === true
          
          if (!institutionIsActive) {
            console.log('⚠️ Institución inactiva - acceso denegado')
            return failure(new Unauthorized({ 
              message: 'La institución asociada a tu cuenta ha sido desactivada. No puedes iniciar sesión. Por favor, contacta al administrador del sistema para más información.' 
            }))
          }
        }
      }
      
      // Ningún rol requiere verificación de email para iniciar sesión
      // La verificación de email es opcional y se envía al crear la cuenta
      // pero no es un requisito para iniciar sesión
      
      console.log('✅ Login completado exitosamente')

      // Asegurar claims actualizados tras validar perfil (idempotente si ya refrescamos arriba)
      try {
        const tokenResult = await getIdTokenResult(result.data)
        if (!tokenResult.claims.claimsRev) {
          await result.data.getIdToken(true)
        }
      } catch (tokenErr) {
        console.warn('⚠️ No se pudo refrescar token tras login:', tokenErr)
      }

      return success({
        firebaseUser: result.data,
        profile: userData.data,
      })
    } else {
      console.log('❌ No se pudieron obtener los datos del usuario:', userData.success ? 'Sin datos' : userData.error)
      if (!userData.success && userData.error) {
        return failure(userData.error)
      }
      return failure(
        new ErrorAPI({
          message:
            'No hay perfil en la base de datos para esta cuenta. Si eres administrador, debe existir el documento en Firestore en superate/auth/users con tu UID de Authentication.',
          statusCode: 404,
        })
      )
    }
    
  } catch (e) { 
    console.log('❌ Error en login:', e)
    return failure(new ErrorAPI(normalizeError(e, 'inicio de sesión'))) 
  }
}

/**
 * Asigna automáticamente un estudiante a todos los docentes del mismo grado y jornada
 * @param {string} studentId - ID del estudiante
 * @param {string} institutionId - ID de la institución
 * @param {string} campusId - ID de la sede
 * @param {string} gradeId - ID del grado
 */
const assignStudentToTeachers = async (studentId: string, institutionId: string, campusId: string, gradeId: string): Promise<void> => {
  try {
    // Obtener información del estudiante para conocer su jornada
    const studentResult = await dbService.getUserById(studentId)
    if (!studentResult.success) {
      console.warn('No se pudo obtener información del estudiante:', studentResult.error)
      return
    }

    const student = studentResult.data
    const studentJornada = (student as any).jornada // Jornada del estudiante

    // Obtener todos los docentes del grado específico
    const teachersResult = await dbService.getTeachersByGrade(institutionId, campusId, gradeId)
    if (!teachersResult.success) {
      console.warn('No se pudieron obtener los docentes del grado:', teachersResult.error)
      return
    }

    // Filtrar docentes por jornada: solo asignar a docentes con la misma jornada o jornada 'única'
    const matchingTeachers = teachersResult.data.filter((teacher: any) => {
      const teacherJornada = teacher.jornada
      // Si el profesor tiene jornada 'única', puede trabajar con cualquier estudiante
      if (teacherJornada === 'única') {
        return true
      }
      // Si el estudiante tiene jornada 'única', puede ser asignado a cualquier profesor
      if (studentJornada === 'única') {
        return true
      }
      // Si ambos tienen jornada definida, deben coincidir
      return teacherJornada === studentJornada
    })

    // Asignar el estudiante solo a los docentes que coinciden con la jornada
    for (const teacher of matchingTeachers) {
      await dbService.assignStudentToTeacher(teacher.id, studentId)
    }

    console.log(`✅ Estudiante ${studentId} (jornada: ${studentJornada || 'no especificada'}) asignado a ${matchingTeachers.length} docentes del grado ${gradeId}`)
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
    const { role, userdoc, email, grade, inst, campus, username, representativePhone, academicYear, jornada } = user
    
    // Verificar que el registro esté habilitado
    const registrationConfigResult = await getRegistrationConfig()
    if (!registrationConfigResult.success) {
      return failure(new ErrorAPI({ 
        message: 'Error al verificar la configuración de registro. Por favor, intenta más tarde.', 
        statusCode: 500 
      }))
    }
    
    if (!registrationConfigResult.data.enabled) {
      return failure(new ErrorAPI({ 
        message: 'El registro de nuevos usuarios está actualmente deshabilitado. Por favor, contacta al administrador del sistema.', 
        statusCode: 403 
      }))
    }
    
    // Verificar que solo se registren estudiantes
    if (role !== 'student') {
      return failure(new Unauthorized({ message: 'Solo los estudiantes pueden registrarse públicamente. Los docentes, coordinadores y rectores deben ser creados por un administrador.' }))
    }

    // Validar que se proporcionen todos los campos necesarios
    if (!inst || !campus || !grade) {
      return failure(new ErrorAPI({ message: 'Institución, sede y grado son obligatorios para el registro', statusCode: 400 }))
    }
    
    // Validar que la institución esté activa
    const institutionResult = await dbService.getInstitutionById(inst)
    if (!institutionResult.success) {
      return failure(new ErrorAPI({ message: 'Institución no encontrada', statusCode: 404 }))
    }
    
    const institution = institutionResult.data
    if (institution.isActive !== true) {
      return failure(new ErrorAPI({ 
        message: 'No se pueden crear usuarios para una institución inactiva. Por favor, contacta al administrador del sistema.', 
        statusCode: 400 
      }))
    }
    
    // Generamos la contraseña automáticamente a partir del documento más un 0
    const generatedPassword = userdoc + '0'

    // Crear cuenta en Firebase Auth
    const userAccount = await authFB.registerAccount(username, email, generatedPassword)
    if (!userAccount.success) throw userAccount.error

    // Crear documento en Firestore usando la nueva estructura jerárquica
    const dbUserData: any = {
      role: 'student',
      name: username,
      email,
      grade: grade,
      gradeId: grade, // Mantener ambos campos para consistencia
      institutionId: inst, // Usar institutionId para nueva estructura
      inst: inst, // Mantener inst para retrocompatibilidad
      campus: campus,
      campusId: campus, // Mantener campusId para consistencia
      sedeId: campus,
      userdoc: generatedPassword,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: 'admin' // Marcar como creado por admin para que aparezca en la gestión de usuarios
    }

    const resolvedGradeName = resolveGradeNameFromInstitution(institution, campus, grade)
    if (resolvedGradeName) {
      dbUserData.gradeName = resolvedGradeName
    }

    dbUserData.institutionName = institution.name ?? inst
    const resolvedCampusName = resolveCampusNameFromInstitution(institution, campus)
    if (resolvedCampusName) {
      dbUserData.campusName = resolvedCampusName
    }

    // Agregar jornada (obligatorio)
    if (jornada) {
      dbUserData.jornada = jornada
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

    // Usar directamente la nueva estructura jerárquica para estudiantes
    console.log('🆕 Registrando estudiante usando nueva estructura jerárquica')
    const dbResult = await dbService.createUserInNewStructure(userAccount.data, dbUserData)
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
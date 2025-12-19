import { success, failure, Result } from "@/interfaces/db.interface"
import { dbService } from "@/services/firebase/db.service"
import { authService } from "@/services/firebase/auth.service"
import { normalizeError } from "@/errors/handler"
import ErrorAPI from "@/errors"
import { User } from "@/interfaces/context.interface"

export interface CreateStudentData {
  name: string
  email: string
  institutionId: string
  campusId: string
  gradeId: string
  userdoc: string
  password?: string
  adminEmail?: string
  adminPassword?: string
  representativePhone?: string
}

export interface UpdateStudentData extends Partial<CreateStudentData> {
  isActive?: boolean
  password?: string
  phone?: string
  institutionId?: string
  campusId?: string
  gradeId?: string
}

export interface StudentFilters {
  institutionId?: string
  campusId?: string
  gradeId?: string
  isActive?: boolean
  searchTerm?: string
}

/**
 * Crea un nuevo estudiante y lo asigna automáticamente a docentes y coordinador
 * @param {CreateStudentData} studentData - Los datos del estudiante a crear
 * @returns {Promise<Result<User>>} - El estudiante creado o un error
 */
export const createStudent = async (studentData: CreateStudentData): Promise<Result<User>> => {
  try {
    const { name, email, institutionId, campusId, gradeId, userdoc, password, adminEmail, adminPassword, representativePhone } = studentData

    // Generar contraseña automáticamente si no se proporciona
    const generatedPassword = password || userdoc + '0'

    // Crear cuenta en Firebase Auth (preservando la sesión del admin)
    const userAccount = await authService.registerAccount(name, email, generatedPassword, true, adminEmail, adminPassword)
    if (!userAccount.success) throw userAccount.error

    // Crear documento en Firestore
    const dbUserData: any = {
      role: 'student',
      name,
      email,
      grade: gradeId,
      inst: institutionId,
      campus: campusId,
      userdoc: generatedPassword,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: 'admin'
    }

    // Agregar teléfono del representante si se proporciona
    if (representativePhone) {
      dbUserData.representativePhone = representativePhone
    }

    const dbResult = await dbService.createUser(userAccount.data, dbUserData)
    if (!dbResult.success) throw dbResult.error

    // Asignar automáticamente a docentes del mismo grado
    await assignStudentToTeachers(userAccount.data.uid, institutionId, campusId, gradeId)

    // Asignar automáticamente al coordinador de la sede
    await assignStudentToPrincipal(userAccount.data.uid, institutionId, campusId)

    // Asignar automáticamente al rector de la institución
    await assignStudentToRector(userAccount.data.uid, institutionId)

    // Enviar verificación de email
    const emailVerification = await authService.sendEmailVerification()
    if (!emailVerification.success) {
      console.warn('No se pudo enviar verificación de email:', emailVerification.error)
    }

    return success(dbResult.data)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'creación de estudiante')))
  }
}

/**
 * Obtiene estudiantes filtrados por criterios específicos
 * @param {StudentFilters} filters - Filtros para la búsqueda
 * @returns {Promise<Result<User[]>>} - Lista de estudiantes filtrados
 */
export const getFilteredStudents = async (filters: StudentFilters): Promise<Result<User[]>> => {
  try {
    console.log('🎯 Controlador: llamando a dbService.getFilteredStudents con filtros:', filters)
    const result = await dbService.getFilteredStudents(filters)
    console.log('🎯 Controlador: resultado del servicio:', result.success ? 'ÉXITO' : 'ERROR')
    if (result.success) {
      console.log('🎯 Controlador: datos recibidos:', result.data.length, 'estudiantes')
      console.log('🎯 Controlador: primer estudiante:', result.data[0])
    }
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) {
    console.error('🎯 Controlador: error:', e)
    return failure(new ErrorAPI(normalizeError(e, 'obtener estudiantes filtrados')))
  }
}

/**
 * Obtiene estudiantes asignados a un docente específico
 * @param {string} teacherId - ID del docente
 * @returns {Promise<Result<User[]>>} - Lista de estudiantes del docente
 */
export const getStudentsByTeacher = async (teacherId: string): Promise<Result<User[]>> => {
  try {
    const result = await dbService.getStudentsByTeacher(teacherId)
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'obtener estudiantes por docente')))
  }
}

/**
 * Obtiene estudiantes asignados a un coordinador específico
 * @param {string} principalId - ID del coordinador
 * @returns {Promise<Result<User[]>>} - Lista de estudiantes del coordinador
 */
export const getStudentsByPrincipal = async (principalId: string): Promise<Result<User[]>> => {
  try {
    const result = await dbService.getStudentsByPrincipal(principalId)
    if (!result.success) throw result.error
    return success(result.data)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'obtener estudiantes por rector')))
  }
}

/**
 * Actualiza un estudiante existente
 * @param {string} studentId - ID del estudiante
 * @param {UpdateStudentData} studentData - Datos a actualizar
 * @returns {Promise<Result<void>>} - Resultado de la actualización
 */
export const updateStudent = async (studentId: string, studentData: UpdateStudentData): Promise<Result<void>> => {
  try {
    // Obtener el estudiante actual para conseguir su email y datos actuales
    const studentResult = await dbService.getUserById(studentId)
    if (!studentResult.success) {
      return failure(studentResult.error)
    }

    const currentStudent = studentResult.data
    const oldEmail = currentStudent.email
    const oldName = currentStudent.name

    // Preparar datos para actualizar en Firestore
    const updateData: any = {}
    if (studentData.name) updateData.name = studentData.name
    if (studentData.email) updateData.email = studentData.email
    if (studentData.phone !== undefined) updateData.phone = studentData.phone
    if (studentData.userdoc !== undefined) updateData.userdoc = studentData.userdoc
    if (studentData.isActive !== undefined) updateData.isActive = studentData.isActive
    if (studentData.institutionId) updateData.inst = studentData.institutionId
    if (studentData.campusId) updateData.campus = studentData.campusId
    if (studentData.gradeId) updateData.grade = studentData.gradeId

    // Si se cambió la institución, sede o grado, necesitamos reasignar al estudiante
    if (studentData.institutionId || studentData.campusId || studentData.gradeId) {
      const newInstitutionId = studentData.institutionId || currentStudent.inst
      const newCampusId = studentData.campusId || currentStudent.campus
      const newGradeId = studentData.gradeId || currentStudent.grade

      // Remover de asignaciones anteriores
      await removeStudentFromAllAssignments(studentId)

      // Asignar a nuevas ubicaciones
      await assignStudentToTeachers(studentId, newInstitutionId, newCampusId, newGradeId)
      await assignStudentToPrincipal(studentId, newInstitutionId, newCampusId)
      await assignStudentToRector(studentId, newInstitutionId)
    }

    // Actualizar datos en Firestore
    const result = await dbService.updateUser(studentId, updateData)
    if (!result.success) throw result.error

    // Intentar actualizar credenciales en Firebase Auth si se proporcionaron
    if ((studentData.email && studentData.email !== oldEmail) || (studentData.name && studentData.name !== oldName) || studentData.password) {
      console.log('ℹ️ Actualización de credenciales en Firebase Auth')
      console.log('ℹ️ El estudiante deberá hacer login con las nuevas credenciales después de la actualización')
      console.log('ℹ️ Si se cambió el email, el usuario deberá usar el nuevo email para iniciar sesión')
      
      // Nota: Firebase Auth desde el cliente no permite actualizar credenciales de otros usuarios
      // Para una solución completa, se necesitaría Firebase Admin SDK en el backend
    }

    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'actualizar estudiante')))
  }
}

/**
 * Elimina un estudiante del sistema
 * @param {string} studentId - ID del estudiante
 * @param {string} adminEmail - Email del administrador
 * @param {string} adminPassword - Contraseña del administrador
 * @returns {Promise<Result<void>>} - Resultado de la eliminación
 */
export const deleteStudent = async (studentId: string, adminEmail?: string, adminPassword?: string): Promise<Result<void>> => {
  try {
    // Obtener información del estudiante antes de eliminar
    const studentResult = await dbService.getUserById(studentId)
    if (!studentResult.success) {
      return failure(studentResult.error)
    }

    const student = studentResult.data
    const studentEmail = student.email
    const studentUserdoc = student.userdoc || ''

    // Remover de docentes y rector antes de eliminar
    await removeStudentFromAllAssignments(studentId)
    
    // PRIMERO intentar eliminar de Firebase Auth (antes de eliminar de Firestore)
    let authDeleted = false
    if (adminEmail && adminPassword && studentEmail) {
      try {
        // Reconstruir la contraseña del estudiante (patrón: userdoc + '0')
        // Intentar múltiples variaciones de contraseña
        const passwordVariations = [
          studentUserdoc.endsWith('0') ? studentUserdoc : studentUserdoc + '0',
          studentUserdoc,
          studentUserdoc.replace(/0$/, '') + '0'
        ]
        
        console.log('🗑️ Intentando eliminar de Firebase Auth...')
        
        for (const studentPassword of passwordVariations) {
          try {
            const authDeleteResult = await authService.deleteUserByCredentials(
              studentEmail,
              studentPassword,
              adminEmail,
              adminPassword
            )
            
            if (authDeleteResult.success) {
              console.log('✅ Estudiante eliminado de Firebase Auth')
              authDeleted = true
              break
            }
          } catch (tryError) {
            console.log(`⚠️ Intento con contraseña "${studentPassword.substring(0, 3)}..." falló, intentando siguiente variación...`)
            continue
          }
        }
        
        if (!authDeleted) {
          console.warn('⚠️ No se pudo eliminar de Firebase Auth con ninguna variación de contraseña')
          console.warn('⚠️ El usuario puede haber cambiado su contraseña')
        }
      } catch (authError) {
        console.warn('⚠️ Error al eliminar de Firebase Auth:', authError)
      }
    } else {
      console.warn('⚠️ No se proporcionaron credenciales de admin. El usuario quedará en Firebase Auth.')
    }

    // SIEMPRE eliminar de Firestore (esto impedirá el login incluso si no se eliminó de Firebase Auth)
    const result = await dbService.deleteUser(studentId)
    if (!result.success) {
      // Si falla la eliminación de Firestore, al menos marcar como inactivo
      console.warn('⚠️ Error al eliminar de Firestore, marcando como inactivo...')
      await dbService.updateUser(studentId, { isActive: false, deletedAt: new Date().toISOString() })
      throw result.error
    }

    console.log('✅ Estudiante eliminado de Firestore')
    
    if (!authDeleted) {
      console.warn('⚠️ IMPORTANTE: El usuario fue eliminado de Firestore pero puede seguir existiendo en Firebase Auth')
      console.warn('⚠️ El usuario NO podrá iniciar sesión porque no existe en Firestore')
    }

    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'eliminar estudiante')))
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
 * Remueve un estudiante de todas sus asignaciones (docentes y rector)
 * @param {string} studentId - ID del estudiante
 */
const removeStudentFromAllAssignments = async (studentId: string): Promise<void> => {
  try {
    // Obtener información del estudiante para saber sus asignaciones
    const studentResult = await dbService.getUserById(studentId)
    if (!studentResult.success) return

    const student = studentResult.data

    // Remover de docentes del grado
    const teachersResult = await dbService.getTeachersByGrade(student.inst, student.campus, student.grade)
    if (teachersResult.success) {
      for (const teacher of teachersResult.data) {
        await dbService.removeStudentFromTeacher(teacher.id, studentId)
      }
    }

    // Remover del rector de la sede
    const principalResult = await dbService.getPrincipalByCampus(student.inst, student.campus)
    if (principalResult.success) {
      await dbService.removeStudentFromPrincipal(principalResult.data.id, studentId)
    }

    console.log(`✅ Estudiante ${studentId} removido de todas las asignaciones`)
  } catch (error) {
    console.error('Error al remover estudiante de asignaciones:', error)
  }
}

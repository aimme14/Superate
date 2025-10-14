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
}

export interface UpdateStudentData extends Partial<Omit<CreateStudentData, 'institutionId' | 'campusId' | 'gradeId'>> {
  isActive?: boolean
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
    const { name, email, institutionId, campusId, gradeId, userdoc, password } = studentData

    // Generar contraseña automáticamente si no se proporciona
    const generatedPassword = password || userdoc + '0'

    // Crear cuenta en Firebase Auth
    const userAccount = await authService.registerAccount(name, email, generatedPassword)
    if (!userAccount.success) throw userAccount.error

    // Crear documento en Firestore
    const dbUserData = {
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

    const dbResult = await dbService.createUser(userAccount.data, dbUserData)
    if (!dbResult.success) throw dbResult.error

    // Asignar automáticamente a docentes del mismo grado
    await assignStudentToTeachers(userAccount.data.uid, institutionId, campusId, gradeId)

    // Asignar automáticamente al coordinador de la sede
    await assignStudentToPrincipal(userAccount.data.uid, institutionId, campusId)

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
    const result = await dbService.updateUser(studentId, studentData)
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'actualizar estudiante')))
  }
}

/**
 * Elimina un estudiante del sistema
 * @param {string} studentId - ID del estudiante
 * @returns {Promise<Result<void>>} - Resultado de la eliminación
 */
export const deleteStudent = async (studentId: string): Promise<Result<void>> => {
  try {
    // Remover de docentes y rector antes de eliminar
    await removeStudentFromAllAssignments(studentId)
    
    const result = await dbService.deleteUser(studentId)
    if (!result.success) throw result.error
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
 * Asigna automáticamente un estudiante al rector de la sede
 * @param {string} studentId - ID del estudiante
 * @param {string} institutionId - ID de la institución
 * @param {string} campusId - ID de la sede
 */
const assignStudentToPrincipal = async (studentId: string, institutionId: string, campusId: string): Promise<void> => {
  try {
    // Obtener el rector de la sede
    const principalResult = await dbService.getPrincipalByCampus(institutionId, campusId)
    if (!principalResult.success) {
      console.warn('No se encontró rector para la sede:', principalResult.error)
      return
    }

    // Asignar el estudiante al rector
    await dbService.assignStudentToPrincipal(principalResult.data.id, studentId)

    console.log(`✅ Estudiante ${studentId} asignado al rector ${principalResult.data.name}`)
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

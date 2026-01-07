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
  academicYear: number // Año académico/cohorte (ej: 2026, 2027) - OBLIGATORIO
  jornada?: 'mañana' | 'tarde' | 'única' // Jornada del estudiante
}

export interface UpdateStudentData extends Partial<CreateStudentData> {
  isActive?: boolean
  password?: string
  phone?: string
  institutionId?: string
  campusId?: string
  gradeId?: string
  academicYear?: number // Año académico/cohorte (ej: 2026, 2027) - Opcional en actualización
  jornada?: 'mañana' | 'tarde' | 'única' // Jornada del estudiante
}

export interface StudentFilters {
  institutionId?: string
  campusId?: string
  gradeId?: string
  isActive?: boolean
  searchTerm?: string
  jornada?: 'mañana' | 'tarde' | 'única'
}

/**
 * Crea un nuevo estudiante y lo asigna automáticamente a docentes y coordinador
 * @param {CreateStudentData} studentData - Los datos del estudiante a crear
 * @returns {Promise<Result<User>>} - El estudiante creado o un error
 */
export const createStudent = async (studentData: CreateStudentData): Promise<Result<User>> => {
  try {
    const { name, email, institutionId, campusId, gradeId, userdoc, password, adminEmail, adminPassword, representativePhone, academicYear, jornada } = studentData

    // Validar que la institución esté activa
    const institutionResult = await dbService.getInstitutionById(institutionId)
    if (!institutionResult.success) {
      return failure(new ErrorAPI({ message: 'Institución no encontrada', statusCode: 404 }))
    }
    
    const institution = institutionResult.data
    if (institution.isActive !== true) {
      return failure(new ErrorAPI({ 
        message: 'No se pueden crear usuarios para una institución inactiva. Por favor, activa la institución primero.', 
        statusCode: 400 
      }))
    }

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

    // Agregar jornada si se proporciona
    if (jornada) {
      dbUserData.jornada = jornada
    }

    // Agregar teléfono del representante si se proporciona
    if (representativePhone) {
      dbUserData.representativePhone = representativePhone
    }

    // Agregar año académico (obligatorio)
    dbUserData.academicYear = academicYear

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
    // Obtener el estudiante actual UNA SOLA VEZ (solo si es necesario)
    let currentStudent: any = null
    let needsReassignment = false
    
    // Solo obtener datos actuales si:
    // 1. Se está cambiando institución/sede/grado (necesita reasignación)
    // 2. Se está activando el usuario (necesita validación)
    if (studentData.institutionId || studentData.campusId || studentData.gradeId || studentData.isActive === true) {
      try {
        const studentResult = await dbService.getUserById(studentId)
        if (!studentResult.success) {
          // Si es error de cuota, continuar sin validación (no crítico)
          if (studentResult.error?.statusCode === 429) {
            console.warn('⚠️ Cuota excedida al obtener estudiante, continuando sin validación')
          } else {
            return failure(studentResult.error)
          }
        } else {
          currentStudent = studentResult.data
          
          // Verificar si realmente cambió la ubicación
          const instChanged = Boolean(studentData.institutionId && studentData.institutionId !== currentStudent.inst)
          const campusChanged = Boolean(studentData.campusId && studentData.campusId !== currentStudent.campus)
          const gradeChanged = Boolean(studentData.gradeId && studentData.gradeId !== currentStudent.grade)
          needsReassignment = instChanged || campusChanged || gradeChanged
        }
      } catch (error: any) {
        // Si es error de cuota, continuar sin validación
        if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
          console.warn('⚠️ Cuota excedida, continuando sin validación de datos actuales')
        } else {
          throw error
        }
      }
    }

    // Preparar datos para actualizar en Firestore
    const updateData: any = {}
    if (studentData.name !== undefined) updateData.name = studentData.name
    if (studentData.email !== undefined) updateData.email = studentData.email
    if (studentData.phone !== undefined) updateData.phone = studentData.phone
    if (studentData.userdoc !== undefined) updateData.userdoc = studentData.userdoc
    if (studentData.isActive !== undefined) updateData.isActive = Boolean(studentData.isActive)
    if (studentData.institutionId !== undefined) updateData.inst = studentData.institutionId
    if (studentData.campusId !== undefined) updateData.campus = studentData.campusId
    if (studentData.gradeId !== undefined) updateData.grade = studentData.gradeId
    if (studentData.academicYear !== undefined) updateData.academicYear = studentData.academicYear
    if (studentData.representativePhone !== undefined) updateData.representativePhone = studentData.representativePhone
    if (studentData.jornada !== undefined) updateData.jornada = studentData.jornada

    // Actualizar datos en Firestore PRIMERO (más importante, debe completarse)
    const result = await dbService.updateUser(studentId, updateData, {
      skipValidation: !needsReassignment && studentData.isActive !== true,
      currentUserData: currentStudent
    })
    
    if (!result.success) {
      // Si es error de cuota, retornar error específico
      if (result.error?.statusCode === 429) {
        return failure(new ErrorAPI({ 
          message: 'Se ha excedido la cuota de Firebase. Por favor, espera unos minutos e intenta nuevamente. La actualización no se completó.', 
          statusCode: 429 
        }))
      }
      throw result.error
    }

    // Reasignar SOLO si realmente cambió la ubicación (en segundo plano, no bloquea, no crítico)
    if (needsReassignment && currentStudent) {
      const newInstitutionId = studentData.institutionId || currentStudent.inst
      const newCampusId = studentData.campusId || currentStudent.campus
      const newGradeId = studentData.gradeId || currentStudent.grade

      // Ejecutar reasignación en segundo plano con delay para no sobrecargar
      setTimeout(() => {
        Promise.all([
          removeStudentFromAllAssignments(studentId),
          assignStudentToTeachers(studentId, newInstitutionId, newCampusId, newGradeId),
          assignStudentToPrincipal(studentId, newInstitutionId, newCampusId),
          assignStudentToRector(studentId, newInstitutionId)
        ]).catch(error => {
          // Si es error de cuota, solo loguear (no crítico, la actualización ya se completó)
          if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
            console.warn('⚠️ Cuota excedida durante reasignación (no crítico, actualización completada)')
          } else {
            console.warn('⚠️ Error en reasignación (no crítico):', error)
          }
        })
      }, 2000) // Esperar 2 segundos para no sobrecargar Firebase
    }

    return success(undefined)
  } catch (e: any) {
    // Manejar error de cuota específicamente
    if (e?.code === 'resource-exhausted' || e?.code === 'quota-exceeded' || e?.statusCode === 429) {
      return failure(new ErrorAPI({ 
        message: 'Se ha excedido la cuota de Firebase. Por favor, espera unos minutos e intenta nuevamente.', 
        statusCode: 429 
      }))
    }
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

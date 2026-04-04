import { success, failure, Result } from "@/interfaces/db.interface"
import { dbService } from "@/services/firebase/db.service"
import { authService } from "@/services/firebase/auth.service"
import { normalizeError } from "@/errors/handler"
import ErrorAPI from "@/errors"
import { User } from "@/interfaces/context.interface"
import {
  resolveCampusNameFromInstitution,
  resolveGradeNameFromInstitution,
} from "@/utils/resolveGradeNameFromInstitution"

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
  /** ID de sede (alias semántico de campusId; debe coincidir con estudiante.sedeId) */
  sedeId?: string
  campusId?: string
  gradeId?: string
  /** Cohorte / año académico (mismo criterio que estudiante.academicYear) */
  academicYear?: number
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
    const { name, email, institutionId, campusId, gradeId, userdoc, password, representativePhone, academicYear, jornada } = studentData

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
    const userAccount = await authService.registerAccount(
      name,
      email,
      generatedPassword,
      true,
      undefined,
      undefined,
      true
    )
    if (!userAccount.success) throw userAccount.error

    // Crear documento en Firestore usando la nueva estructura jerárquica
    const dbUserData: any = {
      role: 'student',
      name,
      email,
      grade: gradeId,
      gradeId: gradeId, // Mantener ambos campos para consistencia
      institutionId: institutionId, // Usar institutionId para nueva estructura
      inst: institutionId, // Mantener inst para retrocompatibilidad
      campus: campusId,
      campusId: campusId, // Mantener campusId para consistencia
      sedeId: campusId, // Mismo ID que campusId; usado en queries alineadas con studentSummaries.sedeId
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

    const resolvedGradeName = resolveGradeNameFromInstitution(institution, campusId, gradeId)
    if (resolvedGradeName) {
      dbUserData.gradeName = resolvedGradeName
    }

    dbUserData.institutionName = institution.name ?? institutionId
    const resolvedCampusName = resolveCampusNameFromInstitution(institution, campusId)
    if (resolvedCampusName) {
      dbUserData.campusName = resolvedCampusName
    }

    // Usar directamente la nueva estructura jerárquica para estudiantes
    console.log('🆕 Creando estudiante usando nueva estructura jerárquica')
    const dbResult = await dbService.createUserInNewStructure(userAccount.data, dbUserData)
    if (!dbResult.success) throw dbResult.error

    // Asignar automáticamente a docentes del mismo grado
    await assignStudentToTeachers(userAccount.data.uid, institutionId, campusId, gradeId)

    // Asignar automáticamente al coordinador de la sede
    await assignStudentToPrincipal(userAccount.data.uid, institutionId, campusId)

    // Asignar automáticamente al rector de la institución
    await assignStudentToRector(userAccount.data.uid, institutionId)

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
    if (studentData.campusId !== undefined) {
      updateData.campus = studentData.campusId
      updateData.sedeId = studentData.campusId
    }
    if (studentData.gradeId !== undefined) updateData.grade = studentData.gradeId
    if (studentData.academicYear !== undefined) updateData.academicYear = studentData.academicYear
    if (studentData.representativePhone !== undefined) updateData.representativePhone = studentData.representativePhone
    if (studentData.jornada !== undefined) updateData.jornada = studentData.jornada

    const locationInPayload =
      studentData.institutionId !== undefined ||
      studentData.campusId !== undefined ||
      studentData.gradeId !== undefined
    if (locationInPayload) {
      let ref = currentStudent
      if (!ref) {
        const refResult = await dbService.getUserById(studentId)
        if (refResult.success) ref = refResult.data
      }
      const r = ref as Record<string, string | undefined> | null | undefined
      const effectiveInst =
        studentData.institutionId ?? r?.inst ?? r?.institutionId
      const effectiveCampus =
        studentData.campusId ?? r?.campus ?? r?.campusId
      const effectiveGrade =
        studentData.gradeId ?? r?.grade ?? r?.gradeId
      if (effectiveInst && effectiveCampus) {
        const instRes = await dbService.getInstitutionById(effectiveInst)
        if (instRes.success) {
          const instData = instRes.data
          updateData.institutionName = instData.name ?? effectiveInst
          const cn = resolveCampusNameFromInstitution(instData, effectiveCampus)
          if (cn) updateData.campusName = cn
          if (effectiveGrade) {
            const gn = resolveGradeNameFromInstitution(instData, effectiveCampus, effectiveGrade)
            if (gn) updateData.gradeName = gn
          }
        }
      }
    }

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
export const deleteStudent = async (studentId: string): Promise<Result<void>> => {
  try {
    const studentResult = await dbService.getUserById(studentId)
    if (!studentResult.success) {
      return failure(studentResult.error)
    }

    await removeStudentFromAllAssignments(studentId)

    const result = await dbService.deleteUser(studentId)
    if (!result.success) {
      console.warn('⚠️ Error al eliminar de Firestore, marcando como inactivo...')
      await dbService.updateUser(studentId, { isActive: false, deletedAt: new Date().toISOString() })
      throw result.error
    }

    console.log('✅ Estudiante eliminado de Firestore')
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'eliminar estudiante')))
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

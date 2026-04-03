import { Teacher } from '@/interfaces/db.interface'
import { Result, success, failure } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { dbService } from '@/services/firebase/db.service'
import { authService } from '@/services/firebase/auth.service'
import { resolveGradeNameFromInstitution } from '@/utils/resolveGradeNameFromInstitution'

// Interfaces para las operaciones CRUD
export interface CreateTeacherData {
  name: string
  email: string
  institutionId: string
  campusId: string
  gradeId: string
  subjects?: string[] // Opcional - los docentes no necesitan materias específicas
  phone?: string
  password?: string // Contraseña para la cuenta de usuario
  adminEmail?: string
  adminPassword?: string
  jornada?: 'mañana' | 'tarde' | 'única' // Jornada del profesor
}

export interface UpdateTeacherData extends Partial<Omit<CreateTeacherData, 'institutionId'>> {
  adminEmail?: string
  adminPassword?: string
  currentPassword?: string // Contraseña actual del docente (requerida para cambiar contraseña)
  studentCount?: number
  students?: string[]
  isActive?: boolean
  institutionId?: string // Para mover el docente a otra institución
  campusId?: string // Para mover el docente a otra sede
  gradeId?: string // Para mover el docente a otro grado
  jornada?: 'mañana' | 'tarde' | 'única' // Jornada del profesor
}

// Funciones CRUD para Docentes
export const getAllTeachers = async (): Promise<Result<Teacher[]>> => {
  try {
    const result = await dbService.getAllTeachers()
    if (result.success) {
      return success(result.data as Teacher[])
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener docentes', statusCode: 500 }))
  }
}

export const getTeacherById = async (id: string): Promise<Result<Teacher>> => {
  try {
    const result = await dbService.getTeacherById(id)
    if (result.success) {
      return success(result.data as Teacher)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener el docente', statusCode: 500 }))
  }
}

export const createTeacher = async (data: CreateTeacherData): Promise<Result<Teacher>> => {
  try {
    console.log('🚀 Iniciando creación de docente con datos:', {
      name: data.name,
      email: data.email,
      institutionId: data.institutionId,
      campusId: data.campusId,
      gradeId: data.gradeId,
      hasPassword: !!data.password
    })

    if (!data.name || !data.email || !data.institutionId || !data.campusId || !data.gradeId) {
      return failure(new ErrorAPI({ message: 'Nombre, email, institución, sede y grado son obligatorios', statusCode: 400 }))
    }

    // Validar que la institución esté activa
    const institutionResult = await dbService.getInstitutionById(data.institutionId)
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
    const generatedPassword = data.password || data.name.toLowerCase().replace(/\s+/g, '') + '123'
    console.log('🔐 Contraseña generada para docente (longitud):', generatedPassword.length)

    // Crear cuenta en Firebase Auth (preservando la sesión del admin)
    console.log('📝 Creando cuenta en Firebase Auth...')
    const userAccount = await authService.registerAccount(data.name, data.email, generatedPassword, true, undefined, undefined)
    if (!userAccount.success) {
      console.error('❌ Error al crear cuenta en Firebase Auth:', userAccount.error)
      throw userAccount.error
    }
    console.log('✅ Cuenta creada en Firebase Auth con UID:', userAccount.data.uid)

    // Crear documento en Firestore usando la nueva estructura jerárquica
    const teacherData: any = {
      role: 'teacher',
      name: data.name,
      email: data.email,
      institutionId: data.institutionId,
      inst: data.institutionId, // Mantener inst para retrocompatibilidad
      campusId: data.campusId,
      campus: data.campusId, // Mantener campus para retrocompatibilidad
      sedeId: data.campusId, // Misma sede; alineado con estudiantes y studentSummaries.sedeId
      gradeId: data.gradeId,
      grade: data.gradeId, // Mantener grade para retrocompatibilidad
      subjects: data.subjects || [], // Si no se proporcionan materias, usar array vacío
      phone: data.phone,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    }

    // Agregar jornada si se proporciona
    if (data.jornada) {
      teacherData.jornada = data.jornada
    }

    const resolvedGradeName = resolveGradeNameFromInstitution(institution, data.campusId, data.gradeId)
    if (resolvedGradeName) {
      teacherData.gradeName = resolvedGradeName
    }

    console.log('👨‍🏫 Datos del docente a guardar en Firestore:', teacherData)
    console.log('🎯 Rol del docente:', teacherData.role)

    // Usar directamente la nueva estructura jerárquica para profesores
    console.log('🆕 Creando docente usando nueva estructura jerárquica')
    const dbResult = await dbService.createUserInNewStructure(userAccount.data, {
      ...teacherData,
      uid: userAccount.data.uid // Pasar el UID de Firebase Auth
    })
    if (!dbResult.success) {
      console.error('❌ Error al crear usuario docente en nueva estructura:', dbResult.error)
      throw dbResult.error
    }
    console.log('✅ Usuario docente creado en nueva estructura jerárquica')

    // Crear también en la estructura jerárquica de grados (para referencias)
    console.log('📊 Agregando docente a la estructura jerárquica de grados...')
    const gradeResult = await dbService.createTeacherInGrade({
      ...teacherData,
      uid: userAccount.data.uid // Pasar el UID de Firebase Auth
    })
    if (!gradeResult.success) {
      console.warn('⚠️ No se pudo crear el docente en la estructura jerárquica de grados:', gradeResult.error)
      // No es crítico, el usuario ya existe en la nueva estructura jerárquica
    } else {
      console.log('✅ Docente agregado a la estructura jerárquica de grados')
    }

    // No enviar verificación de email para docentes
    console.log('ℹ️ Docentes no requieren verificación de email')

    console.log('🎉 Docente creado exitosamente. Puede hacer login inmediatamente.')
    return success(dbResult.data as Teacher)
  } catch (error) {
    console.error('❌ Error general al crear docente:', error)
    return failure(new ErrorAPI({ message: error instanceof Error ? error.message : 'Error al crear el docente', statusCode: 500 }))
  }
}

export const updateTeacher = async (id: string, data: UpdateTeacherData): Promise<Result<Teacher>> => {
  try {
    const result = await dbService.updateTeacher(id, data)
    if (result.success) {
      return success(result.data as Teacher)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar el docente', statusCode: 500 }))
  }
}

export const deleteTeacher = async (id: string): Promise<Result<boolean>> => {
  try {
    const result = await dbService.deleteTeacher(id)
    if (result.success) {
      return success(true)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar el docente', statusCode: 500 }))
  }
}

export const deleteTeacherFromGrade = async (
  institutionId: string,
  campusId: string,
  gradeId: string,
  teacherId: string
): Promise<Result<boolean>> => {
  try {
    // Primero obtener la información del docente para conseguir su email
    const institutionResult = await dbService.getInstitutionById(institutionId)
    if (!institutionResult.success) {
      return failure(institutionResult.error)
    }

    const institution = institutionResult.data
    const campus = institution.campuses.find((c: any) => c.id === campusId)
    if (!campus) {
      return failure(new ErrorAPI({ message: 'Sede no encontrada', statusCode: 404 }))
    }

    const grade = campus.grades.find((g: any) => g.id === gradeId)
    if (!grade) {
      return failure(new ErrorAPI({ message: 'Grado no encontrado', statusCode: 404 }))
    }

    const teacher = grade.teachers?.find((t: any) => t.id === teacherId)
    if (!teacher) {
      return failure(new ErrorAPI({ message: 'Docente no encontrado en el grado', statusCode: 404 }))
    }

    // PRIMERO: Buscar y eliminar el usuario de Firestore ANTES de eliminar de la estructura jerárquica
    // Esto garantiza que el usuario no pueda iniciar sesión incluso si falla algo después
    let userToDelete: any = null
    try {
      const usersResult = await dbService.getAllUsers()
      if (usersResult.success) {
        userToDelete = usersResult.data.find((user: any) =>
          user.email === teacher.email && user.role === 'teacher'
        )

        if (userToDelete) {
          console.log('🗑️ Eliminando usuario de Firestore PRIMERO (antes de estructura jerárquica):', userToDelete.id)

          // SIEMPRE eliminar de Firestore (bloquea el acceso aunque quede cuenta en Firebase Auth)
          const deleteResult = await dbService.deleteUser(userToDelete.id)
          if (deleteResult.success) {
            console.log('✅ Usuario eliminado de Firestore')
          } else {
            console.warn('⚠️ Error al eliminar usuario de Firestore, marcando como inactivo...')
            // Si falla la eliminación, al menos marcar como inactivo - CRÍTICO para prevenir login
            const updateResult = await dbService.updateUser(userToDelete.id, { isActive: false, deletedAt: new Date().toISOString() })
            if (!updateResult.success) {
              console.error('❌ ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario de Firestore')
              return failure(new ErrorAPI({ message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', statusCode: 500 }))
            }
            console.log('✅ Usuario marcado como inactivo en Firestore')
          }
        } else {
          console.warn('⚠️ No se encontró el usuario en Firestore con email:', teacher.email)
        }
      }
    } catch (userError) {
      console.error('❌ Error crítico al eliminar usuario de Firestore:', userError)
      // Si no podemos eliminar o desactivar el usuario, no continuar con la eliminación
      return failure(new ErrorAPI({ message: 'Error crítico: No se pudo eliminar el usuario de Firestore', statusCode: 500 }))
    }

    // SEGUNDO: Eliminar el docente del grado (estructura jerárquica)
    // Solo después de asegurar que el usuario no puede iniciar sesión
    const result = await dbService.deleteTeacherFromGrade(institutionId, campusId, gradeId, teacherId)
    if (!result.success) {
      // Si falla la eliminación de la estructura jerárquica, el usuario ya está bloqueado en Firestore
      console.warn('⚠️ El usuario ya fue eliminado/desactivado de Firestore, pero falló la eliminación de la estructura jerárquica')
      return failure(result.error)
    }

    return success(true)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar el docente del grado', statusCode: 500 }))
  }
}

export const updateTeacherInGrade = async (institutionId: string, campusId: string, gradeId: string, teacherId: string, data: UpdateTeacherData, oldInstitutionId?: string, oldCampusId?: string, oldGradeId?: string): Promise<Result<Teacher>> => {
  try {
    // Verificar si se está moviendo el docente a otro grado/institución/sede
    const newInstitutionId = data.institutionId || institutionId
    const newCampusId = data.campusId || campusId
    const newGradeId = data.gradeId || gradeId
    const oldInstId = oldInstitutionId || institutionId
    const oldCampId = oldCampusId || campusId
    const oldGradId = oldGradeId || gradeId
    
    const isMoving = newInstitutionId !== oldInstId || newCampusId !== oldCampId || newGradeId !== oldGradId

    // Obtener el docente actual desde la ubicación original
    const oldInstitutionResult = await dbService.getInstitutionById(oldInstId)
    if (!oldInstitutionResult.success) {
      return failure(oldInstitutionResult.error)
    }

    const oldInstitution = oldInstitutionResult.data
    const oldCampus = oldInstitution.campuses.find((c: any) => c.id === oldCampId)
    if (!oldCampus) {
      return failure(new ErrorAPI({ message: 'Sede original no encontrada', statusCode: 404 }))
    }

    const oldGrade = oldCampus.grades.find((g: any) => g.id === oldGradId)
    if (!oldGrade) {
      return failure(new ErrorAPI({ message: 'Grado original no encontrado', statusCode: 404 }))
    }

    const teacher = oldGrade.teachers?.find((t: any) => t.id === teacherId)
    if (!teacher) {
      return failure(new ErrorAPI({ message: 'Docente no encontrado en el grado original', statusCode: 404 }))
    }

    const teacherUid = teacher.uid || teacherId
    const oldEmail = teacher.email
    const oldName = teacher.name

    let updatedTeacher: any
    let resolvedGradeNameForUser: string | undefined

    // Si se está moviendo el docente, primero eliminarlo del grado original y luego agregarlo al nuevo
    if (isMoving) {
      console.log('🔄 Moviendo docente de un grado a otro:', {
        from: { institution: oldInstId, campus: oldCampId, grade: oldGradId },
        to: { institution: newInstitutionId, campus: newCampusId, grade: newGradeId }
      })

      // Eliminar del grado original
      const deleteResult = await dbService.deleteTeacherFromGrade(oldInstId, oldCampId, oldGradId, teacherId)
      if (!deleteResult.success) {
        return failure(deleteResult.error)
      }

      // Obtener la nueva institución
      const newInstitutionResult = await dbService.getInstitutionById(newInstitutionId)
      if (!newInstitutionResult.success) {
        return failure(newInstitutionResult.error)
      }

      // Preparar los datos del docente actualizados
      const newInstForName = newInstitutionResult.data
      const gradeNameWhenMoving = resolveGradeNameFromInstitution(
        newInstForName,
        newCampusId,
        newGradeId
      )
      resolvedGradeNameForUser = gradeNameWhenMoving

      const updatedTeacherData = {
        ...teacher,
        ...data,
        institutionId: newInstitutionId,
        campusId: newCampusId,
        gradeId: newGradeId,
        ...(gradeNameWhenMoving ? { gradeName: gradeNameWhenMoving } : {}),
        updatedAt: new Date().toISOString().split('T')[0]
      }

      // Eliminar campos que no deben estar en el objeto del docente
      delete updatedTeacherData.adminEmail
      delete updatedTeacherData.adminPassword
      delete updatedTeacherData.currentPassword
      delete updatedTeacherData.password

      // Agregar al nuevo grado
      const createResult = await dbService.createTeacherInGrade({
        ...updatedTeacherData,
        uid: teacherUid,
        id: teacherId
      })

      if (!createResult.success) {
        return failure(createResult.error)
      }

      updatedTeacher = createResult.data
      // Continuar con la actualización de Firestore y Auth
    } else {
      // Si no se está moviendo, actualizar normalmente en el mismo grado
      const result = await dbService.updateTeacherInGrade(institutionId, campusId, gradeId, teacherId, data)
      if (!result.success) {
        return failure(result.error)
      }
      updatedTeacher = result.data
    }

    // Preparar datos para actualizar en Firestore (colección users)
    const userUpdateData: any = {}
    if (data.name) userUpdateData.name = data.name
    if (data.email) userUpdateData.email = data.email
    if (data.phone !== undefined) userUpdateData.phone = data.phone
    if (data.isActive !== undefined) userUpdateData.isActive = data.isActive
    if (data.jornada !== undefined) userUpdateData.jornada = data.jornada
    // Si se está moviendo el docente, actualizar también los IDs de institución, sede y grado
    if (isMoving) {
      userUpdateData.institutionId = newInstitutionId
      userUpdateData.campusId = newCampusId
      userUpdateData.gradeId = newGradeId
      if (resolvedGradeNameForUser) userUpdateData.gradeName = resolvedGradeNameForUser
    }

    // Actualizar en la colección de usuarios de Firestore
    if (Object.keys(userUpdateData).length > 0 && teacherUid) {
      try {
        const userUpdateResult = await dbService.updateUser(teacherUid, userUpdateData)
        if (!userUpdateResult.success) {
          console.warn('⚠️ Error al actualizar usuario en Firestore:', userUpdateResult.error)
          // No fallar la operación principal si hay error al actualizar en Firestore
        } else {
          console.log('✅ Usuario actualizado en Firestore')
        }
      } catch (userError) {
        console.warn('⚠️ Error al actualizar usuario en Firestore:', userError)
      }
    }

    // Intentar actualizar credenciales en Firebase Auth si se proporcionaron
    const isUpdatingEmail = data.email && data.email !== oldEmail
    const isUpdatingName = data.name && data.name !== oldName
    const isUpdatingPassword = data.password && data.password.trim().length >= 6
    
    console.log('🔍 Verificando si se deben actualizar credenciales:', {
      isUpdatingEmail,
      isUpdatingName,
      isUpdatingPassword,
      hasAdminEmail: !!data.adminEmail,
      hasAdminPassword: !!data.adminPassword,
      hasCurrentPassword: !!data.currentPassword,
      oldEmail
    })
    
    if (isUpdatingEmail || isUpdatingName || isUpdatingPassword) {
      if (data.adminEmail && data.adminPassword && oldEmail) {
        try {
          // Si se está cambiando la contraseña, usar la contraseña actual proporcionada
          // Si no, intentar reconstruir la contraseña original
          let currentPasswordToUse: string | undefined = undefined
          
          if (isUpdatingPassword) {
            if (data.currentPassword) {
              // Usar la contraseña actual proporcionada por el admin
              currentPasswordToUse = data.currentPassword
              console.log('🔐 Usando contraseña actual proporcionada por el admin')
            } else {
              console.warn('⚠️ Se intenta cambiar la contraseña pero no se proporcionó la contraseña actual')
              console.warn('⚠️ Intentando con contraseña reconstruida...')
            }
          }
          
          // Si no se proporcionó contraseña actual, intentar reconstruirla
          if (!currentPasswordToUse) {
            const basePassword = oldName.toLowerCase().replace(/\s+/g, '')
            const passwordVariations = [
              basePassword + '123',
              basePassword + '1234',
              basePassword,
              oldName.toLowerCase().replace(/\s+/g, '') + '123'
            ]
            
            console.log('🔄 Intentando actualizar credenciales en Firebase Auth...')
            console.log('📋 Variaciones de contraseña a intentar:', passwordVariations.map(p => p.substring(0, 3) + '...'))
            
            let credentialsUpdated = false
            for (const currentPassword of passwordVariations) {
              try {
                console.log(`🔐 Intentando con contraseña: ${currentPassword.substring(0, 3)}...`)
                const authUpdateResult = await authService.updateUserCredentialsByAdmin(
                  oldEmail,
                  currentPassword,
                  isUpdatingEmail ? data.email : undefined,
                  isUpdatingName ? data.name : undefined,
                  isUpdatingPassword ? data.password : undefined,
                  data.adminEmail,
                  data.adminPassword
                )
                
                if (authUpdateResult.success) {
                  console.log('✅ Credenciales actualizadas en Firebase Auth')
                  credentialsUpdated = true
                  break
                } else {
                  console.log(`⚠️ Intento falló: ${authUpdateResult.error?.message || 'Error desconocido'}`)
                }
              } catch (tryError: any) {
                console.log(`⚠️ Intento con contraseña falló: ${tryError?.message || 'Error desconocido'}`)
                continue
              }
            }
            
            if (!credentialsUpdated) {
              console.warn('⚠️ No se pudo actualizar credenciales en Firebase Auth con ninguna variación de contraseña')
              console.warn('⚠️ El usuario puede haber cambiado su contraseña. Las credenciales se actualizaron solo en Firestore.')
            }
          } else {
            // Usar la contraseña actual proporcionada
            console.log('🔄 Intentando actualizar credenciales en Firebase Auth con contraseña actual proporcionada...')
            console.log('📝 Datos a actualizar:', {
              newEmail: data.email || 'sin cambio',
              newName: data.name || 'sin cambio',
              hasNewPassword: !!data.password,
              newPasswordLength: data.password?.length || 0
            })
            
            const authUpdateResult = await authService.updateUserCredentialsByAdmin(
              oldEmail,
              currentPasswordToUse,
              isUpdatingEmail ? data.email : undefined,
              isUpdatingName ? data.name : undefined,
              isUpdatingPassword ? data.password : undefined,
              data.adminEmail,
              data.adminPassword
            )
            
            if (authUpdateResult.success) {
              console.log('✅ Credenciales actualizadas en Firebase Auth')
            } else {
              console.error('❌ Error al actualizar credenciales:', authUpdateResult.error)
              console.warn('⚠️ Las credenciales se actualizaron solo en Firestore.')
            }
          }
        } catch (authError: any) {
          console.error('❌ Error al actualizar Firebase Auth:', authError)
          console.warn('⚠️ Las credenciales se actualizaron solo en Firestore.')
        }
      } else {
        console.warn('⚠️ No se proporcionaron credenciales de admin. Las credenciales se actualizaron solo en Firestore.')
        console.warn('⚠️ El usuario deberá usar las credenciales anteriores para iniciar sesión.')
      }
    } else {
      console.log('ℹ️ No se están actualizando credenciales (email, nombre o contraseña)')
    }

    return success(updatedTeacher as Teacher)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar el docente en el grado', statusCode: 500 }))
  }
}

export const getTeachersByInstitution = async (institutionId: string): Promise<Result<Teacher[]>> => {
  try {
    const result = await dbService.getTeachersByInstitution(institutionId)
    if (result.success) {
      return success(result.data as Teacher[])
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener docentes por institución', statusCode: 500 }))
  }
}

export const getTeachersByCampus = async (campusId: string): Promise<Result<Teacher[]>> => {
  try {
    const result = await dbService.getTeachersByCampus(campusId)
    if (result.success) {
      return success(result.data as Teacher[])
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener docentes por sede', statusCode: 500 }))
  }
}

export const getTeachersByGrade = async (institutionId: string, campusId: string, gradeId: string): Promise<Result<Teacher[]>> => {
  try {
    const result = await dbService.getTeachersByGrade(institutionId, campusId, gradeId)
    if (result.success) {
      return success(result.data as Teacher[])
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener docentes por grado', statusCode: 500 }))
  }
}

// Funciones auxiliares para gestión de estudiantes
export const assignStudentToTeacher = async (teacherId: string, studentId: string): Promise<Result<Teacher>> => {
  try {
    const teacherResult = await getTeacherById(teacherId)
    if (!teacherResult.success) {
      return failure(teacherResult.error)
    }

    const teacher = teacherResult.data
    const currentStudents = teacher.students || []

    if (!currentStudents.includes(studentId)) {
      const updatedStudents = [...currentStudents, studentId]
      const updatedTeacher = await updateTeacher(teacherId, {
        students: updatedStudents,
        studentCount: updatedStudents.length
      })
      return updatedTeacher
    }

    return success(teacher)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al asignar estudiante al docente', statusCode: 500 }))
  }
}

export const removeStudentFromTeacher = async (teacherId: string, studentId: string): Promise<Result<Teacher>> => {
  try {
    const teacherResult = await getTeacherById(teacherId)
    if (!teacherResult.success) {
      return failure(teacherResult.error)
    }

    const teacher = teacherResult.data
    const currentStudents = teacher.students || []
    const updatedStudents = currentStudents.filter(id => id !== studentId)

    const updatedTeacher = await updateTeacher(teacherId, {
      students: updatedStudents,
      studentCount: updatedStudents.length
    })
    return updatedTeacher
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al remover estudiante del docente', statusCode: 500 }))
  }
}

// Función para obtener estadísticas de docentes
export const getTeacherStats = async (): Promise<Result<{
  total: number
  active: number
  inactive: number
  byInstitution: Record<string, number>
  bySubject: Record<string, number>
}>> => {
  try {
    const result = await getAllTeachers()
    if (!result.success) {
      return failure(result.error)
    }

    const teachers = result.data
    const stats = {
      total: teachers.length,
      active: teachers.filter(t => t.isActive).length,
      inactive: teachers.filter(t => !t.isActive).length,
      byInstitution: {} as Record<string, number>,
      bySubject: {} as Record<string, number>
    }

    // Contar por institución
    teachers.forEach(teacher => {
      if (teacher.institutionId) {
        stats.byInstitution[teacher.institutionId] = (stats.byInstitution[teacher.institutionId] || 0) + 1
      }
    })

    // Contar por materia
    teachers.forEach(teacher => {
      teacher.subjects?.forEach(subject => {
        stats.bySubject[subject] = (stats.bySubject[subject] || 0) + 1
      })
    })

    return success(stats)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener estadísticas de docentes', statusCode: 500 }))
  }
}

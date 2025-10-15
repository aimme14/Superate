import { Teacher } from '@/interfaces/db.interface'
import { Result, success, failure } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { dbService } from '@/services/firebase/db.service'
import { authService } from '@/services/firebase/auth.service'

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
}

export interface UpdateTeacherData extends Partial<Omit<CreateTeacherData, 'institutionId'>> {
  studentCount?: number
  students?: string[]
  isActive?: boolean
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

    // Generar contraseña automáticamente si no se proporciona
    const generatedPassword = data.password || data.name.toLowerCase().replace(/\s+/g, '') + '123'
    console.log('🔐 Contraseña generada para docente (longitud):', generatedPassword.length)

    // Crear cuenta en Firebase Auth (preservando la sesión del admin)
    console.log('📝 Creando cuenta en Firebase Auth...')
    const userAccount = await authService.registerAccount(data.name, data.email, generatedPassword, true)
    if (!userAccount.success) {
      console.error('❌ Error al crear cuenta en Firebase Auth:', userAccount.error)
      throw userAccount.error
    }
    console.log('✅ Cuenta creada en Firebase Auth con UID:', userAccount.data.uid)

    // Crear documento en Firestore
    const teacherData = {
      role: 'teacher',
      name: data.name,
      email: data.email,
      institutionId: data.institutionId,
      campusId: data.campusId,
      gradeId: data.gradeId,
      subjects: data.subjects || [], // Si no se proporcionan materias, usar array vacío
      phone: data.phone,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    }
    
    console.log('👨‍🏫 Datos del docente a guardar en Firestore:', teacherData)
    console.log('🎯 Rol del docente:', teacherData.role)

    const dbResult = await dbService.createUser(userAccount.data, teacherData)
    if (!dbResult.success) {
      console.error('❌ Error al crear usuario docente en Firestore:', dbResult.error)
      throw dbResult.error
    }
    console.log('✅ Usuario docente creado en Firestore con datos completos')

    // Crear también en la estructura jerárquica de grados
    console.log('📊 Agregando docente a la estructura jerárquica de grados...')
    const gradeResult = await dbService.createTeacherInGrade(teacherData)
    if (!gradeResult.success) {
      console.warn('⚠️ No se pudo crear el docente en la estructura jerárquica:', gradeResult.error)
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

export const deleteTeacherFromGrade = async (institutionId: string, campusId: string, gradeId: string, teacherId: string): Promise<Result<boolean>> => {
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

    // Eliminar el docente del grado
    const result = await dbService.deleteTeacherFromGrade(institutionId, campusId, gradeId, teacherId)
    if (!result.success) {
      return failure(result.error)
    }

    // Buscar y eliminar el usuario de Firestore usando el email
    try {
      const usersResult = await dbService.getAllUsers()
      if (usersResult.success) {
        const userToDelete = usersResult.data.find((user: any) => 
          user.email === teacher.email && user.role === 'teacher'
        )
        
        if (userToDelete) {
          console.log('🗑️ Eliminando usuario de Firestore:', userToDelete.id)
          await dbService.deleteUser(userToDelete.id)
          console.log('✅ Usuario eliminado de Firestore')
        }
      }
    } catch (userError) {
      console.warn('⚠️ Error al eliminar usuario de Firestore:', userError)
      // No fallar la operación principal si hay error al eliminar de Firestore
    }

    return success(true)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar el docente del grado', statusCode: 500 }))
  }
}

export const updateTeacherInGrade = async (institutionId: string, campusId: string, gradeId: string, teacherId: string, data: UpdateTeacherData): Promise<Result<Teacher>> => {
  try {
    const result = await dbService.updateTeacherInGrade(institutionId, campusId, gradeId, teacherId, data)
    if (result.success) {
      return success(result.data as Teacher)
    }
    return failure(result.error)
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

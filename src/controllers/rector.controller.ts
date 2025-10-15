import { Result, success, failure } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { dbService } from '@/services/firebase/db.service'
import { authService } from '@/services/firebase/auth.service'

// Interfaces para las operaciones CRUD de Rectores
export interface CreateRectorData {
  name: string
  email: string
  institutionId: string
  phone?: string
  password?: string // Contraseña para la cuenta de usuario
}

export interface UpdateRectorData extends Partial<Omit<CreateRectorData, 'institutionId'>> {
  isActive?: boolean
}

// Funciones CRUD para Rectores
export const createRector = async (data: CreateRectorData): Promise<Result<any>> => {
  try {
    console.log('🚀 Iniciando creación de rector con datos:', { 
      name: data.name, 
      email: data.email, 
      institutionId: data.institutionId,
      hasPassword: !!data.password,
      phone: data.phone
    })

    // Validaciones de entrada
    if (!data.name || !data.email || !data.institutionId) {
      const missingFields = []
      if (!data.name) missingFields.push('nombre')
      if (!data.email) missingFields.push('email')
      if (!data.institutionId) missingFields.push('institución')
      
      const errorMessage = `Campos obligatorios faltantes: ${missingFields.join(', ')}`
      console.error('❌ Validación fallida:', errorMessage)
      return failure(new ErrorAPI({ message: errorMessage, statusCode: 400 }))
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      console.error('❌ Email inválido:', data.email)
      return failure(new ErrorAPI({ message: 'El formato del email no es válido', statusCode: 400 }))
    }

    // Generar contraseña automáticamente si no se proporciona
    const generatedPassword = data.password || data.name.toLowerCase().replace(/\s+/g, '') + '123'
    console.log('🔐 Contraseña generada para rector (longitud):', generatedPassword.length)

    // Crear cuenta en Firebase Auth (preservando la sesión del admin)
    console.log('📝 Creando cuenta en Firebase Auth...')
    const userAccount = await authService.registerAccount(data.name, data.email, generatedPassword, true)
    if (!userAccount.success) {
      console.error('❌ Error al crear cuenta en Firebase Auth:', userAccount.error)
      return failure(new ErrorAPI({ 
        message: `Error al crear cuenta en Firebase Auth: ${userAccount.error.message}`, 
        statusCode: 500,
        details: userAccount.error
      }))
    }
    console.log('✅ Cuenta creada en Firebase Auth con UID:', userAccount.data.uid)

    // Crear documento en Firestore
    const rectorData = {
      role: 'rector',
      name: data.name,
      email: data.email,
      institutionId: data.institutionId,
      phone: data.phone || null,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    }

    console.log('👔 Datos del rector a guardar en Firestore:', rectorData)
    console.log('🎯 Rol del rector:', rectorData.role)

    const dbResult = await dbService.createUser(userAccount.data, rectorData)
    if (!dbResult.success) {
      console.error('❌ Error al crear usuario rector en Firestore:', dbResult.error)
      return failure(new ErrorAPI({ 
        message: `Error al crear usuario en Firestore: ${dbResult.error.message}`, 
        statusCode: 500,
        details: dbResult.error
      }))
    }
    console.log('✅ Usuario rector creado en Firestore con datos completos')

    // Crear también en la estructura jerárquica de instituciones
    console.log('📊 Agregando rector a la estructura jerárquica de instituciones...')
    const institutionResult = await dbService.addRectorToInstitution(data.institutionId, rectorData)
    if (!institutionResult.success) {
      console.warn('⚠️ No se pudo crear el rector en la estructura jerárquica:', institutionResult.error)
      // No es crítico, el usuario ya existe en Firestore
    } else {
      console.log('✅ Rector agregado a la estructura jerárquica de instituciones')
    }

    // No enviar verificación de email para rectores
    console.log('ℹ️ Rectores no requieren verificación de email')

    console.log('🎉 Rector creado exitosamente. Puede hacer login inmediatamente.')
    return success({
      ...dbResult.data,
      uid: userAccount.data.uid,
      email: data.email,
      name: data.name,
      institutionId: data.institutionId
    })
  } catch (error) {
    console.error('❌ Error general al crear rector:', error)
    return failure(new ErrorAPI({ 
      message: error instanceof Error ? error.message : 'Error inesperado al crear el rector', 
      statusCode: 500,
      details: error
    }))
  }
}

export const getAllRectors = async (): Promise<Result<any[]>> => {
  try {
    // Obtener todas las instituciones y extraer los rectores
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) {
      return failure(institutionsResult.error)
    }

    const rectors: any[] = []
    institutionsResult.data.forEach((institution: any) => {
      if (institution.rector) {
        // Calcular estadísticas para el rector
        let campusCount = 0
        let principalCount = 0
        let teacherCount = 0
        let studentCount = 0

        if (institution.campuses && Array.isArray(institution.campuses)) {
          campusCount = institution.campuses.length
          
          institution.campuses.forEach((campus: any) => {
            // Contar coordinadores
            if (campus.principal) {
              principalCount++
            }

            // Contar docentes y estudiantes por grado
            if (campus.grades && Array.isArray(campus.grades)) {
              campus.grades.forEach((grade: any) => {
                if (grade.teachers && Array.isArray(grade.teachers)) {
                  teacherCount += grade.teachers.length
                }
                if (grade.students && Array.isArray(grade.students)) {
                  studentCount += grade.students.length
                }
              })
            }
          })
        }

        rectors.push({
          ...institution.rector,
          institutionName: institution.name,
          institutionId: institution.id,
          campusCount,
          principalCount,
          teacherCount,
          studentCount
        })
      }
    })

    return success(rectors)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener rectores', statusCode: 500 }))
  }
}

export const updateRector = async (institutionId: string, rectorId: string, data: UpdateRectorData): Promise<Result<any>> => {
  try {
    const result = await dbService.updateRectorInInstitution(institutionId, rectorId, data)
    if (result.success) {
      return success(result.data)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar el rector', statusCode: 500 }))
  }
}

export const deleteRector = async (institutionId: string, rectorId: string): Promise<Result<boolean>> => {
  try {
    const result = await dbService.deleteRectorFromInstitution(institutionId, rectorId)
    if (result.success) {
      return success(true)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar el rector', statusCode: 500 }))
  }
}



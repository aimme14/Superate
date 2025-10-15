import { Result, success, failure } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { dbService } from '@/services/firebase/db.service'
import { authService } from '@/services/firebase/auth.service'

// Interfaces para las operaciones CRUD
export interface CreatePrincipalData {
  name: string
  email: string
  institutionId: string
  campusId: string
  phone?: string
  password?: string // Contraseña para la cuenta de usuario
}

export interface UpdatePrincipalData extends Partial<Omit<CreatePrincipalData, 'institutionId' | 'campusId'>> {
  isActive?: boolean
  password?: string
}

// Funciones CRUD para Coordinadores
export const createPrincipal = async (data: CreatePrincipalData): Promise<Result<any>> => {
  try {
    console.log('🚀 Iniciando creación de coordinador con datos:', { 
      name: data.name, 
      email: data.email, 
      institutionId: data.institutionId,
      campusId: data.campusId,
      hasPassword: !!data.password
    })

    if (!data.name || !data.email || !data.institutionId || !data.campusId) {
      return failure(new ErrorAPI({ message: 'Nombre, email, institución y sede son obligatorios', statusCode: 400 }))
    }

    // Generar contraseña automáticamente si no se proporciona
    const generatedPassword = data.password || data.name.toLowerCase().replace(/\s+/g, '') + '123'
    console.log('🔐 Contraseña generada para coordinador (longitud):', generatedPassword.length)

    // Crear cuenta en Firebase Auth (preservando la sesión del admin)
    console.log('📝 Creando cuenta en Firebase Auth...')
    const userAccount = await authService.registerAccount(data.name, data.email, generatedPassword, true)
    if (!userAccount.success) {
      console.error('❌ Error al crear cuenta en Firebase Auth:', userAccount.error)
      throw userAccount.error
    }
    console.log('✅ Cuenta creada en Firebase Auth con UID:', userAccount.data.uid)

    // Crear documento en Firestore
    const principalData = {
      role: 'principal',
      name: data.name,
      email: data.email,
      institutionId: data.institutionId,
      campusId: data.campusId,
      phone: data.phone,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    }

    console.log('👔 Datos del coordinador a guardar en Firestore:', principalData)
    console.log('🎯 Rol del coordinador:', principalData.role)

    const dbResult = await dbService.createUser(userAccount.data, principalData)
    if (!dbResult.success) {
      console.error('❌ Error al crear usuario coordinador en Firestore:', dbResult.error)
      throw dbResult.error
    }
    console.log('✅ Usuario coordinador creado en Firestore con datos completos')

    // Crear también en la estructura jerárquica de sedes
    console.log('📊 Agregando coordinador a la estructura jerárquica de sedes...')
    const campusResult = await dbService.addPrincipalToCampus(data.institutionId, data.campusId, principalData)
    if (!campusResult.success) {
      console.warn('⚠️ No se pudo crear el coordinador en la estructura jerárquica:', campusResult.error)
    } else {
      console.log('✅ Coordinador agregado a la estructura jerárquica de sedes')
    }

    // No enviar verificación de email para coordinadores
    console.log('ℹ️ Coordinadores no requieren verificación de email')

    console.log('🎉 Coordinador creado exitosamente. Puede hacer login inmediatamente.')
    return success(dbResult.data)
  } catch (error) {
    console.error('❌ Error general al crear coordinador:', error)
    return failure(new ErrorAPI({ message: error instanceof Error ? error.message : 'Error al crear el coordinador', statusCode: 500 }))
  }
}

export const getAllPrincipals = async (): Promise<Result<any[]>> => {
  try {
    // Obtener todas las instituciones y extraer los coordinadores de las sedes
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) {
      return failure(institutionsResult.error)
    }

    const principals: any[] = []
    institutionsResult.data.forEach((institution: any) => {
      institution.campuses.forEach((campus: any) => {
        if (campus.principal) {
          // Calcular el total de estudiantes de todos los grados de la sede
          let studentCount = 0
          if (campus.grades && Array.isArray(campus.grades)) {
            campus.grades.forEach((grade: any) => {
              if (grade.students && Array.isArray(grade.students)) {
                studentCount += grade.students.length
              }
            })
          }

          principals.push({
            ...campus.principal,
            institutionName: institution.name,
            campusName: campus.name,
            institutionId: institution.id,
            campusId: campus.id,
            studentCount // Agregar contador de estudiantes real
          })
        }
      })
    })

    return success(principals)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener coordinadores', statusCode: 500 }))
  }
}

export const updatePrincipal = async (institutionId: string, campusId: string, principalId: string, data: UpdatePrincipalData): Promise<Result<any>> => {
  try {
    // Actualizar datos en Firestore
    const result = await dbService.updatePrincipalInCampus(institutionId, campusId, principalId, data)
    if (!result.success) {
      return failure(result.error)
    }

    // Si se cambió el email, nombre o contraseña, informar sobre Firebase Auth
    if (data.email || data.name || data.password) {
      console.log('ℹ️ Actualización de credenciales en Firebase Auth')
      console.log('ℹ️ El coordinador deberá hacer login con las nuevas credenciales después de la actualización')
      
      // Nota: Firebase Auth no permite actualizar credenciales de otros usuarios desde el cliente
      // Para una solución completa, se necesitaría Firebase Admin SDK en el backend
    }

    return success(result.data)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar el coordinador', statusCode: 500 }))
  }
}

export const deletePrincipal = async (institutionId: string, campusId: string, principalId: string): Promise<Result<boolean>> => {
  try {
    const result = await dbService.deletePrincipalFromCampus(institutionId, campusId, principalId)
    if (result.success) {
      return success(true)
    }
    return failure(result.error)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar el coordinador', statusCode: 500 }))
  }
}

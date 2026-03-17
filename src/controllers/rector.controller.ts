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
  adminEmail?: string
  adminPassword?: string
}

export interface UpdateRectorData extends Partial<Omit<CreateRectorData, 'institutionId'>> {
  adminEmail?: string
  adminPassword?: string
  currentPassword?: string // Contraseña actual del rector (requerida para cambiar contraseña)
  isActive?: boolean
  institutionId?: string // Para mover el rector a otra institución
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
    console.log('🔐 Contraseña generada para rector (longitud):', generatedPassword.length)

    // Crear cuenta en Firebase Auth (preservando la sesión del admin)
    console.log('📝 Creando cuenta en Firebase Auth...')
    const userAccount = await authService.registerAccount(data.name, data.email, generatedPassword, true, data.adminEmail, data.adminPassword)
    if (!userAccount.success) {
      console.error('❌ Error al crear cuenta en Firebase Auth:', userAccount.error)
      return failure(new ErrorAPI({ 
        message: `Error al crear cuenta en Firebase Auth: ${userAccount.error.message}`, 
        statusCode: 500,
        details: userAccount.error
      }))
    }
    console.log('✅ Cuenta creada en Firebase Auth con UID:', userAccount.data.uid)

    // Crear documento en Firestore usando la nueva estructura jerárquica
    const rectorData = {
      role: 'rector',
      name: data.name,
      email: data.email,
      institutionId: data.institutionId,
      inst: data.institutionId, // Mantener inst para retrocompatibilidad
      phone: data.phone || null,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    }

    console.log('👔 Datos del rector a guardar en Firestore:', rectorData)
    console.log('🎯 Rol del rector:', rectorData.role)

    // Usar directamente la nueva estructura jerárquica para rectores
    console.log('🆕 Creando rector usando nueva estructura jerárquica')
    const dbResult = await dbService.createUserInNewStructure(userAccount.data, {
      ...rectorData,
      uid: userAccount.data.uid // Pasar el UID de Firebase Auth
    })
    if (!dbResult.success) {
      console.error('❌ Error al crear usuario rector en nueva estructura:', dbResult.error)
      return failure(new ErrorAPI({ 
        message: `Error al crear usuario en Firestore: ${dbResult.error.message}`, 
        statusCode: 500,
        details: dbResult.error
      }))
    }
    console.log('✅ Usuario rector creado en nueva estructura jerárquica')

    // Crear también en la estructura jerárquica de instituciones (para referencias)
    console.log('📊 Agregando rector a la estructura jerárquica de instituciones...')
    const addRectorResult = await dbService.addRectorToInstitution(data.institutionId, {
      ...rectorData,
      uid: userAccount.data.uid // Pasar el UID de Firebase Auth
    })
    if (!addRectorResult.success) {
      console.warn('⚠️ No se pudo crear el rector en la estructura jerárquica de instituciones:', addRectorResult.error)
      // No es crítico, el usuario ya existe en la nueva estructura jerárquica
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
    console.log('🔍 Iniciando obtención de rectores desde múltiples fuentes...')
    
    // ESTRATEGIA: Obtener rectores desde DOS fuentes y combinarlos
    // 1. Desde la colección de usuarios (users) con role='rector'
    // 2. Desde la estructura jerárquica de instituciones
    
    // PASO 1: Obtener todos los usuarios y filtrar por rol 'rector'
    const allUsersResult = await dbService.getAllUsers()
    if (!allUsersResult.success) {
      console.warn('⚠️ No se pudieron obtener usuarios desde la colección users:', allUsersResult.error)
    }
    
    const allRectorsFromUsers = allUsersResult.success 
      ? allUsersResult.data.filter((user: any) => user.role === 'rector' && user.isActive !== false)
      : []
    
    console.log(`📊 Rectores encontrados en colección users: ${allRectorsFromUsers.length}`)
    
    // PASO 2: Obtener todas las instituciones y extraer los rectores de la estructura jerárquica
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) {
      console.warn('⚠️ No se pudieron obtener instituciones:', institutionsResult.error)
      // Si falla obtener instituciones, retornar solo los rectores de la colección users
      if (allRectorsFromUsers.length > 0) {
        return success(allRectorsFromUsers.map((rector: any) => ({
          ...rector,
          id: rector.id || rector.uid,
          uid: rector.uid || rector.id,
          institutionId: rector.institutionId || rector.inst,
          institutionName: rector.institutionName || 'Institución no asignada',
          campusCount: 0,
          principalCount: 0,
          teacherCount: 0,
          studentCount: rector.studentCount || 0
        })))
      }
      return failure(institutionsResult.error)
    }

    // Crear un mapa de rectores desde la estructura jerárquica para facilitar la combinación
    const rectorsFromHierarchy = new Map<string, any>()
    const institutionMap = new Map<string, any>()
    
    // Procesar cada institución para obtener rectores de la estructura jerárquica
    for (const institution of institutionsResult.data) {
      institutionMap.set(institution.id, institution)
      
      if (institution.rector) {
        const rectorId = institution.rector.uid || institution.rector.id
        if (rectorId) {
          // Calcular estadísticas para el rector desde la estructura jerárquica
          let campusCount = 0
          let principalCount = 0
          let teacherCount = 0
          let studentCount = 0

          if (institution.campuses && Array.isArray(institution.campuses)) {
            campusCount = institution.campuses.length
            
            institution.campuses.forEach((campus: any) => {
              if (campus.principal) {
                principalCount++
              }

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

          rectorsFromHierarchy.set(rectorId, {
            ...institution.rector,
            id: rectorId,
            uid: rectorId,
            institutionName: institution.name,
            institutionId: institution.id,
            campusCount,
            principalCount,
            teacherCount,
            studentCount: institution.rector.studentCount || studentCount
          })
        }
      }
    }
    
    console.log(`📊 Rectores encontrados en estructura jerárquica: ${rectorsFromHierarchy.size}`)
    
    // PASO 3: Combinar ambas fuentes, evitando duplicados
    // Crear un mapa de usuarios por ID para acceso rápido
    const usersMap = new Map<string, any>()
    if (allUsersResult.success) {
      allUsersResult.data.forEach((user: any) => {
        const userId = user.id || user.uid
        if (userId) {
          usersMap.set(userId, user)
        }
      })
    }
    
    const combinedRectors = new Map<string, any>()
    
    // Primero agregar todos los rectores de la colección users
    for (const rectorFromUsers of allRectorsFromUsers) {
      const rectorId = rectorFromUsers.id || rectorFromUsers.uid
      if (!rectorId) {
        console.warn('⚠️ Rector sin ID o UID encontrado en colección users:', rectorFromUsers.email)
        continue
      }
      
      const institutionId = rectorFromUsers.institutionId || rectorFromUsers.inst
      const institution = institutionId ? institutionMap.get(institutionId) : null
      
      // Si existe en la estructura jerárquica, combinar datos (dar prioridad a la estructura jerárquica)
      const rectorFromHierarchy = rectorsFromHierarchy.get(rectorId)
      
      if (rectorFromHierarchy) {
        // Combinar: datos de users como base, estructura jerárquica tiene prioridad para campos específicos
        combinedRectors.set(rectorId, {
          ...rectorFromUsers, // Base: datos completos de la colección users
          ...rectorFromHierarchy, // Prioridad: estructura jerárquica sobreescribe campos específicos
          id: rectorId,
          uid: rectorId
        })
      } else {
        // Rector existe en users pero NO en estructura jerárquica - aún así incluirlo
        console.warn(`⚠️ Rector ${rectorId} (${rectorFromUsers.email}) existe en colección users pero NO en estructura jerárquica`)
        
        combinedRectors.set(rectorId, {
          ...rectorFromUsers,
          id: rectorId,
          uid: rectorId,
          institutionId: institutionId || null,
          institutionName: institution?.name || rectorFromUsers.institutionName || 'Institución no asignada',
          campusCount: 0,
          principalCount: 0,
          teacherCount: 0,
          studentCount: rectorFromUsers.studentCount || 0
        })
      }
    }
    
    // Agregar rectores que solo existen en la estructura jerárquica (por si acaso)
    for (const [rectorId, rectorFromHierarchy] of rectorsFromHierarchy.entries()) {
      if (!combinedRectors.has(rectorId)) {
        console.warn(`⚠️ Rector ${rectorId} existe en estructura jerárquica pero NO en colección users`)
        
        // Buscar en el mapa de usuarios (ya cargado)
        const userFromMap = usersMap.get(rectorId)
        if (userFromMap && userFromMap.role === 'rector') {
          combinedRectors.set(rectorId, {
            ...userFromMap,
            ...rectorFromHierarchy,
            id: rectorId,
            uid: rectorId
          })
        } else {
          // Si no existe en users, usar solo datos de estructura jerárquica
          combinedRectors.set(rectorId, rectorFromHierarchy)
        }
      }
    }
    
    const finalRectors = Array.from(combinedRectors.values())
    console.log(`✅ Total de rectores encontrados y combinados: ${finalRectors.length}`)
    
    return success(finalRectors)
  } catch (error) {
    console.error('❌ Error al obtener rectores:', error)
    return failure(new ErrorAPI({ message: 'Error al obtener rectores', statusCode: 500 }))
  }
}

/**
 * Obtiene el rector actual por uid (para dashboard rector).
 * Una sola lectura: getAllInstitutions(); el rector viene embebido en el doc de institución.
 * No usa getAllUsers() (~689 lecturas).
 */
export const getRectorByUserId = async (userId: string): Promise<Result<any>> => {
  try {
    if (!userId) return failure(new ErrorAPI({ message: 'userId es requerido', statusCode: 400 }))
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) return failure(institutionsResult.error)

    for (const institution of institutionsResult.data) {
      const rector = institution.rector
      if (!rector) continue
      const rectorId = rector.uid || rector.id
      if (rectorId !== userId) continue

      let campusCount = 0
      let principalCount = 0
      let teacherCount = 0
      let studentCount = 0
      if (institution.campuses && Array.isArray(institution.campuses)) {
        campusCount = institution.campuses.length
        institution.campuses.forEach((campus: any) => {
          if (campus.principal) principalCount++
          if (campus.grades && Array.isArray(campus.grades)) {
            campus.grades.forEach((grade: any) => {
              if (grade.teachers?.length) teacherCount += grade.teachers.length
              if (grade.students?.length) studentCount += grade.students.length
            })
          }
        })
      }

      const rectorData = {
        ...rector,
        id: rectorId,
        uid: rectorId,
        institutionId: institution.id,
        institutionName: institution.name,
        campusCount,
        principalCount,
        teacherCount,
        studentCount: rector.studentCount ?? studentCount,
      }
      return success(rectorData)
    }

    return failure(new ErrorAPI({ message: 'Rector no encontrado para el usuario', statusCode: 404 }))
  } catch (error) {
    console.error('❌ Error en getRectorByUserId:', error)
    return failure(new ErrorAPI({ message: 'Error al obtener rector por usuario', statusCode: 500 }))
  }
}

export const updateRector = async (institutionId: string, rectorId: string, data: UpdateRectorData, oldInstitutionId?: string): Promise<Result<any>> => {
  try {
    // Verificar si se está moviendo el rector a otra institución
    const newInstitutionId = data.institutionId || institutionId
    const oldInstId = oldInstitutionId || institutionId
    
    const isMoving = newInstitutionId !== oldInstId

    // Obtener el rector actual desde la ubicación original
    const oldInstitutionResult = await dbService.getInstitutionById(oldInstId)
    if (!oldInstitutionResult.success) {
      return failure(oldInstitutionResult.error)
    }

    const oldInstitution = oldInstitutionResult.data
    if (!oldInstitution.rector || oldInstitution.rector.id !== rectorId) {
      return failure(new ErrorAPI({ message: 'Rector no encontrado en la institución original', statusCode: 404 }))
    }

    const rector = oldInstitution.rector
    const rectorUid = rector.uid || rectorId
    const oldEmail = rector.email
    const oldName = rector.name

    let updatedRector: any

    // Si se está moviendo el rector, primero eliminarlo de la institución original y luego agregarlo a la nueva
    if (isMoving) {
      console.log('🔄 Moviendo rector de una institución a otra:', {
        from: { institution: oldInstId },
        to: { institution: newInstitutionId }
      })

      // Eliminar de la institución original
      const deleteResult = await dbService.deleteRectorFromInstitution(oldInstId, rectorId)
      if (!deleteResult.success) {
        return failure(deleteResult.error)
      }

      // Obtener la nueva institución
      const newInstitutionResult = await dbService.getInstitutionById(newInstitutionId)
      if (!newInstitutionResult.success) {
        return failure(newInstitutionResult.error)
      }

      // Verificar que la nueva institución no tenga ya un rector
      if (newInstitutionResult.data.rector) {
        return failure(new ErrorAPI({ message: 'La institución destino ya tiene un rector asignado', statusCode: 400 }))
      }

      // Preparar los datos del rector actualizados
      const updatedRectorData = {
        ...rector,
        ...data,
        institutionId: newInstitutionId,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      // Eliminar campos que no deben estar en el objeto del rector
      delete updatedRectorData.adminEmail
      delete updatedRectorData.adminPassword
      delete updatedRectorData.currentPassword
      delete updatedRectorData.password

      // Agregar a la nueva institución
      const createResult = await dbService.addRectorToInstitution(newInstitutionId, {
        ...updatedRectorData,
        uid: rectorUid,
        id: rectorId
      })

      if (!createResult.success) {
        return failure(createResult.error)
      }

      updatedRector = createResult.data
      // Continuar con la actualización de Firestore y Auth
    } else {
      // Si no se está moviendo, actualizar normalmente en la misma institución
      const result = await dbService.updateRectorInInstitution(institutionId, rectorId, data)
      if (!result.success) {
        return failure(result.error)
      }
      updatedRector = result.data
    }

    // Preparar datos para actualizar en Firestore (colección users)
    const userUpdateData: any = {}
    if (data.name) userUpdateData.name = data.name
    if (data.email) userUpdateData.email = data.email
    if (data.phone !== undefined) userUpdateData.phone = data.phone
    if (data.isActive !== undefined) userUpdateData.isActive = data.isActive
    // Si se está moviendo el rector, actualizar también el ID de institución
    if (isMoving) {
      userUpdateData.institutionId = newInstitutionId
    }

    // Actualizar en la colección de usuarios de Firestore
    if (Object.keys(userUpdateData).length > 0 && rectorUid) {
      try {
        const userUpdateResult = await dbService.updateUser(rectorUid, userUpdateData)
        if (!userUpdateResult.success) {
          console.warn('⚠️ Error al actualizar usuario en Firestore:', userUpdateResult.error)
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

    return success(updatedRector)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar el rector', statusCode: 500 }))
  }
}

export const deleteRector = async (
  institutionId: string, 
  rectorId: string,
  adminEmail?: string,
  adminPassword?: string
): Promise<Result<boolean>> => {
  try {
    // Obtener el rector antes de eliminarlo para conseguir su UID y email
    const institutionResult = await dbService.getInstitutionById(institutionId)
    if (!institutionResult.success) {
      return failure(institutionResult.error)
    }

    const institution = institutionResult.data
    if (!institution.rector || institution.rector.id !== rectorId) {
      return failure(new ErrorAPI({ message: 'Rector no encontrado en la institución', statusCode: 404 }))
    }

    const rector = institution.rector
    const rectorUid = rector.uid || rectorId

    // PRIMERO: Eliminar de Firestore ANTES de eliminar de la estructura jerárquica
    // Esto garantiza que el usuario no pueda iniciar sesión incluso si falla algo después
    if (rectorUid) {
      console.log('🗑️ Eliminando usuario de Firestore PRIMERO (antes de estructura jerárquica):', rectorUid)
      
      // PRIMERO intentar eliminar de Firebase Auth
      let authDeleted = false
      if (adminEmail && adminPassword && rector.email) {
        try {
          // Reconstruir la contraseña del rector (patrón: name.toLowerCase().replace(/\s+/g, '') + '123')
          const basePassword = rector.name.toLowerCase().replace(/\s+/g, '')
          const passwordVariations = [
            basePassword + '123',
            basePassword + '1234',
            basePassword,
            rector.name.toLowerCase().replace(/\s+/g, '') + '123'
          ]
          
          console.log('🗑️ Intentando eliminar de Firebase Auth...')
          
          for (const rectorPassword of passwordVariations) {
            try {
              const authDeleteResult = await authService.deleteUserByCredentials(
                rector.email,
                rectorPassword,
                adminEmail,
                adminPassword
              )
              
              if (authDeleteResult.success) {
                console.log('✅ Rector eliminado de Firebase Auth')
                authDeleted = true
                break
              }
            } catch (tryError) {
              console.log(`⚠️ Intento con contraseña falló, intentando siguiente variación...`)
              continue
            }
          }
          
          if (!authDeleted) {
            console.warn('⚠️ No se pudo eliminar de Firebase Auth con ninguna variación de contraseña')
          }
        } catch (authError) {
          console.warn('⚠️ Error al eliminar de Firebase Auth:', authError)
        }
      } else {
        console.warn('⚠️ No se proporcionaron credenciales de admin. El usuario quedará en Firebase Auth.')
      }

      // SIEMPRE eliminar de Firestore (esto impedirá el login incluso si no se eliminó de Firebase Auth)
      try {
        // Intentar eliminar de Firestore (esto intenta en nueva estructura y colección antigua)
        const deleteResult = await dbService.deleteUser(rectorUid)
        if (deleteResult.success) {
          console.log('✅ Usuario eliminado de Firestore')
        } else {
          console.warn('⚠️ No se pudo eliminar usuario de Firestore:', deleteResult.error?.message)
          console.warn('⚠️ Intentando eliminar directamente de la estructura jerárquica...')
          
          // Si falla, intentar eliminar directamente de la estructura jerárquica usando institutionId y role
          try {
            const deleteResultNewStructure = await dbService.deleteUserFromNewStructure(
              rectorUid, 
              institution.id, 
              'rector'
            )
            if (deleteResultNewStructure.success) {
              console.log('✅ Usuario eliminado de nueva estructura (intento directo)')
            } else {
              // Si aún falla, marcar como inactivo - CRÍTICO para prevenir login
              console.warn('⚠️ No se pudo eliminar, marcando como inactivo...')
              let markedAsInactive = false
              
              // Intentar marcar como inactivo en nueva estructura
              try {
                const updateResultNewStructure = await dbService.updateUserInNewStructure(rectorUid, { 
                  isActive: false, 
                  deletedAt: new Date().toISOString() 
                })
                if (updateResultNewStructure.success) {
                  console.log('✅ Usuario marcado como inactivo en Firestore (nueva estructura)')
                  markedAsInactive = true
                }
              } catch (updateNewStructureError) {
                console.warn('⚠️ Error al marcar como inactivo en nueva estructura:', updateNewStructureError)
              }
              
              // Si no se pudo en nueva estructura, intentar en colección antigua
              if (!markedAsInactive) {
                const updateResult = await dbService.updateUser(rectorUid, { 
                  isActive: false, 
                  deletedAt: new Date().toISOString() 
                })
                if (!updateResult.success) {
                  console.error('❌ ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario de Firestore')
                  return failure(new ErrorAPI({ 
                    message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
                    statusCode: 500 
                  }))
                }
                console.log('✅ Usuario marcado como inactivo en Firestore')
              }
            }
          } catch (directDeleteError: any) {
            console.error('❌ Error al intentar eliminación directa:', directDeleteError)
            // Intentar marcar como inactivo como último recurso
            try {
              const updateResultNewStructure = await dbService.updateUserInNewStructure(rectorUid, { 
                isActive: false, 
                deletedAt: new Date().toISOString() 
              })
              if (!updateResultNewStructure.success) {
                const updateResult = await dbService.updateUser(rectorUid, { 
                  isActive: false, 
                  deletedAt: new Date().toISOString() 
                })
                if (!updateResult.success) {
                  console.error('❌ ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
                  return failure(new ErrorAPI({ 
                    message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
                    statusCode: 500 
                  }))
                }
              }
              console.log('✅ Usuario marcado como inactivo en Firestore (último recurso)')
            } catch (updateError) {
              console.error('❌ ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
              return failure(new ErrorAPI({ 
                message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
                statusCode: 500 
              }))
            }
          }
        }
      } catch (userError: any) {
        console.error('❌ Error crítico al eliminar usuario de Firestore:', userError)
        // Intentar marcar como inactivo como último recurso
        try {
          const updateResultNewStructure = await dbService.updateUserInNewStructure(rectorUid, { 
            isActive: false, 
            deletedAt: new Date().toISOString() 
          })
          if (!updateResultNewStructure.success) {
            const updateResult = await dbService.updateUser(rectorUid, { 
              isActive: false, 
              deletedAt: new Date().toISOString() 
            })
            if (!updateResult.success) {
              console.error('❌ ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
              return failure(new ErrorAPI({ 
                message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
                statusCode: 500 
              }))
            }
          }
          console.log('✅ Usuario marcado como inactivo en Firestore (último recurso)')
        } catch (updateError) {
          console.error('❌ ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
          return failure(new ErrorAPI({ 
            message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
            statusCode: 500 
          }))
        }
      }
    } else {
      console.warn('⚠️ No se encontró UID del rector')
    }

    // SEGUNDO: Eliminar de la estructura jerárquica
    // Solo después de asegurar que el usuario no puede iniciar sesión
    const result = await dbService.deleteRectorFromInstitution(institutionId, rectorId)
    if (!result.success) {
      // Si falla la eliminación de la estructura jerárquica, el usuario ya está bloqueado en Firestore
      console.warn('⚠️ El usuario ya fue eliminado/desactivado de Firestore, pero falló la eliminación de la estructura jerárquica')
      return failure(result.error)
    }

    return success(true)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar el rector', statusCode: 500 }))
  }
}



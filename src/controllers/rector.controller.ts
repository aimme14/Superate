import { Result, success, failure } from '@/interfaces/db.interface'
import ErrorAPI from '@/errors'
import { dbService } from '@/services/firebase/db.service'
import { authService } from '@/services/firebase/auth.service'
import { logger } from '@/utils/logger'

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
    // Validaciones de entrada
    if (!data.name || !data.email || !data.institutionId) {
      const missingFields = []
      if (!data.name) missingFields.push('nombre')
      if (!data.email) missingFields.push('email')
      if (!data.institutionId) missingFields.push('institución')
      
      const errorMessage = `Campos obligatorios faltantes: ${missingFields.join(', ')}`
      logger.error('Validación fallida:', errorMessage)
      return failure(new ErrorAPI({ message: errorMessage, statusCode: 400 }))
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(data.email)) {
      logger.error('Email inválido:', data.email)
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

    // Crear cuenta en Firebase Auth (preservando la sesión del admin)
    const userAccount = await authService.registerAccount(data.name, data.email, generatedPassword, true, undefined, undefined)
    if (!userAccount.success) {
      logger.error('Error al crear cuenta en Firebase Auth:', userAccount.error)
      return failure(new ErrorAPI({ 
        message: `Error al crear cuenta en Firebase Auth: ${userAccount.error.message}`, 
        statusCode: 500,
        details: userAccount.error
      }))
    }

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

    // Usar directamente la nueva estructura jerárquica para rectores
    const dbResult = await dbService.createUserInNewStructure(userAccount.data, {
      ...rectorData,
      uid: userAccount.data.uid // Pasar el UID de Firebase Auth
    })
    if (!dbResult.success) {
      logger.error('Error al crear usuario rector en nueva estructura:', dbResult.error)
      return failure(new ErrorAPI({ 
        message: `Error al crear usuario en Firestore: ${dbResult.error.message}`, 
        statusCode: 500,
        details: dbResult.error
      }))
    }

    // Crear también en la estructura jerárquica de instituciones (para referencias)
    const addRectorResult = await dbService.addRectorToInstitution(data.institutionId, {
      ...rectorData,
      uid: userAccount.data.uid // Pasar el UID de Firebase Auth
    })
    if (!addRectorResult.success) {
      logger.warn('No se pudo crear el rector en la estructura jerárquica de instituciones')
      // No es crítico, el usuario ya existe en la nueva estructura jerárquica
    }

    // No enviar verificación de email para rectores
    return success({
      ...dbResult.data,
      uid: userAccount.data.uid,
      email: data.email,
      name: data.name,
      institutionId: data.institutionId
    })
  } catch (error) {
    logger.error('Error general al crear rector:', error)
    return failure(new ErrorAPI({ 
      message: error instanceof Error ? error.message : 'Error inesperado al crear el rector', 
      statusCode: 500,
      details: error
    }))
  }
}

export const getAllRectors = async (): Promise<Result<any[]>> => {
  try {
    // ESTRATEGIA: Obtener rectores desde DOS fuentes y combinarlos
    // 1. Desde la colección de usuarios (users) con role='rector'
    // 2. Desde la estructura jerárquica de instituciones
    
    // PASO 1: Obtener todos los usuarios y filtrar por rol 'rector'
    const allUsersResult = await dbService.getAllUsers()
    if (!allUsersResult.success) {
      logger.warn('No se pudieron obtener usuarios desde la colección users')
    }
    
    const allRectorsFromUsers = allUsersResult.success 
      ? allUsersResult.data.filter((user: any) => user.role === 'rector' && user.isActive !== false)
      : []
    
    // PASO 2: Obtener todas las instituciones y extraer los rectores de la estructura jerárquica
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) {
      logger.warn('No se pudieron obtener instituciones')
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
        logger.warn('Rector sin ID o UID encontrado en colección users')
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
        logger.warn('Rector existe en colección users pero NO en estructura jerárquica')
        
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
        logger.warn('Rector existe en estructura jerárquica pero NO en colección users')
        
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
    return success(finalRectors)
  } catch (error) {
    logger.error('Error al obtener rectores:', error)
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

    // 1) Intento con nueva estructura jerárquica:
    //    - superate/auth/institutions/{institutionId}/rectores/{rectorId}
    //    - además el documento suele traer institutionId/inst embebidos
    const rectorFromNewStructureResult = await dbService.getUserByIdFromNewStructure(userId)
    if (rectorFromNewStructureResult.success) {
      const rector = rectorFromNewStructureResult.data
      const role = rector.role

      // Si el usuario encontrado no es rector, asumimos que no aplica a este endpoint.
      if (role && role !== 'rector') {
        return failure(new ErrorAPI({ message: 'Rector no encontrado para el usuario', statusCode: 404 }))
      }

      const rectorId = rector.uid || rector.id || userId
      const institutionId = rector.institutionId || rector.inst

      // Si no tenemos institutionId, retornamos datos parciales.
      if (!institutionId) {
        return success({
          ...rector,
          id: rectorId,
          uid: rectorId,
        })
      }

      const institutionResult = await dbService.getInstitutionById(institutionId)
      if (!institutionResult.success) return failure(institutionResult.error)

      const institution = institutionResult.data

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
        inst: institution.id, // compatibilidad retro
        institutionName: institution.name,
        campusCount,
        principalCount,
        teacherCount,
        studentCount: rector.studentCount ?? studentCount,
      }

      return success(rectorData)
    }

    // 2) Fallback compatible con estructura anterior:
    //    - instituciones/{institutionId}.rector (embebido)
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
        inst: institution.id, // compatibilidad retro
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
    logger.error('Error en getRectorByUserId:', error)
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
          logger.warn('Error al actualizar usuario en Firestore')
        } else {
        }
      } catch (userError) {
        logger.warn('Error al actualizar usuario en Firestore')
      }
    }

    // Intentar actualizar credenciales en Firebase Auth si se proporcionaron
    const isUpdatingEmail = data.email && data.email !== oldEmail
    const isUpdatingName = data.name && data.name !== oldName
    const isUpdatingPassword = data.password && data.password.trim().length >= 6
    
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
            } else {
              logger.warn('Se intenta cambiar la contraseña pero no se proporcionó la contraseña actual')
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
            
            let credentialsUpdated = false
            for (const currentPassword of passwordVariations) {
              try {
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
                  credentialsUpdated = true
                  break
                }
              } catch (tryError: any) {
                continue
              }
            }
            
            if (!credentialsUpdated) {
              logger.warn('No se pudo actualizar credenciales en Firebase Auth con ninguna variación de contraseña')
            }
          } else {
            // Usar la contraseña actual proporcionada
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
            } else {
              logger.error('Error al actualizar credenciales:', authUpdateResult.error)
              logger.warn('Las credenciales se actualizaron solo en Firestore')
            }
          }
        } catch (authError: any) {
          logger.error('Error al actualizar Firebase Auth:', authError)
          logger.warn('Las credenciales se actualizaron solo en Firestore')
        }
      } else {
        logger.warn('No se proporcionaron credenciales de admin. Las credenciales se actualizaron solo en Firestore')
        logger.warn('El usuario deberá usar las credenciales anteriores para iniciar sesión')
      }
    }

    return success(updatedRector)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar el rector', statusCode: 500 }))
  }
}

export const deleteRector = async (
  institutionId: string, 
  rectorId: string
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
      // SIEMPRE eliminar de Firestore (bloquea el acceso aunque quede cuenta en Firebase Auth)
      try {
        // Intentar eliminar de Firestore (esto intenta en nueva estructura y colección antigua)
        const deleteResult = await dbService.deleteUser(rectorUid)
        if (deleteResult.success) {
        } else {
          logger.warn('No se pudo eliminar usuario de Firestore')
          logger.warn('Intentando eliminar directamente de la estructura jerárquica')
          
          // Si falla, intentar eliminar directamente de la estructura jerárquica usando institutionId y role
          try {
            const deleteResultNewStructure = await dbService.deleteUserFromNewStructure(
              rectorUid, 
              institution.id, 
              'rector'
            )
            if (deleteResultNewStructure.success) {
            } else {
              // Si aún falla, marcar como inactivo - CRÍTICO para prevenir login
              logger.warn('No se pudo eliminar, marcando como inactivo')
              let markedAsInactive = false
              
              // Intentar marcar como inactivo en nueva estructura
              try {
                const updateResultNewStructure = await dbService.updateUserInNewStructure(rectorUid, { 
                  isActive: false, 
                  deletedAt: new Date().toISOString() 
                })
                if (updateResultNewStructure.success) {
                  markedAsInactive = true
                }
              } catch (updateNewStructureError) {
                logger.warn('Error al marcar como inactivo en nueva estructura')
              }
              
              // Si no se pudo en nueva estructura, intentar en colección antigua
              if (!markedAsInactive) {
                const updateResult = await dbService.updateUser(rectorUid, { 
                  isActive: false, 
                  deletedAt: new Date().toISOString() 
                })
                if (!updateResult.success) {
                  logger.error('ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario de Firestore')
                  return failure(new ErrorAPI({ 
                    message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
                    statusCode: 500 
                  }))
                }
              }
            }
          } catch (directDeleteError: any) {
            logger.error('Error al intentar eliminación directa:', directDeleteError)
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
                  logger.error('ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
                  return failure(new ErrorAPI({ 
                    message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
                    statusCode: 500 
                  }))
                }
              }
            } catch (updateError) {
              logger.error('ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
              return failure(new ErrorAPI({ 
                message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
                statusCode: 500 
              }))
            }
          }
        }
      } catch (userError: any) {
        logger.error('Error crítico al eliminar usuario de Firestore:', userError)
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
              logger.error('ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
              return failure(new ErrorAPI({ 
                message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
                statusCode: 500 
              }))
            }
          }
        } catch (updateError) {
          logger.error('ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
          return failure(new ErrorAPI({ 
            message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', 
            statusCode: 500 
          }))
        }
      }
    } else {
      logger.warn('No se encontró UID del rector')
    }

    // SEGUNDO: Eliminar de la estructura jerárquica
    // Solo después de asegurar que el usuario no puede iniciar sesión
    const result = await dbService.deleteRectorFromInstitution(institutionId, rectorId)
    if (!result.success) {
      // Si falla la eliminación de la estructura jerárquica, el usuario ya está bloqueado en Firestore
      logger.warn('Usuario eliminado de Firestore pero falló eliminación de estructura jerárquica')
      return failure(result.error)
    }

    return success(true)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar el rector', statusCode: 500 }))
  }
}



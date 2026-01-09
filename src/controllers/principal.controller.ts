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
  adminEmail?: string
  adminPassword?: string
}

export interface UpdatePrincipalData extends Partial<Omit<CreatePrincipalData, 'institutionId' | 'campusId'>> {
  adminEmail?: string
  adminPassword?: string
  currentPassword?: string // Contraseña actual del coordinador (requerida para cambiar contraseña)
  isActive?: boolean
  password?: string
  institutionId?: string // Para mover el coordinador a otra institución
  campusId?: string // Para mover el coordinador a otra sede
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
    console.log('🔐 Contraseña generada para coordinador (longitud):', generatedPassword.length)

    // Crear cuenta en Firebase Auth (preservando la sesión del admin)
    console.log('📝 Creando cuenta en Firebase Auth...')
    const userAccount = await authService.registerAccount(data.name, data.email, generatedPassword, true, data.adminEmail, data.adminPassword)
    if (!userAccount.success) {
      console.error('❌ Error al crear cuenta en Firebase Auth:', userAccount.error)
      throw userAccount.error
    }
    console.log('✅ Cuenta creada en Firebase Auth con UID:', userAccount.data.uid)

    // Crear documento en Firestore usando la nueva estructura jerárquica
    const principalData = {
      role: 'principal',
      name: data.name,
      email: data.email,
      institutionId: data.institutionId,
      inst: data.institutionId, // Mantener inst para retrocompatibilidad
      campusId: data.campusId,
      campus: data.campusId, // Mantener campus para retrocompatibilidad
      phone: data.phone,
      isActive: true,
      createdAt: new Date().toISOString(),
      createdBy: 'admin'
    }

    console.log('👔 Datos del coordinador a guardar en Firestore:', principalData)
    console.log('🎯 Rol del coordinador:', principalData.role)

    // Usar directamente la nueva estructura jerárquica para coordinadores
    console.log('🆕 Creando coordinador usando nueva estructura jerárquica')
    const dbResult = await dbService.createUserInNewStructure(userAccount.data, {
      ...principalData,
      uid: userAccount.data.uid // Pasar el UID de Firebase Auth
    })
    if (!dbResult.success) {
      console.error('❌ Error al crear usuario coordinador en nueva estructura:', dbResult.error)
      throw dbResult.error
    }
    console.log('✅ Usuario coordinador creado en nueva estructura jerárquica')

    // Crear también en la estructura jerárquica de sedes (para referencias)
    console.log('📊 Agregando coordinador a la estructura jerárquica de sedes...')
    const campusResult = await dbService.addPrincipalToCampus(data.institutionId, data.campusId, {
      ...principalData,
      uid: userAccount.data.uid // Pasar el UID de Firebase Auth
    })
    if (!campusResult.success) {
      console.warn('⚠️ No se pudo crear el coordinador en la estructura jerárquica de sedes:', campusResult.error)
      // No es crítico, el usuario ya existe en la nueva estructura jerárquica
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
            studentCount: campus.principal.studentCount || 0 // Usar el contador actualizado del coordinador
          })
        }
      })
    })

    return success(principals)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al obtener coordinadores', statusCode: 500 }))
  }
}

export const updatePrincipal = async (institutionId: string, campusId: string, principalId: string, data: UpdatePrincipalData, oldInstitutionId?: string, oldCampusId?: string): Promise<Result<any>> => {
  try {
    // Verificar si se está moviendo el coordinador a otra sede/institución
    const newInstitutionId = data.institutionId || institutionId
    const newCampusId = data.campusId || campusId
    const oldInstId = oldInstitutionId || institutionId
    const oldCampId = oldCampusId || campusId
    
    const isMoving = newInstitutionId !== oldInstId || newCampusId !== oldCampId

    // Obtener el coordinador actual desde la ubicación original
    const oldInstitutionResult = await dbService.getInstitutionById(oldInstId)
    if (!oldInstitutionResult.success) {
      return failure(oldInstitutionResult.error)
    }

    const oldInstitution = oldInstitutionResult.data
    const oldCampus = oldInstitution.campuses.find((c: any) => c.id === oldCampId)
    if (!oldCampus || !oldCampus.principal || oldCampus.principal.id !== principalId) {
      return failure(new ErrorAPI({ message: 'Coordinador no encontrado en la sede original', statusCode: 404 }))
    }

    const principal = oldCampus.principal
    const principalUid = principal.uid || principalId
    const oldEmail = principal.email
    const oldName = principal.name

    let updatedPrincipal: any

    // Si se está moviendo el coordinador, primero eliminarlo de la sede original y luego agregarlo a la nueva
    if (isMoving) {
      console.log('🔄 Moviendo coordinador de una sede a otra:', {
        from: { institution: oldInstId, campus: oldCampId },
        to: { institution: newInstitutionId, campus: newCampusId }
      })

      // Eliminar de la sede original
      const deleteResult = await dbService.deletePrincipalFromCampus(oldInstId, oldCampId, principalId)
      if (!deleteResult.success) {
        return failure(deleteResult.error)
      }

      // Obtener la nueva institución
      const newInstitutionResult = await dbService.getInstitutionById(newInstitutionId)
      if (!newInstitutionResult.success) {
        return failure(newInstitutionResult.error)
      }

      // Verificar que la nueva sede existe
      const newCampus = newInstitutionResult.data.campuses.find((c: any) => c.id === newCampusId)
      if (!newCampus) {
        return failure(new ErrorAPI({ message: 'Sede destino no encontrada', statusCode: 404 }))
      }

      // Verificar que la nueva sede no tenga ya un coordinador
      if (newCampus.principal) {
        return failure(new ErrorAPI({ message: 'La sede destino ya tiene un coordinador asignado', statusCode: 400 }))
      }

      // Preparar los datos del coordinador actualizados
      const updatedPrincipalData = {
        ...principal,
        ...data,
        institutionId: newInstitutionId,
        campusId: newCampusId,
        updatedAt: new Date().toISOString().split('T')[0]
      }

      // Eliminar campos que no deben estar en el objeto del coordinador
      delete updatedPrincipalData.adminEmail
      delete updatedPrincipalData.adminPassword
      delete updatedPrincipalData.currentPassword
      delete updatedPrincipalData.password

      // Agregar a la nueva sede
      const createResult = await dbService.addPrincipalToCampus(newInstitutionId, newCampusId, {
        ...updatedPrincipalData,
        uid: principalUid,
        id: principalId
      })

      if (!createResult.success) {
        return failure(createResult.error)
      }

      updatedPrincipal = createResult.data
      // Continuar con la actualización de Firestore y Auth
    } else {
      // Si no se está moviendo, actualizar normalmente en la misma sede
      const result = await dbService.updatePrincipalInCampus(institutionId, campusId, principalId, data)
      if (!result.success) {
        return failure(result.error)
      }
      updatedPrincipal = result.data
    }

    // Preparar datos para actualizar en Firestore (colección users)
    const userUpdateData: any = {}
    if (data.name) userUpdateData.name = data.name
    if (data.email) userUpdateData.email = data.email
    if (data.phone !== undefined) userUpdateData.phone = data.phone
    if (data.isActive !== undefined) userUpdateData.isActive = data.isActive
    // Si se está moviendo el coordinador, actualizar también los IDs de institución y sede
    if (isMoving) {
      userUpdateData.institutionId = newInstitutionId
      userUpdateData.campusId = newCampusId
    }

    // Actualizar en la colección de usuarios de Firestore
    if (Object.keys(userUpdateData).length > 0 && principalUid) {
      try {
        const userUpdateResult = await dbService.updateUser(principalUid, userUpdateData)
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

    return success(updatedPrincipal)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al actualizar el coordinador', statusCode: 500 }))
  }
}

export const deletePrincipal = async (
  institutionId: string, 
  campusId: string, 
  principalId: string,
  adminEmail?: string,
  adminPassword?: string
): Promise<Result<boolean>> => {
  try {
    // Obtener el coordinador antes de eliminarlo para conseguir su UID y email
    const institutionResult = await dbService.getInstitutionById(institutionId)
    if (!institutionResult.success) {
      return failure(institutionResult.error)
    }

    const institution = institutionResult.data
    const campus = institution.campuses.find((c: any) => c.id === campusId)
    if (!campus || !campus.principal || campus.principal.id !== principalId) {
      return failure(new ErrorAPI({ message: 'Coordinador no encontrado en la sede', statusCode: 404 }))
    }

    const principal = campus.principal
    const principalUid = principal.uid || principalId

    // PRIMERO: Eliminar de Firestore ANTES de eliminar de la estructura jerárquica
    // Esto garantiza que el usuario no pueda iniciar sesión incluso si falla algo después
    if (principalUid) {
      console.log('🗑️ Eliminando usuario de Firestore PRIMERO (antes de estructura jerárquica):', principalUid)
      
      // PRIMERO intentar eliminar de Firebase Auth
      let authDeleted = false
      if (adminEmail && adminPassword && principal.email) {
        try {
          // Reconstruir la contraseña del coordinador (patrón: name.toLowerCase().replace(/\s+/g, '') + '123')
          const basePassword = principal.name.toLowerCase().replace(/\s+/g, '')
          const passwordVariations = [
            basePassword + '123',
            basePassword + '1234',
            basePassword,
            principal.name.toLowerCase().replace(/\s+/g, '') + '123'
          ]
          
          console.log('🗑️ Intentando eliminar de Firebase Auth...')
          
          for (const principalPassword of passwordVariations) {
            try {
              const authDeleteResult = await authService.deleteUserByCredentials(
                principal.email,
                principalPassword,
                adminEmail,
                adminPassword
              )
              
              if (authDeleteResult.success) {
                console.log('✅ Coordinador eliminado de Firebase Auth')
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
        const deleteResult = await dbService.deleteUser(principalUid)
        if (deleteResult.success) {
          console.log('✅ Usuario eliminado de Firestore')
        } else {
          console.warn('⚠️ Error al eliminar usuario de Firestore, marcando como inactivo...')
          // Si falla la eliminación, al menos marcar como inactivo - CRÍTICO para prevenir login
          const updateResult = await dbService.updateUser(principalUid, { isActive: false, deletedAt: new Date().toISOString() })
          if (!updateResult.success) {
            console.error('❌ ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario de Firestore')
            return failure(new ErrorAPI({ message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', statusCode: 500 }))
          }
          console.log('✅ Usuario marcado como inactivo en Firestore')
        }
      } catch (userError) {
        console.error('❌ Error crítico al eliminar usuario de Firestore:', userError)
        // Intentar marcar como inactivo como último recurso
        try {
          const updateResult = await dbService.updateUser(principalUid, { isActive: false, deletedAt: new Date().toISOString() })
          if (!updateResult.success) {
            console.error('❌ ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
            return failure(new ErrorAPI({ message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', statusCode: 500 }))
          }
          console.log('✅ Usuario marcado como inactivo en Firestore (último recurso)')
        } catch (updateError) {
          console.error('❌ ERROR CRÍTICO: No se pudo eliminar ni desactivar el usuario')
          return failure(new ErrorAPI({ message: 'Error crítico: No se pudo eliminar ni desactivar el usuario', statusCode: 500 }))
        }
      }
    } else {
      console.warn('⚠️ No se encontró UID del coordinador')
    }

    // SEGUNDO: Eliminar de la estructura jerárquica
    // Solo después de asegurar que el usuario no puede iniciar sesión
    const result = await dbService.deletePrincipalFromCampus(institutionId, campusId, principalId)
    if (!result.success) {
      // Si falla la eliminación de la estructura jerárquica, el usuario ya está bloqueado en Firestore
      console.warn('⚠️ El usuario ya fue eliminado/desactivado de Firestore, pero falló la eliminación de la estructura jerárquica')
      return failure(result.error)
    }

    return success(true)
  } catch (error) {
    return failure(new ErrorAPI({ message: 'Error al eliminar el coordinador', statusCode: 500 }))
  }
}

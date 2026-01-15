import { authService as authFB } from "@/services/firebase/auth.service"
import { success, failure, Result } from "@/interfaces/db.interface"
import { dbService } from "@/services/firebase/db.service"
import ErrorAPI from "@/errors/index"
import { normalizeError } from "@/errors/handler"
import { User as UserFB } from "firebase/auth"
import { getFirestore, collection, getDocs, doc, getDoc, setDoc } from "firebase/firestore"
import { firebaseApp } from "@/services/firebase/db.service"
import { getAllPhases } from "@/utils/firestoreHelpers"

interface CreateUserData {
  username: string
  email: string
  role: 'teacher' | 'principal'
  institution: string
  campus?: string
  grade?: string
  password: string
}

/**
 * Crea un nuevo usuario (docente o rector) - Solo para administradores
 * @param {CreateUserData} userData - Los datos del usuario a crear
 * @returns {Promise<Result<UserFB>>} - El usuario creado o un error
 */
export const createUserByAdmin = async (userData: CreateUserData): Promise<Result<UserFB>> => {
  try {
    const { username, email, role, institution, campus, grade, password } = userData

    // Validar que el rol sea válido para creación por admin
    if (role !== 'teacher' && role !== 'principal') {
      throw new Error('Solo se pueden crear usuarios con rol de docente o rector')
    }

    // Validar que la institución esté activa
    if (institution) {
      const institutionResult = await dbService.getInstitutionById(institution)
      if (!institutionResult.success) {
        return failure(new ErrorAPI({ message: 'Institución no encontrada', statusCode: 404 }))
      }
      
      const institutionData = institutionResult.data
      if (institutionData.isActive !== true) {
        return failure(new ErrorAPI({ 
          message: 'No se pueden crear usuarios para una institución inactiva. Por favor, activa la institución primero.', 
          statusCode: 400 
        }))
      }
    }

    // Crear cuenta en Firebase Auth
    const userAccount = await authFB.registerAccount(username, email, password)
    if (!userAccount.success) throw userAccount.error

    // Crear documento en Firestore usando la nueva estructura jerárquica
    const dbUserData = {
      role,
      name: username,
      email,
      grade: grade || 'N/A',
      institutionId: institution, // Usar institutionId para nueva estructura
      inst: institution, // Mantener inst para retrocompatibilidad
      campus: campus || '',
      campusId: campus || '', // Mantener campusId para consistencia
      userdoc: password,
      createdAt: new Date().toISOString(),
      isActive: true,
      createdBy: 'admin' // Marcar que fue creado por admin
    }

    // Usar directamente la nueva estructura si tiene institutionId
    let dbResult
    if (institution && (role === 'teacher' || role === 'principal')) {
      console.log('🆕 Creando usuario usando nueva estructura jerárquica')
      dbResult = await dbService.createUserInNewStructure(userAccount.data, dbUserData)
    } else {
      // Fallback a método general (que tiene retrocompatibilidad)
      dbResult = await dbService.createUser(userAccount.data, dbUserData)
    }
    
    if (!dbResult.success) throw dbResult.error

    // Enviar verificación de email
    const emailVerification = await authFB.sendEmailVerification()
    if (!emailVerification.success) {
      console.warn('No se pudo enviar verificación de email:', emailVerification.error)
    }

    return success(userAccount.data)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'creación de usuario por administrador')))
  }
}

/**
 * Obtiene todos los usuarios del sistema - Solo para administradores
 * @returns {Promise<Result<any[]>>} - Lista de usuarios
 */
export const getAllSystemUsers = async (): Promise<Result<any[]>> => {
  try {
    const result = await dbService.getAllUsers()
    if (!result.success) throw result.error
    
    return success(result.data)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'obtener usuarios del sistema')))
  }
}

/**
 * Actualiza un usuario existente - Solo para administradores
 * @param {string} userId - ID del usuario
 * @param {Partial<any>} updateData - Datos a actualizar
 * @returns {Promise<Result<void>>} - Resultado de la actualización
 */
export const updateUserByAdmin = async (userId: string, updateData: Partial<any>): Promise<Result<void>> => {
  try {
    const result = await dbService.updateUser(userId, updateData)
    if (!result.success) throw result.error
    
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'actualización de usuario por administrador')))
  }
}

/**
 * Desactiva un usuario - Solo para administradores
 * @param {string} userId - ID del usuario
 * @returns {Promise<Result<void>>} - Resultado de la desactivación
 */
export const deactivateUser = async (userId: string): Promise<Result<void>> => {
  try {
    const updateData = {
      isActive: false,
      deactivatedAt: new Date().toISOString(),
      deactivatedBy: 'admin'
    }
    
    const result = await dbService.updateUser(userId, updateData)
    if (!result.success) throw result.error
    
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'desactivación de usuario')))
  }
}

/**
 * Activa un usuario - Solo para administradores
 * @param {string} userId - ID del usuario
 * @returns {Promise<Result<void>>} - Resultado de la activación
 */
export const activateUser = async (userId: string): Promise<Result<void>> => {
  try {
    const updateData = {
      isActive: true,
      activatedAt: new Date().toISOString(),
      activatedBy: 'admin'
    }
    
    const result = await dbService.updateUser(userId, updateData)
    if (!result.success) throw result.error
    
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'activación de usuario')))
  }
}

/**
 * Recalcula todos los contadores de estudiantes - Solo para administradores
 * @returns {Promise<Result<void>>} - Resultado del recálculo
 */
export const recalculateStudentCounts = async (): Promise<Result<void>> => {
  try {
    console.log('🔄 Administrador ejecutando recálculo de contadores...')
    const result = await dbService.recalculateAllStudentCounts()
    if (!result.success) throw result.error
    return success(undefined)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'recalcular contadores de estudiantes')))
  }
}

/**
 * Cuenta el total de pruebas presentadas en el sistema
 * 
 * Estructura de datos en Firestore:
 * - results (colección principal)
 *   - IDestudiantes (documento por cada estudiante)
 *     - fase I (subcolección con exámenes)
 *     - Fase II (subcolección con exámenes)
 *     - fase III (subcolección con exámenes)
 * 
 * Cuenta todas las pruebas de todas las fases de todos los estudiantes.
 * Ejemplo: Si un estudiante tiene 7 exámenes en fase I y 3 en Fase II,
 * ese estudiante tiene 10 exámenes en total.
 * 
 * @returns {Promise<Result<number>>} - Total de pruebas completadas
 */
export const getTotalCompletedExams = async (): Promise<Result<number>> => {
  try {
    const db = getFirestore(firebaseApp)
    
    // Intentar primero usar el contador del registro si está disponible (más rápido)
    try {
      const { examRegistryService } = await import('@/services/firebase/examRegistry.service')
      const registryResult = await examRegistryService.getTotalExams()
      if (registryResult.success && registryResult.data > 0) {
        console.log(`✅ [getTotalCompletedExams] Total de exámenes desde registro: ${registryResult.data}`)
        return success(registryResult.data)
      } else if (registryResult.success && registryResult.data === 0) {
        console.log(`⚠️ [getTotalCompletedExams] Registro existe pero está en 0, contando manualmente desde results...`)
      }
    } catch (registryError) {
      // Si falla el registro, continuar con el conteo manual
      console.log('⚠️ [getTotalCompletedExams] No se pudo obtener desde registro, contando manualmente...')
    }
    
    // Si el registro no tiene datos o falla, hacer conteo manual (más lento pero más preciso)
    // Obtener todos los estudiantes (documentos en la colección 'results')
    console.log('🔍 [getTotalCompletedExams] Iniciando conteo manual desde colección results...')
    const resultsRef = collection(db, 'results')
    const usersSnapshot = await getDocs(resultsRef)
    
    if (usersSnapshot.empty) {
      console.log('📊 [getTotalCompletedExams] No hay estudiantes en la colección results')
      return success(0)
    }
    
    console.log(`📊 [getTotalCompletedExams] Encontrados ${usersSnapshot.size} estudiantes en results`)
    
    // Obtener todas las fases disponibles usando la función helper para mantener consistencia
    const mainPhases = getAllPhases() // ['fase I', 'Fase II', 'fase III']
    console.log(`📋 [getTotalCompletedExams] Fases a contar: ${mainPhases.join(', ')}`)
    
    // Crear promesas para consultar todas las fases de todos los usuarios en paralelo
    const promises: Promise<number>[] = []
    
    // Para cada estudiante (documento en results)
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id
      
      // Para cada fase (fase I, Fase II, fase III), crear una promesa que cuenta los documentos
      for (const phaseName of mainPhases) {
        const promise = (async () => {
          try {
            // Acceder a la subcolección de la fase: results/{userId}/{phaseName}
            const phaseRef = collection(db, 'results', userId, phaseName)
            const phaseSnapshot = await getDocs(phaseRef)
            // Cada documento en la subcolección es un examen completado
            const count = phaseSnapshot.empty ? 0 : phaseSnapshot.docs.length
            if (count > 0) {
              console.log(`  📝 [getTotalCompletedExams] Estudiante ${userId} - ${phaseName}: ${count} exámenes`)
            }
            return count
          } catch (error) {
            // Si no existe la subcolección (estudiante no tiene exámenes en esa fase), retornar 0
            return 0
          }
        })()
        
        promises.push(promise)
      }
    }
    
    // Ejecutar todas las consultas en paralelo (mucho más rápido que secuencial)
    console.log(`⏳ [getTotalCompletedExams] Ejecutando ${promises.length} consultas en paralelo...`)
    const results = await Promise.all(promises)
    // Sumar todos los conteos para obtener el total de exámenes completados
    const totalExams = results.reduce((sum, count) => sum + count, 0)
    
    console.log(`✅ [getTotalCompletedExams] Total de exámenes encontrados: ${totalExams} (${usersSnapshot.size} estudiantes, ${mainPhases.length} fases por estudiante)`)
    
    return success(totalExams)
  } catch (e) {
    console.error('❌ [getTotalCompletedExams] Error al contar pruebas completadas:', e)
    return failure(new ErrorAPI(normalizeError(e, 'contar pruebas completadas')))
  }
}

/**
 * Obtiene estadísticas del sistema para el dashboard del administrador
 * @returns {Promise<Result<{
 *   totalUsers: number
 *   totalInstitutions: number
 *   activeSessions: number
 *   systemUptimeDays: number
 *   totalCompletedExams: number
 * }>>} - Estadísticas del sistema
 */
export const getAdminStats = async (): Promise<Result<{
  totalUsers: number
  totalInstitutions: number
  activeSessions: number
  systemUptimeDays: number
  totalCompletedExams: number
}>> => {
  try {
    // Obtener total de usuarios (todos los roles)
    const usersResult = await dbService.getAllUsers()
    if (!usersResult.success) throw usersResult.error
    
    const totalUsers = usersResult.data.length

    // Obtener total de instituciones
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) throw institutionsResult.error
    
    const totalInstitutions = institutionsResult.data.length

    // Obtener sesiones activas (usuarios con última actividad en los últimos 5 minutos)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
    const activeSessions = usersResult.data.filter((user: any) => {
      if (!user.lastActivity) return false
      const lastActivity = user.lastActivity instanceof Date 
        ? user.lastActivity 
        : new Date(user.lastActivity)
      return lastActivity >= fiveMinutesAgo
    }).length

    // Calcular tiempo de actividad del sistema (días desde la creación)
    // Usar la fecha de creación del primer usuario o institución, o una fecha fija
    let systemStartDate: Date
    
    // Intentar obtener la fecha de creación más antigua
    const allUsers = usersResult.data as any[]
    const allInstitutions = institutionsResult.data as any[]
    
    const userDates = allUsers
      .map(u => u.createdAt ? new Date(u.createdAt) : null)
      .filter((d): d is Date => d !== null)
    
    const institutionDates = allInstitutions
      .map(i => i.createdAt ? new Date(i.createdAt) : null)
      .filter((d): d is Date => d !== null)
    
    const allDates = [...userDates, ...institutionDates]
    
    if (allDates.length > 0) {
      systemStartDate = new Date(Math.min(...allDates.map(d => d.getTime())))
    } else {
      // Fecha por defecto: 1 de enero de 2024 (ajustar según necesidad)
      systemStartDate = new Date('2024-01-01T00:00:00')
    }
    
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - systemStartDate.getTime())
    const systemUptimeDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    // Obtener total de pruebas completadas
    const examsResult = await getTotalCompletedExams()
    const totalCompletedExams = examsResult.success ? examsResult.data : 0

    return success({
      totalUsers,
      totalInstitutions,
      activeSessions,
      systemUptimeDays,
      totalCompletedExams
    })
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'obtener estadísticas del administrador')))
  }
}

/**
 * Tipo de alerta del sistema
 */
export interface SystemAlert {
  id: string
  type: 'error' | 'warning' | 'info' | 'success'
  message: string
  priority: 'high' | 'medium' | 'low'
  timestamp: Date
  details?: string
}

/**
 * Obtiene alertas del sistema basadas en métricas y estado actual
 * @returns {Promise<Result<SystemAlert[]>>} - Lista de alertas del sistema
 */
export const getSystemAlerts = async (): Promise<Result<SystemAlert[]>> => {
  try {
    const alerts: SystemAlert[] = []

    // Obtener estadísticas para análisis
    const statsResult = await getAdminStats()
    if (!statsResult.success) {
      // Si no podemos obtener estadísticas, es una alerta crítica
      alerts.push({
        id: 'stats-error',
        type: 'error',
        message: 'No se pueden obtener estadísticas del sistema',
        priority: 'high',
        timestamp: new Date(),
        details: 'Error al conectar con la base de datos'
      })
      return success(alerts)
    }

    const stats = statsResult.data

    // 1. Alerta de saturación: Muchas sesiones activas
    const saturationThreshold = 1000 // Umbral de saturación
    if (stats.activeSessions > saturationThreshold) {
      alerts.push({
        id: 'saturation-high',
        type: 'warning',
        message: `Alto número de sesiones activas: ${stats.activeSessions.toLocaleString()}`,
        priority: 'high',
        timestamp: new Date(),
        details: `El sistema está experimentando alta carga con ${stats.activeSessions} usuarios activos simultáneos`
      })
    } else if (stats.activeSessions > saturationThreshold * 0.7) {
      alerts.push({
        id: 'saturation-medium',
        type: 'warning',
        message: `Carga moderada del sistema: ${stats.activeSessions.toLocaleString()} sesiones activas`,
        priority: 'medium',
        timestamp: new Date(),
        details: 'Monitorear el rendimiento del sistema'
      })
    }

    // 2. Alerta de usuarios inactivos (sin actividad reciente)
    const usersResult = await dbService.getAllUsers()
    if (usersResult.success) {
      const allUsers = usersResult.data as any[]
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      const inactiveUsers = allUsers.filter((user: any) => {
        if (!user.lastActivity) return true
        const lastActivity = user.lastActivity instanceof Date 
          ? user.lastActivity 
          : new Date(user.lastActivity)
        return lastActivity < oneHourAgo && user.isActive !== false
      })

      if (inactiveUsers.length > allUsers.length * 0.5) {
        alerts.push({
          id: 'inactive-users',
          type: 'warning',
          message: `Muchos usuarios inactivos: ${inactiveUsers.length} de ${allUsers.length}`,
          priority: 'medium',
          timestamp: new Date(),
          details: 'Más del 50% de los usuarios no han tenido actividad en la última hora'
        })
      }
    }

    // 3. Alerta de instituciones sin actividad
    const institutionsResult = await dbService.getAllInstitutions()
    if (institutionsResult.success) {
      const allInstitutions = institutionsResult.data as any[]
      const institutionsWithUsers = allInstitutions.filter((inst: any) => {
        // Verificar si la institución tiene usuarios asociados
        return usersResult.success && (usersResult.data as any[]).some((u: any) => 
          u.inst === inst.id || u.institutionId === inst.id
        )
      })

      const inactiveInstitutions = allInstitutions.length - institutionsWithUsers.length
      if (inactiveInstitutions > 0 && allInstitutions.length > 0) {
        const percentage = (inactiveInstitutions / allInstitutions.length) * 100
        if (percentage > 30) {
          alerts.push({
            id: 'inactive-institutions',
            type: 'info',
            message: `${inactiveInstitutions} instituciones sin usuarios activos`,
            priority: 'low',
            timestamp: new Date(),
            details: `${percentage.toFixed(1)}% de las instituciones no tienen usuarios asociados`
          })
        }
      }
    }

    // 4. Alerta de rendimiento: Verificar si hay muchos usuarios pero pocas sesiones activas
    if (stats.totalUsers > 100 && stats.activeSessions < stats.totalUsers * 0.1) {
      alerts.push({
        id: 'low-engagement',
        type: 'info',
        message: 'Baja tasa de participación de usuarios',
        priority: 'low',
        timestamp: new Date(),
        details: `Solo ${((stats.activeSessions / stats.totalUsers) * 100).toFixed(1)}% de los usuarios están activos`
      })
    }

    // 5. Alerta de sistema saludable (si no hay problemas críticos)
    const criticalAlerts = alerts.filter(a => a.priority === 'high')
    const warningAlerts = alerts.filter(a => a.priority === 'medium')
    
    if (criticalAlerts.length === 0 && warningAlerts.length === 0) {
      alerts.push({
        id: 'system-healthy',
        type: 'success',
        message: 'Todos los sistemas funcionando correctamente',
        priority: 'low',
        timestamp: new Date(),
        details: 'El sistema está operando dentro de parámetros normales'
      })
    }

    // Ordenar alertas por prioridad (high -> medium -> low) y luego por timestamp
    alerts.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 }
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority]
      }
      return b.timestamp.getTime() - a.timestamp.getTime()
    })

    return success(alerts)
  } catch (e) {
    // Si hay un error al obtener alertas, devolver una alerta de error
    return success([{
      id: 'alerts-error',
      type: 'error',
      message: 'Error al obtener alertas del sistema',
      priority: 'high',
      timestamp: new Date(),
      details: normalizeError(e, 'obtener alertas').message
    }])
  }
}

/**
 * Interfaz para datos de usuarios por institución
 */
export interface InstitutionUserCount {
  institutionId: string
  institutionName: string
  userCount: number
  isActive: boolean
  rectors: number
  coordinators: number
  teachers: number
  students: number
  jornadaManana: number
  jornadaTarde: number
  jornadaUnica: number
}

/**
 * Obtiene el conteo de usuarios por institución
 * Verifica que los usuarios realmente pertenezcan a cada institución
 * @param year - Año para filtrar usuarios por fecha de creación (opcional, por defecto todos los años)
 * @returns {Promise<Result<InstitutionUserCount[]>>} - Lista de instituciones con conteo de usuarios
 */
export const getUsersByInstitution = async (year?: number): Promise<Result<InstitutionUserCount[]>> => {
  try {
    // Obtener todas las instituciones
    const institutionsResult = await dbService.getAllInstitutions()
    if (!institutionsResult.success) {
      throw institutionsResult.error
    }

    // Obtener todos los usuarios de la colección 'superate/auth/users'
    const usersResult = await dbService.getAllUsers()
    if (!usersResult.success) {
      throw usersResult.error
    }

    const allUsers = usersResult.data as any[]
    const allInstitutions = institutionsResult.data as any[]

    // Crear un mapa de IDs de usuarios existentes y activos para verificación rápida
    // IMPORTANTE: Solo usuarios que realmente existen en la colección 'users' y están activos
    const existingActiveUsers = new Map<string, any>()
    allUsers.forEach((user: any) => {
      // Solo considerar usuarios que:
      // 1. Tienen ID válido
      // 2. Están activos explícitamente (isActive === true)
      // 3. Existen en la colección de usuarios
      if (user.id && user.isActive === true) {
        existingActiveUsers.set(user.id, user)
      }
    })

    console.log(`📊 Total usuarios en BD: ${allUsers.length}`)
    console.log(`✅ Usuarios activos en BD: ${existingActiveUsers.size}`)

    // Crear un mapa de IDs de instituciones válidas para verificación rápida
    const validInstitutionIds = new Set<string>()
    allInstitutions.forEach((institution: any) => {
      validInstitutionIds.add(institution.id)
    })

    // Crear un mapa de usuarios por institución con contadores por rol
    const userCountByInstitution: Record<string, { 
      name: string, 
      count: number, 
      isActive: boolean,
      rectors: number,
      coordinators: number,
      teachers: number,
      students: number,
      jornadaManana: number,
      jornadaTarde: number,
      jornadaUnica: number
    }> = {}

    // Inicializar todas las instituciones con 0 usuarios
    allInstitutions.forEach((institution: any) => {
      userCountByInstitution[institution.id] = {
        name: institution.name || 'Sin nombre',
        count: 0,
        isActive: institution.isActive !== false,
        rectors: 0,
        coordinators: 0,
        teachers: 0,
        students: 0,
        jornadaManana: 0,
        jornadaTarde: 0,
        jornadaUnica: 0
      }
    })

    // PRIMERO: Contar rectores y coordinadores desde la estructura de las instituciones
    // IMPORTANTE: Verificar que realmente existan en la colección 'users' y estén activos
    let rectorsCounted = 0
    let coordinatorsCounted = 0
    
    allInstitutions.forEach((institution: any) => {
      const institutionData = userCountByInstitution[institution.id]
      if (!institutionData) return

      // Contar rector de la institución
      if (institution.rector && institution.rector.id) {
        const rectorId = institution.rector.id
        // Verificar que el rector:
        // 1. Exista en la colección 'users' (superate/auth/users)
        // 2. Esté activo explícitamente (isActive === true)
        const rectorInDB = existingActiveUsers.get(rectorId)
        if (rectorInDB && rectorInDB.isActive === true) {
          institutionData.rectors++
          institutionData.count++
          rectorsCounted++
        } else {
          console.log(`⚠️ Rector ${rectorId} no existe en BD o está inactivo`)
        }
      }

      // Contar coordinadores de las sedes
      if (institution.campuses && Array.isArray(institution.campuses)) {
        institution.campuses.forEach((campus: any) => {
          if (campus.principal && campus.principal.id) {
            const coordinatorId = campus.principal.id
            // Verificar que el coordinador:
            // 1. Exista en la colección 'users' (superate/auth/users)
            // 2. Esté activo explícitamente (isActive === true)
            const coordinatorInDB = existingActiveUsers.get(coordinatorId)
            if (coordinatorInDB && coordinatorInDB.isActive === true) {
              institutionData.coordinators++
              institutionData.count++
              coordinatorsCounted++
            } else {
              console.log(`⚠️ Coordinador ${coordinatorId} no existe en BD o está inactivo`)
            }
          }
        })
      }
    })

    console.log(`👥 Rectores contados: ${rectorsCounted}`)
    console.log(`👥 Coordinadores contados: ${coordinatorsCounted}`)

    // SEGUNDO: Contar docentes y estudiantes desde la colección de usuarios
    // (también verificar que no se dupliquen rectores/coordinadores)
    const countedRectors = new Set<string>() // IDs de rectores ya contados
    const countedCoordinators = new Set<string>() // IDs de coordinadores ya contados

    // Marcar rectores y coordinadores ya contados desde la estructura de instituciones
    // Solo marcar los que realmente existen en la BD y están activos
    allInstitutions.forEach((institution: any) => {
      if (institution.rector && institution.rector.id) {
        const rectorInDB = existingActiveUsers.get(institution.rector.id)
        if (rectorInDB && rectorInDB.isActive === true) {
          countedRectors.add(institution.rector.id)
        }
      }
      if (institution.campuses && Array.isArray(institution.campuses)) {
        institution.campuses.forEach((campus: any) => {
          if (campus.principal && campus.principal.id) {
            const coordinatorInDB = existingActiveUsers.get(campus.principal.id)
            if (coordinatorInDB && coordinatorInDB.isActive === true) {
              countedCoordinators.add(campus.principal.id)
            }
          }
        })
      }
    })

    // SEGUNDO: Contar docentes y estudiantes desde la colección 'users'
    // Solo contar usuarios que existen en la BD y están activos
    let teachersCounted = 0
    let studentsCounted = 0
    
    // Función auxiliar para obtener el año de creación del usuario
    const getUserYear = (user: any): number | null => {
      if (!user.createdAt) return null
      
      // createdAt puede ser un string ISO, un timestamp de Firestore, o un Date
      let date: Date
      if (typeof user.createdAt === 'string') {
        date = new Date(user.createdAt)
      } else if (user.createdAt?.toDate) {
        // Firestore Timestamp
        date = user.createdAt.toDate()
      } else if (user.createdAt?.seconds) {
        // Firestore Timestamp en formato {seconds, nanoseconds}
        date = new Date(user.createdAt.seconds * 1000)
      } else if (user.createdAt instanceof Date) {
        date = user.createdAt
      } else {
        return null
      }
      
      return date.getFullYear()
    }
    
    allUsers.forEach((user: any) => {
      // Verificar que el usuario:
      // 1. Exista (tenga ID)
      // 2. Esté activo explícitamente (isActive === true)
      // 3. Esté en el mapa de usuarios existentes y activos
      if (!user.id || user.isActive !== true || !existingActiveUsers.has(user.id)) {
        return
      }

      // Filtrar por año si se especifica
      if (year !== undefined) {
        const userYear = getUserYear(user)
        if (userYear !== year) {
          return
        }
      }

      // Los admins no se cuentan por institución
      if (user.role === 'admin') return

      // Obtener el ID de la institución del usuario
      const institutionId = user.inst || user.institutionId
      
      // Verificar que el institutionId existe y es válido
      if (!institutionId || !validInstitutionIds.has(institutionId)) {
        return
      }

      // Verificar que el usuario realmente pertenece a esta institución
      const userBelongsToInstitution = 
        user.role === 'student' 
          ? user.inst === institutionId
          : (user.institutionId === institutionId || user.inst === institutionId)

      if (!userBelongsToInstitution || !userCountByInstitution[institutionId]) {
        return
      }

      const institutionData = userCountByInstitution[institutionId]

      // Para rectores: solo contar si no fue contado desde la estructura de la institución
      if (user.role === 'rector') {
        if (!countedRectors.has(user.id)) {
          institutionData.rectors++
          institutionData.count++
          countedRectors.add(user.id)
        }
        return
      }

      // Para coordinadores: solo contar si no fue contado desde la estructura de la institución
      if (user.role === 'principal') {
        if (!countedCoordinators.has(user.id)) {
          institutionData.coordinators++
          institutionData.count++
          countedCoordinators.add(user.id)
        }
        return
      }

      // Para docentes y estudiantes: contar normalmente
      if (user.role === 'teacher') {
        institutionData.teachers++
        institutionData.count++
        teachersCounted++
      } else if (user.role === 'student') {
        institutionData.students++
        institutionData.count++
        studentsCounted++
        
        // Contar jornadas de estudiantes
        if (user.jornada) {
          if (user.jornada === 'mañana') {
            institutionData.jornadaManana++
          } else if (user.jornada === 'tarde') {
            institutionData.jornadaTarde++
          } else if (user.jornada === 'única') {
            institutionData.jornadaUnica++
          }
        }
      }
    })

    console.log(`👨‍🏫 Docentes contados: ${teachersCounted}`)
    console.log(`👨‍🎓 Estudiantes contados: ${studentsCounted}`)

    // Convertir a array y ordenar por cantidad de usuarios (mayor a menor)
    const result: InstitutionUserCount[] = Object.entries(userCountByInstitution)
      .map(([institutionId, data]) => ({
        institutionId,
        institutionName: data.name,
        userCount: data.count,
        isActive: data.isActive,
        rectors: data.rectors,
        coordinators: data.coordinators,
        teachers: data.teachers,
        students: data.students,
        jornadaManana: data.jornadaManana,
        jornadaTarde: data.jornadaTarde,
        jornadaUnica: data.jornadaUnica
      }))
      .sort((a, b) => b.userCount - a.userCount) // Ordenar por cantidad de usuarios descendente

    return success(result)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'obtener usuarios por institución')))
  }
}

/**
 * Interfaz para la configuración de registro
 */
export interface RegistrationConfig {
  enabled: boolean
  updatedAt?: Date
  updatedBy?: string
}

/**
 * Obtiene la configuración de registro del sistema
 * @returns {Promise<Result<RegistrationConfig>>} - Configuración de registro
 */
export const getRegistrationConfig = async (): Promise<Result<RegistrationConfig>> => {
  try {
    const db = getFirestore(firebaseApp)
    const configRef = doc(db, 'superate', 'auth', 'system', 'registration')
    const configSnap = await getDoc(configRef)
    
    if (!configSnap.exists()) {
      // Si no existe, crear con valor por defecto (habilitado)
      const defaultConfig: RegistrationConfig = {
        enabled: true,
        updatedAt: new Date(),
      }
      await setDoc(configRef, defaultConfig)
      return success(defaultConfig)
    }
    
    const data = configSnap.data() as any
    let updatedAt: Date | undefined = undefined
    
    if (data.updatedAt) {
      if (typeof data.updatedAt.toDate === 'function') {
        // Firestore Timestamp
        updatedAt = data.updatedAt.toDate()
      } else if (data.updatedAt instanceof Date) {
        // Ya es un Date
        updatedAt = data.updatedAt
      } else if (data.updatedAt.seconds) {
        // Firestore Timestamp en formato {seconds, nanoseconds}
        updatedAt = new Date(data.updatedAt.seconds * 1000)
      }
    }
    
    return success({
      enabled: data.enabled ?? true, // Por defecto habilitado si no existe
      updatedAt,
      updatedBy: data.updatedBy,
    })
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'obtener configuración de registro')))
  }
}

/**
 * Actualiza la configuración de registro del sistema
 * @param {boolean} enabled - Estado de habilitación del registro
 * @param {string} updatedBy - ID del usuario que realiza la actualización
 * @returns {Promise<Result<RegistrationConfig>>} - Configuración actualizada
 */
export const updateRegistrationConfig = async (
  enabled: boolean,
  updatedBy: string
): Promise<Result<RegistrationConfig>> => {
  try {
    const db = getFirestore(firebaseApp)
    const configRef = doc(db, 'superate', 'auth', 'system', 'registration')
    
    const config: RegistrationConfig = {
      enabled,
      updatedAt: new Date(),
      updatedBy,
    }
    
    await setDoc(configRef, config, { merge: true })
    
    return success(config)
  } catch (e) {
    return failure(new ErrorAPI(normalizeError(e, 'actualizar configuración de registro')))
  }
}

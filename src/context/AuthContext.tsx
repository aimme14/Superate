import { login as loginFB, logout as logoutFB, register, forgotPassword } from "@/controllers/auth.controller"
import { getUsers, getUserById, updateUser, deleteUser } from "@/controllers/user.controller"
import { dbService } from "@/services/firebase/db.service"
import { useNotification } from "@/hooks/ui/useNotification"
import { Props } from "@/interfaces/props.interface"
import { useLoading } from "@/hooks/ui/useLoading"
import { txt } from "@/utils/format"
import { AuthContext, User } from "@/interfaces/context.interface"

import { authService as authFB } from "@/services/firebase/auth.service"
import { createContext, useContext, useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { clearPersistedCache } from "@/lib/queryPersist"
import { logger } from "@/utils/logger"
import { Result } from "@/interfaces/db.interface"
import { LoginFormProps, RegisterFormProps } from "@/schemas/auth.schema"

const Auth = createContext<AuthContext>(undefined)

/**
 * Hook personalizado para acceder al contexto de autenticación.
 * @throws {Error} Si se intenta usar fuera del AuthProvider.
 */
export const useAuthContext = () => {
  const context = useContext(Auth)
  if (!context) throw new Error('useAuth must be used within a AuthProvider')
  return context
}

/**
 * Proveedor del contexto de autenticación.
 * Maneja el estado de autenticación y proporciona funciones para iniciar sesión, registrarse y cerrar sesión.
 * @param {Props} props - Las propiedades del componente.
 * @returns {JSX.Element} Elemento JSX que envuelve a los hijos con el contexto de autenticación.
 */
const CURRENT_USER_QUERY_KEY = ['currentUser'] as const

export const AuthProvider = ({ children }: Props): JSX.Element => {
  const { notifySuccess, notifyError, notifyInfo } = useNotification()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | undefined>()
  const [loading, setLoading] = useState(true)
  const [isAuth, setIsAuth] = useState(false)
  const { handler } = useLoading()

  /** Observa el estado de autenticación del negocio en sesión */
  useEffect(() => {
    return authFB.observeAuth(async (auth) => {
      if (!auth) {
        queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
        clearPersistedCache()
        setUser(undefined)
        setIsAuth(false)
        setLoading(false)
        return
      }

      const userData = await fetchUserData(auth.uid, queryClient)
      if (!userData) {
        logger.log('⚠️ Usuario no encontrado o inactivo en Firestore, cerrando sesión...')
        setUser(undefined)
        setIsAuth(false)
        queryClient.removeQueries({ queryKey: CURRENT_USER_QUERY_KEY })
        clearPersistedCache()
        try {
          await authFB.logout()
        } catch (error) {
          logger.error('Error al cerrar sesión:', error)
        }
        setLoading(false)
        return
      }

      setUser(userData)
      setIsAuth(true)
      setLoading(false)
    })
  }, [queryClient])
  /*--------------------------------------------------authentication--------------------------------------------------*/
  /**
   * Inicia sesión con tu emprendimiento usando las credenciales de acceso
   * @param {LoginFormProps} credentials - Las credenciales de acceso del negocio.
   * @returns {Promise<void>} Un void que resulta de la ejecucion de la funcion login
   */
  const signin = async (credentials: LoginFormProps): Promise<void> => {
    return handler('Iniciando session...', async () => {
      try {
        const result = await loginFB(credentials)
        if (!result.success) throw result.error
        setAuthStatus(result)
      } catch (e: any) {
        // Mostrar todos los errores de autenticación, especialmente los relacionados con usuarios inactivos
        const errorMessage = e.message || 'Error al iniciar sesión'
        const errorTitle = errorMessage.includes('desactivada') || errorMessage.includes('desactivado') 
          ? 'Acceso denegado' 
          : 'Error al iniciar sesión'
        
        notifyError({ 
          title: errorTitle, 
          message: errorMessage 
        })
      }
      finally { setLoading(false) }
    })
  }

  /**
   * Registra un nuevo usuario
   * @param {RegisterFormProps} data - Los datos del negocio a registrar.
   * @returns {Promise<void>} Un void que resulta de la ejecucion de la funcion register
   */
  const signup = async (data: RegisterFormProps): Promise<void> => {
    return handler('Registrando...', async () => {
      try {
        const user = await register(data)
        if (!user.success) throw user.error
      } catch (e) { logger.log(e) }
      finally { setLoadingStatus() }
    })
  }

  /**
   * Cierra la sesión del negocio actual
   * @returns {Promise<void>} Un void que cierra la sesion del negocio
   */
  const signout = async (): Promise<void> => {
    return handler('Cerrando session...', async () => {
      try {
        const result = await logoutFB()
        if (!result.success) throw result.error
        result.success && setAuthStatus()
      } catch (e) { logger.log(e) }
      finally { setLoadingStatus() }
    })
  }
  /*---------------------------------------------------------------------------------------------------------*/

  /*--------------------------------------------------user handlers--------------------------------------------------*/
  /**
   * Obtiene todos los usuarios
   * @returns {Promise<any>} Los datos de todos los usuarios.
   */
  const getAll = async (): Promise<any> => {
    try {
      const response = await getUsers()
      if (!response.success) throw response.error
      return response.data
    } catch (e) { logger.log(e) }
  }
  /**
   * Obtiene un usuario por ID. Usa caché de React Query para evitar lecturas repetidas.
   */
  const getById = async (id: string, enabled?: boolean): Promise<any | undefined> => {
    try {
      if (!enabled) return undefined
      const cached = queryClient.getQueryData([...CURRENT_USER_QUERY_KEY, id])
      if (cached) return cached as any
      const response = await getUserById(id)
      if (!response.success) throw response.error
      queryClient.setQueryData([...CURRENT_USER_QUERY_KEY, id], response.data)
      return response.data
    } catch (e) { notifyError(txt('getUserById', e)); return undefined }
  }
  /**
   * Actualiza un usuario existente. Invalida la caché del usuario actual para refrescar datos.
   */
  const update = async (id: string, data: any): Promise<any> => {
    return handler('Actualizando...', async () => {
      try {
        const response = await updateUser(id, data)
        if (!response.success) throw response.error
        queryClient.invalidateQueries({ queryKey: [...CURRENT_USER_QUERY_KEY, id] })
        notifySuccess(txt('updateUser'))
        return response.data
      } catch (e) { notifyError(txt('updateUser', e)) }
    })
  }
  /**
   * Elimina la cuenta del usuario
   * @param {string} id - El ID del usuario.
   * @returns {Promise<any>} Los datos del usuario eliminado o undefined.
   */
  const _delete = async (id: string): Promise<any> => {
    return handler('Eliminando cuenta...', async () => {
      try {
        const response = await deleteUser(id)
        if (!response.success) throw response.error
        notifySuccess(txt('deleteUser'))
        return response.data
      } catch (e) { notifyError(txt('deleteUser', e)) }
    })
  }
  /*---------------------------------------------------------------------------------------------------------*/

  /*--------------------------------------------------verification--------------------------------------------------*/
  /**
   * Permite enviar una solicitud de restablecimiento de contraseña
   * @param {string} email - Corresponde al email para enviar la solicitud.
   */
  const sendResetPassword = async (email: string): Promise<void> => {
    return handler('Validando solicitud...', async () => {
      try { await forgotPassword(email).then(() => notifyInfo(txt('send-reset-pass'))) }
      catch (e) { notifyError(txt('send-reset-pass', e)) }
    })
  }
  /*---------------------------------------------------------------------------------------------------------*/

  /*--------------------------------------------------helpers--------------------------------------------------*/
  /**
   * Actualiza el estado de autenticación basado en la respuesta del servidor.
   * @param {Result<any> | undefined} res - La respuesta del servidor.
   */
  const setAuthStatus = (res?: Result<any>) => {
    setUser(res?.success ? res.data : undefined)
    setIsAuth(Boolean(res?.success))
  }
  /**
   * Actualiza el estado de carga basado en un parametro opcional
   * si valor del param es distinto a undefined, se muestra el loading
   * @param {string | undefined} status - El estado de carga.
   */
  const setLoadingStatus = (status?: string) => {
    setLoading(Boolean(status))
  }
  /**
   * Obtiene los datos completos del usuario desde la base de datos.
   * Usa caché de React Query para evitar lecturas repetidas (getUserById costoso).
   */
  const fetchUserData = async (uid: string, qc: ReturnType<typeof useQueryClient>): Promise<User | undefined> => {
    try {
      let userData: any = qc.getQueryData([...CURRENT_USER_QUERY_KEY, uid])
      if (!userData) {
        const response = await getUserById(uid)
        if (!response.success) return undefined
        userData = response.data
        qc.setQueryData([...CURRENT_USER_QUERY_KEY, uid], userData)
      }

      if (!userData) return undefined

      const isActive = userData.isActive === true
      if (!isActive) {
        logger.log('⚠️ Usuario inactivo, no se puede cargar')
        return undefined
      }

      if (userData.institutionId || userData.inst) {
        const institutionId = userData.institutionId || userData.inst
        const institutionResult = await dbService.getInstitutionById(institutionId)
        if (institutionResult.success && institutionResult.data) {
          if (institutionResult.data.isActive !== true) {
            logger.log('⚠️ Institución inactiva, no se puede cargar el usuario')
            return undefined
          }
        }
      }

      return {
        uid,
        email: userData.email || '',
        displayName: userData.name || '',
        emailVerified: true,
        role: userData.role,
        grade: userData.gradeName || userData.grade,
        institution: userData.institutionName || userData.inst,
        userdoc: userData.userdoc,
      }
    } catch (error) {
      logger.error('Error fetching user data:', error)
      return undefined
    }
  }
  /*---------------------------------------------------------------------------------------------------------*/

  /*--------------------------------------------------returns--------------------------------------------------*/
  return (
    <Auth.Provider value={{
      isAuth, user, loading, signin, signup, signout, getAll, getById, update, delete: _delete, sendResetPassword
    }}>
      {children}
    </Auth.Provider>
  )
}
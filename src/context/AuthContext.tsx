import { login as loginFB, logout as logoutFB, register, forgotPassword } from "@/controllers/auth.controller"
import { getUsers, getUserById, updateUser, deleteUser } from "@/controllers/user.controller"
import { useNotification } from "@/hooks/ui/useNotification"
import { Props } from "@/interfaces/props.interface"
import { useLoading } from "@/hooks/ui/useLoading"
import { txt } from "@/utils/format"
import { AuthContext, User } from "@/interfaces/context.interface"

import { authService as authFB } from "@/services/firebase/auth.service"
import { createContext, useContext, useEffect, useRef, useState } from "react"
import type { User as FirebaseAuthUser } from "firebase/auth"
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
/** Clave React Query para el documento de usuario (persistida en localStorage). */
export const CURRENT_USER_QUERY_KEY = ['currentUser'] as const

function mapUserDocToContext(uid: string, userData: Record<string, unknown>): User {
  return {
    uid,
    email: String(userData.email ?? ''),
    displayName: (userData.name as string | undefined) ?? null,
    emailVerified: true,
    role: userData.role as User['role'],
    grade: (userData.gradeName as string | undefined) || (userData.grade as string | undefined),
    institution: (userData.institutionName as string | undefined) || (userData.inst as string | undefined),
    userdoc: userData.userdoc as string | undefined,
  }
}

function mapFirebaseToContextUser(fb: FirebaseAuthUser): User {
  return {
    uid: fb.uid,
    email: fb.email ?? '',
    displayName: fb.displayName ?? null,
    emailVerified: fb.emailVerified,
  }
}

export const AuthProvider = ({ children }: Props): JSX.Element => {
  const { notifySuccess, notifyError, notifyInfo } = useNotification()
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | undefined>()
  const [loading, setLoading] = useState(true)
  const [isAuth, setIsAuth] = useState(false)
  const { handler } = useLoading()
  /** uid actual de Auth para sincronizar con caché cuando hidrata después de observeAuth */
  const authUidRef = useRef<string | null>(null)

  /**
   * Restaura sesión sin lecturas a Firestore: perfil desde caché persistida de React Query
   * o datos mínimos desde Firebase Auth.
   */
  useEffect(() => {
    return authFB.observeAuth((auth) => {
      if (!auth) {
        authUidRef.current = null
        queryClient.clear()
        clearPersistedCache()
        setUser(undefined)
        setIsAuth(false)
        setLoading(false)
        return
      }

      authUidRef.current = auth.uid
      const applyProfileFromCache = () => {
        const cached = queryClient.getQueryData([...CURRENT_USER_QUERY_KEY, auth.uid]) as
          | Record<string, unknown>
          | undefined
        if (cached) {
          setUser(mapUserDocToContext(auth.uid, cached))
        } else {
          setUser(mapFirebaseToContextUser(auth))
        }
      }
      applyProfileFromCache()
      // PersistQueryClient hidrata después del primer tick: re-aplicar rol/institución
      queueMicrotask(applyProfileFromCache)
      setIsAuth(true)
      setLoading(false)
    })
  }, [queryClient])

  /** Cuando el perfil currentUser se actualiza (fetch o hidratar), reflejar rol en el contexto */
  useEffect(() => {
    const unsub = queryClient.getQueryCache().subscribe((event) => {
      if (event?.type !== 'updated' && event?.type !== 'added') return
      const q = event.query
      const key = q.queryKey
      if (key[0] !== 'currentUser' || typeof key[1] !== 'string') return
      const uid = key[1]
      if (uid !== authUidRef.current) return
      if (q.state.status !== 'success' || !q.state.data) return
      setUser(mapUserDocToContext(uid, q.state.data as Record<string, unknown>))
    })
    return unsub
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
        const { firebaseUser, profile } = result.data
        queryClient.setQueryData([...CURRENT_USER_QUERY_KEY, firebaseUser.uid], profile)
        setUser(mapUserDocToContext(firebaseUser.uid, profile))
        setIsAuth(true)
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
        // Evita lecturas a Firestore en carrera cuando el token aún no se ha invalidado del todo
        await queryClient.cancelQueries()
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
      const response = await getUserById(
        id,
        user?.uid === id && user?.email ? { authEmail: user.email } : undefined
      )
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
  /*--------------------------------------------------returns--------------------------------------------------*/
  return (
    <Auth.Provider value={{
      isAuth, user, loading, signin, signup, signout, getAll, getById, update, delete: _delete, sendResetPassword
    }}>
      {children}
    </Auth.Provider>
  )
}
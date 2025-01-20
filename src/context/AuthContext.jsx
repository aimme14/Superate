import PropTypes from 'prop-types'

import { login, register, logout, forgotPassword } from "@/controllers/auth.controller";
import { authService as authFB } from "@/services/firebase/auth.service";
import { createContext, useContext, useState, useEffect } from "react";

const Auth = createContext(undefined)

/**
 * Hook personalizado para acceder al contexto de autenticación.
 * @throws {Error} Si se intenta usar fuera del AuthProvider.
 */
export const useAuthContext = () => {
  const context = useContext(Auth)
  if (!context) throw new Error('Error al intentar usar authContext')
  return context
}

/**
 * Proveedor del contexto de autenticación.
 * Maneja el estado de autenticación y proporciona funciones para iniciar sesión, registrarse y cerrar sesión.
 * @param {Props} props - Las propiedades del componente.
 * @returns {JSX.Element} Elemento JSX que envuelve a los hijos con el contexto de autenticación.
 */
export const AuthProvider = ({ children }) => {
  const [loading, setLoading] = useState(true)
  const [isAuth, setIsAuth] = useState(false)
  const [user, setUser] = useState()

  /** Observa el estado de autenticación del negocio en sesión */
  useEffect(() => {
    return authFB.observeAuth((auth) => {
      setIsAuth(Boolean(auth))
      setUser(mapAuth(auth))
      setLoading(false)
    })
  }, [])

  /*--------------------------------------------------authentication--------------------------------------------------*/
  /**
   * Inicia sesión con tu emprendimiento usando las credenciales de acceso
   * @param {LoginFormProps} credentials - Las credenciales de acceso del negocio.
   * @returns {Promise<void>} Un void que resulta de la ejecucion de la funcion login
   */
  const signin = async (credentials) => {
    setLoadingStatus("Iniciando sesión...")
    try {
      const result = await login(credentials)
      if (!result.success) throw result.error
      console.log(result)
      setAuthStatus(result)
    } catch (e) {
      console.log(e)
    } finally { setLoadingStatus() }
  }

  /**
   * Registra un nuevo usuario
   * @param {RegisterFormProps} data - Los datos del negocio a registrar.
   * @returns {Promise<void>} Un void que resulta de la ejecucion de la funcion register
   */
  const signup = async (data) => {
    setLoadingStatus("Registrando...")
    try {
      const user = await register(data)
      if (!user.success) throw user.error
      console.log(user)
    } catch (e) {
      console.log(e)
    } finally { setLoadingStatus() }
  }

  /**
   * Cierra la sesión del negocio actual
   * @returns {Promise<void>} Un void que cierra la sesion del negocio
   */
  const signout = async () => {
    setLoadingStatus("Cerrando sesión...")
    try {
      const result = await logout()
      if (!result.success) throw result.error
      result.success && setAuthStatus()
      console.log(result)
    } catch (e) {
      console.log(e)
    } finally { setLoadingStatus() }
  }
  /*---------------------------------------------------------------------------------------------------------*/

  /*--------------------------------------------------verification--------------------------------------------------*/
  /**
   * Envía un correo de restablecimiento de contraseña
   * @param {string} email - El email del usuario.
   * @returns {Promise<void>} Un void que envia al correo la recuperacion de contraseña
   */
  const sendResetEmail = async (email) => {
    setLoadingStatus("Enviando correo de recuperación...")
    try {
      const result = await forgotPassword(email)
      if (!result.success) throw result.error
      console.log(result)
    } catch (e) {
      console.log(e)
    } finally { setLoadingStatus() }
  }
  /*---------------------------------------------------------------------------------------------------------*/

  /*--------------------------------------------------tools--------------------------------------------------*/
  /**
   * Actualiza el estado de autenticación basado en la respuesta del servidor.
   * @param {Result<any> | undefined} res - La respuesta del servidor.
   */
  const setAuthStatus = (res) => {
    setUser(res?.success ? res.data : undefined)
    setIsAuth(Boolean(res?.success))
  }
  /**
   * Actualiza el estado de carga basado en un parametro opcional
   * si valor del param es distinto a undefined, se muestra el loading
   * @param {string | undefined} status - El estado de carga.
   */
  const setLoadingStatus = (status) => {
    setLoading(Boolean(status))
  }

  /**
   * Mapea un usuario de Firebase al tipo de usuario definido en la aplicación.
   * @param {User} fbUser - El usuario de Firebase.
   * @returns {User | undefined} - El usuario mapeado o undefined si no hay usuario.
   */
  const mapAuth = (fbUser) => {
    if (!fbUser) return undefined
    return {
      uid: fbUser.uid,
      email: fbUser.email || '',
      photoURL: fbUser.photoURL || '',
      displayName: fbUser.displayName || '',
      emailVerified: fbUser.emailVerified,
    }
  }
  /*---------------------------------------------------------------------------------------------------------*/

  return (
    <Auth.Provider value={{
      user,
      isAuth,
      loading,
      signin,
      signup,
      signout,
      sendResetEmail
    }}>
      {children}
    </Auth.Provider>
  )
}

AuthProvider.propTypes = {
  children: PropTypes.node.isRequired
}
import { useThemeContext } from "@/context/ThemeContext"
import Skeleton from "#/common/skeletons/SkeletonLarge"
import { useAuthContext } from "@/context/AuthContext"
import { Navigate, Outlet, useNavigate } from "react-router-dom"
import { useEffect, useState, useCallback } from "react"
import { useInactivityTimeout } from "@/hooks/ui/useInactivityTimeout"
import { useNotification } from "@/hooks/ui/useNotification"

function ProtectedRoute() {
  const [showSkeleton, setShowSkeleton] = useState(true)
  const { isAuth, loading, signout, user } = useAuthContext()
  const { theme } = useThemeContext()
  const navigate = useNavigate()
  const { notifyInfo, notifyError } = useNotification()

  /**
   * Maneja el cierre de sesión por inactividad
   */
  const handleInactivity = useCallback(async () => {
    try {
      notifyInfo({
        title: 'Sesión cerrada',
        message: 'Tu sesión ha sido cerrada por inactividad. Por favor, inicia sesión nuevamente.'
      })
      
      // Cerrar sesión
      await signout()
      
      // Redirigir a la pantalla de login
      navigate('/auth/login', { replace: true })
    } catch (error) {
      console.error('Error al cerrar sesión por inactividad:', error)
      // Aún así redirigir al login
      navigate('/auth/login', { replace: true })
    }
  }, [signout, navigate, notifyInfo])

  // Hook de inactividad: cierra sesión después de 10 minutos de inactividad
  useInactivityTimeout(10, handleInactivity, isAuth && !loading)

  useEffect(() => {
    if (loading) {// if still loading, wait for auth to finish loading
      const timeoutId = setTimeout(() => setShowSkeleton(false), 3000)
      return () => clearTimeout(timeoutId)
    } else { setShowSkeleton(false) }
  }, [loading])

  // Validar que el usuario esté activo
  useEffect(() => {
    const validateUserStatus = async () => {
      if (!loading && isAuth && user?.uid) {
        try {
          const { getUserById } = await import('@/controllers/user.controller')
          const userResult = await getUserById(user.uid)
          
          if (userResult.success && userResult.data) {
            const isActive = userResult.data.isActive === true
            
            if (!isActive) {
              notifyError({
                title: 'Acceso denegado',
                message: 'Tu cuenta ha sido desactivada. Por favor, contacta al administrador del sistema.'
              })
              await signout()
              navigate('/auth/login', { replace: true })
              return
            }
            
            // Verificar institución si existe
            if (userResult.data.institutionId || userResult.data.inst) {
              const { dbService } = await import('@/services/firebase/db.service')
              const institutionId = userResult.data.institutionId || userResult.data.inst
              const institutionResult = await dbService.getInstitutionById(institutionId)
              
              if (institutionResult.success && institutionResult.data) {
                const institutionIsActive = institutionResult.data.isActive === true
                
                if (!institutionIsActive) {
                  notifyError({
                    title: 'Acceso denegado',
                    message: 'La institución asociada a tu cuenta ha sido desactivada. Por favor, contacta al administrador del sistema.'
                  })
                  await signout()
                  navigate('/auth/login', { replace: true })
                }
              }
            }
          }
        } catch (error) {
          console.error('Error validando estado del usuario:', error)
        }
      }
    }
    
    validateUserStatus()
  }, [loading, isAuth, user, signout, navigate, notifyError])

  if (showSkeleton) return <Skeleton theme={theme} />
  if (!isAuth) return <Navigate to='/auth/login' replace />
  return <Outlet />
}

export default ProtectedRoute
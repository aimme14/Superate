import LoginSection from '@/sections/login/LoginSection'
import { useThemeContext } from '@/context/ThemeContext'
import { useAuthContext } from '@/context/AuthContext'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useNotification } from '@/hooks/ui/useNotification'
import { cn } from '@/lib/utils'

const LoginPage = () => {
  const { theme } = useThemeContext()
  const { isAuth, loading } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()
  const { notifyInfo } = useNotification()

  useEffect(() => {
    const state = location.state as { sessionExpired?: boolean; message?: string } | null
    if (state?.sessionExpired && state.message) {
      notifyInfo({ title: 'Sesión cerrada', message: state.message })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [location.pathname, location.state, navigate, notifyInfo])

  // Esperar a que termine la verificación de autenticación antes de redirigir o mostrar login
  useEffect(() => { 
    if (!loading && isAuth) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuth, loading, navigate])

  // Mostrar skeleton mientras se verifica la autenticación
  if (loading) {
    return (
      <div className={cn(
        "flex justify-center items-center",
        "w-full h-screen",
        "relative"
      )}>
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">
            Verificando sesión...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex justify-center items-start",
      "px-4 py-4",
      "w-full flex-1",
      "relative"
    )}>
      <LoginSection theme={theme} />
    </div>
  )
}

export default LoginPage
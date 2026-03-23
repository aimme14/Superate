import HomeSection from '@/sections/HomeSection'
import { useThemeContext } from '@/context/ThemeContext'
import { useAuthContext } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { useIsMobile } from '@/hooks/ui/use-mobile'

const HomePage = () => {
  const { theme } = useThemeContext()
  const { isAuth, loading } = useAuthContext()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  // Esperar a que termine la verificación de autenticación antes de redirigir o mostrar contenido
  useEffect(() => {
    if (!loading && isAuth) {
      navigate('/dashboard', { replace: true })
      return
    }

    // En móvil, si no hay sesión activa, llevar directamente al login
    if (!loading && !isAuth && isMobile) {
      navigate('/auth/login', { replace: true })
    }
  }, [isAuth, loading, navigate, isMobile])

  // Mostrar loader mientras se verifica la autenticación
  if (loading) {
    return (
      <div className="flex items-center justify-center w-full h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm font-medium text-muted-foreground">
            Verificando sesión...
          </p>
        </div>
      </div>
    )
  }

  return <HomeSection theme={theme} />
}

export default HomePage
import HomeSection from '@/sections/HomeSection'
import { useThemeContext } from '@/context/ThemeContext'
import { useAuthContext } from '@/context/AuthContext'
import { Navigate } from 'react-router-dom'
import { useIsMobile } from '@/hooks/ui/use-mobile'

const HomePage = () => {
  const { theme } = useThemeContext()
  const { isAuth, loading } = useAuthContext()
  const isMobile = useIsMobile()

  // La bienvenida vive en RootLayout; aquí solo redirigimos sin parpadeos
  if (loading) return null

  if (isAuth) {
    return <Navigate to="/dashboard" replace />
  }

  if (isMobile) {
    return <Navigate to="/auth/login" replace />
  }

  return <HomeSection theme={theme} />
}

export default HomePage
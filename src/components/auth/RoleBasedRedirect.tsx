import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthContext } from '@/context/AuthContext'
import { useRole } from '@/hooks/core/useRole'

/**
 * Componente que redirige automáticamente al usuario al dashboard correcto según su rol
 */
export default function RoleBasedRedirect() {
  const { isAuth, loading } = useAuthContext()
  const { userRole } = useRole()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && isAuth && userRole) {
      // Redirigir según el rol del usuario
      switch (userRole) {
        case 'student':
          navigate('/dashboard', { replace: true })
          break
        case 'teacher':
          navigate('/dashboard/teacher', { replace: true })
          break
        case 'principal':
          navigate('/dashboard/principal', { replace: true })
          break
        case 'admin':
          navigate('/dashboard/admin', { replace: true })
          break
        default:
          // Si no hay rol definido, ir al dashboard por defecto
          navigate('/dashboard', { replace: true })
      }
    }
  }, [isAuth, loading, userRole, navigate])

  // No renderizar nada, solo manejar la redirección
  return null
}

/**
 * Hook para obtener la ruta correcta del dashboard según el rol
 */
export const useDashboardRoute = () => {
  const { userRole } = useRole()
  
  const getDashboardRoute = () => {
    switch (userRole) {
      case 'student':
        return '/dashboard'
      case 'teacher':
        return '/dashboard/teacher'
      case 'principal':
        return '/dashboard/principal'
      case 'admin':
        return '/dashboard/admin'
      default:
        return '/dashboard'
    }
  }

  return { getDashboardRoute }
}


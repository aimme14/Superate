import { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useRole } from '@/hooks/core/useRole'
import { UserRole } from '@/interfaces/context.interface'

interface RoleProtectedRouteProps {
  children: ReactNode
  allowedRoles: UserRole[]
  fallbackPath?: string
}

/**
 * Componente que protege rutas basándose en el rol del usuario
 */
export default function RoleProtectedRoute({ 
  children, 
  allowedRoles, 
  fallbackPath = '/dashboard' 
}: RoleProtectedRouteProps) {
  const { userRole, isStudent } = useRole()

  // Si el usuario no tiene un rol válido, redirigir al dashboard por defecto
  if (!userRole) {
    return <Navigate to={fallbackPath} replace />
  }

  // Verificar si el rol del usuario está en los roles permitidos
  const hasAccess = userRole ? allowedRoles.includes(userRole) : false

  if (!hasAccess) {
    // Redirigir según el rol del usuario
    const redirectPath = isStudent ? '/dashboard' : `/dashboard/${userRole}`
    return <Navigate to={redirectPath} replace />
  }

  return <>{children}</>
}

/**
 * Hook para verificar si el usuario tiene acceso a una ruta específica
 */
export const useRoleAccess = (allowedRoles: UserRole[]) => {
  const { userRole } = useRole()
  return userRole ? allowedRoles.includes(userRole) : false
}


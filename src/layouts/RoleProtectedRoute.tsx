import { ReactNode, useEffect } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useRole } from '@/hooks/core/useRole'
import { UserRole } from '@/interfaces/context.interface'
import { useAuthContext } from '@/context/AuthContext'
import { useNotification } from '@/hooks/ui/useNotification'

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
  const { user, signout } = useAuthContext()
  const navigate = useNavigate()
  const { notifyError } = useNotification()

  // Validar que el usuario esté activo
  useEffect(() => {
    const validateUserStatus = async () => {
      if (user?.uid) {
        try {
          const { getUserById } = await import('@/controllers/user.controller')
          const userResult = await getUserById(user.uid)
          
          if (userResult.success && userResult.data) {
            const userData = userResult.data as any
            const isActive = userData.isActive === true
            
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
            if (userData.institutionId || userData.inst) {
              const { dbService } = await import('@/services/firebase/db.service')
              const institutionId = userData.institutionId || userData.inst
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
  }, [user, signout, navigate, notifyError])

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


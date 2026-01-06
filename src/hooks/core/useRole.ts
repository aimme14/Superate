import { useAuthContext } from "@/context/AuthContext"
import { UserRole } from "@/interfaces/context.interface"

import { useEffect, useState } from 'react'

/**
 * Hook personalizado para manejar roles y permisos de usuario
 */
export const useRole = () => {
  const { user } = useAuthContext()
  const [isUserActive, setIsUserActive] = useState<boolean>(true)
  const [isInstitutionActive, setIsInstitutionActive] = useState<boolean>(true)

  const userRole: UserRole | undefined = user?.role

  // Validar estado activo del usuario y su institución
  useEffect(() => {
    const validateStatus = async () => {
      if (!user?.uid) {
        setIsUserActive(false)
        setIsInstitutionActive(false)
        return
      }

      try {
        const { getUserById } = await import('@/controllers/user.controller')
        const userResult = await getUserById(user.uid)
        
        if (userResult.success && userResult.data) {
          const userActive = userResult.data.isActive === true
          setIsUserActive(userActive)
          
          // Verificar institución si existe
          if (userResult.data.institutionId || userResult.data.inst) {
            const { dbService } = await import('@/services/firebase/db.service')
            const institutionId = userResult.data.institutionId || userResult.data.inst
            const institutionResult = await dbService.getInstitutionById(institutionId)
            
            if (institutionResult.success && institutionResult.data) {
              const institutionActive = institutionResult.data.isActive === true
              setIsInstitutionActive(institutionActive)
            } else {
              setIsInstitutionActive(true) // Si no se puede verificar, asumir activa
            }
          } else {
            setIsInstitutionActive(true) // Si no tiene institución, no aplica
          }
        } else {
          setIsUserActive(false)
        }
      } catch (error) {
        console.error('Error validando estado del usuario:', error)
        setIsUserActive(false)
      }
    }
    
    validateStatus()
  }, [user])

  // Permisos por rol
  const permissions = {
    student: {
      canViewDashboard: true,
      canTakeExams: true,
      canViewResults: true,
      canViewProfile: true,
      canManageUsers: false,
      canManageExams: false,
      canViewAnalytics: false,
      canManageInstitution: false,
      canCreateUsers: false,
      canManageForms: false,
      canAccessAdminPanel: false,
    },
    teacher: {
      canViewDashboard: true,
      canTakeExams: false,
      canViewResults: true,
      canViewProfile: true,
      canManageUsers: false,
      canManageExams: true,
      canViewAnalytics: true,
      canManageInstitution: false,
      canCreateUsers: false,
      canManageForms: false,
      canAccessAdminPanel: false,
    },
    principal: {
      canViewDashboard: true,
      canTakeExams: false,
      canViewResults: true,
      canViewProfile: true,
      canManageUsers: true,
      canManageExams: true,
      canViewAnalytics: true,
      canManageInstitution: true,
      canCreateUsers: false,
      canManageForms: false,
      canAccessAdminPanel: false,
    },
    rector: {
      canViewDashboard: true,
      canTakeExams: false,
      canViewResults: true,
      canViewProfile: true,
      canManageUsers: true,
      canManageExams: true,
      canViewAnalytics: true,
      canManageInstitution: true,
      canCreateUsers: true,
      canManageForms: true,
      canAccessAdminPanel: false,
    },
    admin: {
      canViewDashboard: true,
      canTakeExams: false,
      canViewResults: true,
      canViewProfile: true,
      canManageUsers: true,
      canManageExams: true,
      canViewAnalytics: true,
      canManageInstitution: true,
      canCreateUsers: true,
      canManageForms: true,
      canAccessAdminPanel: true,
    }
  }

  const hasPermission = (permission: keyof typeof permissions.student): boolean => {
    // Si el usuario o su institución no están activos, no tiene permisos
    if (!isUserActive || !isInstitutionActive) return false
    if (!userRole) return false
    return permissions[userRole][permission]
  }

  const isStudent = userRole === 'student'
  const isTeacher = userRole === 'teacher'
  const isPrincipal = userRole === 'principal'
  const isRector = userRole === 'rector'
  const isAdmin = userRole === 'admin'
  const isStaff = isTeacher || isPrincipal || isRector || isAdmin

  // Configuración de navegación por rol
  const navigationConfig = {
    student: {
      mainRoutes: ['/dashboard', '/quiz', '/resultados', '/promedio'],
      sidebarItems: [
        { label: 'Dashboard', href: '/dashboard', icon: 'Home' },
        { label: 'Exámenes', href: '/quiz', icon: 'BookOpen' },
        { label: 'Resultados', href: '/resultados', icon: 'BarChart' },
        { label: 'Promedio', href: '/promedio', icon: 'TrendingUp' },
      ]
    },
    teacher: {
      mainRoutes: ['/dashboard/teacher', '/exams/manage', '/students', '/analytics'],
      sidebarItems: [
        { label: 'Dashboard', href: '/dashboard/teacher', icon: 'Home' },
        { label: 'Gestionar Exámenes', href: '/exams/manage', icon: 'BookOpen' },
        { label: 'Estudiantes', href: '/students', icon: 'Users' },
        { label: 'Analíticas', href: '/analytics', icon: 'BarChart' },
      ]
    },
    principal: {
      mainRoutes: ['/dashboard/principal', '/institution', '/staff', '/reports'],
      sidebarItems: [
        { label: 'Dashboard', href: '/dashboard/principal', icon: 'Home' },
        { label: 'Institución', href: '/institution', icon: 'Building' },
        { label: 'Personal', href: '/staff', icon: 'Users' },
        { label: 'Reportes', href: '/reports', icon: 'FileText' },
      ]
    },
    rector: {
      mainRoutes: ['/dashboard/rector', '/sedes', '/coordinadores', '/docentes', '/estudiantes', '/reportes'],
      sidebarItems: [
        { label: 'Dashboard', href: '/dashboard/rector', icon: 'Home' },
        { label: 'Sedes', href: '/sedes', icon: 'Building2' },
        { label: 'Coordinadores', href: '/coordinadores', icon: 'Crown' },
        { label: 'Docentes', href: '/docentes', icon: 'GraduationCap' },
        { label: 'Estudiantes', href: '/estudiantes', icon: 'Users' },
        { label: 'Reportes', href: '/reportes', icon: 'FileText' },
      ]
    },
    admin: {
      mainRoutes: ['/dashboard/admin', '/system', '/users', '/settings'],
      sidebarItems: [
        { label: 'Dashboard', href: '/dashboard/admin', icon: 'Home' },
        { label: 'Sistema', href: '/system', icon: 'Settings' },
        { label: 'Usuarios', href: '/users', icon: 'Users' },
        { label: 'Configuración', href: '/settings', icon: 'Cog' },
      ]
    }
  }

  const getNavigationConfig = () => {
    if (!userRole) return navigationConfig.student // Fallback a student si no hay rol
    return navigationConfig[userRole]
  }

  return {
    userRole,
    permissions: userRole ? permissions[userRole] : permissions.student,
    hasPermission,
    isStudent,
    isTeacher,
    isPrincipal,
    isRector,
    isAdmin,
    isStaff,
    getNavigationConfig,
    isUserActive,
    isInstitutionActive,
    isActive: isUserActive && isInstitutionActive, // Estado combinado
  }
}


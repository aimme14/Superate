import { useAuthContext } from "@/context/AuthContext"
import { UserRole } from "@/interfaces/context.interface"

/**
 * Hook personalizado para manejar roles y permisos de usuario
 */
export const useRole = () => {
  const { user } = useAuthContext()

  const userRole: UserRole | undefined = user?.role

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
    if (!userRole) return false
    return permissions[userRole][permission]
  }

  const isStudent = userRole === 'student'
  const isTeacher = userRole === 'teacher'
  const isPrincipal = userRole === 'principal'
  const isAdmin = userRole === 'admin'
  const isStaff = isTeacher || isPrincipal || isAdmin

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
    isAdmin,
    isStaff,
    getNavigationConfig,
  }
}


import { useThemeContext } from '@/context/ThemeContext'
import Skeleton from '#/common/skeletons/SkeletonLarge'
import { useAuthContext } from '@/context/AuthContext'
import { useRole } from '@/hooks/core/useRole'
import AdminSection from './admin/AdminPage'
import { Home as NewDashboard } from './NewDashboard'
import TeacherDashboard from './teacher/TeacherDashboard'
import PrincipalDashboard from './principal/PrincipalDashboard'
import RectorDashboard from './rector/RectorDashboard'
import AdminDashboard from './admin/AdminDashboard'
import RoleBasedRedirect from '@/components/auth/RoleBasedRedirect'
import { Suspense } from 'react'

const DashboardPage = () => {
  const { theme } = useThemeContext()
  const { user, loading } = useAuthContext()
  const { userRole, isStudent, isTeacher, isPrincipal, isRector, isAdmin } = useRole()
  
  // Si está cargando, mostrar skeleton
  if (loading) {
    return <Skeleton theme={theme} />
  }

  // Si no hay usuario autenticado, redirigir
  if (!user) {
    return <RoleBasedRedirect />
  }

  // Si no hay rol definido, usar lógica anterior como fallback
  if (!userRole) {
    return (
      <Suspense fallback={<Skeleton theme={theme} />}>
        {user?.displayName === 'aimme' ? <AdminSection /> : <NewDashboard />}
      </Suspense>
    )
  }

  // Renderizar dashboard según el rol
  return (
    <Suspense fallback={<Skeleton theme={theme} />}>
      {isStudent && <NewDashboard />}
      {isTeacher && <TeacherDashboard theme={theme} />}
      {isPrincipal && <PrincipalDashboard theme={theme} />}
      {isRector && <RectorDashboard theme={theme} />}
      {isAdmin && <AdminDashboard theme={theme} />}
    </Suspense>
  )
}

export default DashboardPage
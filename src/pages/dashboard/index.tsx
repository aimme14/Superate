import { lazy, Suspense } from 'react'
import { useThemeContext } from '@/context/ThemeContext'
import Skeleton from '#/common/skeletons/SkeletonLarge'
import { useAuthContext } from '@/context/AuthContext'
import { useRole } from '@/hooks/core/useRole'
import RoleBasedRedirect from '@/components/auth/RoleBasedRedirect'

// Lazy load dashboards por rol: solo se descarga el dashboard que el usuario necesita
const AdminSection = lazy(() => import('./admin/AdminPage'))
const NewDashboard = lazy(() => import('./NewDashboard').then(m => ({ default: m.Home })))
const TeacherDashboard = lazy(() => import('./teacher/TeacherDashboard'))
const PrincipalDashboard = lazy(() => import('./principal/PrincipalDashboard'))
const RectorDashboard = lazy(() => import('./rector/RectorDashboard'))
const AdminDashboard = lazy(() => import('./admin/AdminDashboard'))

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

  // Renderizar dashboard según el rol (cada uno se carga bajo demanda)
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
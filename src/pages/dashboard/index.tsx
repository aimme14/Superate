import { useThemeContext } from '@/context/ThemeContext'
import Skeleton from '#/common/skeletons/SkeletonLarge'
import { useAuthContext } from '@/context/AuthContext'
import AdminSection from './admin/AdminPage'
import NewDashboard from './NewDashboard'
import { Suspense } from 'react'

const DashboardPage = () => {
  const { theme } = useThemeContext()
  const { user } = useAuthContext()
  
  return (
    <Suspense fallback={<Skeleton theme={theme} />}>
      {user?.displayName === 'aimme' ? <AdminSection /> : <NewDashboard />}
    </Suspense>
  )
}

export default DashboardPage
import { useThemeContext } from "@/context/ThemeContext"
import Skeleton from "#/common/skeletons/SkeletonLarge"
import { useAuthContext } from "@/context/AuthContext"
import { Navigate, Outlet } from "react-router-dom"
import { useEffect, useState } from "react"

function ProtectedRoute() {
  const [showSkeleton, setShowSkeleton] = useState(true)
  const { isAuth, loading } = useAuthContext()
  const { theme } = useThemeContext()

  useEffect(() => {
    if (loading) {// if still loading, wait for auth to finish loading
      const timeoutId = setTimeout(() => setShowSkeleton(false), 3000)
      return () => clearTimeout(timeoutId)
    } else { setShowSkeleton(false) }
  }, [loading])

  if (showSkeleton) return <Skeleton theme={theme} />
  if (!isAuth) return <Navigate to='/auth/login' replace />
  return <Outlet />
}

export default ProtectedRoute
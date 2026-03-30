import { useThemeContext } from "@/context/ThemeContext"
import Skeleton from "#/common/skeletons/SkeletonLarge"
import { useAuthContext } from "@/context/AuthContext"
import { Navigate, Outlet, useNavigate } from "react-router-dom"
import { useEffect, useMemo } from "react"
import { useNotification } from "@/hooks/ui/useNotification"
import { useCurrentUser } from "@/hooks/query/useCurrentUser"
import { useInstitution } from "@/hooks/query/useInstitutionQuery"

function ProtectedRoute() {
  const { isAuth, loading, signout, user } = useAuthContext()
  const { theme } = useThemeContext()
  const navigate = useNavigate()
  const { notifyError } = useNotification()

  const {
    data: userData,
    isLoading: isLoadingUser,
    isError: isUserError,
  } = useCurrentUser(user?.uid)

  const institutionId = useMemo(() => {
    if (!userData) return ""
    const d = userData as Record<string, unknown>
    const id = d.institutionId ?? d.inst
    return id != null && id !== "" ? String(id) : ""
  }, [userData])

  const { data: institution, isLoading: isLoadingInstitution } = useInstitution(
    institutionId,
    Boolean(institutionId)
  )

  useEffect(() => {
    if (loading || !isAuth || !user?.uid) return
    if (isLoadingUser) return
    if (isUserError) {
      console.error("Error validando estado del usuario: no se pudo cargar el perfil")
      return
    }
    if (!userData) return

    const isActive = (userData as { isActive?: boolean }).isActive === true
    if (!isActive) {
      void (async () => {
        notifyError({
          title: "Acceso denegado",
          message:
            "Tu cuenta ha sido desactivada. Por favor, contacta al administrador del sistema.",
        })
        await signout()
        navigate("/auth/login", { replace: true })
      })()
      return
    }

    if (!institutionId) return
    if (isLoadingInstitution) return
    if (!institution) return

    const institutionIsActive = institution.isActive === true
    if (!institutionIsActive) {
      void (async () => {
        notifyError({
          title: "Acceso denegado",
          message:
            "La institución asociada a tu cuenta ha sido desactivada. Por favor, contacta al administrador del sistema.",
        })
        await signout()
        navigate("/auth/login", { replace: true })
      })()
    }
  }, [
    loading,
    isAuth,
    user?.uid,
    isLoadingUser,
    isUserError,
    userData,
    institutionId,
    isLoadingInstitution,
    institution,
    signout,
    navigate,
    notifyError,
  ])

  if (loading) return <Skeleton theme={theme} />
  if (!isAuth) return <Navigate to="/auth/login" replace />
  if (user?.uid && isLoadingUser) return <Skeleton theme={theme} />

  return <Outlet />
}

export default ProtectedRoute

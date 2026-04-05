import { useThemeContext } from "@/context/ThemeContext"
import Skeleton from "#/common/skeletons/SkeletonLarge"
import { useAuthContext } from "@/context/AuthContext"
import { Navigate, Outlet, useNavigate } from "react-router-dom"
import { useEffect, useMemo, useRef } from "react"
import { useNotification } from "@/hooks/ui/useNotification"
import { useCurrentUser } from "@/hooks/query/useCurrentUser"
import { useInstitution } from "@/hooks/query/useInstitutionQuery"
import type { User } from "@/interfaces/db.interface"

/** Perfil Firestore puede incluir `inst` legacy además de `institutionId`. */
type UserWithLegacyInst = User & { inst?: string }

function ProtectedRoute() {
  const { isAuth, loading, signout, user } = useAuthContext()
  const { theme } = useThemeContext()
  const navigate = useNavigate()
  const { notifyError } = useNotification()
  const profileErrorLogged = useRef(false)

  const {
    data: userData,
    isLoading: isLoadingUser,
    isError: isUserError,
  } = useCurrentUser(user?.uid, isAuth && !loading && Boolean(user?.uid))

  const institutionId = useMemo(() => {
    if (!userData) return ""
    const d = userData as UserWithLegacyInst
    const id = d.institutionId ?? d.inst
    return id != null && id !== "" ? String(id) : ""
  }, [userData])

  /** Admin no depende de una institución concreta; evita 404/toasts si el perfil trae un id viejo. */
  const shouldLoadInstitution =
    Boolean(institutionId) && userData?.role !== 'admin'

  const { data: institution, isLoading: isLoadingInstitution } = useInstitution(
    institutionId,
    shouldLoadInstitution
  )

  useEffect(() => {
    if (loading || !isAuth || !user?.uid) return
    if (isLoadingUser) return
    if (isUserError) {
      if (!profileErrorLogged.current) {
        profileErrorLogged.current = true
        console.error("Error validando estado del usuario: no se pudo cargar el perfil")
      }
      return
    }
    profileErrorLogged.current = false
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

    if (userData.role === 'admin') return

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
  // No bloquear la app con skeleton mientras carga el perfil: las rutas hijas muestran su propio loading.
  // Evita pantalla infinita si Firestore o la red fallan de forma intermitente.

  return <Outlet />
}

export default ProtectedRoute

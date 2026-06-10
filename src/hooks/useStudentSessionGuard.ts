import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { authService } from '@/services/firebase/auth.service'
import {
  captureStudentSessionRevFromUser,
  getStoredStudentSessionRev,
  isRevokedTokenError,
} from '@/lib/studentSession'

const POLL_MS = 20_000

/**
 * Detecta sesiones revocadas en el servidor y cierra la sesión del estudiante al instante
 * (forzando refresh del ID token y comparando el claim sessionRev).
 */
export function useStudentSessionGuard(
  isAuth: boolean,
  signout: () => Promise<void>
): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isAuth) return

    let cancelled = false

    const forceLogout = async (message: string) => {
      if (cancelled) return
      cancelled = true
      try {
        await signout()
      } finally {
        navigate('/auth/login', {
          replace: true,
          state: { sessionExpired: true, message },
        })
      }
    }

    const checkSession = async () => {
      const user = authService.auth.currentUser
      if (!user || cancelled) return

      try {
        const result = await user.getIdTokenResult(true)
        if (result.claims.role !== 'student') return

        const serverRev = Number(result.claims.sessionRev ?? 0)
        const localRev = getStoredStudentSessionRev()
        if (serverRev > localRev) {
          await forceLogout(
            'Tu sesión fue cerrada por el administrador. Inicia sesión de nuevo.'
          )
        }
      } catch (error) {
        if (isRevokedTokenError(error)) {
          await forceLogout(
            'Tu sesión expiró o fue cerrada. Inicia sesión de nuevo.'
          )
        }
      }
    }

    void authService.auth.currentUser
      ?.getIdTokenResult()
      .then(() => captureStudentSessionRevFromUser(authService.auth.currentUser!))
      .catch(() => undefined)

    void checkSession()

    const interval = window.setInterval(() => {
      void checkSession()
    }, POLL_MS)

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void checkSession()
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)

    return () => {
      cancelled = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
    }
  }, [isAuth, signout, navigate])
}

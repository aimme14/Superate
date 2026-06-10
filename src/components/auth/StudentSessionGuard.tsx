import { useAuthContext } from '@/context/AuthContext'
import { useStudentSessionGuard } from '@/hooks/useStudentSessionGuard'

/** Vigila sesiones revocadas de estudiantes (debe montarse dentro de BrowserRouter). */
export function StudentSessionGuard() {
  const { isAuth, signout } = useAuthContext()
  useStudentSessionGuard(isAuth, signout)
  return null
}

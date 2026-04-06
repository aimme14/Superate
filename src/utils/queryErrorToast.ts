import { OFFLINE_USER_MESSAGE } from '@/constants/networkMessages'
import { getAuth } from 'firebase/auth'
import { getErrorCode, getErrorMessage, isNetworkErrorLike, normalizeText } from '@/utils/networkError'

/** Código Firebase en ErrorAPI normalizado (p. ej. details.code). */
function getUnderlyingFirebaseCode(error: unknown): string | null {
  const top = getErrorCode(error)
  if (top === 'permission-denied') return top
  if (error && typeof error === 'object' && 'details' in error) {
    const d = (error as { details?: { code?: string } }).details
    if (d && typeof d.code === 'string') return d.code
  }
  return top
}

/**
 * Errores de permiso en Firestore justo después de cerrar sesión son esperables (queries en carrera).
 * No deben mostrarse como fallo global al usuario.
 */
export function shouldSuppressQueryErrorWhileLoggedOut(error: unknown): boolean {
  if (typeof window === 'undefined') return false
  if (getAuth().currentUser) return false
  if (getUnderlyingFirebaseCode(error) === 'permission-denied') return true
  const msg = getErrorMessage(error).toLowerCase()
  return msg.includes('permiso') || msg.includes('permission-denied')
}

/**
 * Título y descripción amigables para toasts de errores de React Query.
 */
export function getQueryErrorToastContent(error: unknown): { title: string; description: string } {
  const message = getErrorMessage(error)
  const lower = message.toLowerCase()
  const normalizedLower = normalizeText(message)

  if (isNetworkErrorLike(error)) return { title: OFFLINE_USER_MESSAGE, description: '' }

  if (
    lower.includes('permiso') ||
    lower.includes('permission') ||
    lower.includes('permission-denied')
  ) {
    return {
      title: 'Permisos insuficientes',
      description: message,
    }
  }

  if (
    normalizedLower.includes('indice') ||
    normalizedLower.includes('index') ||
    lower.includes('failed-precondition')
  ) {
    return {
      title: 'Consulta o índice requerido',
      description: message,
    }
  }

  if (lower.includes('cuota') || lower.includes('quota') || lower.includes('resource-exhausted')) {
    return {
      title: 'Límite de uso',
      description: message,
    }
  }

  return {
    title: 'Error al cargar datos',
    description: message,
  }
}

import { OFFLINE_USER_MESSAGE } from '@/constants/networkMessages'
import { getErrorMessage, isNetworkErrorLike, normalizeText } from '@/utils/networkError'

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

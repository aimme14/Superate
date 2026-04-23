const NETWORK_HINTS = [
  'failed to fetch',
  'network',
  'fetch',
  'offline',
  'err_connection',
  'err_internet',
  'timeout',
  'timed out',
  'deadline exceeded',
  'deadline-exceeded',
  'internet',
  'conexion',
  'sin conexion',
] as const

const UNAVAILABLE_HINTS = [
  'no disponible',
  'no esta disponible',
  'disponible temporalmente',
  'unavailable',
  'service unavailable',
] as const

const NETWORK_ERROR_CODES = new Set([
  'unavailable',
  'deadline-exceeded',
  'network-request-failed',
  'auth/network-request-failed',
  'storage/retry-limit-exceeded',
])

/**
 * Normaliza texto para comparaciones robustas (sin tildes y en minúsculas).
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Extrae un mensaje legible desde `unknown`.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return 'Error desconocido'
}

export function getErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const o = error as { code?: unknown; details?: unknown }
  if (typeof o.code === 'string') return o.code
  if (o.details && typeof o.details === 'object') {
    const dc = (o.details as { code?: unknown }).code
    if (typeof dc === 'string') return dc
  }
  return null
}

/**
 * Determina si un error se comporta como problema de conectividad.
 * Prioriza comparaciones por código/patrones cortos para minimizar costo.
 */
export function isNetworkErrorLike(error: unknown): boolean {
  const code = getErrorCode(error)
  if (code && NETWORK_ERROR_CODES.has(code)) return true

  const rawMessage = getErrorMessage(error)
  const normalizedMessage = normalizeText(rawMessage)

  if (NETWORK_HINTS.some((hint) => normalizedMessage.includes(hint))) return true

  return UNAVAILABLE_HINTS.some((hint) => normalizedMessage.includes(hint))
}

export function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && !navigator.onLine
}

/**
 * Pantalla del examen: si el fallo parece de red, mostrar mensaje de conexión;
 * si no, el flujo histórico asume falta de preguntas en el banco.
 */
export function resolveQuizLoadFailureExamState(error: unknown): 'network_error' | 'no_questions' {
  return isNetworkErrorLike(error) ? 'network_error' : 'no_questions'
}

/**
 * Título y descripción amigables para toasts de errores de React Query.
 */
export function getQueryErrorToastContent(error: unknown): { title: string; description: string } {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : 'Error desconocido'

  const lower = message.toLowerCase()

  if (message.includes('Failed to fetch') || lower.includes('network') || lower.includes('fetch')) {
    return {
      title: 'Sin conexión',
      description:
        'Revisa tu conexión a internet. Se reintentará automáticamente cuando vuelva la red.',
    }
  }

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
    lower.includes('índice') ||
    lower.includes('index') ||
    lower.includes('failed-precondition')
  ) {
    return {
      title: 'Consulta o índice requerido',
      description: message,
    }
  }

  if (lower.includes('no disponible') || lower.includes('unavailable')) {
    return {
      title: 'Servicio no disponible',
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

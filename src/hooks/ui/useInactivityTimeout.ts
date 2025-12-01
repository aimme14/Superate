import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook personalizado para detectar inactividad del usuario y ejecutar una acción después de un tiempo determinado.
 * Detecta eventos de mouse, teclado, scroll, touch y focus para resetear el timer.
 * 
 * @param {number} timeoutMinutes - Tiempo en minutos antes de considerar inactividad (por defecto 10 minutos)
 * @param {() => void} onInactive - Función a ejecutar cuando se detecta inactividad
 * @param {boolean} enabled - Si está habilitado el hook (por defecto true)
 */
export const useInactivityTimeout = (
  timeoutMinutes: number = 10,
  onInactive: () => void,
  enabled: boolean = true
) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastActivityRef = useRef<number>(Date.now())

  /**
   * Reinicia el timer de inactividad
   */
  const resetTimer = useCallback(() => {
    if (!enabled) return

    // Limpiar el timer anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Actualizar la última actividad
    lastActivityRef.current = Date.now()

    // Establecer nuevo timer
    const timeoutMs = timeoutMinutes * 60 * 1000 // Convertir minutos a milisegundos
    timeoutRef.current = setTimeout(() => {
      console.log(`⏰ Sesión cerrada por inactividad después de ${timeoutMinutes} minutos`)
      onInactive()
    }, timeoutMs)
  }, [timeoutMinutes, onInactive, enabled])

  /**
   * Maneja los eventos de actividad del usuario
   */
  const handleActivity = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  /**
   * Maneja el cambio de visibilidad de la pestaña
   */
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible') {
      // Cuando la pestaña vuelve a ser visible, resetear el timer
      resetTimer()
    }
    // Si la pestaña se oculta, no hacer nada (el timer continúa)
  }, [resetTimer])

  useEffect(() => {
    if (!enabled) {
      // Si está deshabilitado, limpiar cualquier timer existente
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      return
    }

    // Eventos que indican actividad del usuario
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
      'keydown',
      'focus'
    ]

    // Agregar listeners para todos los eventos
    events.forEach(event => {
      document.addEventListener(event, handleActivity, true)
    })

    // Listener especial para cambios de visibilidad
    document.addEventListener('visibilitychange', handleVisibilityChange)

    // Iniciar el timer
    resetTimer()

    // Cleanup: remover listeners y limpiar timer
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity, true)
      })
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [enabled, handleActivity, handleVisibilityChange, resetTimer])

  /**
   * Función para resetear manualmente el timer (útil para acciones específicas)
   */
  const reset = useCallback(() => {
    resetTimer()
  }, [resetTimer])

  return { reset }
}


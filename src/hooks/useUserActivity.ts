import { useEffect, useRef } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { dbService } from '@/services/firebase/db.service'

/**
 * Hook para actualizar la última actividad del usuario
 * OPTIMIZADO: Actualiza solo cada 5 minutos para evitar exceder cuota de Firebase
 */
export const useUserActivity = () => {
  const { user, isAuth } = useAuthContext()
  const lastUpdateRef = useRef<number>(0)
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!isAuth || !user?.uid) return

    const updateActivity = async () => {
      try {
        const now = Date.now()
        // Solo actualizar si han pasado al menos 5 minutos desde la última actualización
        if (now - lastUpdateRef.current < 5 * 60 * 1000) {
          return // Evitar actualizaciones demasiado frecuentes
        }

        await dbService.updateUser(user.uid, {
          lastActivity: new Date().toISOString()
        })
        lastUpdateRef.current = now
      } catch (error: any) {
        // Si es error de cuota, no loguear (evitar spam)
        if (error?.code === 'resource-exhausted' || error?.code === 'quota-exceeded') {
          console.warn('⚠️ Cuota de Firebase excedida, omitiendo actualización de actividad')
          return
        }
        console.error('Error al actualizar última actividad:', error)
      }
    }

    // Actualizar inmediatamente al montar (solo una vez)
    updateActivity()

    // Actualizar cada 5 minutos (no más frecuente)
    const interval = setInterval(updateActivity, 5 * 60 * 1000)

    // Debounce para eventos de usuario - actualizar máximo cada 5 minutos
    const handleActivity = () => {
      // Limpiar timeout anterior si existe
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }

      // Programar actualización solo si han pasado 5 minutos
      const timeSinceLastUpdate = Date.now() - lastUpdateRef.current
      if (timeSinceLastUpdate >= 5 * 60 * 1000) {
        updateActivity()
      } else {
        // Programar para cuando falten 5 minutos
        const remainingTime = 5 * 60 * 1000 - timeSinceLastUpdate
        updateTimeoutRef.current = setTimeout(updateActivity, remainingTime)
      }
    }

    // Solo escuchar eventos importantes (no mousemove que es muy frecuente)
    const events = ['mousedown', 'keypress', 'click']
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      clearInterval(interval)
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current)
      }
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [user?.uid, isAuth])
}


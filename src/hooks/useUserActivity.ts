import { useEffect } from 'react'
import { useAuthContext } from '@/context/AuthContext'
import { dbService } from '@/services/firebase/db.service'

/**
 * Hook para actualizar la última actividad del usuario
 * Se actualiza cada 5 minutos mientras el usuario está activo
 */
export const useUserActivity = () => {
  const { user, isAuth } = useAuthContext()

  useEffect(() => {
    if (!isAuth || !user?.uid) return

    const updateActivity = async () => {
      try {
        await dbService.updateUser(user.uid, {
          lastActivity: new Date().toISOString()
        })
      } catch (error) {
        console.error('Error al actualizar última actividad:', error)
      }
    }

    // Actualizar inmediatamente al montar
    updateActivity()

    // Actualizar cada 5 minutos
    const interval = setInterval(updateActivity, 5 * 60 * 1000)

    // Actualizar cuando el usuario interactúa con la página
    const handleActivity = () => {
      updateActivity()
    }

    // Eventos que indican actividad del usuario
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click']
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true })
    })

    return () => {
      clearInterval(interval)
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [user?.uid, isAuth])
}


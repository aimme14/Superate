import { useState, useEffect } from 'react'
import { WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { OFFLINE_USER_MESSAGE } from '@/constants/networkMessages'

/**
 * Banner fijo que se muestra cuando el usuario pierde conexión (navigator.onLine === false).
 * Indica que se están mostrando datos en caché y que algunas acciones pueden no estar disponibles.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  )

  useEffect(() => {
    if (typeof navigator === 'undefined') return
    const handleOffline = () => setIsOffline(true)
    const handleOnline = () => setIsOffline(false)
    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)
    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

  if (!isOffline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 py-2 px-4',
        'bg-amber-500/95 text-amber-950 text-sm font-medium shadow-md'
      )}
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>{OFFLINE_USER_MESSAGE}</span>
    </div>
  )
}

import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/ui/use-toast'

const TOAST_DEBOUNCE_MS = 2000

/**
 * Muestra un toast cuando una query falla (tras reintentos).
 * Evita spam debouncing por un breve periodo.
 */
export function GlobalQueryErrorToaster() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const lastToastRef = useRef<number>(0)

  useEffect(() => {
    const cache = queryClient.getQueryCache()
    const unsub = cache.subscribe((event) => {
      if (event?.type !== 'updated') return
      const query = event.query
      if (query.state.status !== 'error') return
      const error = query.state.error
      const message = error instanceof Error ? error.message : 'Error de conexión'
      if (Date.now() - lastToastRef.current < TOAST_DEBOUNCE_MS) return
      lastToastRef.current = Date.now()
      toast({
        title: 'Error de conexión',
        description: message.includes('Failed to fetch') || message.includes('network')
          ? 'Revisa tu conexión a internet. Se reintentará automáticamente.'
          : message,
        variant: 'destructive',
        duration: 5000,
      })
    })
    return () => unsub()
  }, [queryClient, toast])

  return null
}

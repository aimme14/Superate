import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/ui/use-toast'
import { getQueryErrorToastContent } from '@/utils/queryErrorToast'

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
      if (Date.now() - lastToastRef.current < TOAST_DEBOUNCE_MS) return
      lastToastRef.current = Date.now()
      const { title, description } = getQueryErrorToastContent(error)
      toast({
        title,
        description,
        variant: 'destructive',
        duration: 5000,
      })
    })
    return () => unsub()
  }, [queryClient, toast])

  return null
}

import { useEffect, useState } from 'react'

const MIN_SPLASH_MS = 3000

/**
 * Mantiene visible la bienvenida al menos MIN_SPLASH_MS y hasta que termine auth.loading.
 */
export function useInitialAuthSplash(loading: boolean) {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS)
    return () => window.clearTimeout(id)
  }, [])

  const showSplash = loading || !minTimeElapsed
  return { showSplash }
}

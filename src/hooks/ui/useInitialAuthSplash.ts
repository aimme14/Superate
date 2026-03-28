import { useEffect, useState } from 'react'

const MIN_SPLASH_MS = 3000

/** Pantalla de bienvenida fija (~3s), sin acoplarse a auth ni a lecturas de red. */
export function useInitialAuthSplash() {
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  useEffect(() => {
    const id = window.setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS)
    return () => window.clearTimeout(id)
  }, [])

  return { showSplash: !minTimeElapsed }
}

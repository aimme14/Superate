import * as React from 'react'

/** Alineado con Tailwind `lg:` (1024px). */
const LG_MIN_PX = 1024

function getIsLgUp(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia(`(min-width: ${LG_MIN_PX}px)`).matches
}

/**
 * `true` cuando el viewport es al menos `lg` (desktop con las dos columnas del resumen).
 */
export function useIsLgUp() {
  const [isLgUp, setIsLgUp] = React.useState(getIsLgUp)

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${LG_MIN_PX}px)`)
    const onChange = () => setIsLgUp(mql.matches)
    mql.addEventListener('change', onChange)
    setIsLgUp(mql.matches)
    return () => mql.removeEventListener('change', onChange)
  }, [])

  return isLgUp
}

import { useState, useEffect } from 'react'

/**
 * Hook que retorna un valor debounced. El valor se actualiza solo después de que
 * el usuario deja de escribir durante el tiempo especificado.
 * @param value - Valor a debounce
 * @param delay - Delay en milisegundos (por defecto 350ms)
 */
export function useDebounce<T>(value: T, delay = 350): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

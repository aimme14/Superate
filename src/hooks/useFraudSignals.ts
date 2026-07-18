import { useState, useRef, useEffect, useCallback } from 'react'
import { logger } from '@/utils/logger'

/**
 * Señales "blandas" de posible fraude durante un examen.
 * A diferencia del cambio de pestaña (que puede cerrar el examen), estas solo
 * se bloquean y se registran para revisión posterior del docente.
 */
export interface FraudSignals {
  /** Intentos de copiar / cortar / pegar bloqueados. */
  copyPaste: number
  /** Aperturas del menú contextual (clic derecho) bloqueadas. */
  contextMenu: number
  /** Combinaciones de teclas asociadas a DevTools bloqueadas. */
  devtools: number
  /** Se detectó una pantalla extendida (best-effort, Window Management API). */
  secondScreen: boolean
}

export const EMPTY_FRAUD_SIGNALS: FraudSignals = {
  copyPaste: 0,
  contextMenu: 0,
  devtools: 0,
  secondScreen: false,
}

/** True si alguna señal blanda fue detectada. */
export function hasFraudSignals(signals?: FraudSignals | null): boolean {
  if (!signals) return false
  return (
    signals.copyPaste > 0 ||
    signals.contextMenu > 0 ||
    signals.devtools > 0 ||
    signals.secondScreen === true
  )
}

interface UseFraudSignalsParams {
  /** Solo escucha mientras el examen esté activo (examState === 'active' && !examLocked). */
  active: boolean
}

/**
 * Detección centralizada de señales blandas de fraude. No dispara escrituras ni
 * lecturas: todo ocurre en el navegador. El valor final se persiste junto con el
 * resultado del examen (mismo documento, sin costo extra).
 *
 * Se expone `fraudSignalsRef` porque el guardado del examen suele ejecutarse desde
 * un closure de `useEffect`; leer del ref evita valores obsoletos.
 */
export function useFraudSignals({ active }: UseFraudSignalsParams) {
  const [fraudSignals, setFraudSignals] = useState<FraudSignals>({ ...EMPTY_FRAUD_SIGNALS })
  const fraudSignalsRef = useRef<FraudSignals>({ ...EMPTY_FRAUD_SIGNALS })

  const bump = useCallback((key: keyof FraudSignals) => {
    setFraudSignals(prev => {
      const next: FraudSignals =
        key === 'secondScreen'
          ? { ...prev, secondScreen: true }
          : { ...prev, [key]: (prev[key] as number) + 1 }
      fraudSignalsRef.current = next
      return next
    })
  }, [])

  const resetFraudSignals = useCallback(() => {
    const fresh: FraudSignals = { ...EMPTY_FRAUD_SIGNALS }
    fraudSignalsRef.current = fresh
    setFraudSignals(fresh)
  }, [])

  useEffect(() => {
    if (!active) return

    const onCopyCutPaste = (e: Event) => {
      e.preventDefault()
      bump('copyPaste')
      logger.debug('[antifraude] copiar/cortar/pegar bloqueado durante el examen')
    }

    const onContextMenu = (e: Event) => {
      e.preventDefault()
      bump('contextMenu')
    }

    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key
      const isDevtoolsCombo =
        key === 'F12' ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(key)) ||
        ((e.ctrlKey || e.metaKey) && ['U', 'u'].includes(key))
      if (isDevtoolsCombo) {
        e.preventDefault()
        bump('devtools')
        logger.debug('[antifraude] atajo de DevTools bloqueado durante el examen')
      }
    }

    document.addEventListener('copy', onCopyCutPaste)
    document.addEventListener('cut', onCopyCutPaste)
    document.addEventListener('paste', onCopyCutPaste)
    document.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('keydown', onKeyDown, true)

    // Detección best-effort de segunda pantalla (no todos los navegadores la exponen).
    try {
      const extended = (window.screen as Screen & { isExtended?: boolean })?.isExtended
      if (extended) bump('secondScreen')
    } catch {
      /* API no disponible: se ignora */
    }

    return () => {
      document.removeEventListener('copy', onCopyCutPaste)
      document.removeEventListener('cut', onCopyCutPaste)
      document.removeEventListener('paste', onCopyCutPaste)
      document.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [active, bump])

  return { fraudSignals, fraudSignalsRef, resetFraudSignals }
}

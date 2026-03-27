/**
 * Caché local (localStorage) para tips ICFES y herramientas IA en la ruta de preparación.
 * Se limpia al cerrar sesión (ver clearPersistedCache / AuthContext).
 */
import type { TipICFES } from '@/interfaces/tipsICFES.interface'
import type { AIToolData } from '@/services/firebase/aiTools.service'

const VERSION = 1
const KEY_PREFIX = 'superate:ruta-prep'

export type RutaPreparacionLocalPayload = {
  v: number
  /** Ausente = nunca cacheado; array vacío = cacheado sin resultados */
  icfesTips?: TipICFES[]
  herramientasIA?: AIToolData[]
}

function key(uid: string): string {
  return `${KEY_PREFIX}:v${VERSION}:${uid}`
}

export function readRutaPreparacionCache(uid: string): RutaPreparacionLocalPayload | null {
  try {
    if (typeof window === 'undefined') return null
    const raw = window.localStorage.getItem(key(uid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as RutaPreparacionLocalPayload
    if (parsed.v !== VERSION) return null
    return parsed
  } catch {
    return null
  }
}

function writePayload(uid: string, payload: RutaPreparacionLocalPayload): void {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key(uid), JSON.stringify(payload))
  } catch {
    // quota, modo privado
  }
}

export function mergeRutaPreparacionCache(
  uid: string,
  partial: Partial<Pick<RutaPreparacionLocalPayload, 'icfesTips' | 'herramientasIA'>>
): void {
  const prev = readRutaPreparacionCache(uid) ?? { v: VERSION }
  writePayload(uid, {
    ...prev,
    ...partial,
    v: VERSION,
  })
}

export function clearCachedIcfesTips(uid: string): void {
  const prev = readRutaPreparacionCache(uid)
  if (!prev || prev.icfesTips === undefined) return
  const { icfesTips: _t, ...rest } = prev
  const next: RutaPreparacionLocalPayload = { ...rest, v: VERSION }
  if (next.herramientasIA === undefined) {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key(uid))
    } catch {
      /* ignore */
    }
    return
  }
  writePayload(uid, next)
}

export function clearCachedHerramientasIA(uid: string): void {
  const prev = readRutaPreparacionCache(uid)
  if (!prev || prev.herramientasIA === undefined) return
  const { herramientasIA: _h, ...rest } = prev
  const next: RutaPreparacionLocalPayload = { ...rest, v: VERSION }
  if (next.icfesTips === undefined) {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key(uid))
    } catch {
      /* ignore */
    }
    return
  }
  writePayload(uid, next)
}

/** Sin uid: borra todas las entradas de esta caché (logout). */
export function clearRutaPreparacionCache(uid?: string): void {
  try {
    if (typeof window === 'undefined') return
    if (uid) {
      window.localStorage.removeItem(key(uid))
      return
    }
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(`${KEY_PREFIX}:`)) toRemove.push(k)
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

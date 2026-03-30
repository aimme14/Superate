/**
 * Lectura de AI_Tools/consolidado_1 con caché local de Firestore (IndexedDB).
 * Preferencia: caché → red; reintento fuerza servidor.
 *
 * Los ítems del consolidado no traen id de documento; se asigna `consolidado-{index}`
 * para keys en UI (mismo criterio que TipsIA).
 */

import {
  doc,
  getDoc,
  getDocFromCache,
  getDocFromServer,
  getFirestore,
  Timestamp,
} from 'firebase/firestore'
import { firebaseApp } from '@/services/db'
import type { AIToolData, Nivel } from '@/services/firebase/aiTools.service'

const AI_TOOLS = 'AI_Tools'
const CONSOLIDADO_1 = 'consolidado_1'

function mapConsolidatedItem(raw: unknown, index: number): AIToolData {
  const data =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const createdAt = (data.createdAt as Timestamp)?.toDate?.() ?? new Date()
  const updatedAt = (data.updatedAt as Timestamp)?.toDate?.() ?? createdAt
  const isActive = data.isActive === undefined ? true : Boolean(data.isActive)
  return {
    id: `consolidado-${index}`,
    nombre: String(data.nombre ?? ''),
    especialidad: String(data.especialidad ?? ''),
    modulosRecomendados: Array.isArray(data.modulosRecomendados)
      ? data.modulosRecomendados.map(String)
      : [],
    nivel: (data.nivel as Nivel) ?? 'intermedio',
    urlRedireccion: String(data.urlRedireccion ?? ''),
    iconUrl: data.iconUrl != null ? String(data.iconUrl) : null,
    promptsSugeridos: Array.isArray(data.promptsSugeridos)
      ? data.promptsSugeridos.map(String)
      : [],
    isActive,
    createdAt,
    updatedAt,
  }
}

function dataToTools(data: Record<string, unknown> | undefined): AIToolData[] {
  const items = data?.items
  if (!Array.isArray(items)) return []
  return items.map((item, i) => mapConsolidatedItem(item, i))
}

export type FetchAIToolsConsolidadoOptions = {
  /** Si true, ignora caché local y lee solo desde el servidor (p. ej. botón reintentar). */
  forceServer?: boolean
}

/**
 * Obtiene las herramientas desde AI_Tools/consolidado_1.
 * Sin `forceServer`: intenta `getDocFromCache` (0 lecturas de red si ya está en IndexedDB), si no hay caché usa `getDoc`.
 */
export async function fetchAIToolsConsolidado1(
  options?: FetchAIToolsConsolidadoOptions
): Promise<AIToolData[]> {
  const db = getFirestore(firebaseApp)
  const ref = doc(db, AI_TOOLS, CONSOLIDADO_1)

  if (options?.forceServer) {
    const snap = await getDocFromServer(ref)
    if (!snap.exists()) return []
    return dataToTools(snap.data() as Record<string, unknown>)
  }

  try {
    const cached = await getDocFromCache(ref)
    if (cached.exists()) {
      return dataToTools(cached.data() as Record<string, unknown>)
    }
  } catch {
    // Sin entrada en caché local: seguir a red
  }

  const snap = await getDoc(ref)
  if (!snap.exists()) return []
  return dataToTools(snap.data() as Record<string, unknown>)
}

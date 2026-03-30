import type { Simulacro } from '@/interfaces/simulacro.interface'

/** Alineado con ViewerPdfPage: resolución de URL por tipo sin lectura extra a Firestore. */
export type SimulacroPdfTipo =
  | 'documento'
  | 'hoja'
  | 'documento2'
  | 'hoja2'
  | 'icfes1doc'
  | 'icfes1hoja'
  | 'icfes2doc'
  | 'icfes2hoja'

/** Prefijo en localStorage para pasar la URL al visor (misma clave en todas las pestañas del origen). */
export const VIEWER_PDF_HANDOFF_PREFIX = 'superateViewerPdfUrl:' as const

export function viewerPdfHandoffKey(simId: string, tipo: SimulacroPdfTipo): string {
  return `${VIEWER_PDF_HANDOFF_PREFIX}${simId}:${tipo}`
}

/** Limpia enlaces de handoff (logout / borrado de sitio). */
export function clearViewerPdfHandoffKeys(): void {
  try {
    if (typeof window === 'undefined') return
    const toRemove: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(VIEWER_PDF_HANDOFF_PREFIX)) toRemove.push(k)
    }
    toRemove.forEach((k) => window.localStorage.removeItem(k))
  } catch {
    // ignore
  }
}

export function getSimulacroPdfUrl(sim: Simulacro, tipo: SimulacroPdfTipo): string | null {
  switch (tipo) {
    case 'documento':
      return sim.pdfSimulacroUrl || null
    case 'hoja':
      return sim.pdfHojaRespuestasUrl || null
    case 'documento2':
      return sim.pdfSimulacroSeccion2Url || null
    case 'hoja2':
      return sim.pdfHojaRespuestasSeccion2Url || null
    case 'icfes1doc':
      return sim.icfes?.seccion1DocumentoUrl || null
    case 'icfes1hoja':
      return sim.icfes?.seccion1HojaUrl || null
    case 'icfes2doc':
      return sim.icfes?.seccion2DocumentoUrl || null
    case 'icfes2hoja':
      return sim.icfes?.seccion2HojaUrl || null
    default:
      return null
  }
}

/**
 * Abre el visor con URL corta.
 * - Simulacros reales: `simulacroId` + `tipo` → `getById` en Firestore.
 * - Consolidado (`consolidado:...`): la URL va a **localStorage** (compartido con `target="_blank"`;
 *   sessionStorage no lo es) y el visor usa `sid` + `tipo`.
 * Si falla el almacenamiento, último recurso `?url=` (riesgo de truncar en la barra).
 */
export function buildSimulacroViewerPdfPath(sim: Simulacro, tipo: SimulacroPdfTipo): string {
  const url = getSimulacroPdfUrl(sim, tipo)
  if (!url) return '#'
  if (sim.id.startsWith('consolidado:')) {
    try {
      localStorage.setItem(viewerPdfHandoffKey(sim.id, tipo), url)
    } catch {
      return `/viewer/pdf?url=${encodeURIComponent(url)}`
    }
    const q = new URLSearchParams()
    q.set('sid', sim.id)
    q.set('tipo', tipo)
    return `/viewer/pdf?${q.toString()}`
  }
  return `/viewer/pdf?simulacroId=${encodeURIComponent(sim.id)}&tipo=${encodeURIComponent(tipo)}`
}

import type { Simulacro } from '@/interfaces/simulacro.interface'

/** Alineado con ViewerPdfPage: resolución de URL por tipo. */
export type SimulacroPdfTipo =
  | 'documento'
  | 'hoja'
  | 'documento2'
  | 'hoja2'
  | 'icfes1doc'
  | 'icfes1hoja'
  | 'icfes2doc'
  | 'icfes2hoja'

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
 * - Siempre incluye `url` (Storage) cuando existe: el visor evita Firestore y deja que PDF.js cargue por streaming.
 * - `sid`/`tipo` o `simulacroId`/`tipo` sirven para caché IndexedDB estable y enlaces legibles.
 */
export function buildSimulacroViewerPdfPath(sim: Simulacro, tipo: SimulacroPdfTipo): string {
  const url = getSimulacroPdfUrl(sim, tipo)
  if (!url) return '#'
  const q = new URLSearchParams()
  q.set('tipo', tipo)
  q.set('url', encodeURIComponent(url))
  if (sim.id.startsWith('consolidado:')) {
    q.set('sid', sim.id)
  } else {
    q.set('simulacroId', sim.id)
  }
  return `/viewer/pdf?${q.toString()}`
}

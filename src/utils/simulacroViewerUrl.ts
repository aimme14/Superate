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
 * - IDs `consolidado:...`: `sid` + `tipo` → el visor lee `Simulacros/consolidado_1` y resuelve la URL.
 * - Documentos reales (panel admin): `simulacroId` + `tipo` → `getById` en la colección Simulacros.
 */
export function buildSimulacroViewerPdfPath(sim: Simulacro, tipo: SimulacroPdfTipo): string {
  const url = getSimulacroPdfUrl(sim, tipo)
  if (!url) return '#'
  if (sim.id.startsWith('consolidado:')) {
    const q = new URLSearchParams()
    q.set('sid', sim.id)
    q.set('tipo', tipo)
    return `/viewer/pdf?${q.toString()}`
  }
  return `/viewer/pdf?simulacroId=${encodeURIComponent(sim.id)}&tipo=${encodeURIComponent(tipo)}`
}

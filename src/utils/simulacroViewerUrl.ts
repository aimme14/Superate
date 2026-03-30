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

/** Abre el visor con `?url=` (una sola lectura de datos; el visor no llama a getById). */
export function buildSimulacroViewerPdfPath(sim: Simulacro, tipo: SimulacroPdfTipo): string {
  const url = getSimulacroPdfUrl(sim, tipo)
  if (!url) return '#'
  return `/viewer/pdf?url=${encodeURIComponent(url)}`
}

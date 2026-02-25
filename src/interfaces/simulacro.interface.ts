/**
 * Interfaces para el módulo de Simulacros tipo Saber 11 (ICFES).
 * Incluye el simulacro principal y la subcolección de videos explicativos.
 */

/** Grados disponibles para simulacros (ej. 9°, 10°, 11°) */
export const SIMULACRO_GRADOS = ['9°', '10°', '11°'] as const
export type SimulacroGrado = (typeof SIMULACRO_GRADOS)[number]

/** Materias alineadas con Saber 11 / ICFES. ICFES tiene dos secciones (2 documentos + 2 hojas de respuesta + videos). */
export const SIMULACRO_MATERIAS = [
  { value: 'matematicas', label: 'Matemáticas' },
  { value: 'lectura-critica', label: 'Lectura Crítica' },
  { value: 'ciencias-naturales', label: 'Ciencias Naturales' },
  { value: 'sociales', label: 'Sociales' },
  { value: 'ingles', label: 'Inglés' },
  { value: 'icfes', label: 'ICFES' },
] as const
export type SimulacroMateria = (typeof SIMULACRO_MATERIAS)[number]['value']

export interface SimulacroVideo {
  id: string
  titulo: string
  descripcion?: string
  url: string
  /** Ruta en Storage para poder eliminar el archivo al borrar el video o el simulacro */
  storagePath?: string
  createdAt: Date
}

/**
 * Materia ICFES: dos secciones, cada una con 1 documento PDF y 1 hoja de respuestas PDF.
 * Máximo 2 documentos y 2 hojas de respuesta. Si se sube solo uno no es obligatorio el segundo.
 * Los videos de ICFES se guardan en la subcolección Simulacros/{id}/ICFES/Videos.
 */
export interface SimulacroICFES {
  /** URL PDF documento sección 1 (opcional; validar hasta 2 documentos) */
  seccion1DocumentoUrl?: string
  /** URL PDF hoja de respuestas sección 1 */
  seccion1HojaUrl?: string
  /** URL PDF documento sección 2 */
  seccion2DocumentoUrl?: string
  /** URL PDF hoja de respuestas sección 2 */
  seccion2HojaUrl?: string
}

export interface Simulacro {
  id: string
  grado: SimulacroGrado
  materia: string
  titulo: string
  /** @deprecated Ya no se usa; se mantiene opcional por compatibilidad con datos existentes. */
  formulario?: string
  numeroOrden: number
  comentario: string
  isActive: boolean
  createdAt: Date
  /** URL del PDF del simulacro (obligatorio tras creación) */
  pdfSimulacroUrl: string
  /** URL del PDF de la hoja de respuestas asociada (1:1 con este simulacro) */
  pdfHojaRespuestasUrl: string
  /** Videos explicativos (subcolección; relación 1:N) */
  videos?: SimulacroVideo[]
  /** Materia ICFES: dos secciones (2 documentos PDF + 2 hojas de respuesta) y videos en ICFES/Videos */
  icfes?: SimulacroICFES
  /** Videos de la materia ICFES (subcolección Simulacros/{id}/ICFES/Videos) */
  icfesVideos?: SimulacroVideo[]
}

export interface CreateSimulacroInput {
  grado: SimulacroGrado
  materia: string
  titulo: string
  numeroOrden: number
  comentario: string
  isActive?: boolean
  pdfSimulacroUrl: string
  pdfHojaRespuestasUrl: string
}

export interface UpdateSimulacroInput {
  grado?: SimulacroGrado
  materia?: string
  titulo?: string
  numeroOrden?: number
  comentario?: string
  isActive?: boolean
  pdfSimulacroUrl?: string
  pdfHojaRespuestasUrl?: string
  icfes?: SimulacroICFES
}

export interface CreateSimulacroVideoInput {
  titulo: string
  descripcion?: string
  url: string
  storagePath?: string
}

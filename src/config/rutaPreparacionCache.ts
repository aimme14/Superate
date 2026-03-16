/**
 * Configuración unificada de caché para la sección "Ruta de preparación".
 * Mismos tiempos en simulacros, plan de estudio y evaluaciones para que el
 * estudiante no note recargas constantes al navegar entre secciones.
 *
 * - staleTime: datos considerados frescos → no refetch al navegar.
 * - gcTime: datos en memoria → carga instantánea al volver.
 */
export const RUTA_PREPARACION_CACHE = {
  /** 10 min: datos frescos; evita refetch mientras el estudiante usa la ruta. */
  staleTimeMs: 10 * 60 * 1000,
  /** 10 min: datos en memoria para carga rápida al volver. */
  gcTimeMs: 10 * 60 * 1000,
} as const;

/**
 * Caché "hasta refresh" para la lista de Ruta académica simulacros.
 * - Primera entrada: se hace la petición y se guarda en caché.
 * - Navegación (Ruta académica ↔ Plan de estudio ↔ Simulacros IA, etc.): solo caché, sin nueva petición.
 * - Solo al refrescar la página (F5): se vuelve a consultar (el caché se pierde al recargar).
 */
export const RUTA_ACADEMICA_SIMULACROS_CACHE = {
  /** Nunca considerar los datos obsoletos durante la sesión. */
  staleTime: Infinity,
  /** Mantener en memoria hasta que se cierre/refresque la pestaña. */
  gcTime: Infinity,
  /** No refetch al volver a la pestaña. */
  refetchOnWindowFocus: false,
  /** No refetch al montar el componente si ya hay datos en caché. */
  refetchOnMount: false,
  /** No refetch al reconectar red. */
  refetchOnReconnect: false,
} as const;

/**
 * Caché de sesión para todo el rol estudiante (excepto preguntas de simulacros y tests).
 * Una carga inicial y el resto desde memoria; reduce lecturas a la base de datos.
 * Invalidar explícitamente (ej. evaluaciones al enviar un examen) cuando el dato cambie.
 */
export const ESTUDIANTE_SESSION_CACHE = {
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const;

/** Preguntas Simulacros IA/ICFES: refresco cada 30 min para rotar preguntas. */
export const SIMULACRO_QUESTIONS_CACHE_MS = 30 * 60 * 1000;

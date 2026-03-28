/**
 * Configuración unificada de caché para la sección "Ruta de preparación".
 * Mismos tiempos en simulacros, plan de estudio y evaluaciones para que el
 * estudiante no note recargas constantes al navegar entre secciones.
 *
 * - staleTime: datos considerados frescos → no refetch al navegar.
 * - gcTime: datos en memoria → carga instantánea al volver.
 */
export const RUTA_PREPARACION_CACHE = {
  /** Alineado a sesión hasta cerrar sesión (invalidación explícita al enviar examen, etc.). */
  staleTimeMs: Number.POSITIVE_INFINITY,
  gcTimeMs: Number.POSITIVE_INFINITY,
} as const;

/**
 * Caché "hasta refresh" para la lista de Ruta académica simulacros.
 * - Primera entrada: se hace la petición y se guarda en caché.
 * - Navegación (Ruta académica ↔ Plan de estudio ↔ Simulacros IA, etc.): solo caché, sin nueva petición.
 * - Con persistencia React Query + localStorage, al reabrir la app sigue la caché hasta cerrar sesión.
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

/**
 * Preguntas completas (bank) al abrir «Ver pregunta» en Resultados u otras vistas.
 * Misma sesión: una lectura por id; repetir la misma pregunta no vuelve a Firestore.
 */
export const QUESTION_BANK_SESSION_CACHE = {
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnMount: false,
  refetchOnReconnect: false,
} as const;

/** Preguntas Simulacros IA/ICFES: refresco cada 30 min para rotar preguntas. */
export const SIMULACRO_QUESTIONS_CACHE_MS = 30 * 60 * 1000;

/**
 * Configuración de caché para el dashboard del rector.
 * Sin actualización por tiempo: los datos solo se refrescan al recargar la página (F5).
 * Minimiza lecturas en Firestore: no hay refetch automático por tiempo ni al montar/volver.
 *
 * - staleTime: Infinity → los datos nunca se consideran obsoletos por tiempo.
 * - gcTime: Infinity → la caché se mantiene en memoria hasta cerrar/refrescar la pestaña.
 */
export const DASHBOARD_RECTOR_CACHE = {
  /** Nunca obsoleto por tiempo; solo se pide de nuevo al refrescar la página. */
  staleTimeMs: Infinity,
  /** Caché en memoria hasta cerrar o refrescar la pestaña. */
  gcTimeMs: Infinity,
} as const;

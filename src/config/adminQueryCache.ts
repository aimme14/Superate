/**
 * Opciones de React Query alineadas con el rol admin:
 * menos refetch al volver a la ventana, datos de listado estables en memoria.
 * No persiste en disco (evita datos sensibles en storage local).
 */
export const ADMIN_LIST_CACHE = {
  staleTime: 15 * 60 * 1000, // 15 min
  gcTime: 45 * 60 * 1000, // 45 min en memoria
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const

/**
 * Solo para `useQuestionsInfinite` (banco de preguntas con paginación).
 *
 * - **staleTime / gcTime = Infinity:** mientras exista el `QueryClient` (típico: pestaña abierta,
 *   sesión SPA sin recargar), el listado infinito no caduca ni se elimina de memoria al desmontar
 *   el componente. Cada “Cargar más” acumula páginas en la misma entrada de caché; volver a la
 *   sección no re-lee páginas ya obtenidas.
 * - **No es persistencia en disco:** un F5 o cerrar la pestaña vacía el caché del cliente.
 * - **`invalidateQueries` / botón Refrescar lista:** siguen forzando lectura nueva en Firestore.
 *
 * El resto de hooks admin siguen usando {@link ADMIN_LIST_CACHE} para no retener datos viejos
 * indefinidamente en otras pantallas.
 */
export const QUESTIONS_BANK_INFINITE_CACHE = {
  staleTime: Infinity,
  gcTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
  refetchOnMount: false,
} as const

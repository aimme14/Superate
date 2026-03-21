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

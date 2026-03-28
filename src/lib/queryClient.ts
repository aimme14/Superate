import { QueryClient } from "@tanstack/react-query";

/**
 * Caché hasta cerrar sesión: sin GC por tiempo ni refetch automático por antigüedad.
 * Debe alinearse con persistOptions.maxAge en queryPersist (Infinity).
 * Las mutaciones / invalidateQueries siguen refrescando donde haga falta.
 */
const SESSION_UNTIL_LOGOUT = Infinity;

/** Reintentos con backoff exponencial (1s, 2s, máx 10s). */
function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 10000);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: SESSION_UNTIL_LOGOUT,
      gcTime: SESSION_UNTIL_LOGOUT,
      retry: 2,
      retryDelay,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

export default queryClient;

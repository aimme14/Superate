import { QueryClient } from "@tanstack/react-query";

/** Mismo valor que persistOptions.maxAge para que la caché restaurada no se elimine por GC. */
const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h

/** Reintentos con backoff exponencial (1s, 2s, máx 10s). */
function retryDelay(attemptIndex: number): number {
  return Math.min(1000 * 2 ** attemptIndex, 10000);
}

/**
 * QueryClient con caché optimizado, persistencia y reintentos.
 * - staleTime: 5 min (evita refetch al navegar).
 * - gcTime: 24 h (alineado con persist).
 * - retry: 2 reintentos con backoff ante fallos de red.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: PERSIST_MAX_AGE_MS, // 24 h
      retry: 2,
      retryDelay,
    },
  },
});

export default queryClient;
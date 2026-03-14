import { QueryClient } from "@tanstack/react-query";

/** Mismo valor que persistOptions.maxAge para que la caché restaurada no se elimine por GC. */
const PERSIST_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 h

/**
 * QueryClient con caché optimizado y compatible con persistencia en localStorage.
 * - staleTime: 5 min por defecto (evita refetch al navegar).
 * - gcTime: 24 h para que la caché restaurada desde persist no se borre de inmediato.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min
      gcTime: PERSIST_MAX_AGE_MS, // 24 h (alineado con persist maxAge)
    },
  },
});

export default queryClient;
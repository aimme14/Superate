import { QueryClient } from "@tanstack/react-query";

/**
 * QueryClient configurado con caché optimizado para la experiencia del estudiante.
 * - staleTime: 5 min → Los datos se consideran frescos, evita refetch al navegar entre secciones.
 * - gcTime: 10 min → Los datos permanecen en memoria para carga instantánea al volver.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
    },
  },
});

export default queryClient;
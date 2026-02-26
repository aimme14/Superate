import { useQuery } from "@tanstack/react-query";
import { simulacrosService } from "@/services/firebase/simulacros.service";
import type { Simulacro } from "@/interfaces/simulacro.interface";

const SIMULACROS_QUERY_KEY = ["simulacros", "with-videos"] as const;

/**
 * Hook para obtener simulacros con videos.
 * Usa React Query para caché: al navegar entre secciones, los datos se sirven desde caché.
 */
export function useSimulacros() {
  return useQuery({
    queryKey: SIMULACROS_QUERY_KEY,
    queryFn: async (): Promise<Simulacro[]> => {
      const res = await simulacrosService.getAllWithVideos();
      if (res.success) {
        return res.data;
      }
      throw new Error(res.error?.message ?? "Error al cargar simulacros");
    },
    staleTime: 5 * 60 * 1000, // 5 min
    gcTime: 10 * 60 * 1000, // 10 min
  });
}

import { useQuery } from "@tanstack/react-query";
import { simulacrosService } from "@/services/firebase/simulacros.service";
import type { Simulacro } from "@/interfaces/simulacro.interface";

export const SIMULACROS_QUERY_KEY = ["simulacros", "with-videos"] as const;
export const SIMULACROS_LIST_QUERY_KEY = ["simulacros", "list"] as const;
export const simulacroDetailKey = (id: string) => ["simulacros", "detail", id] as const;

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

/**
 * Hook para obtener lista de simulacros (sin videos) para el admin.
 * Usa React Query con caché de 2 minutos.
 */
export function useSimulacrosList() {
  return useQuery({
    queryKey: SIMULACROS_LIST_QUERY_KEY,
    queryFn: async (): Promise<Simulacro[]> => {
      const res = await simulacrosService.getAll();
      if (res.success) {
        return res.data;
      }
      throw new Error(res.error?.message ?? "Error al cargar simulacros");
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para obtener detalles de un simulacro (con videos) al expandir.
 * Usa caché para evitar peticiones repetidas.
 */
export function useSimulacroDetails(id: string | null, enabled: boolean) {
  return useQuery({
    queryKey: simulacroDetailKey(id ?? ""),
    queryFn: async (): Promise<Simulacro | null> => {
      if (!id) return null;
      const res = await simulacrosService.getById(id);
      if (res.success) return res.data;
      throw new Error(res.error?.message ?? "Error al cargar simulacro");
    },
    enabled: enabled && !!id,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

import { useQuery } from "@tanstack/react-query";
import { simulacrosService } from "@/services/firebase/simulacros.service";
import type { Simulacro } from "@/interfaces/simulacro.interface";
import {
  RUTA_PREPARACION_CACHE,
  RUTA_ACADEMICA_SIMULACROS_CACHE,
} from "@/config/rutaPreparacionCache";

export const SIMULACROS_QUERY_KEY = ["simulacros", "with-videos"] as const;
export const SIMULACROS_LIST_QUERY_KEY = ["simulacros", "list"] as const;
export const simulacroDetailKey = (id: string) => ["simulacros", "detail", id] as const;

/**
 * Hook para obtener la lista de simulacros con videos (Ruta académica simulacros).
 * Caché "hasta refresh": primera entrada hace la petición; al navegar se usa solo caché;
 * solo al refrescar la página (F5) se vuelve a consultar.
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
    ...RUTA_ACADEMICA_SIMULACROS_CACHE,
  });
}

/**
 * Hook para obtener lista de simulacros (sin videos).
 * Misma configuración de caché que la Ruta de preparación.
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
    staleTime: RUTA_PREPARACION_CACHE.staleTimeMs,
    gcTime: RUTA_PREPARACION_CACHE.gcTimeMs,
  });
}

/**
 * Hook para obtener detalles de un simulacro (con videos) al expandir.
 * Misma configuración de caché que la Ruta de preparación.
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
    staleTime: RUTA_PREPARACION_CACHE.staleTimeMs,
    gcTime: RUTA_PREPARACION_CACHE.gcTimeMs,
  });
}

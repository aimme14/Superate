import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { simulacrosService } from "@/services/firebase/simulacros.service";
import type { Simulacro } from "@/interfaces/simulacro.interface";
import type { PaginatedSimulacros, SimulacroCursor } from "@/services/firebase/simulacros.service";
import {
  RUTA_ACADEMICA_SIMULACROS_CACHE,
  ESTUDIANTE_SESSION_CACHE,
} from "@/config/rutaPreparacionCache";

export const SIMULACROS_QUERY_KEY = ["simulacros", "with-videos"] as const;
export const SIMULACROS_LIST_QUERY_KEY = ["simulacros", "list"] as const;
export const simulacroDetailKey = (id: string) => ["simulacros", "detail", id] as const;

/**
 * Hook para obtener la lista de simulacros sin videos (Ruta académica simulacros).
 * Los videos se cargan bajo demanda al expandir la sección de cada simulacro (useSimulacroDetails).
 * Caché "hasta refresh": primera entrada hace la petición; al navegar se usa solo caché.
 */
export function useSimulacros() {
  return useQuery({
    queryKey: SIMULACROS_QUERY_KEY,
    queryFn: async (): Promise<Simulacro[]> => {
      const res = await simulacrosService.getAll();
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
 * Caché de sesión: una carga, resto desde memoria hasta F5.
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
    ...ESTUDIANTE_SESSION_CACHE,
  });
}

export function useSimulacrosListInfinite(pageSize: number = 10) {
  return useInfiniteQuery({
    queryKey: [...SIMULACROS_LIST_QUERY_KEY, "infinite", pageSize],
    queryFn: async ({ pageParam }): Promise<PaginatedSimulacros> => {
      const cursor = pageParam as SimulacroCursor | undefined
      const res = await simulacrosService.getAllPaginated(pageSize, cursor)
      if (!res.success) throw new Error(res.error?.message ?? "Error al cargar simulacros")
      return res.data
    },
    initialPageParam: undefined as SimulacroCursor | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    ...ESTUDIANTE_SESSION_CACHE,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/**
 * Hook para obtener detalles de un simulacro (con videos) al expandir.
 * Caché de sesión: una carga, resto desde memoria hasta F5.
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
    ...ESTUDIANTE_SESSION_CACHE,
  });
}

/**
 * Prefetch centralizado para la sección "Ruta de preparación".
 * Se ejecuta en segundo plano para que, al entrar a la sección, los datos
 * estén en caché o listos. No compite con la carga inicial del dashboard.
 */

import type { QueryClient } from "@tanstack/react-query";
import { SIMULACROS_QUERY_KEY } from "@/hooks/query/useSimulacros";
import {
  RUTA_ACADEMICA_SIMULACROS_CACHE,
  ESTUDIANTE_SESSION_CACHE,
} from "@/config/rutaPreparacionCache";
import { simulacrosService } from "@/services/firebase/simulacros.service";
import { fetchEvaluations } from "@/hooks/query/useStudentEvaluations";

/** Grado por defecto cuando aún no se conoce el del usuario (no bloquea la UI). */
export const DEFAULT_GRADE_RUTA_PREPARACION = "11";

/** Tiempo mínimo de espera antes de ejecutar el prefetch (dashboard tiene prioridad). */
const PREFETCH_DELAY_MS = 1200;

/** Timeout para requestIdleCallback (fallback si el navegador tarda). */
const IDLE_TIMEOUT_MS = 2000;

let scheduled = false;
let ran = false;

export interface RutaPreparacionPrefetchOptions {
  /** Grado del estudiante; si no se pasa, se usa DEFAULT_GRADE_RUTA_PREPARACION. */
  grade?: string;
  /** Si se pasa, se prefetchean también las evaluaciones (útil para Plan de estudio). */
  userId?: string;
}

/**
 * Ejecuta el prefetch de datos de Ruta de preparación (lista simulacros PDF, opcional evaluaciones).
 * Simulacros IA / ICFES no se precargan aquí: solo cargan al pulsar Iniciar.
 * No bloquea: se puede llamar en cualquier momento.
 */
export function runRutaPreparacionPrefetch(
  queryClient: QueryClient,
  options: RutaPreparacionPrefetchOptions = {}
): void {
  void queryClient.prefetchQuery({
    queryKey: SIMULACROS_QUERY_KEY,
    queryFn: async () => {
      const res = await simulacrosService.getConsolidadoShard1();
      if (res.success) return res.data;
      throw new Error(res.error?.message ?? "Error al cargar simulacros");
    },
    ...RUTA_ACADEMICA_SIMULACROS_CACHE,
  });

  if (options.userId) {
    void queryClient.prefetchQuery({
      queryKey: ["student-evaluations", options.userId],
      queryFn: () => fetchEvaluations(options.userId!),
      ...ESTUDIANTE_SESSION_CACHE,
    });
  }
}

/**
 * Programa el prefetch de Ruta de preparación para ejecutarse cuando el navegador
 * esté en idle (o tras un timeout), para no competir con la carga inicial del dashboard.
 * Solo se ejecuta una vez por sesión.
 *
 * @returns Función de cancelación para llamar en el cleanup del efecto.
 */
export function scheduleRutaPreparacionPrefetch(
  queryClient: QueryClient,
  options: RutaPreparacionPrefetchOptions = {}
): () => void {
  if (ran) return () => {};
  if (scheduled) return () => {};

  scheduled = true;
  let cancelled = false;

  const run = () => {
    if (cancelled || ran) return;
    ran = true;
    runRutaPreparacionPrefetch(queryClient, options);
  };

  const schedule = () => {
    if (cancelled) return;
    run();
  };

  const useIdle = typeof requestIdleCallback !== "undefined";
  const handle = useIdle
    ? requestIdleCallback(schedule, { timeout: IDLE_TIMEOUT_MS })
    : window.setTimeout(schedule, PREFETCH_DELAY_MS);

  const cancel = () => {
    cancelled = true;
    scheduled = false;
    if (useIdle && typeof cancelIdleCallback !== "undefined") {
      cancelIdleCallback(handle as ReturnType<typeof requestIdleCallback>);
    } else {
      clearTimeout(handle as number);
    }
  };

  return cancel;
}

/**
 * Módulo compartido para prefetch de Simulacros IA.
 * Usado por: prefetch al entrar en la página y prefetch al hover en el menú.
 * Las preguntas se consideran válidas solo 30 min para rotar y evitar repetidas.
 */

import {
  getRandomEjercicios,
  type EjercicioIA,
} from "@/services/firebase/ejerciciosIA.service";
import { SIMULACRO_QUESTIONS_CACHE_MS } from "@/config/rutaPreparacionCache";

const EXERCISES_LIMIT = 10;

let cache: {
  data: EjercicioIA[];
  grade: string;
  subject: string;
  fetchedAt: number;
} | null = null;

/**
 * Inicia prefetch de ejercicios en segundo plano.
 * Solo omite si ya hay caché para exactamente los mismos (grade, subject) y no ha caducado (30 min).
 */
export function prefetchSimulacrosIA(grade: string, subject?: string): void {
  const subj = subject && subject !== "all" ? subject : "all";
  const now = Date.now();
  if (
    cache &&
    cache.grade === grade &&
    cache.subject === subj &&
    now - cache.fetchedAt < SIMULACRO_QUESTIONS_CACHE_MS
  )
    return;
  const subjectParam = subj === "all" ? undefined : subj;

  getRandomEjercicios({
    grade,
    subject: subjectParam,
    limit: EXERCISES_LIMIT,
  })
    .then((result) => {
      if (result.success && (result.data?.length ?? 0) > 0) {
        cache = { data: result.data!, grade, subject: subj, fetchedAt: Date.now() };
      }
    })
    .catch(() => {});
}

/**
 * Obtiene y consume el prefetch si coincide con los filtros y no ha pasado 30 min.
 * Devuelve los datos y limpia la caché si hay coincidencia; si caducó, retorna null y limpia.
 */
export function consumePrefetchedSimulacrosIA(
  grade: string,
  subject: string
): EjercicioIA[] | null {
  if (!cache) return null;
  if (cache.grade !== grade || cache.subject !== subject) return null;
  if (Date.now() - cache.fetchedAt >= SIMULACRO_QUESTIONS_CACHE_MS) {
    cache = null;
    return null;
  }
  const data = cache.data;
  cache = null;
  return data;
}

/**
 * Limpia la caché de prefetch (útil al desmontar o cambiar de vista).
 */
export function clearPrefetchedSimulacrosIA(): void {
  cache = null;
}

/**
 * Módulo compartido para prefetch de Simulacros IA.
 * Usado por: prefetch al entrar en la página y prefetch al hover en el menú.
 */

import {
  getRandomEjercicios,
  type EjercicioIA,
} from "@/services/firebase/ejerciciosIA.service";

const EXERCISES_LIMIT = 10;

let cache: {
  data: EjercicioIA[];
  grade: string;
  subject: string;
} | null = null;

/**
 * Inicia prefetch de ejercicios en segundo plano.
 * Solo omite si ya hay caché para exactamente los mismos (grade, subject).
 */
export function prefetchSimulacrosIA(grade: string, subject?: string): void {
  const subj = subject && subject !== "all" ? subject : "all";
  if (cache && cache.grade === grade && cache.subject === subj) return;
  const subjectParam = subj === "all" ? undefined : subj;

  getRandomEjercicios({
    grade,
    subject: subjectParam,
    limit: EXERCISES_LIMIT,
  })
    .then((result) => {
      if (result.success && (result.data?.length ?? 0) > 0) {
        cache = { data: result.data!, grade, subject: subj };
      }
    })
    .catch(() => {});
}

/**
 * Obtiene y consume el prefetch si coincide con los filtros.
 * Devuelve los datos y limpia la caché si hay coincidencia.
 */
export function consumePrefetchedSimulacrosIA(
  grade: string,
  subject: string
): EjercicioIA[] | null {
  if (!cache) return null;
  if (cache.grade !== grade || cache.subject !== subject) return null;
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

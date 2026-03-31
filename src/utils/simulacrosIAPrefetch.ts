/**
 * Caché en memoria para Simulacros IA (10 preguntas por tanda).
 * Solo se escribe al pulsar "Iniciar simulacro"; no hay peticiones previas.
 * Reutiliza la misma tanda mientras no caduque (SIMULACRO_QUESTIONS_CACHE_MS).
 */

import type { EjercicioIA } from "@/services/firebase/ejerciciosIA.service";
import { SIMULACRO_QUESTIONS_CACHE_MS } from "@/config/rutaPreparacionCache";

const EXERCISES_LIMIT = 10;

function normSubject(subject?: string): string {
  return subject && subject !== "all" ? subject : "all";
}

function makeKey(grade: string, subject?: string): string {
  return `${grade}::${normSubject(subject)}`;
}

const store = new Map<string, { data: EjercicioIA[]; fetchedAt: number }>();

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < SIMULACRO_QUESTIONS_CACHE_MS;
}

/**
 * Devuelve una copia de la tanda en caché si existe y no ha caducado.
 */
export function readSimulacrosIACache(
  grade: string,
  subject?: string
): EjercicioIA[] | null {
  const key = makeKey(grade, subject);
  const entry = store.get(key);
  if (!entry) return null;
  if (!isFresh(entry.fetchedAt)) {
    store.delete(key);
    return null;
  }
  return entry.data.slice();
}

/**
 * Guarda la tanda obtenida al iniciar (como mucho 10 ítems).
 */
export function writeSimulacrosIACache(
  grade: string,
  subject: string | undefined,
  data: EjercicioIA[]
): void {
  const slice = data.slice(0, EXERCISES_LIMIT);
  if (slice.length === 0) return;
  store.set(makeKey(grade, subject), {
    data: slice,
    fetchedAt: Date.now(),
  });
}

export function clearSimulacrosIACache(): void {
  store.clear();
}

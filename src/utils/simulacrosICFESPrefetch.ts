/**
 * Caché en memoria para Simulacros ICFES (10 preguntas por tanda y filtros).
 * Solo se escribe al pulsar "Iniciar simulacro"; no hay lecturas previas al banco.
 * Reutiliza la misma tanda mientras no caduque (SIMULACRO_QUESTIONS_CACHE_MS).
 */

import type { Question } from "@/services/firebase/question.service";
import { SIMULACRO_QUESTIONS_CACHE_MS } from "@/config/rutaPreparacionCache";

const EXERCISES_LIMIT = 10;

function normSubject(subject: string): string {
  return subject && subject !== "all" ? subject : "all";
}

function makeKey(grade: string, subject: string): string {
  return `${grade}::${normSubject(subject)}`;
}

const store = new Map<
  string,
  { questions: Question[]; fetchedAt: number }
>();

function isFresh(fetchedAt: number): boolean {
  return Date.now() - fetchedAt < SIMULACRO_QUESTIONS_CACHE_MS;
}

/**
 * Devuelve una copia superficial de la tanda en caché si existe y no ha caducado.
 */
export function readSimulacrosICFESCache(
  grade: string,
  subject: string
): Question[] | null {
  const key = makeKey(grade, subject);
  const entry = store.get(key);
  if (!entry) return null;
  if (!isFresh(entry.fetchedAt)) {
    store.delete(key);
    return null;
  }
  return entry.questions.slice();
}

/**
 * Guarda la tanda obtenida al iniciar (como mucho 10 ítems).
 */
export function writeSimulacrosICFESCache(
  grade: string,
  subject: string,
  questions: Question[]
): void {
  const slice = questions.slice(0, EXERCISES_LIMIT);
  if (slice.length === 0) return;
  store.set(makeKey(grade, subject), {
    questions: slice,
    fetchedAt: Date.now(),
  });
}

export function clearSimulacrosICFESCache(): void {
  store.clear();
}

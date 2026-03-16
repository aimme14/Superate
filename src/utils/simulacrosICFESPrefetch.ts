/**
 * Prefetch de Simulacros ICFES: una tanda de 10 preguntas "all" (todas las materias).
 * Se ejecuta al cargar el dashboard del estudiante (mismo momento que Simulacros IA).
 * Las preguntas se consideran válidas 30 min (misma política que IA).
 */

import { questionService, type Question } from "@/services/firebase/question.service";
import { SIMULACRO_QUESTIONS_CACHE_MS } from "@/config/rutaPreparacionCache";

const EXERCISES_LIMIT = 10;

/** Convierte grado "11"/"10" (display) al código del banco "1"/"0". */
function gradeToQuestionBank(gradeInput: string): string {
  const s = String(gradeInput).trim().toLowerCase();
  if (s === "11" || s === "undécimo" || s === "undecimo") return "1";
  if (s === "10" || s === "décimo" || s === "decimo") return "0";
  if (["6", "7", "8", "9"].includes(s)) return s;
  if (s.startsWith("11")) return "1";
  if (s.startsWith("10")) return "0";
  if (s.startsWith("9")) return "9";
  if (s.startsWith("8")) return "8";
  if (s.startsWith("7")) return "7";
  if (s.startsWith("6")) return "6";
  return "1";
}

let cache: {
  questions: Question[];
  grade: string; // en formato banco ("1", "0", ...)
  fetchedAt: number;
} | null = null;

/**
 * Inicia prefetch de 10 preguntas "all" en segundo plano.
 * grade: grado en formato display ("11", "10") o banco ("1", "0").
 */
export function prefetchSimulacrosICFES(grade: string): void {
  const bankGrade = gradeToQuestionBank(grade);
  const now = Date.now();
  if (
    cache &&
    cache.grade === bankGrade &&
    now - cache.fetchedAt < SIMULACRO_QUESTIONS_CACHE_MS
  )
    return;

  questionService
    .getRandomQuestions({ grade: bankGrade }, EXERCISES_LIMIT)
    .then((result) => {
      if (result.success && (result.data?.length ?? 0) > 0) {
        cache = {
          questions: result.data!,
          grade: bankGrade,
          fetchedAt: Date.now(),
        };
      }
    })
    .catch(() => {});
}

/**
 * Consume el prefetch si coincide con grado y materia "all", y no ha pasado 30 min.
 * grade: en formato banco ("1", "0") como en la página.
 * subject: debe ser "all" para usar esta tanda.
 */
export function consumePrefetchedSimulacrosICFES(
  grade: string,
  subject: string
): Question[] | null {
  if (subject !== "all") return null;
  if (!cache) return null;
  if (cache.grade !== grade) return null;
  if (Date.now() - cache.fetchedAt >= SIMULACRO_QUESTIONS_CACHE_MS) {
    cache = null;
    return null;
  }
  const questions = cache.questions;
  cache = null;
  return questions;
}

/**
 * Limpia el prefetch (útil al desmontar o cambiar de vista).
 */
export function clearPrefetchedSimulacrosICFES(): void {
  cache = null;
}

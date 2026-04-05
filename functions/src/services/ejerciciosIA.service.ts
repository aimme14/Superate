/**
 * Servicio para obtener ejercicios de la colección EjerciciosIA.
 * Usado por el mini simulacro en Simulacros IA.
 *
 * Estrategia: una sola query con limit(N). Cada documento devuelto = 1 lectura.
 *
 * Se usa el entero `shard` en [0, SHARD_MAX) por documento. Cada request elige
 * un shard al azar y pide hasta `limit` ejercicios de ese shard.
 * Sin `orderBy(__name__)`: una sola query con índice solo en `shard` (fieldOverrides
 * collection group), evita escaneos grandes en Query Insights cuando faltaba el
 * compuesto (shard + __name__). Facturación: ~1 lectura por documento devuelto (≤ limit).
 *
 * Backfill: npm run backfill:ejercicios-ia-rand (nombre histórico; rellena shard)
 */

import { getStudentDatabase } from '../utils/firestoreHelpers';

/** Cantidad de shards; más shards = menos ejercicios por shard en promedio. */
export const EJERCICIOS_IA_SHARD_MAX = 100;

export interface EjercicioIA {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
}

export interface GetRandomEjerciciosOutcome {
  exercises: EjercicioIA[];
  /** Documentos leídos en la única query ejecutada (facturación Firestore). */
  documentsRead: number;
}

/**
 * Obtiene ejercicios aleatorios desde todas las subcolecciones "ejercicios".
 * Estructura: EjerciciosIA/{grado}/{materiaCode}/{topicCode}/ejercicios/ejercicioN
 *
 * Requiere campo entero `shard` en [0, EJERCICIOS_IA_SHARD_MAX). Sin backfill,
 * puede devolver vacío.
 */
export async function getRandomEjercicios(
  _grade?: string,
  _subjectCode?: string,
  limit: number = 10
): Promise<GetRandomEjerciciosOutcome> {
  const db = getStudentDatabase();
  const safeLimit = Math.min(10, Math.max(1, Math.trunc(limit || 10)));
  const shard = Math.floor(Math.random() * EJERCICIOS_IA_SHARD_MAX);

  const snap = await db
    .collectionGroup('ejercicios')
    .where('shard', '==', shard)
    .limit(safeLimit)
    .get();

  const exercises: EjercicioIA[] = [];
  snap.docs.forEach((doc) => {
    const data = doc.data();
    if (!data?.question) return;
    exercises.push({
      question: data.question || '',
      options: Array.isArray(data.options) ? data.options : [],
      correctAnswer: data.correctAnswer || '',
      explanation: data.explanation || '',
      topic: data.topic || '',
    });
  });

  return {
    exercises,
    documentsRead: snap.size,
  };
}

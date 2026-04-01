/**
 * Servicio para obtener ejercicios de la colección EjerciciosIA.
 * Usado por el mini simulacro en Simulacros IA.
 *
 * Estrategia optimizada:
 * - UNA sola query por clic.
 * - Sin filtros por materia/eje/topic.
 * - limit(10) => ~10 lecturas facturables.
 */

import * as admin from 'firebase-admin';
import { getStudentDatabase } from '../utils/firestoreHelpers';

export interface EjercicioIA {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
}

/**
 * Obtiene ejercicios aleatorios desde todas las subcolecciones "ejercicios".
 * Estructura origen: EjerciciosIA/{grado}/{materiaCode}/{topicCode}/ejercicios/ejercicioN
 *
 * Nota:
 * Se usa un cursor pseudoaleatorio sobre documentId (ejercicio1..ejercicio100)
 * para variar el bloque devuelto sin aumentar el número de queries.
 *
 * @param _grade - Parámetro legacy (ya no se usa para filtrar)
 * @param _subjectCode - Parámetro legacy (ya no se usa para filtrar)
 * @param limit - Cantidad máxima de ejercicios a retornar (default 10)
 */
export async function getRandomEjercicios(
  _grade?: string,
  _subjectCode?: string,
  limit: number = 10
): Promise<EjercicioIA[]> {
  const db = getStudentDatabase();
  const safeLimit = Math.min(10, Math.max(1, Math.trunc(limit || 10)));

  // Cursor pseudoaleatorio sobre IDs existentes (ejercicio1..ejercicio100).
  const randomOrder = Math.floor(Math.random() * 100) + 1;
  const randomDocId = `ejercicio${randomOrder}`;

  const snap = await db
    .collectionGroup('ejercicios')
    .where(admin.firestore.FieldPath.documentId(), '>=', randomDocId)
    .orderBy(admin.firestore.FieldPath.documentId())
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

  return exercises;
}

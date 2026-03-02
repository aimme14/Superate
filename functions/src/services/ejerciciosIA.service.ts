/**
 * Servicio para obtener ejercicios de la colección EjerciciosIA.
 * Usado por el mini simulacro en Simulacros IA.
 */

import * as admin from 'firebase-admin';
import { getStudentDatabase } from '../utils/firestoreHelpers';
import { getGradeNameForAdminPath, SUBJECTS_CONFIG } from '../config/subjects.config';

export interface EjercicioIA {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  topic: string;
}

/**
 * Obtiene ejercicios aleatorios desde EjerciciosIA.
 * Estructura: EjerciciosIA/{grado}/{materiaCode}/{topicCode}/ejercicios/ejercicio1, ejercicio2...
 *
 * Las lecturas a Firestore se ejecutan en paralelo para reducir el tiempo de respuesta.
 *
 * @param grade - Grado del estudiante ("11", "Undécimo", etc.)
 * @param subjectCode - Código de materia (MA, BI, CS...) o undefined para aleatorio
 * @param limit - Cantidad máxima de ejercicios a retornar (default 10)
 */
export async function getRandomEjercicios(
  grade: string,
  subjectCode?: string,
  limit: number = 10
): Promise<EjercicioIA[]> {
  const db = getStudentDatabase();
  const gradePath = getGradeNameForAdminPath(grade);

  const subjectsToQuery = subjectCode
    ? SUBJECTS_CONFIG.filter((s) => s.code === subjectCode)
    : SUBJECTS_CONFIG;

  /** Construir todas las referencias a subcolecciones de ejercicios */
  const queries: Array<{
    ref: admin.firestore.CollectionReference;
    subject: { code: string; topics: { name: string }[] };
    topic: { name: string; code: string };
  }> = [];
  for (const subject of subjectsToQuery) {
    for (const topic of subject.topics) {
      const ejerciciosRef = db
        .collection('EjerciciosIA')
        .doc(gradePath)
        .collection(subject.code)
        .doc(topic.code)
        .collection('ejercicios');
      queries.push({ ref: ejerciciosRef, subject, topic });
    }
  }

  /** Ejecutar todas las lecturas en paralelo */
  const results = await Promise.allSettled(
    queries.map((q) => q.ref.get())
  );

  const allExercises: EjercicioIA[] = [];

  results.forEach((result, idx) => {
    if (result.status === 'rejected') {
      const q = queries[idx];
      console.warn(
        `⚠️ Error leyendo EjerciciosIA/${gradePath}/${q.subject.code}/${q.topic.code}:`,
        result.reason?.message ?? String(result.reason)
      );
      return;
    }
    const snap = result.value;
    const q = queries[idx];
    snap.docs.forEach((doc) => {
      const data = doc.data();
      if (data?.question) {
        allExercises.push({
          question: data.question || '',
          options: Array.isArray(data.options) ? data.options : [],
          correctAnswer: data.correctAnswer || '',
          explanation: data.explanation || '',
          topic: data.topic || q.topic.name,
        });
      }
    });
  });

  // Fisher-Yates shuffle
  for (let i = allExercises.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allExercises[i], allExercises[j]] = [allExercises[j], allExercises[i]];
  }

  return allExercises.slice(0, limit);
}

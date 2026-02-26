/**
 * Servicio para obtener ejercicios de la colección EjerciciosIA.
 * Usado por el mini simulacro en Simulacros IA.
 */

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

  const allExercises: EjercicioIA[] = [];

  for (const subject of subjectsToQuery) {
    for (const topic of subject.topics) {
      try {
        const ejerciciosRef = db
          .collection('EjerciciosIA')
          .doc(gradePath)
          .collection(subject.code)
          .doc(topic.code)
          .collection('ejercicios');

        const snap = await ejerciciosRef.get();

        snap.docs.forEach((doc) => {
          const data = doc.data();
          if (data?.question) {
            allExercises.push({
              question: data.question || '',
              options: Array.isArray(data.options) ? data.options : [],
              correctAnswer: data.correctAnswer || '',
              explanation: data.explanation || '',
              topic: data.topic || topic.name,
            });
          }
        });
      } catch (err) {
        console.warn(
          `⚠️ Error leyendo EjerciciosIA/${gradePath}/${subject.code}/${topic.code}:`,
          (err as Error).message
        );
      }
    }
  }

  // Fisher-Yates shuffle
  for (let i = allExercises.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allExercises[i], allExercises[j]] = [allExercises[j], allExercises[i]];
  }

  return allExercises.slice(0, limit);
}

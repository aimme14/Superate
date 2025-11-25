import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/services/db';
import { success, failure, Result } from '@/interfaces/db.interface';
import ErrorAPI from '@/errors';
import { normalizeError } from '@/errors/handler';

const db = getFirestore(firebaseApp);

/**
 * Servicio para rastrear preguntas ya respondidas por estudiantes
 * Evita que se repitan preguntas en fases posteriores
 */
class QuestionTrackingService {
  private static instance: QuestionTrackingService;

  static getInstance() {
    if (!QuestionTrackingService.instance) {
      QuestionTrackingService.instance = new QuestionTrackingService();
    }
    return QuestionTrackingService.instance;
  }

  /**
   * Obtiene todas las preguntas ya respondidas por un estudiante
   * en fases anteriores de una materia específica
   * 
   * @param studentId - ID del estudiante
   * @param subject - Materia (ej: 'Matemáticas', 'Lenguaje')
   * @param currentPhase - Fase actual ('first', 'second', 'third')
   * @returns Set con los IDs de preguntas ya respondidas
   */
  async getAnsweredQuestions(
    studentId: string,
    subject: string,
    currentPhase: 'first' | 'second' | 'third'
  ): Promise<Result<Set<string>>> {
    try {
      console.log(`🔍 Obteniendo preguntas ya respondidas para estudiante ${studentId}`);
      console.log(`   Materia: ${subject}, Fase actual: ${currentPhase}`);

      const answeredQuestionIds = new Set<string>();

      // Obtener todos los resultados del estudiante
      const resultsRef = doc(db, 'results', studentId);
      const resultsSnap = await getDoc(resultsRef);

      if (!resultsSnap.exists()) {
        console.log('   No se encontraron resultados previos para este estudiante');
        return success(answeredQuestionIds);
      }

      const resultsData = resultsSnap.data();
      const phaseOrder: ('first' | 'second' | 'third')[] = ['first', 'second', 'third'];
      const currentPhaseIndex = phaseOrder.indexOf(currentPhase);

      // Si es la primera fase, no hay preguntas previas
      if (currentPhaseIndex === 0) {
        console.log('   Es la primera fase, no hay preguntas previas');
        return success(answeredQuestionIds);
      }

      // Obtener fases anteriores a la actual
      const previousPhases = phaseOrder.slice(0, currentPhaseIndex);

      console.log(`   Revisando fases anteriores: ${previousPhases.join(', ')}`);

      // Iterar sobre todos los exámenes guardados
      for (const [, examData] of Object.entries(resultsData)) {
        const exam = examData as any;

        // Verificar que el examen sea de la misma materia
        if (exam.subject !== subject) {
          continue;
        }

        // Verificar que el examen sea de una fase anterior
        if (!exam.phase || !previousPhases.includes(exam.phase)) {
          continue;
        }

        // Extraer los IDs de las preguntas respondidas
        if (exam.questionDetails && Array.isArray(exam.questionDetails)) {
          exam.questionDetails.forEach((questionDetail: any) => {
            const questionId = questionDetail.questionId;
            if (questionId) {
              // Normalizar el ID (puede ser número o string)
              const normalizedId = String(questionId);
              answeredQuestionIds.add(normalizedId);
            }
          });
        }

        // También revisar en answers por si acaso
        if (exam.answers && typeof exam.answers === 'object') {
          Object.keys(exam.answers).forEach(questionId => {
            const normalizedId = String(questionId);
            answeredQuestionIds.add(normalizedId);
          });
        }
      }

      console.log(`   ✅ Encontradas ${answeredQuestionIds.size} preguntas ya respondidas en fases anteriores`);
      if (answeredQuestionIds.size > 0) {
        console.log(`   IDs de preguntas: ${Array.from(answeredQuestionIds).slice(0, 10).join(', ')}${answeredQuestionIds.size > 10 ? '...' : ''}`);
      }

      return success(answeredQuestionIds);
    } catch (e) {
      console.error('❌ Error obteniendo preguntas respondidas:', e);
      return failure(new ErrorAPI(normalizeError(e, 'obtener preguntas respondidas')));
    }
  }

  /**
   * Filtra preguntas excluyendo las que ya fueron respondidas
   * 
   * @param questions - Array de preguntas a filtrar
   * @param answeredQuestionIds - Set con IDs de preguntas ya respondidas
   * @returns Array de preguntas filtradas
   */
  filterAnsweredQuestions(
    questions: any[],
    answeredQuestionIds: Set<string>
  ): any[] {
    if (answeredQuestionIds.size === 0) {
      return questions;
    }

    const filtered = questions.filter(question => {
      const questionId = question.id || question.code;
      const normalizedId = String(questionId);
      return !answeredQuestionIds.has(normalizedId);
    });

    console.log(`🔍 Filtradas ${questions.length - filtered.length} preguntas ya respondidas`);
    console.log(`   Preguntas disponibles: ${filtered.length} de ${questions.length}`);

    return filtered;
  }

  /**
   * Verifica si un estudiante ya completó una materia específica en una fase específica
   * Esto previene que el estudiante repita un examen de la misma materia en la misma fase
   * 
   * @param studentId - ID del estudiante
   * @param subject - Materia (ej: 'Matemáticas', 'Lenguaje')
   * @param phase - Fase ('first', 'second', 'third')
   * @returns true si ya completó, false si no
   */
  async hasCompletedSubjectInPhase(
    studentId: string,
    subject: string,
    phase: 'first' | 'second' | 'third'
  ): Promise<Result<boolean>> {
    try {
      console.log(`🔍 Verificando si estudiante ${studentId} ya completó ${subject} en fase ${phase}`);

      // Obtener todos los resultados del estudiante
      const resultsRef = doc(db, 'results', studentId);
      const resultsSnap = await getDoc(resultsRef);

      if (!resultsSnap.exists()) {
        console.log('   No se encontraron resultados previos');
        return success(false);
      }

      const resultsData = resultsSnap.data();

      // Buscar si existe un resultado con la misma materia y fase
      for (const [examId, examData] of Object.entries(resultsData)) {
        const exam = examData as any;

        // Verificar que el examen sea de la misma materia y fase
        if (exam.subject === subject && exam.phase === phase && exam.completed === true) {
          console.log(`   ✅ Ya completó ${subject} en fase ${phase} (examen: ${examId})`);
          return success(true);
        }
      }

      console.log(`   ❌ No ha completado ${subject} en fase ${phase}`);
      return success(false);
    } catch (e) {
      console.error('❌ Error verificando completitud de materia:', e);
      return failure(new ErrorAPI(normalizeError(e, 'verificar completitud de materia')));
    }
  }
}

export const questionTrackingService = QuestionTrackingService.getInstance();

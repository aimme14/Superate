/**
 * Utilidades para integrar el sistema de fases con los componentes de Quiz
 */

import { phaseAnalysisService } from '@/services/phase/phaseAnalysis.service';
import { phaseAuthorizationService } from '@/services/phase/phaseAuthorization.service';
import { dbService } from '@/services/firebase/db.service';
import { PhaseType } from '@/interfaces/phase.interface';

/**
 * Procesa los resultados de un examen completado según la fase
 * - Fase 1: Analiza resultados y genera plan de mejoramiento
 * - Fase 2: Analiza progreso comparando con Fase 1
 * - Fase 3: Genera resultado ICFES final
 */
export async function processExamResults(
  userId: string,
  subject: string,
  phase: PhaseType | string | undefined,
  examResult: any
): Promise<{ success: boolean; error?: string }> {
  try {
    // Si no hay fase definida, no procesar
    if (!phase || !['first', 'second', 'third'].includes(phase)) {
      console.log('⚠️ No se procesará el resultado: fase no definida o inválida');
      return { success: true };
    }

    const phaseType = phase as PhaseType;

    // Obtener información del estudiante para el gradeId
    const userResult = await dbService.getUserById(userId);
    if (!userResult.success || !userResult.data) {
      console.error('❌ No se pudo obtener información del estudiante');
      return { success: false, error: 'No se pudo obtener información del estudiante' };
    }

    const studentData = userResult.data;
    const gradeId = studentData.gradeId || studentData.grade;

    if (!gradeId) {
      console.error('❌ No se encontró gradeId para el estudiante');
      return { success: false, error: 'No se encontró información de grado' };
    }

    // Procesar según la fase
    switch (phaseType) {
      case 'first':
        // Analizar resultados de Fase 1
        console.log(`🔍 Procesando resultados Fase 1 para ${userId} en ${subject}`);
        const analysisResult = await phaseAnalysisService.analyzePhase1Results(
          userId,
          subject,
          examResult
        );

        if (!analysisResult.success) {
          console.error('❌ Error analizando Fase 1:', analysisResult.error);
          return { success: false, error: 'Error al analizar resultados' };
        }

        // Actualizar progreso del estudiante
        await phaseAuthorizationService.updateStudentPhaseProgress(
          userId,
          gradeId,
          'first',
          subject,
          true // completed
        );

        console.log(`✅ Fase 1 procesada exitosamente para ${subject}`);
        break;

      case 'second':
        // Analizar progreso comparando con Fase 1
        console.log(`📈 Procesando resultados Fase 2 para ${userId} en ${subject}`);

        // Obtener resultado de Fase 1 para comparar
        const phase1AnalysisId = `${userId}_${subject}_phase1`;
        const { collection, doc, getDoc, getFirestore } = await import('firebase/firestore');
        const { firebaseApp } = await import('@/services/db');
        const db = getFirestore(firebaseApp);
        const phase1Ref = doc(collection(db, 'superate', 'auth', 'phase1Analyses'), phase1AnalysisId);
        const phase1Snap = await getDoc(phase1Ref);

        if (!phase1Snap.exists()) {
          console.warn('⚠️ No se encontró análisis de Fase 1, no se puede analizar progreso');
          // Aún así actualizar progreso
          await phaseAuthorizationService.updateStudentPhaseProgress(
            userId,
            gradeId,
            'second',
            subject,
            true
          );
          break;
        }

        // Obtener resultado de Fase 1 desde results
        const resultsRef = doc(collection(db, 'results'), userId);
        const resultsSnap = await getDoc(resultsRef);
        const results = resultsSnap.exists() ? resultsSnap.data() : {};

        let phase1Result: any = null;
        Object.values(results).forEach((exam: any) => {
          if (exam.subject === subject && exam.phase === 'first') {
            phase1Result = exam;
          }
        });

        if (phase1Result) {
          const progressResult = await phaseAnalysisService.analyzeProgress(
            userId,
            subject,
            phase1Result,
            examResult
          );

          if (!progressResult.success) {
            console.error('❌ Error analizando progreso:', progressResult.error);
          }
        }

        // Actualizar progreso del estudiante
        await phaseAuthorizationService.updateStudentPhaseProgress(
          userId,
          gradeId,
          'second',
          subject,
          true
        );

        console.log(`✅ Fase 2 procesada exitosamente para ${subject}`);
        break;

      case 'third':
        // Generar resultado ICFES final
        console.log(`🎯 Procesando resultados Fase 3 (ICFES) para ${userId} en ${subject}`);

        const phase3Result = await phaseAnalysisService.generatePhase3Result(
          userId,
          subject,
          examResult
        );

        if (!phase3Result.success) {
          console.error('❌ Error generando resultado ICFES:', phase3Result.error);
          return { success: false, error: 'Error al generar resultado ICFES' };
        }

        // Actualizar progreso del estudiante
        await phaseAuthorizationService.updateStudentPhaseProgress(
          userId,
          gradeId,
          'third',
          subject,
          true
        );

        console.log(`✅ Fase 3 procesada exitosamente para ${subject}`);
        break;
    }

    return { success: true };
  } catch (error) {
    console.error('❌ Error procesando resultados del examen:', error);
    return { success: false, error: 'Error inesperado al procesar resultados' };
  }
}

/**
 * Verifica si un estudiante puede acceder a una fase específica
 */
export async function checkPhaseAccess(
  userId: string,
  gradeId: string,
  phase: PhaseType | string | undefined
): Promise<{ canAccess: boolean; reason?: string }> {
  try {
    if (!phase || !['first', 'second', 'third'].includes(phase)) {
      return { canAccess: false, reason: 'Fase no definida' };
    }

    const phaseType = phase as PhaseType;
    const accessResult = await phaseAuthorizationService.canStudentAccessPhase(
      userId,
      gradeId,
      phaseType
    );

    if (!accessResult.success) {
      return { canAccess: false, reason: 'Error al verificar acceso' };
    }

    return accessResult.data;
  } catch (error) {
    console.error('❌ Error verificando acceso a fase:', error);
    return { canAccess: false, reason: 'Error al verificar acceso' };
  }
}



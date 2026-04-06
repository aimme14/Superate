/**
 * Utilidades para integrar el sistema de fases con los componentes de Quiz
 */

import { phaseAnalysisService } from '@/services/phase/phaseAnalysis.service';
import { phaseAuthorizationService } from '@/services/phase/phaseAuthorization.service';
import { countUniqueCompletedSubjectsInPhase } from '@/services/phase/phaseStatusData.service';
import { dbService } from '@/services/firebase/db.service';
import { PhaseType } from '@/interfaces/phase.interface';
import { getPhaseName } from '@/utils/firestoreHelpers';
import type { StudentProgressSummaryDoc } from '@/services/studentProgressSummary/fetchEvaluationsFromSummary';

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

    console.log(`👤 Datos del estudiante:`, {
      userId,
      gradeId: `"${gradeId}"`,
      institutionId: studentData.institutionId,
      campusId: studentData.campusId,
      tieneGradeId: !!studentData.gradeId,
      tieneGrade: !!studentData.grade
    });

    if (!gradeId) {
      console.error('❌ No se encontró gradeId para el estudiante');
      console.error('Datos del estudiante:', studentData);
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

        // Progreso por fase vive en studentSummaries (trigger backend). Aquí solo comprobamos results/.
        const completedCount = await countUniqueCompletedSubjectsInPhase(userId, 'first');
        if (completedCount >= 7) {
          console.log(`🎉 Todas las materias de Fase I completadas. Creando carpeta "Fase II"...`);

          try {
            const { collection, doc, setDoc, getFirestore } = await import('firebase/firestore');
            const { firebaseApp } = await import('@/services/db');
            const db = getFirestore(firebaseApp);
            const phase2Name = getPhaseName('second');

            const placeholderDocId = `_phase2_initialized_${Date.now()}`;
            const phase2Ref = doc(collection(db, 'results', userId, phase2Name), placeholderDocId);

            await setDoc(phase2Ref, {
              initialized: true,
              createdAt: new Date().toISOString(),
              message: 'Carpeta Fase II inicializada automáticamente al completar todas las materias de Fase I',
              phase: 'second',
              timestamp: Date.now(),
            });

            console.log(`✅ Carpeta "Fase II" creada exitosamente en: results/${userId}/${phase2Name}`);
          } catch (error) {
            console.error('❌ Error creando carpeta "Fase II":', error);
          }
        } else {
          console.log(`📊 Progreso Fase I: ${completedCount}/7 materias con examen completado`);
        }

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
          break;
        }

        // Obtener resultado de Fase 1 desde la subcolección 'fase I'
        let phase1Result: any = null;
        
        // Buscar en la subcolección de fase I
        const phase1Name = getPhaseName('first');
        const phase1ResultsRef = collection(db, 'results', userId, phase1Name);
        const { getDocs: getDocsPhase1 } = await import('firebase/firestore');
        const phase1ResultsSnap = await getDocsPhase1(phase1ResultsRef);
        
        phase1ResultsSnap.docs.forEach(doc => {
          const examData = doc.data();
          if (examData.subject === subject) {
            phase1Result = examData;
          }
        });
        
        // Si no se encuentra en la nueva estructura, buscar en la estructura antigua
        if (!phase1Result) {
          const resultsRef = doc(collection(db, 'results'), userId);
          const resultsSnap = await getDoc(resultsRef);
          const results = resultsSnap.exists() ? resultsSnap.data() : {};
          
          Object.values(results).forEach((exam: any) => {
            if (exam.subject === subject && exam.phase === 'first') {
              phase1Result = exam;
            }
          });
        }

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
 * Verifica si un estudiante puede acceder a una fase específica (flags globales + studentSummaries).
 * @param summary - Si ya cargaste `studentSummaries` en la misma pantalla, pásalo para evitar lecturas duplicadas.
 */
export async function checkPhaseAccess(
  userId: string,
  phase: PhaseType | string | undefined,
  options?: { summary?: StudentProgressSummaryDoc | null }
): Promise<{ canAccess: boolean; reason?: string }> {
  try {
    if (!phase || !['first', 'second', 'third'].includes(phase)) {
      return { canAccess: false, reason: 'Fase no definida' };
    }

    const phaseType = phase as PhaseType;
    const accessResult = await phaseAuthorizationService.canStudentAccessPhase(userId, phaseType, options);

    if (!accessResult.success) {
      return { canAccess: false, reason: 'Error al verificar acceso' };
    }

    return accessResult.data;
  } catch (error) {
    console.error('❌ Error verificando acceso a fase:', error);
    return { canAccess: false, reason: 'Error al verificar acceso' };
  }
}



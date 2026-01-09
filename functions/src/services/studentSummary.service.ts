/**
 * Servicio de Resumen Académico del Estudiante
 * 
 * Genera resúmenes académicos estilo ICFES/Saber 11 con IA
 * basados en los resultados de las 7 evaluaciones del estudiante
 */

import * as dotenv from 'dotenv';
if (process.env.FUNCTIONS_EMULATOR === 'true' || process.env.NODE_ENV === 'development') {
  dotenv.config();
}

import { geminiClient, GEMINI_CONFIG } from '../config/gemini.config';
import * as admin from 'firebase-admin';
import { getStudentDatabase } from '../utils/firestoreHelpers';

/**
 * Lista de las 7 materias del sistema
 */
const ALL_SUBJECTS = [
  'Matemáticas',
  'Lenguaje',
  'Ciencias Sociales',
  'Biologia',
  'Quimica',
  'Física',
  'Inglés'
];

/**
 * Niveles de desempeño basados en porcentajes
 */
enum PerformanceLevel {
  SUPERIOR = 'Superior',
  ALTO = 'Alto',
  BASICO = 'Básico',
  BAJO = 'Bajo'
}

/**
 * Resultado normalizado de una evaluación
 */
interface NormalizedEvaluationResult {
  materia: string;
  puntaje: number;
  nivel: PerformanceLevel;
  competencias: {
    [competence: string]: string;
  };
  temas: {
    tema: string;
    puntaje: number;
    nivel: PerformanceLevel;
  }[];
  // Datos detallados para análisis pedagógico (no se muestran al estudiante)
  temasDetallados: {
    tema: string;
    puntaje: number; // Porcentaje exacto
    nivel: PerformanceLevel;
    totalPreguntas: number;
    correctas: number;
    tiempoPromedioSegundos?: number;
    patronTiempo?: 'impulsivo' | 'dificultad_cognitiva' | 'normal';
  }[];
  tiempoPromedioPorPregunta?: number; // Segundos promedio por pregunta
  patronesTiempo?: {
    impulsividad: number; // % de preguntas rápidas e incorrectas
    dificultadCognitiva: number; // % de preguntas lentas e incorrectas
  };
}

/**
 * Métricas globales calculadas
 */
interface GlobalMetrics {
  promedioGeneral: number;
  materiasFuertes: string[];
  materiasDebiles: string[];
  temasFuertes: { materia: string; tema: string; puntaje: number }[];
  temasDebiles: { materia: string; tema: string; puntaje: number }[];
  nivelGeneralDesempeno: PerformanceLevel;
  // Métricas adicionales para diagnóstico pedagógico
  debilidadesLeves: { materia: string; tema: string; puntaje: number }[]; // 35-39% (cerca de Básico)
  debilidadesEstructurales: { materia: string; tema: string; puntaje: number }[]; // <35% (muy por debajo)
  patronesGlobalesTiempo?: {
    promedioGeneralSegundos: number;
    porcentajeImpulsividad: number;
    porcentajeDificultadCognitiva: number;
  };
}

/**
 * Contexto académico del estudiante
 */
interface AcademicContext {
  grado?: string;
  nivel?: string;
  institutionId?: string;
  sedeId?: string;
  gradeId?: string;
}

/**
 * Resumen académico generado por IA
 */
interface AcademicSummary {
  resumen_general: string;
  analisis_competencial: string | { [materia: string]: string }; // Puede ser string (backward compatibility) o objeto por materias
  fortalezas_academicas: string[];
  aspectos_por_mejorar: string[];
  recomendaciones_enfoque_saber11: string[];
  // Campos adicionales para Fase I (diagnóstico pedagógico)
  justificacion_pedagogica?: {
    contenidos_prioritarios: Array<{
      materia: string;
      tema: string;
      justificacion: string; // Por qué se prioriza
      tipo_actividad_recomendada: string; // Qué tipo de actividad será más efectiva
    }>;
    estrategias_por_patron?: {
      impulsividad?: string[];
      dificultad_cognitiva?: string[];
      debilidades_estructurales?: string[];
      debilidades_leves?: string[];
    };
  };
}

/**
 * Resumen persistido en Firestore
 */
export interface PersistedSummary {
  studentId: string;
  phase: 'first' | 'second' | 'third';
  fecha: string;
  version: string;
  fuente: string;
  resumen: AcademicSummary;
  metadata: {
    materiasAnalizadas: number;
    modeloIA: string;
  };
  contextoAcademico?: AcademicContext;
  metricasGlobales?: GlobalMetrics;
}

/**
 * Resultado de generación de resumen
 */
interface SummaryGenerationResult {
  success: boolean;
  summary?: PersistedSummary;
  error?: string;
  processingTimeMs?: number;
}

/**
 * Servicio principal de Resumen Académico
 */
class StudentSummaryService {
  /**
   * Normaliza el nombre de una materia
   */
  private normalizeSubjectName(subject: string): string {
    const normalized = subject.trim().toLowerCase();
    const subjectMap: Record<string, string> = {
      'biologia': 'Biologia',
      'biología': 'Biologia',
      'biology': 'Biologia',
      'quimica': 'Quimica',
      'química': 'Quimica',
      'chemistry': 'Quimica',
      'fisica': 'Física',
      'física': 'Física',
      'physics': 'Física',
      'matematicas': 'Matemáticas',
      'matemáticas': 'Matemáticas',
      'math': 'Matemáticas',
      'lenguaje': 'Lenguaje',
      'language': 'Lenguaje',
      'ciencias sociales': 'Ciencias Sociales',
      'sociales': 'Ciencias Sociales',
      'ingles': 'Inglés',
      'inglés': 'Inglés',
      'english': 'Inglés'
    };
    return subjectMap[normalized] || subject;
  }

  /**
   * Determina el nivel de desempeño basado en el porcentaje
   */
  private getPerformanceLevel(percentage: number): PerformanceLevel {
    if (percentage >= 80) return PerformanceLevel.SUPERIOR;
    if (percentage >= 60) return PerformanceLevel.ALTO;
    if (percentage >= 40) return PerformanceLevel.BASICO;
    return PerformanceLevel.BAJO;
  }

  /**
   * Obtiene las evaluaciones completadas de un estudiante para una fase específica
   */
  private async getStudentEvaluations(studentId: string, phase?: 'first' | 'second' | 'third'): Promise<any[]> {
    try {
      const studentDb = getStudentDatabase();
      const evaluations: any[] = [];

      // Mapear fases a nombres de subcolección
      const phaseVariants: Record<string, string[]> = {
        first: ['fase I', 'Fase I', 'Fase 1', 'fase 1', 'first'],
        second: ['Fase II', 'fase II', 'Fase 2', 'fase 2', 'second'],
        third: ['fase III', 'Fase III', 'Fase 3', 'fase 3', 'third'],
      };

      // Si se especifica una fase, solo buscar en esa fase
      if (phase) {
        const phaseNames = phaseVariants[phase] || [];
        for (const phaseName of phaseNames) {
          try {
            const phaseRef = studentDb
              .collection('results')
              .doc(studentId)
              .collection(phaseName);
            
            const phaseSnap = await phaseRef.get();
            
            if (!phaseSnap.empty) {
              phaseSnap.docs.forEach(doc => {
                const examData = doc.data();
                const isCompleted = examData.isCompleted !== false && examData.completed !== false;
                if (isCompleted && examData.subject) {
                  evaluations.push({
                    ...examData,
                    examId: doc.id,
                    phase: phase,
                  });
                }
              });
            }
          } catch (error: any) {
            console.warn(`⚠️ Error buscando en fase ${phaseName}:`, error.message);
          }
        }
      } else {
        // Buscar en todas las fases
        for (const [phaseKey, phaseNames] of Object.entries(phaseVariants)) {
          for (const phaseName of phaseNames) {
            try {
              const phaseRef = studentDb
                .collection('results')
                .doc(studentId)
                .collection(phaseName);
              
              const phaseSnap = await phaseRef.get();
              
              if (!phaseSnap.empty) {
                phaseSnap.docs.forEach(doc => {
                  const examData = doc.data();
                  const isCompleted = examData.isCompleted !== false && examData.completed !== false;
                  if (isCompleted && examData.subject) {
                    evaluations.push({
                      ...examData,
                      examId: doc.id,
                      phase: phaseKey,
                    });
                  }
                });
              }
            } catch (error: any) {
              console.warn(`⚠️ Error buscando en fase ${phaseName}:`, error.message);
            }
          }
        }
      }

      return evaluations;
    } catch (error: any) {
      console.error('Error obteniendo evaluaciones del estudiante:', error);
      throw error;
    }
  }

  /**
   * Normaliza los resultados de las 7 evaluaciones
   * FASE 1.1 - Normalización
   */
  private normalizeEvaluationResults(evaluations: any[]): NormalizedEvaluationResult[] {
    const normalizedResults: Map<string, NormalizedEvaluationResult> = new Map();

    // Agrupar por materia y tomar la mejor evaluación de cada materia
    evaluations.forEach(evalData => {
      const subject = this.normalizeSubjectName(evalData.subject || evalData.examTitle || '');
      
      if (!ALL_SUBJECTS.includes(subject)) {
        return; // Ignorar materias que no están en las 7 principales
      }

      // Calcular puntaje total
      let percentage = 0;
      if (evalData.score?.overallPercentage !== undefined) {
        percentage = evalData.score.overallPercentage;
      } else if (evalData.questionDetails && evalData.questionDetails.length > 0) {
        const correct = evalData.questionDetails.filter((q: any) => q.isCorrect).length;
        const total = evalData.questionDetails.length;
        percentage = total > 0 ? (correct / total) * 100 : 0;
      }

      // Si ya existe una evaluación de esta materia, tomar la de mayor puntaje
      if (!normalizedResults.has(subject) || 
          (normalizedResults.get(subject)?.puntaje || 0) < percentage) {
        
        // Extraer competencias desde questionDetails
        const competencias: { [key: string]: string } = {};
        const temas: { tema: string; puntaje: number; nivel: PerformanceLevel }[] = [];
        const temasDetallados: NormalizedEvaluationResult['temasDetallados'] = [];
        
        // Variables para análisis de tiempo
        let tiempoTotalSegundos = 0;
        let preguntasConTiempo = 0;
        const preguntasRapidasIncorrectas: number[] = [];
        const preguntasLentasIncorrectas: number[] = [];
        
        if (evalData.questionDetails && Array.isArray(evalData.questionDetails)) {
          // Agrupar por tema con datos detallados
          const topicStats: { 
            [topic: string]: { 
              correct: number; 
              total: number;
              tiempos: number[];
              rapidasIncorrectas: number;
              lentasIncorrectas: number;
            } 
          } = {};
          
          // Tiempo promedio esperado por pregunta (en segundos)
          // Basado en estándares: preguntas simples 30-60s, complejas 90-120s
          const tiempoRapido = 20; // Menos de 20s se considera rápido
          const tiempoLento = 120; // Más de 120s se considera lento
          
          evalData.questionDetails.forEach((q: any) => {
            const topic = q.topic || 'Sin tema';
            if (!topicStats[topic]) {
              topicStats[topic] = { 
                correct: 0, 
                total: 0,
                tiempos: [],
                rapidasIncorrectas: 0,
                lentasIncorrectas: 0
              };
            }
            topicStats[topic].total++;
            if (q.isCorrect) {
              topicStats[topic].correct++;
            }
            
            // Analizar tiempo por pregunta
            const tiempoPregunta = q.timeSpent || 0;
            if (tiempoPregunta > 0) {
              topicStats[topic].tiempos.push(tiempoPregunta);
              tiempoTotalSegundos += tiempoPregunta;
              preguntasConTiempo++;
              
              // Detectar patrones: rápida e incorrecta (impulsividad)
              if (!q.isCorrect && tiempoPregunta < tiempoRapido) {
                topicStats[topic].rapidasIncorrectas++;
                preguntasRapidasIncorrectas.push(tiempoPregunta);
              }
              
              // Detectar patrones: lenta e incorrecta (dificultad cognitiva)
              if (!q.isCorrect && tiempoPregunta > tiempoLento) {
                topicStats[topic].lentasIncorrectas++;
                preguntasLentasIncorrectas.push(tiempoPregunta);
              }
            }
          });

          // Calcular puntajes por tema y métricas detalladas
          Object.entries(topicStats).forEach(([topic, stats]) => {
            const topicPercentage = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
            const tiempoPromedioTema = stats.tiempos.length > 0 
              ? stats.tiempos.reduce((a, b) => a + b, 0) / stats.tiempos.length 
              : undefined;
            
            // Determinar patrón de tiempo del tema
            let patronTiempo: 'impulsivo' | 'dificultad_cognitiva' | 'normal' | undefined;
            if (stats.rapidasIncorrectas > stats.total * 0.3) {
              patronTiempo = 'impulsivo';
            } else if (stats.lentasIncorrectas > stats.total * 0.3) {
              patronTiempo = 'dificultad_cognitiva';
            } else if (tiempoPromedioTema) {
              patronTiempo = 'normal';
            }
            
            temas.push({
              tema: topic,
              puntaje: topicPercentage,
              nivel: this.getPerformanceLevel(topicPercentage),
            });
            
            temasDetallados.push({
              tema: topic,
              puntaje: topicPercentage, // Porcentaje exacto para análisis detallado
              nivel: this.getPerformanceLevel(topicPercentage),
              totalPreguntas: stats.total,
              correctas: stats.correct,
              tiempoPromedioSegundos: tiempoPromedioTema,
              patronTiempo: patronTiempo,
            });
          });

          // Para competencias, usar temas como proxy (puedes ajustar según tu modelo)
          temas.forEach(tema => {
            competencias[tema.tema] = tema.nivel;
          });
        }
        
        // Calcular tiempo promedio por pregunta
        const tiempoPromedioPorPregunta = preguntasConTiempo > 0 
          ? tiempoTotalSegundos / preguntasConTiempo 
          : undefined;
        
        // Calcular porcentajes de patrones de tiempo
        const totalPreguntas = evalData.questionDetails?.length || 0;
        const patronesTiempo = totalPreguntas > 0 ? {
          impulsividad: (preguntasRapidasIncorrectas.length / totalPreguntas) * 100,
          dificultadCognitiva: (preguntasLentasIncorrectas.length / totalPreguntas) * 100,
        } : undefined;

        normalizedResults.set(subject, {
          materia: subject,
          puntaje: percentage,
          nivel: this.getPerformanceLevel(percentage),
          competencias,
          temas,
          temasDetallados,
          tiempoPromedioPorPregunta,
          patronesTiempo,
        });
      }
    });

    return Array.from(normalizedResults.values());
  }

  /**
   * Calcula métricas globales sin IA
   * FASE 1.2 - Cálculo determinístico
   */
  private calculateGlobalMetrics(normalizedResults: NormalizedEvaluationResult[]): GlobalMetrics {
    if (normalizedResults.length === 0) {
      return {
        promedioGeneral: 0,
        materiasFuertes: [],
        materiasDebiles: [],
        temasFuertes: [],
        temasDebiles: [],
        nivelGeneralDesempeno: PerformanceLevel.BAJO,
        debilidadesLeves: [],
        debilidadesEstructurales: [],
      };
    }

    // Promedio general
    const promedioGeneral = normalizedResults.reduce((sum, r) => sum + r.puntaje, 0) / normalizedResults.length;

    // Materias fuertes (>= 70) y débiles (< 60)
    const materiasFuertes = normalizedResults
      .filter(r => r.puntaje >= 70)
      .map(r => r.materia)
      .sort((a, b) => {
        const aPuntaje = normalizedResults.find(r => r.materia === a)?.puntaje || 0;
        const bPuntaje = normalizedResults.find(r => r.materia === b)?.puntaje || 0;
        return bPuntaje - aPuntaje;
      });

    const materiasDebiles = normalizedResults
      .filter(r => r.puntaje < 60)
      .map(r => r.materia)
      .sort((a, b) => {
        const aPuntaje = normalizedResults.find(r => r.materia === a)?.puntaje || 0;
        const bPuntaje = normalizedResults.find(r => r.materia === b)?.puntaje || 0;
        return aPuntaje - bPuntaje;
      });

    // Temas fuertes y débiles
    const temasFuertes: { materia: string; tema: string; puntaje: number }[] = [];
    const temasDebiles: { materia: string; tema: string; puntaje: number }[] = [];
    const debilidadesLeves: { materia: string; tema: string; puntaje: number }[] = [];
    const debilidadesEstructurales: { materia: string; tema: string; puntaje: number }[] = [];

    // Variables para patrones globales de tiempo
    let tiempoTotalGlobal = 0;
    let preguntasConTiempoGlobal = 0;
    let preguntasRapidasIncorrectasGlobal = 0;
    let preguntasLentasIncorrectasGlobal = 0;
    let totalPreguntasGlobal = 0;

    normalizedResults.forEach(result => {
      // Analizar temas
      result.temasDetallados.forEach(temaDet => {
        if (temaDet.puntaje >= 70) {
          temasFuertes.push({
            materia: result.materia,
            tema: temaDet.tema,
            puntaje: temaDet.puntaje,
          });
        } else if (temaDet.puntaje < 60) {
          temasDebiles.push({
            materia: result.materia,
            tema: temaDet.tema,
            puntaje: temaDet.puntaje,
          });
          
          // Clasificar debilidades: leves (35-39%) vs estructurales (<35%)
          if (temaDet.puntaje >= 35 && temaDet.puntaje < 40) {
            debilidadesLeves.push({
              materia: result.materia,
              tema: temaDet.tema,
              puntaje: temaDet.puntaje,
            });
          } else if (temaDet.puntaje < 35) {
            debilidadesEstructurales.push({
              materia: result.materia,
              tema: temaDet.tema,
              puntaje: temaDet.puntaje,
            });
          }
        }
        
        // Acumular métricas de tiempo
        totalPreguntasGlobal += temaDet.totalPreguntas;
        if (temaDet.tiempoPromedioSegundos) {
          tiempoTotalGlobal += temaDet.tiempoPromedioSegundos * temaDet.totalPreguntas;
          preguntasConTiempoGlobal += temaDet.totalPreguntas;
        }
        
        // Contar patrones de tiempo (aproximación basada en porcentajes)
        if (temaDet.patronTiempo === 'impulsivo') {
          preguntasRapidasIncorrectasGlobal += Math.round(temaDet.totalPreguntas * 0.3);
        } else if (temaDet.patronTiempo === 'dificultad_cognitiva') {
          preguntasLentasIncorrectasGlobal += Math.round(temaDet.totalPreguntas * 0.3);
        }
      });
      
      // También usar datos de patronesTiempo si están disponibles
      if (result.patronesTiempo) {
        const totalPreguntasMateria = result.temasDetallados.reduce((sum, t) => sum + t.totalPreguntas, 0);
        preguntasRapidasIncorrectasGlobal += Math.round(totalPreguntasMateria * result.patronesTiempo.impulsividad / 100);
        preguntasLentasIncorrectasGlobal += Math.round(totalPreguntasMateria * result.patronesTiempo.dificultadCognitiva / 100);
      }
    });

    // Ordenar temas
    temasFuertes.sort((a, b) => b.puntaje - a.puntaje);
    temasDebiles.sort((a, b) => a.puntaje - b.puntaje);
    debilidadesLeves.sort((a, b) => b.puntaje - a.puntaje);
    debilidadesEstructurales.sort((a, b) => a.puntaje - b.puntaje);

    // Calcular patrones globales de tiempo
    const patronesGlobalesTiempo = preguntasConTiempoGlobal > 0 ? {
      promedioGeneralSegundos: tiempoTotalGlobal / preguntasConTiempoGlobal,
      porcentajeImpulsividad: totalPreguntasGlobal > 0 
        ? (preguntasRapidasIncorrectasGlobal / totalPreguntasGlobal) * 100 
        : 0,
      porcentajeDificultadCognitiva: totalPreguntasGlobal > 0
        ? (preguntasLentasIncorrectasGlobal / totalPreguntasGlobal) * 100
        : 0,
    } : undefined;

    return {
      promedioGeneral,
      materiasFuertes,
      materiasDebiles,
      temasFuertes,
      temasDebiles,
      nivelGeneralDesempeno: this.getPerformanceLevel(promedioGeneral),
      debilidadesLeves,
      debilidadesEstructurales,
      patronesGlobalesTiempo,
    };
  }

  /**
   * Obtiene el contexto académico del estudiante
   * NUEVA ESTRUCTURA: Busca primero en la nueva estructura jerárquica, luego en la antigua
   */
  private async getAcademicContext(studentId: string): Promise<AcademicContext> {
    try {
      const studentDb = getStudentDatabase();
      
      // PRIMERO: Intentar buscar en la nueva estructura jerárquica
      try {
        // Obtener todas las instituciones para buscar el estudiante
        const institutionsRef = studentDb.collection('superate').doc('auth').collection('institutions');
        const institutionsSnap = await institutionsRef.get();

        if (!institutionsSnap.empty) {
          // Buscar en cada institución en la colección de estudiantes
          for (const institutionDoc of institutionsSnap.docs) {
            const institutionId = institutionDoc.id;
            const estudiantesRef = institutionDoc.ref.collection('estudiantes').doc(studentId);
            const estudianteSnap = await estudiantesRef.get();

            if (estudianteSnap.exists) {
              const userData = estudianteSnap.data();
              console.log(`✅ Estudiante encontrado en nueva estructura jerárquica: institutions/${institutionId}/estudiantes/${studentId}`);
              return {
                grado: userData?.gradeName || userData?.grade || undefined,
                nivel: userData?.gradeName || undefined,
                institutionId: institutionId,
                sedeId: userData?.campusId || userData?.campus || undefined,
                gradeId: userData?.gradeId || userData?.grade || undefined,
              };
            }
          }
        }
      } catch (newStructureError: any) {
        console.warn('⚠️ Error al buscar en nueva estructura jerárquica:', newStructureError.message);
        // Continuar con búsqueda en estructura antigua
      }

      // SEGUNDO: Buscar en la estructura antigua (retrocompatibilidad)
      console.log(`⚠️ Estudiante no encontrado en nueva estructura, buscando en estructura antigua...`);
      const userRef = studentDb.collection('superate').doc('auth').collection('users').doc(studentId);
      const userSnap = await userRef.get();

      if (userSnap.exists) {
        const userData = userSnap.data();
        console.log(`✅ Estudiante encontrado en estructura antigua (deprecated): users/${studentId}`);
        return {
          grado: userData?.gradeName || userData?.grade || undefined,
          nivel: userData?.gradeName || undefined,
          institutionId: userData?.inst || userData?.institutionId || undefined,
          sedeId: userData?.campusId || userData?.campus || undefined,
          gradeId: userData?.gradeId || userData?.grade || undefined,
        };
      }

      return {};
    } catch (error: any) {
      console.warn('Error obteniendo contexto académico:', error.message);
      return {};
    }
  }

  /**
   * Genera el resumen académico con IA
   * IMPORTANTE: normalizedResults contiene SOLO los resultados de la fase actual (phase)
   */
  private async generateSummaryWithAI(
    normalizedResults: NormalizedEvaluationResult[],
    globalMetrics: GlobalMetrics,
    academicContext: AcademicContext,
    phase: 'first' | 'second' | 'third',
    studentId: string
  ): Promise<AcademicSummary> {
    const prompt = await this.buildSummaryPrompt(normalizedResults, globalMetrics, academicContext, phase, studentId);
    
    try {
      const result = await geminiClient.generateContent(prompt, []);
      
      // Parsear respuesta JSON
      let cleanedText = result.text.replace(/```json\n?([\s\S]*?)\n?```/g, '$1');
      cleanedText = cleanedText.replace(/```\n?([\s\S]*?)\n?```/g, '$1');
      
      const firstBrace = cleanedText.indexOf('{');
      const lastBrace = cleanedText.lastIndexOf('}');
      
      if (firstBrace === -1 || lastBrace === -1) {
        throw new Error('No se encontró estructura JSON válida en la respuesta de la IA');
      }
      
      const jsonString = cleanedText.substring(firstBrace, lastBrace + 1);
      const parsed = JSON.parse(jsonString);
      
      // Validar estructura
      if (!parsed.resumen_general || !parsed.analisis_competencial) {
        throw new Error('La respuesta de la IA no tiene la estructura esperada');
      }
      
      // Normalizar analisis_competencial: puede ser string o objeto
      let analisisCompetencial: string | { [materia: string]: string };
      if (typeof parsed.analisis_competencial === 'string') {
        analisisCompetencial = parsed.analisis_competencial;
      } else if (typeof parsed.analisis_competencial === 'object' && parsed.analisis_competencial !== null) {
        analisisCompetencial = parsed.analisis_competencial;
      } else {
        throw new Error('analisis_competencial debe ser un string o un objeto con las materias');
      }
      
      const summary: AcademicSummary = {
        resumen_general: parsed.resumen_general,
        analisis_competencial: analisisCompetencial,
        fortalezas_academicas: Array.isArray(parsed.fortalezas_academicas) 
          ? parsed.fortalezas_academicas 
          : [],
        aspectos_por_mejorar: Array.isArray(parsed.aspectos_por_mejorar)
          ? parsed.aspectos_por_mejorar
          : [],
        recomendaciones_enfoque_saber11: Array.isArray(parsed.recomendaciones_enfoque_saber11)
          ? parsed.recomendaciones_enfoque_saber11
          : [],
      };
      
      // Agregar justificación pedagógica si está presente (Fase I)
      if (parsed.justificacion_pedagogica) {
        summary.justificacion_pedagogica = parsed.justificacion_pedagogica;
      }
      
      return summary;
    } catch (error: any) {
      console.error('Error generando resumen con IA:', error);
      throw new Error(`Error generando resumen con IA: ${error.message}`);
    }
  }

  /**
   * Obtiene el resumen completo de fases anteriores para contexto comparativo
   * Retorna tanto las métricas como el análisis completo generado por IA
   * Para Fase III, retorna solo Fase II (la más reciente)
   */
  private async getPreviousPhaseMetrics(
    studentId: string,
    currentPhase: 'first' | 'second' | 'third'
  ): Promise<{ phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null> {
    try {
      const studentDb = getStudentDatabase();
      
      // Determinar qué fases anteriores buscar
      const previousPhases: ('first' | 'second' | 'third')[] = [];
      if (currentPhase === 'second') {
        previousPhases.push('first');
      } else if (currentPhase === 'third') {
        previousPhases.push('second'); // Para Fase III, solo retornamos Fase II (la más reciente)
      }

      // Obtener el resumen más reciente de las fases anteriores
      for (const prevPhase of previousPhases) {
        try {
          const summaryRef = studentDb
            .collection('ResumenStudent')
            .doc(studentId)
            .collection(prevPhase)
            .doc('resumenActual');
          
          const snapshot = await summaryRef.get();
          if (snapshot.exists) {
            const data = snapshot.data() as PersistedSummary;
            if (data.metricasGlobales) {
              const phaseName = prevPhase === 'first' ? 'Fase I' : prevPhase === 'second' ? 'Fase II' : 'Fase III';
              return {
                phase: phaseName,
                metrics: data.metricasGlobales,
                fullSummary: data, // Incluir el resumen completo para tener acceso al análisis de IA
              };
            }
          }
        } catch (error: any) {
          console.warn(`⚠️ Error obteniendo métricas de ${prevPhase}:`, error.message);
        }
      }

      return null;
    } catch (error: any) {
      console.warn('⚠️ Error obteniendo métricas de fases anteriores:', error.message);
      return null;
    }
  }

  /**
   * Obtiene información de todas las fases anteriores necesarias para Fase III
   * Retorna información completa de Fase I y Fase II
   */
  private async getAllPreviousPhasesForPhase3(
    studentId: string
  ): Promise<{
    phase1: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
    phase2: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
  }> {
    try {
      const studentDb = getStudentDatabase();
      
      let phase1Data: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null = null;
      let phase2Data: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null = null;

      // Obtener Fase I
      try {
        const phase1Ref = studentDb
          .collection('ResumenStudent')
          .doc(studentId)
          .collection('first')
          .doc('resumenActual');
        
        const phase1Snap = await phase1Ref.get();
        if (phase1Snap.exists) {
          const data = phase1Snap.data() as PersistedSummary;
          if (data.metricasGlobales) {
            phase1Data = {
              phase: 'Fase I',
              metrics: data.metricasGlobales,
              fullSummary: data,
            };
          }
        }
      } catch (error: any) {
        console.warn('⚠️ Error obteniendo métricas de Fase I:', error.message);
      }

      // Obtener Fase II
      try {
        const phase2Ref = studentDb
          .collection('ResumenStudent')
          .doc(studentId)
          .collection('second')
          .doc('resumenActual');
        
        const phase2Snap = await phase2Ref.get();
        if (phase2Snap.exists) {
          const data = phase2Snap.data() as PersistedSummary;
          if (data.metricasGlobales) {
            phase2Data = {
              phase: 'Fase II',
              metrics: data.metricasGlobales,
              fullSummary: data,
            };
          }
        }
      } catch (error: any) {
        console.warn('⚠️ Error obteniendo métricas de Fase II:', error.message);
      }

      return {
        phase1: phase1Data,
        phase2: phase2Data,
      };
    } catch (error: any) {
      console.warn('⚠️ Error obteniendo fases anteriores para Fase III:', error.message);
      return {
        phase1: null,
        phase2: null,
      };
    }
  }

  /**
   * Construye el prompt para la IA
   * IMPORTANTE: Los datos de evaluación (normalizedResults) son SOLO de la fase actual
   * El contexto de fases anteriores solo incluye métricas globales para comparación
   */
  private async buildSummaryPrompt(
    normalizedResults: NormalizedEvaluationResult[],
    globalMetrics: GlobalMetrics,
    academicContext: AcademicContext,
    phase: 'first' | 'second' | 'third',
    studentId: string
  ): Promise<string> {
    const phaseName = phase === 'first' ? 'Fase I' : phase === 'second' ? 'Fase II' : 'Fase III';
    
    // Para Fase I, incluir datos detallados (porcentajes, tiempos) para diagnóstico pedagógico
    // Para otras fases, mantener formato simplificado
    const materiasData = phase === 'first' 
      ? normalizedResults.map(r => ({
          materia: r.materia,
          nivel: r.nivel,
          puntaje: r.puntaje, // Porcentaje exacto para análisis detallado
          competencias: r.competencias,
          temasDetallados: r.temasDetallados.map(t => ({
            tema: t.tema,
            puntaje: t.puntaje, // Porcentaje exacto
            nivel: t.nivel,
            totalPreguntas: t.totalPreguntas,
            correctas: t.correctas,
            tiempoPromedioSegundos: t.tiempoPromedioSegundos,
            patronTiempo: t.patronTiempo,
          })),
          tiempoPromedioPorPregunta: r.tiempoPromedioPorPregunta,
          patronesTiempo: r.patronesTiempo,
        }))
      : normalizedResults.map(r => ({
          materia: r.materia,
          nivel: r.nivel,
          competencias: r.competencias,
        }));
    
    // Lista de materias para el prompt
    const materiasLista = normalizedResults.map(r => r.materia).join(', ');

    // Para Fase III, obtener información de AMBAS fases anteriores (Fase I y Fase II)
    // Para otras fases, obtener solo la fase anterior más reciente
    let previousPhaseMetrics: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null = null;
    let phase3PreviousPhases: {
      phase1: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
      phase2: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
    } | null = null;

    if (phase === 'third') {
      // Para Fase III, obtener ambas fases anteriores
      phase3PreviousPhases = await this.getAllPreviousPhasesForPhase3(studentId);
      // También obtener la fase más reciente para mantener compatibilidad
      previousPhaseMetrics = phase3PreviousPhases.phase2 || phase3PreviousPhases.phase1;
    } else {
      // Para otras fases, obtener solo la fase anterior más reciente
      previousPhaseMetrics = await this.getPreviousPhaseMetrics(studentId, phase);
    }

    // Construir sección de contexto comparativo (solo si hay fase anterior)
    let comparativeContextSection = '';
    let phase2ComparativeAnalysisSection = '';
    let phase3ContextSection = '';
    
    if (previousPhaseMetrics) {
      // Construir mapa de niveles de Fase II por materia para comparación
      const phase2MateriaLevels: { [key: string]: string } = {};
      normalizedResults.forEach(r => {
        phase2MateriaLevels[r.materia] = r.nivel;
      });

      // Agrupar temas débiles por materia para Fase II
      const temasDebilesPorMateria: { [materia: string]: string[] } = {};
      if (previousPhaseMetrics.metrics.temasDebiles) {
        previousPhaseMetrics.metrics.temasDebiles.forEach(({ materia, tema }) => {
          if (!temasDebilesPorMateria[materia]) {
            temasDebilesPorMateria[materia] = [];
          }
          temasDebilesPorMateria[materia].push(tema);
        });
      }

      // Construir sección con análisis completo de Fase I si está disponible
      let phase1FullAnalysisSection = '';
      if (phase === 'second' && previousPhaseMetrics.fullSummary && previousPhaseMetrics.fullSummary.resumen) {
        const phase1Resumen = previousPhaseMetrics.fullSummary.resumen;
        
        // Formatear análisis competencial de Fase I
        let analisisCompetencialFase1 = '';
        if (typeof phase1Resumen.analisis_competencial === 'object' && phase1Resumen.analisis_competencial !== null) {
          // Es un objeto por materias
          analisisCompetencialFase1 = Object.entries(phase1Resumen.analisis_competencial)
            .map(([materia, analisis]) => `**${materia}**:\n${analisis}`)
            .join('\n\n');
        } else if (typeof phase1Resumen.analisis_competencial === 'string') {
          // Es un string (backward compatibility)
          analisisCompetencialFase1 = phase1Resumen.analisis_competencial;
        }

        phase1FullAnalysisSection = `
═══════════════════════════════════════════════════════════════
📋 ANÁLISIS COMPLETO DE ${previousPhaseMetrics.phase} GENERADO POR IA
═══════════════════════════════════════════════════════════════

Este es el análisis completo que se generó para ${previousPhaseMetrics.phase}. Úsalo como referencia para comparar con el estado actual en Fase II:

**RESUMEN GENERAL DE ${previousPhaseMetrics.phase}:**
${phase1Resumen.resumen_general || 'No disponible'}

**ANÁLISIS COMPETENCIAL POR MATERIA DE ${previousPhaseMetrics.phase}:**
${analisisCompetencialFase1 || 'No disponible'}

**FORTALEZAS ACADÉMICAS IDENTIFICADAS EN ${previousPhaseMetrics.phase}:**
${phase1Resumen.fortalezas_academicas && phase1Resumen.fortalezas_academicas.length > 0 
  ? phase1Resumen.fortalezas_academicas.map(f => `- ${f}`).join('\n')
  : 'Ninguna identificada'}

**ASPECTOS POR MEJORAR IDENTIFICADOS EN ${previousPhaseMetrics.phase}:**
${phase1Resumen.aspectos_por_mejorar && phase1Resumen.aspectos_por_mejorar.length > 0
  ? phase1Resumen.aspectos_por_mejorar.map(a => `- ${a}`).join('\n')
  : 'Ninguno identificado'}

${phase1Resumen.justificacion_pedagogica && phase1Resumen.justificacion_pedagogica.contenidos_prioritarios && phase1Resumen.justificacion_pedagogica.contenidos_prioritarios.length > 0 ? `
**CONTENIDOS PRIORITARIOS IDENTIFICADOS EN ${previousPhaseMetrics.phase} (para el plan de estudio personalizado):**
${phase1Resumen.justificacion_pedagogica.contenidos_prioritarios.map(cp => 
  `- **${cp.materia} - ${cp.tema}**: ${cp.justificacion}`
).join('\n')}
` : ''}

⚠️ IMPORTANTE: Este análisis de ${previousPhaseMetrics.phase} te muestra el estado anterior completo del estudiante. Úsalo para hacer comparaciones precisas y específicas en tu análisis de Fase II, especialmente para las materias que eran débiles.

`;
      }

      comparativeContextSection = `
═══════════════════════════════════════════════════════════════
CONTEXTO COMPARATIVO - ${previousPhaseMetrics.phase}
═══════════════════════════════════════════════════════════════

Para enriquecer tu análisis, aquí están las métricas generales de la fase anterior (${previousPhaseMetrics.phase}):

- Nivel general de desempeño en ${previousPhaseMetrics.phase}: ${previousPhaseMetrics.metrics.nivelGeneralDesempeno}
- Materias con desempeño favorable en ${previousPhaseMetrics.phase}: ${previousPhaseMetrics.metrics.materiasFuertes.join(', ') || 'Ninguna'}
- Materias que requerían fortalecimiento en ${previousPhaseMetrics.phase}: ${previousPhaseMetrics.metrics.materiasDebiles.join(', ') || 'Ninguna'}

${phase === 'second' ? `\n📊 COMPARACIÓN DETALLADA MATERIA POR MATERIA (${previousPhaseMetrics.phase} → Fase II):

Las siguientes materias fueron identificadas como DÉBILES en ${previousPhaseMetrics.phase} y requirieron intervención pedagógica mediante planes de estudio personalizados. Compara su desempeño actual en Fase II:

${previousPhaseMetrics.metrics.materiasDebiles.map(materia => {
  const nivelFase2 = phase2MateriaLevels[materia] || 'No evaluada';
  const temasDebiles = temasDebilesPorMateria[materia] || [];
  const temasTexto = temasDebiles.length > 0 
    ? `\n  • Temas específicos que eran débiles en ${previousPhaseMetrics.phase}: ${temasDebiles.join(', ')}`
    : '';
  return `- **${materia}**: 
  • Nivel en ${previousPhaseMetrics.phase}: Requería fortalecimiento (Básico o Bajo)
  • Nivel en Fase II: ${nivelFase2}${temasTexto}`;
}).join('\n\n')}

${previousPhaseMetrics.metrics.materiasDebiles.length === 0 ? '- No hubo materias identificadas como débiles en la fase anterior' : ''}

${previousPhaseMetrics.metrics.debilidadesEstructurales && previousPhaseMetrics.metrics.debilidadesEstructurales.length > 0 ? `
⚠️ DEBILIDADES ESTRUCTURALES IDENTIFICADAS EN ${previousPhaseMetrics.phase} (requerían atención prioritaria):
${previousPhaseMetrics.metrics.debilidadesEstructurales.map(d => `- ${d.materia} - ${d.tema}`).join('\n')}
` : ''}

${previousPhaseMetrics.metrics.debilidadesLeves && previousPhaseMetrics.metrics.debilidadesLeves.length > 0 ? `
📋 DEBILIDADES LEVES IDENTIFICADAS EN ${previousPhaseMetrics.phase} (cercanas al nivel básico):
${previousPhaseMetrics.metrics.debilidadesLeves.map(d => `- ${d.materia} - ${d.tema}`).join('\n')}
` : ''}

⚠️ IMPORTANTE: Usa esta información para tu análisis comparativo explícito en la sección correspondiente. Debes comparar no solo las materias, sino también los temas específicos que eran débiles en ${previousPhaseMetrics.phase} para evaluar si mejoraron en Fase II.` : ''}

${phase1FullAnalysisSection}

⚠️ NOTA: Este contexto es para referencia comparativa. Tu análisis debe basarse PRINCIPALMENTE en los resultados de ${phaseName} que se muestran a continuación. Puedes mencionar mejoras o cambios respecto a la fase anterior, pero sin mencionar puntajes numéricos específicos.
`;
      
      // Sección especial para Fase II sobre análisis comparativo
      if (phase === 'second' && previousPhaseMetrics.metrics.materiasDebiles.length > 0) {
        phase2ComparativeAnalysisSection = `
═══════════════════════════════════════════════════════════════
⚠️ ANÁLISIS COMPARATIVO OBLIGATORIO PARA FASE II
═══════════════════════════════════════════════════════════════

🎯 PROPÓSITO: Evaluar el progreso respecto a Fase I y el impacto del plan de estudio personalizado.

📋 PARA CADA MATERIA DÉBIL DE FASE I (${previousPhaseMetrics.metrics.materiasDebiles.join(', ')}):
1. PRIMERA ORACIÓN OBLIGATORIA: "El estudiante MEJORÓ(dilo de una forma tecnica)." O "El estudiante se MANTUVO(dilo de una forma tecnica)." O "El estudiante EMPEORÓ(dilo de una forma tecnica)." (SIN EXCEPCIÓN, SIN repetir el nombre de la materia)
2. Explica el cambio en lenguaje sencillo (1-2 oraciones)
   - ⚠️ VARIACIÓN OBLIGATORIA: Aunque el mensaje sea el mismo, varía la forma de expresarlo en cada materia usando diferentes estructuras y sinónimos
   - Si mejoró: INCLUYE FELICITACIONES al estudiante (ej: "¡Felicitaciones por este progreso!", "¡Excelente trabajo!")
   - Si se mantuvo o empeoró: ENFÓCATE en falta de dedicación del estudiante, NO critiques el plan de estudio
3. Menciona temas específicos que mejoraron/mantuvieron/empeoraron (varía la forma de expresarlo)
4. Si mejoró: Felicita nuevamente y menciona el impacto positivo. Si se mantuvo o empeoró: Enfócate en que el estudiante necesita más dedicación, tiempo de práctica y esfuerzo (NO digas que el plan no funcionó)

⚠️ VARIACIÓN CRÍTICA: NO uses las mismas frases exactas en diferentes materias. Aunque el mensaje sea el mismo, varía:
- Las estructuras de las oraciones
- Los sinónimos utilizados
- La forma de expresar conceptos similares
- El orden de la información

⚠️ EVITA REDUNDANCIAS: NO repitas la misma información en diferentes secciones. Cada sección debe aportar información única y complementaria.
`;
      }
    }

    // Construir sección especial para Fase III con información de ambas fases anteriores
    if (phase === 'third' && phase3PreviousPhases) {
      let phase1Section = '';
      let phase2Section = '';

      // Sección de Fase I
      if (phase3PreviousPhases.phase1 && phase3PreviousPhases.phase1.fullSummary) {
        const phase1Resumen = phase3PreviousPhases.phase1.fullSummary.resumen;

        phase1Section = `
═══════════════════════════════════════════════════════════════
📋 INFORMACIÓN DE FASE I (DIAGNÓSTICO INICIAL)
═══════════════════════════════════════════════════════════════

**RESUMEN GENERAL DE FASE I:**
${phase1Resumen.resumen_general || 'No disponible'}

**MÉTRICAS DE FASE I:**
- Nivel general de desempeño: ${phase3PreviousPhases.phase1.metrics.nivelGeneralDesempeno}
- Materias con desempeño favorable: ${phase3PreviousPhases.phase1.metrics.materiasFuertes.join(', ') || 'Ninguna'}
- Materias que requerían fortalecimiento: ${phase3PreviousPhases.phase1.metrics.materiasDebiles.join(', ') || 'Ninguna'}

**FORTALEZAS ACADÉMICAS IDENTIFICADAS EN FASE I:**
${phase1Resumen.fortalezas_academicas && phase1Resumen.fortalezas_academicas.length > 0 
  ? phase1Resumen.fortalezas_academicas.map(f => `- ${f}`).join('\n')
  : 'Ninguna identificada'}

**ASPECTOS POR MEJORAR IDENTIFICADOS EN FASE I:**
${phase1Resumen.aspectos_por_mejorar && phase1Resumen.aspectos_por_mejorar.length > 0
  ? phase1Resumen.aspectos_por_mejorar.map(a => `- ${a}`).join('\n')
  : 'Ninguno identificado'}

`;
      }

      // Sección de Fase II
      if (phase3PreviousPhases.phase2 && phase3PreviousPhases.phase2.fullSummary) {
        const phase2Resumen = phase3PreviousPhases.phase2.fullSummary.resumen;

        phase2Section = `
═══════════════════════════════════════════════════════════════
📋 INFORMACIÓN DE FASE II (REFUERZO PERSONALIZADO)
═══════════════════════════════════════════════════════════════

**RESUMEN GENERAL DE FASE II:**
${phase2Resumen.resumen_general || 'No disponible'}

**MÉTRICAS DE FASE II:**
- Nivel general de desempeño: ${phase3PreviousPhases.phase2.metrics.nivelGeneralDesempeno}
- Materias con desempeño favorable: ${phase3PreviousPhases.phase2.metrics.materiasFuertes.join(', ') || 'Ninguna'}
- Materias que requerían fortalecimiento: ${phase3PreviousPhases.phase2.metrics.materiasDebiles.join(', ') || 'Ninguna'}

**FORTALEZAS ACADÉMICAS IDENTIFICADAS EN FASE II:**
${phase2Resumen.fortalezas_academicas && phase2Resumen.fortalezas_academicas.length > 0 
  ? phase2Resumen.fortalezas_academicas.map(f => `- ${f}`).join('\n')
  : 'Ninguna identificada'}

**ASPECTOS POR MEJORAR IDENTIFICADOS EN FASE II:**
${phase2Resumen.aspectos_por_mejorar && phase2Resumen.aspectos_por_mejorar.length > 0
  ? phase2Resumen.aspectos_por_mejorar.map(a => `- ${a}`).join('\n')
  : 'Ninguno identificado'}

`;
      }

      phase3ContextSection = `
═══════════════════════════════════════════════════════════════
📊 TRAYECTORIA ACADÉMICA DEL ESTUDIANTE (FASE I → FASE II → FASE III)
═══════════════════════════════════════════════════════════════

El estudiante ha completado las tres fases del proceso de preparación académica:

${phase1Section}
${phase2Section}

⚠️ IMPORTANTE: Usa esta información completa de Fase I y Fase II para:
1. Evaluar la trayectoria académica del estudiante a lo largo de las tres fases
2. Identificar mejoras sostenidas, áreas que se mantuvieron estables, o retrocesos
3. Determinar el estado actual del estudiante DESPUÉS de completar Fase I y Fase II
4. Evaluar en qué condición se encuentra el estudiante para presentar las pruebas ICFES Saber 11
5. Proporcionar un diagnóstico integral que considere todo el proceso de preparación

Tu análisis en el "resumen_general" DEBE indicar claramente:
- El estado del estudiante después de haber completado Fase I y Fase II
- En qué condición se encuentra para presentar las pruebas ICFES Saber 11
- Una evaluación integral que considere toda la trayectoria académica

`;
    }

    // Ajustar el prompt según la fase
    const isPhase3 = phase === 'third';
    const roleDescription = isPhase3 
      ? `Eres un experto evaluador del Instituto Colombiano para la Evaluación de la Educación (ICFES) y del Ministerio de Educación Nacional, con amplia trayectoria en la elaboración de informes oficiales de resultados de las pruebas Saber 11. Tienes más de 20 años de experiencia analizando resultados de evaluaciones estandarizadas y generando informes institucionales para el sector educativo colombiano.`
      : phase === 'first'
      ? `Actúa como un Doctor en Ciencias de la Educación, especialista en diagnóstico pedagógico y evaluación estandarizada tipo ICFES / Saber 11, con más de 20 años de experiencia como docente, evaluador institucional y asesor académico. Tu enfoque principal es la comprensión integral del perfil de desempeño académico del estudiante para establecer bases sólidas de intervención pedagógica.`
      : `Actúa como un Doctor en Ciencias de la Educación, especialista en evaluación estandarizada tipo ICFES / Saber 11, con más de 20 años de experiencia como docente, evaluador institucional y asesor académico. Tu especialidad es comunicar resultados académicos de forma clara y accesible a padres de familia, manteniendo la precisión técnica pero haciendo el lenguaje comprensible para personas sin formación pedagógica.`;

    const expertiseDescription = isPhase3
      ? `Tu dominio experto incluye:
- Marco de competencias oficial del ICFES Saber 11
- Estructura y metodología de los informes oficiales del Ministerio de Educación Nacional
- Interpretación institucional de resultados por competencias y niveles de desempeño
- Elaboración de informes académicos oficiales siguiendo el formato y lenguaje del ICFES
- Análisis comparativo longitudinal del progreso estudiantil según estándares nacionales`
      : phase === 'first'
      ? `Tu dominio experto incluye:
- Marco de competencias del ICFES Saber 11
- Diagnóstico pedagógico integral y análisis de perfiles de aprendizaje
- Interpretación de resultados por competencias y niveles de desempeño con enfoque diagnóstico
- Análisis de patrones de respuesta (impulsividad vs dificultad cognitiva)
- Estándares esperados por grado y nivel educativo
- Diseño de estrategias de intervención pedagógica basadas en diagnóstico
- Elaboración de informes académicos institucionales claros, objetivos y orientados a la mejora
- Justificación pedagógica de priorización de contenidos y actividades de aprendizaje`
      : `Tienes dominio experto en:
- Marco de competencias del ICFES Saber 11
- Interpretación de resultados por competencias y niveles de desempeño
- Análisis integral del rendimiento estudiantil
- Elaboración de informes académicos institucionales claros, objetivos y orientados a la mejora
- Análisis longitudinal del progreso estudiantil`;

    const writingStyle = isPhase3
      ? `Tu redacción debe ser:
- Formal e institucional, como los informes oficiales del ICFES
- Técnica pero COMPRENSIBLE: usa términos técnicos cuando sean necesarios, pero siempre acompañados de explicaciones claras y sencillas
- Si mencionas conceptos técnicos (como "competencias", "desempeño", "niveles"), explícalos de forma que cualquier persona pueda entender
- Evita jerga académica excesiva; si debes usarla, explícala inmediatamente después
- Objetiva y precisa, pero con un lenguaje que padres de familia sin formación pedagógica puedan comprender
- Enfocada en competencias y estándares, explicados de manera clara
- Estructurada como un informe oficial pero accesible`
      : phase === 'second'
      ? `Tu redacción debe ser ESPECIALMENTE CLARA Y ACCESIBLE para padres de familia:

⚠️ REGLAS DE LENGUAJE PARA FASE II:

1. MANTÉN EL TECNICISMO PERO HAZLO ENTENDIBLE:
   - ✅ BIEN: "El estudiante mejoró en Matemáticas, pasando de un nivel básico (regular) a un nivel alto (bueno). Esto significa que ahora tiene mejores habilidades para resolver problemas matemáticos."
   - ❌ MAL: "El estudiante evidencia un fortalecimiento competencial en el área matemática, transitando de un desempeño básico a un desempeño alto."

2. EXPLICA SIEMPRE LOS TÉRMINOS TÉCNICOS:
   - "Competencias" → siempre añade "(habilidades)" o "(capacidades)"
   - "Desempeño" → añade "(rendimiento)" o "(resultados)"
   - "Nivel básico" → añade "(regular)"
   - "Nivel alto" → añade "(bueno)"
   - "Nivel superior" → añade "(excelente)"
   - "Nivel bajo" → añade "(necesita mejorar)"
   - "Fortalecimiento" → usa "mejora" o "desarrollo"
   - "Intervención pedagógica" → usa "plan de estudio personalizado" o "estrategias de apoyo"

3. USA EJEMPLOS CONCRETOS:
   - En lugar de: "Presenta dificultades en competencias matemáticas"
   - Mejor: "Tiene dificultades para resolver problemas de álgebra y geometría"

4. ESTRUCTURA CLARA Y DIRECTA:
   - Empieza con conclusiones claras: "El estudiante MEJORÓ/MANTUVO/EMPEORÓ"
   - Luego explica el cambio en términos sencillos
   - Finalmente, menciona detalles específicos

5. EVITA JERGA PEDAGÓGICA EXCESIVA:
   - ❌ "Desarrollo competencial" → ✅ "Mejora en habilidades"
   - ❌ "Fortalecimiento competencial" → ✅ "Mejora en" o "desarrollo de habilidades"
   - ❌ "Evidencia desempeño" → ✅ "Muestra" o "tiene un rendimiento"
   - ❌ "Requiere fortalecimiento" → ✅ "Necesita mejorar" o "requiere más apoyo"

6. OBJETIVO:
- Este documento será leído por padres de familia sin formación pedagógica
- Mantén la precisión técnica pero hazla accesible
- Usa lenguaje claro, directo y concreto
- Explica conceptos complejos con lenguaje simple`
      : `Tu redacción debe ser:
- Técnica pero COMPRENSIBLE: mantén el rigor académico pero con lenguaje claro y accesible
- Formal pero entendible: este documento será leído por padres de familia, estudiantes y docentes
- Si usas términos técnicos (como "competencias", "desempeño", "niveles de desempeño"), explícalos de forma sencilla o usa expresiones más familiares junto a los términos técnicos
- Evita jerga pedagógica excesiva: en lugar de solo decir "desarrollo competencial", di "mejora en sus habilidades y competencias" o "ha desarrollado mejor sus competencias"
- Usa ejemplos concretos cuando sea posible para facilitar la comprensión
- Explica conceptos complejos con lenguaje simple, manteniendo la precisión técnica
- Enfocada en competencias y habilidades, pero explicadas de manera que cualquier persona pueda entender
- Puedes usar términos técnicos cuando sean necesarios, pero siempre con explicaciones claras o sinónimos más accesibles`;

    return `${roleDescription}

${expertiseDescription}

${writingStyle}

═══════════════════════════════════════════════════════════════
CONTEXTO ACADÉMICO DEL ESTUDIANTE
═══════════════════════════════════════════════════════════════

Fase evaluativa ACTUAL: ${phaseName}
${academicContext.grado ? `Grado: ${academicContext.grado}` : 'Grado: No especificado'}
${academicContext.nivel ? `Nivel: ${academicContext.nivel}` : ''}

${phase === 'third' ? phase3ContextSection : comparativeContextSection}
${phase2ComparativeAnalysisSection}
═══════════════════════════════════════════════════════════════
RESULTADOS POR MATERIA - ${phaseName}
═══════════════════════════════════════════════════════════════

⚠️ NOTA CRÍTICA: Los siguientes resultados son EXCLUSIVAMENTE de ${phaseName}. Tu análisis debe basarse en estos datos.

${phase === 'first' ? materiasData.map((r: any) => `
**${r.materia}**
- Nivel de desempeño: ${r.nivel} (Puntaje: ${r.puntaje.toFixed(1)}%)
- Competencias/Temas evaluados:
${r.temasDetallados.map((t: any) => `  • ${t.tema}: ${t.puntaje.toFixed(1)}% (${t.correctas}/${t.totalPreguntas} correctas)${t.tiempoPromedioSegundos ? ` - Tiempo promedio: ${t.tiempoPromedioSegundos.toFixed(1)}s` : ''}${t.patronTiempo ? ` - Patrón: ${t.patronTiempo === 'impulsivo' ? 'Impulsividad (respuestas rápidas e incorrectas)' : t.patronTiempo === 'dificultad_cognitiva' ? 'Dificultad cognitiva (respuestas lentas e incorrectas)' : 'Normal'}` : ''}`).join('\n')}
${r.tiempoPromedioPorPregunta ? `- Tiempo promedio por pregunta: ${r.tiempoPromedioPorPregunta.toFixed(1)} segundos` : ''}
${r.patronesTiempo ? `- Patrones de tiempo: ${r.patronesTiempo.impulsividad.toFixed(1)}% impulsividad, ${r.patronesTiempo.dificultadCognitiva.toFixed(1)}% dificultad cognitiva` : ''}
`).join('\n') : materiasData.map((r: any) => `
**${r.materia}**
- Nivel de desempeño: ${r.nivel}
- Competencias evaluadas: ${Object.keys(r.competencias).join(', ') || 'No especificadas'}
`).join('\n')}

═══════════════════════════════════════════════════════════════
MÉTRICAS GLOBALES CALCULADAS - ${phaseName}
═══════════════════════════════════════════════════════════════

Estas métricas fueron calculadas determinísticamente basándose SOLO en los resultados de ${phaseName}:

- Nivel general de desempeño: ${globalMetrics.nivelGeneralDesempeno}
- Materias con desempeño favorable: ${globalMetrics.materiasFuertes.join(', ') || 'Ninguna'}
- Materias que requieren fortalecimiento: ${globalMetrics.materiasDebiles.join(', ') || 'Ninguna'}
${phase === 'first' && globalMetrics.debilidadesLeves.length > 0 ? `- Debilidades leves (35-39%, cercanas al nivel Básico): ${globalMetrics.debilidadesLeves.map(d => `${d.materia} - ${d.tema} (${d.puntaje.toFixed(1)}%)`).join(', ')}` : ''}
${phase === 'first' && globalMetrics.debilidadesEstructurales.length > 0 ? `- Debilidades estructurales (<35%, muy por debajo del estándar): ${globalMetrics.debilidadesEstructurales.map(d => `${d.materia} - ${d.tema} (${d.puntaje.toFixed(1)}%)`).join(', ')}` : ''}
${phase === 'first' && globalMetrics.patronesGlobalesTiempo ? `- Patrones globales de tiempo:
  • Tiempo promedio por pregunta: ${globalMetrics.patronesGlobalesTiempo.promedioGeneralSegundos.toFixed(1)} segundos
  • Porcentaje de impulsividad (rápidas e incorrectas): ${globalMetrics.patronesGlobalesTiempo.porcentajeImpulsividad.toFixed(1)}%
  • Porcentaje de dificultad cognitiva (lentas e incorrectas): ${globalMetrics.patronesGlobalesTiempo.porcentajeDificultadCognitiva.toFixed(1)}%` : ''}

═══════════════════════════════════════════════════════════════
INSTRUCCIONES PARA EL ANÁLISIS
═══════════════════════════════════════════════════════════════

${isPhase3 ? `IMPORTANTE: Esta es la ${phaseName}, que simula una evaluación oficial tipo ICFES Saber 11. Tu análisis debe reflejar el formato y rigor de los informes oficiales del Ministerio de Educación Nacional.

Analiza integralmente el desempeño del estudiante en ${phaseName}, considerando:
- Niveles de desempeño por área evaluada (BASADOS EN ${phaseName})
- Fortalezas y debilidades por competencias según estándares nacionales (IDENTIFICADAS EN ${phaseName})
- Coherencia y consistencia entre las áreas evaluadas en ${phaseName}
- Estado general frente a las exigencias y estándares del examen oficial ICFES Saber 11
- Interpretación del desempeño según los niveles establecidos por el ICFES
${phase3PreviousPhases ? `- Trayectoria académica completa: Debes considerar la información completa de Fase I y Fase II proporcionada anteriormente para evaluar:
  • El estado del estudiante DESPUÉS de haber completado las dos primeras fases
  • La evolución académica a lo largo de las tres fases (mejoras sostenidas, áreas que se mantuvieron estables, retrocesos)
  • En qué condición se encuentra el estudiante para presentar las pruebas ICFES Saber 11
  • Una evaluación integral que considere todo el proceso de preparación (Fase I → Fase II → Fase III)
  (menciona mejoras sostenidas, mantenimientos o áreas que requieren fortalecimiento continuo, pero sin puntajes numéricos específicos)` : previousPhaseMetrics ? `- Trayectoria académica y evolución del desempeño respecto a ${previousPhaseMetrics.phase} (menciona mejoras sostenidas, mantenimientos o áreas que requieren fortalecimiento continuo, pero sin puntajes numéricos)` : ''}

⚠️ RESTRICCIONES CRÍTICAS (Estilo Oficial ICFES):
- Tu análisis debe basarse EXCLUSIVAMENTE en los resultados de ${phaseName}
- Utiliza lenguaje técnico-institucional propio de los informes oficiales del ICFES
- NO menciones puntajes numéricos explícitos
- NO realices comparaciones con otros estudiantes
- NO utilices lenguaje clínico o psicológico
- NO uses juicios de valor personal
- NO incluyas saludos ni despedidas
- Mantén un tono objetivo, profesional e institucional en todo momento
- Si mencionas comparación con fase anterior, hazlo en términos de evolución académica y desarrollo competencial, sin números
- Responde SOLO con JSON válido` : phase === 'first' ? `🎯 DIAGNÓSTICO PEDAGÓGICO INTEGRAL - FASE I

La Fase I cumple la función de establecer un DIAGNÓSTICO PEDAGÓGICO INTEGRAL, cuyo propósito NO es calificar ni etiquetar al estudiante, sino COMPRENDER su perfil real de desempeño académico para fundamentar la intervención pedagógica posterior.

Analiza integralmente el desempeño del estudiante en Fase I, considerando:

1. ANÁLISIS DE DESEMPEÑO POR MATERIA Y TEMA:
- Usa los porcentajes exactos proporcionados para distinguir entre:
  • Debilidades leves (35-39%): cercanas al nivel Básico, requieren refuerzo moderado
  • Debilidades estructurales (<35%): muy por debajo del estándar, requieren intervención prioritaria
- Compara el desempeño con los estándares esperados para el grado ${academicContext.grado || 'del estudiante'}
- Identifica fortalezas y debilidades por competencias/temas con precisión diagnóstica

2. ANÁLISIS DE PATRONES DE RESPUESTA (TIEMPO):
- Respuestas muy rápidas e incorrectas (impulsividad): indica necesidad de estrategias de autorregulación y reflexión
- Respuestas muy lentas e incorrectas (dificultad cognitiva): indica necesidad de apoyo pedagógico más intensivo y explicaciones más detalladas
- Usa esta información para recomendar tipos de actividades más efectivas

3. JUSTIFICACIÓN PEDAGÓGICA CRÍTICA:
La Fase I DEBE dejar claramente trazada la justificación pedagógica de:
- QUÉ se estudiará después: identifica los temas/competencias que requieren intervención prioritaria
- POR QUÉ se prioriza ese contenido: fundamenta pedagógicamente la priorización basándote en:
  • Severidad de la debilidad (estructural vs leve)
  • Impacto en el aprendizaje futuro
  • Relación con estándares del grado
  • Patrones de tiempo identificados
- QUÉ TIPO DE ACTIVIDADES serán más efectivas: recomienda estrategias específicas según los patrones identificados:
  • Para impulsividad: actividades que promuevan reflexión, verificación, autorregulación
  • Para dificultad cognitiva: actividades con más apoyo, explicaciones paso a paso, ejemplos guiados
  • Para debilidades estructurales: actividades de nivelación y construcción de bases sólidas
  • Para debilidades leves: actividades de refuerzo y práctica dirigida

4. COMPARACIÓN CON ESTÁNDARES ESPERADOS:
- Compara el desempeño del estudiante con lo esperado para su grado/nivel
- NO compares con otros estudiantes
- Identifica brechas específicas respecto a los estándares del grado
- Establece expectativas realistas de mejora basadas en el diagnóstico

⚠️ RESTRICCIONES CRÍTICAS:
- Tu análisis debe basarse EXCLUSIVAMENTE en los resultados de Fase I
- Usa los porcentajes exactos para análisis interno, pero en el informe final usa lenguaje cualitativo (no muestres números directamente al estudiante)
- NO realices comparaciones con otros estudiantes
- NO utilices lenguaje clínico o psicológico
- NO uses juicios de valor personal
- NO incluyas saludos ni despedidas
- El enfoque es DIAGNÓSTICO y PEDAGÓGICO, no evaluativo o calificativo
- Debes fundamentar pedagógicamente todas tus recomendaciones
- ⚠️ ESPECIALMENTE PARA INGLÉS: El análisis de Inglés DEBE enfocarse ÚNICAMENTE en el nivel académico según el Marco Común Europeo de Referencia (MCER): A1, A2, B1, B2, C1 o C2. 
  • NO menciones "pruebas del 1 al 7" ni referencias numéricas a pruebas
  • NO menciones "prueba 1", "prueba 2", etc.
  • Identifica y menciona el nivel MCER correspondiente basándote en el desempeño general (ej: "El estudiante se encuentra en nivel A2", "demuestra competencia en nivel B1", "presenta un nivel B2")
  • Explica qué significa ese nivel de forma sencilla (ej: "nivel B1 significa que puede comunicarse en situaciones cotidianas")
  • El análisis debe centrarse en el nivel de dominio del idioma, no en referencias a pruebas específicas
- Responde SOLO con JSON válido` : phase === 'second' && previousPhaseMetrics ? `🎯 ANÁLISIS INTEGRAL CON ENFOQUE EN EVALUACIÓN DE INTERVENCIÓN PEDAGÓGICA

Analiza integralmente el desempeño del estudiante en ${phaseName}, considerando:

1. ANÁLISIS BASE DE FASE II:
- Niveles de desempeño por materia (BASADOS EN Fase II)
- Fortalezas y debilidades por competencias (IDENTIFICADAS EN Fase II)
- Coherencia entre materias evaluadas en Fase II
- Estado general frente a las exigencias del modelo Saber 11

2. ⚠️ ANÁLISIS COMPARATIVO OBLIGATORIO:
Para cada materia débil de Fase I (${previousPhaseMetrics.metrics.materiasDebiles.join(', ') || 'ninguna'}):
   - Indica EXPLÍCITAMENTE si mejoró, se mantuvo o empeoró (primera oración obligatoria)
   - Explica el cambio en lenguaje sencillo (1-2 oraciones)
   - Menciona temas específicos que mejoraron/mantuvieron/empeoraron
   - Evalúa brevemente el impacto del plan de estudio (1 oración)
   
⚠️ EVITA REPETIR: Si ya mencionaste algo en una sección, NO lo repitas en otra. Cada sección debe aportar información única.

⚠️ RESTRICCIONES CRÍTICAS Y GUÍA DE LENGUAJE:

1. BASE DEL ANÁLISIS:
- Basa tu análisis PRINCIPALMENTE en los resultados de Fase II
- El análisis comparativo es OBLIGATORIO y debe ser EXPLÍCITO
- Compara a nivel de materias y temas/competencias específicas

2. ⚠️ REGLA DE ORO - PRIMERA ORACIÓN OBLIGATORIA:
   Para CADA materia débil de Fase I, la PRIMERA ORACIÓN debe ser EXACTAMENTE:
   - "El estudiante tuvo una mejora significativa." O
   - "El estudiante mantuvo su nivel de desempeño." O
   - "El estudiante presentó un retroceso significativo."
   
   ⚠️ IMPORTANTE: NO repitas el nombre de la materia en el texto, ya que el nombre de la materia es la CLAVE del objeto JSON.
   
   ❌ PROHIBIDO: 
   - Variaciones, rodeos, o frases como "En relación con Fase I..."
   - Repetir el nombre de la materia: "El estudiante MEJORÓ en Matemáticas" (INCORRECTO)
   - El nombre de la materia ya está en la clave del JSON, no lo repitas

3. LENGUAJE ACCESIBLE (Mantén tecnicismo pero explícalo):
   - "Competencias" → añade "(habilidades)"
   - "Desempeño" → añade "(rendimiento)"
   - "Intervención pedagógica" → usa "plan de estudio personalizado"
   - Niveles: siempre explica (Superior=excelente, Alto=bueno, Básico=regular, Bajo=necesita mejorar)

4. ⚠️ EVITA REDUNDANCIAS - REGLA CRÍTICA:
   - NO repitas la misma información en diferentes secciones
   - Cada sección debe aportar información ÚNICA y COMPLEMENTARIA
   - Si mencionas algo en "resumen_general", NO lo repitas exactamente en "analisis_competencial"
   - Si ya indicaste "El estudiante MEJORÓ en Matemáticas" en el análisis de esa materia, NO lo repitas en otras secciones
   - Sé CONCISO: di lo esencial sin repetir conceptos
   - Cada oración debe agregar valor nuevo, no repetir lo ya dicho

5. PROHIBICIONES:
- NO puntajes numéricos explícitos
- NO comparaciones con otros estudiantes
- NO lenguaje clínico/psicológico
- NO saludos/despedidas
- ⚠️ ESPECIALMENTE PARA INGLÉS: El análisis DEBE enfocarse ÚNICAMENTE en el nivel académico según el Marco Común Europeo de Referencia (MCER): A1, A2, B1, B2, C1 o C2. 
  • PROHIBIDO mencionar "pruebas del 1 al 7", "prueba 1", "prueba 2", o cualquier referencia numérica a pruebas
  • Identifica y menciona el nivel MCER correspondiente basándote en el desempeño general (ej: "El estudiante se encuentra en nivel A2", "demuestra competencia en nivel B1", "presenta un nivel B2")
  • Explica qué significa ese nivel de forma sencilla
  • El análisis debe centrarse en el nivel de dominio del idioma, NO en referencias a pruebas específicas
- Responde SOLO con JSON válido` : `Analiza integralmente el desempeño del estudiante en ${phaseName}, considerando:
- Niveles de desempeño por materia (BASADOS SOLO EN ${phaseName})
- Fortalezas y debilidades por competencias (IDENTIFICADAS EN ${phaseName})
- Coherencia entre materias evaluadas en ${phaseName}
- Estado general frente a las exigencias del modelo Saber 11
${previousPhaseMetrics ? `- Progreso o cambios respecto a ${previousPhaseMetrics.phase} (menciona mejoras, mantenimientos o áreas que requieren atención continuada, pero sin puntajes numéricos)` : ''}

⚠️ RESTRICCIONES CRÍTICAS:
- Tu análisis debe basarse PRINCIPALMENTE en los resultados de ${phaseName}
- NO menciones puntajes numéricos explícitos
- NO realices comparaciones con otros estudiantes
- NO utilices lenguaje clínico o psicológico
- NO uses juicios de valor
- NO incluyas saludos ni despedidas
- Si mencionas comparación con fase anterior, hazlo en términos de progreso o evolución competencial, sin números
- ⚠️ ESPECIALMENTE PARA INGLÉS: El análisis DEBE enfocarse ÚNICAMENTE en el nivel académico según el Marco Común Europeo de Referencia (MCER): A1, A2, B1, B2, C1 o C2. 
  • PROHIBIDO mencionar "pruebas del 1 al 7", "prueba 1", "prueba 2", o cualquier referencia numérica a pruebas
  • Identifica y menciona el nivel MCER correspondiente basándote en el desempeño general (ej: "El estudiante se encuentra en nivel A2", "demuestra competencia en nivel B1", "presenta un nivel B2")
  • Explica qué significa ese nivel de forma sencilla
  • El análisis debe centrarse en el nivel de dominio del idioma, NO en referencias a pruebas específicas
- Responde SOLO con JSON válido`}

═══════════════════════════════════════════════════════════════
FORMATO DE RESPUESTA (JSON)
═══════════════════════════════════════════════════════════════

Responde ÚNICAMENTE con un objeto JSON en este formato exacto:

{
  "resumen_general": "${isPhase3 ? `Resumen ejecutivo del desempeño del estudiante en la ${phaseName}, estructurado como un informe oficial ICFES. Debe presentar una evaluación integral del estado académico según los estándares nacionales, enfocándose en las competencias evaluadas bajo el marco oficial del examen Saber 11. Utiliza lenguaje institucional formal.

⚠️ CONTENIDO OBLIGATORIO DEL RESUMEN GENERAL PARA FASE III:

1. Debe indicar claramente el ESTADO DEL ESTUDIANTE DESPUÉS de haber completado las dos primeras fases (Fase I y Fase II), considerando:
   - La trayectoria académica completa (Fase I → Fase II → Fase III)
   - Mejoras sostenidas, áreas que se mantuvieron estables, o retrocesos
   - El impacto del proceso de preparación en el desarrollo competencial

2. Debe evaluar en QUÉ CONDICIÓN SE ENCUENTRA EL ESTUDIANTE PARA PRESENTAR LAS PRUEBAS ICFES SABER 11, considerando:
   - Su nivel de preparación general
   - Fortalezas y debilidades identificadas
   - Nivel de dominio de las competencias requeridas
   - Recomendaciones sobre su estado de preparación para el examen oficial

3. Debe ser una evaluación integral que considere todo el proceso de preparación, no solo los resultados de Fase III.

${phase3PreviousPhases ? `La información de Fase I y Fase II fue proporcionada anteriormente en este prompt. Úsala para fundamentar tu análisis.` : previousPhaseMetrics ? `Puedes hacer referencia a la evolución académica respecto a ${previousPhaseMetrics.phase}, pero sin puntajes numéricos.` : ''}

(300-400 palabras)` : phase === 'second' && previousPhaseMetrics ? `Resumen dirigido a padres de familia sobre el progreso académico del estudiante en Fase II. 

⚠️ ESTRUCTURA OBLIGATORIA:

1. PRIMER PÁRRAFO (30-35 palabras): 
   - Menciona el propósito de Fase II: evaluar el progreso respecto a Fase I
   - Indica de forma general si el estudiante mejoró, se mantuvo o empeoró en las áreas de debilidad identificadas en Fase I
   - Usa lenguaje sencillo: "El estudiante mejoró en las áreas que presentaba dificultades", "El estudiante mantiene algunas dificultades", etc.

2. SEGUNDO PÁRRAFO (35-40 palabras):
   - Menciona específicamente las materias que eran débiles en Fase I: ${previousPhaseMetrics.metrics.materiasDebiles.length > 0 ? previousPhaseMetrics.metrics.materiasDebiles.join(', ') : 'ninguna materia identificada'}
   - Para cada materia, indica claramente si mejoró, se mantuvo o empeoró
   - Explica en términos sencillos: "En Matemáticas, pasó de tener un nivel básico (regular) a un nivel alto (bueno)", "En Lenguaje, se mantiene en nivel básico (regular) y requiere más apoyo"

3. TERCER PÁRRAFO (30-35 palabras):
   - Si mejoró: Felicita al estudiante y menciona el impacto positivo del plan de estudio
   - Si se mantuvo o empeoró: Enfócate en que el estudiante necesita mayor dedicación al estudio, más tiempo de práctica y esfuerzo (NO digas que el plan no funcionó)
   - Conclusión sobre el progreso general

⚠️ LENGUAJE Y ESTRUCTURA:
- Usa lenguaje claro y accesible para padres
- Mantén tecnicismo pero explícalo: "nivel básico (regular)", "competencias (habilidades)"
- ⚠️ EVITA REDUNDANCIAS: NO repitas información que ya aparecerá en "analisis_competencial". El resumen general debe dar una visión general, los detalles van en el análisis por materia.
- Sé específico pero conciso sobre mejoras, mantenimientos o retrocesos
- Total: 100 palabras` : phase === 'first' ? `⚠️ FORMATO OBLIGATORIO PARA RESUMEN GENERAL - FASE I:


📋 OBLIGATORIO incluir TODAS estas materias en el resumen (en este orden o similar) para descrbir el estado del estudiante con respecto a ellas pero a groso modo, de manera general:
1. Biología 
2. Ciencias Sociales 
3. Física 
4. Matemáticas
5. Química
6. Lenguaje
7. Inglés - ⚠️ OBLIGATORIO: identifica el nivel MCER (A1, A2, B1, B2, C1 o C2) y explica qué significa ese nivel. NO menciones "pruebas del 1 al 7". Ejemplo: "En Inglés, el estudiante se encuentra en nivel A2, lo que indica competencia básica en el idioma, con capacidad para comprender frases y expresiones de uso frecuente."

Dato para tener en cuenta: No menciones los temas espesificos en el resumen general, solo menciona las materias de manera general.
dato para tener en cuenta: al final se debe mencionar si el estudiante debe poner de su parte para mejorar su desempeño o mantener su compromiso con el estudio.


IMPORTANTE: El resumen debe ser diagnóstico (no calificativo), analizando cada materia con sus temas/competencias específicas todo de manera global y general. como finalidad ofrecer una visión global y comprensible del estado académico general del estudiante en el momento inicial del proceso. Usa lenguaje claro y accesible. (150-200 palabras)` : `Descripción global del estado académico del estudiante en ${phaseName}, en relación con las competencias evaluadas bajo el enfoque Saber 11. Debe reflejar el nivel de preparación general frente a las exigencias académicas del nivel educativo. ${previousPhaseMetrics ? `Puedes mencionar si hay progreso respecto a ${previousPhaseMetrics.phase}, pero sin puntajes numéricos.` : ''} (100 palabras exactas)`}",
  
  "analisis_competencial": ${isPhase3 ? `"Análisis técnico-institucional del desarrollo de competencias (habilidades) del estudiante en la ${phaseName}, siguiendo el formato de informes oficiales del ICFES. Incluye: análisis por áreas evaluadas, coherencia entre competencias, patrones de desempeño según estándares nacionales. Usa términos técnicos cuando sean necesarios pero explícalos de forma clara. Por ejemplo: 'el estudiante evidencia dominio en...' (muestra buen nivel en...), 'se identifican áreas que requieren fortalecimiento en...' (se necesita mejorar en...). ${previousPhaseMetrics ? `Puedes mencionar la trayectoria académica y evolución del desempeño respecto a ${previousPhaseMetrics.phase}, siempre explicando los términos técnicos.` : ''} (300-400 palabras)"` : `Un OBJETO JSON donde cada clave es el nombre exacto de una materia (${materiasLista}) y el valor es el análisis ESPECÍFICO de esa materia. Debes generar un análisis INDEPENDIENTE para CADA materia.

⚠️ FORMATO REQUERIDO (OBJETO JSON) - FASE II:
${phase === 'second' && previousPhaseMetrics ? `
═══════════════════════════════════════════════════════════════
⚠️ REGLA DE ORO - ESTRUCTURA OBLIGATORIA PARA MATERIAS DÉBILES
═══════════════════════════════════════════════════════════════

Para CADA materia que era débil en Fase I (${previousPhaseMetrics.metrics.materiasDebiles.join(', ')}), la PRIMERA ORACIÓN del análisis DEBE ser EXACTAMENTE una de estas tres opciones, SIN EXCEPCIÓN, SIN VARIACIONES, SIN RODEOS:

✅ OPCIÓN 1 (si mejoró): "El estudiante tuvo una mejora significativa."
✅ OPCIÓN 2 (si presentó una mejora sustancial): "El estudiante presentó una mejora sustancial."
✅ OPCIÓN 3 (si empeoró): "El estudiante presentó un retroceso significativo."

⚠️ PROHIBICIONES ABSOLUTAS:
❌ NO puedes empezar con: "En relación con Fase I...", "Comparado con la fase anterior...", "Respecto a Fase I...", "En [materia], el estudiante muestra...", "El análisis de [materia] indica...", "En [materia], se observa..."
❌ NO puedes usar variaciones: "El estudiante ha mejorado...", "El estudiante mantiene...", "El estudiante presenta mejoras...", "El estudiante evidencia mejoras..."
❌ NO puedes omitir esta declaración
❌ NO puedes usar lenguaje indirecto o ambiguo
❌ NO puedes repetir el nombre de la materia: "El estudiante MEJORÓ en Matemáticas" (INCORRECTO - el nombre de la materia ya está en la clave del JSON)

✅ EJEMPLOS CORRECTOS (PRIMERA ORACIÓN EXACTA):
- "El estudiante tuvo una mejora significativa."
  - "El estudiante presentó una mejora sustancial en su nivel de preparación académica."
- "El estudiante presentó un retroceso significativo."

❌ EJEMPLOS INCORRECTOS (PROHIBIDOS):
- "El estudiante MEJORÓ en Matemáticas." (repite el nombre de la materia)
- "En Matemáticas, el estudiante muestra mejoras respecto a Fase I."
- "Comparado con Fase I, Lenguaje presenta un desempeño similar."
- "Física requiere atención continua, similar a la fase anterior."
- "El estudiante ha mejorado en Matemáticas."

ESTRUCTURA COMPLETA OBLIGATORIA:

⚠️ IMPORTANTE: NO repitas el nombre de la materia en el texto, ya que el nombre de la materia es la CLAVE del objeto JSON. Empieza directamente con la declaración del resultado.

1. PRIMERA ORACIÓN (OBLIGATORIA - SIN EXCEPCIÓN):
   Debe ser EXACTAMENTE: "El estudiante tuvo una mejora significativa." O "El estudiante presentó una mejora sustancial." O "El estudiante presentó un retroceso significativo."
   ❌ NO digas: "El estudiante MEJORÓ en Matemáticas" (el nombre de la materia ya está en la clave del JSON)
   ✅ CORRECTO: "El estudiante tuvo una mejora significativa."
   ✅ CORRECTO: "El estudiante presentó una mejora sustancial."
   ✅ CORRECTO: "El estudiante presentó un retroceso significativo."

2. SEGUNDA ORACIÓN: Explicación del cambio en lenguaje sencillo
   ⚠️ VARIACIÓN OBLIGATORIA: Aunque el mensaje sea el mismo, DEBES variar la forma de expresarlo en cada materia. Usa diferentes estructuras, sinónimos y formas de redacción.
   
   Si mejoró - VARIACIONES POSIBLES (elige diferentes formas para cada materia, INCLUYE FELICITACIONES):
   - "En Fase I tenía un nivel básico (regular) y ahora tiene un nivel alto (bueno). ¡Felicitaciones por este progreso! Su dedicación al estudio y las estrategias de apoyo han sido efectivas."
   - "Su desempeño (rendimiento) evolucionó de básico (regular) a alto (bueno). ¡Excelente trabajo! El esfuerzo y compromiso del estudiante, junto con el plan de estudio personalizado, han dado resultados positivos."
   - "Pasó de un nivel básico (regular) a un nivel alto (bueno). ¡Felicitaciones por este avance significativo! La dedicación del estudiante ha sido clave en este progreso."
   - "El progreso es evidente: de nivel básico (regular) a nivel alto (bueno). ¡Muy bien! El compromiso del estudiante con su proceso de aprendizaje ha sido fundamental para alcanzar estos resultados."
   - "El estudiante presenta una mejora sustancial en su nivel de preparación académica. Su desempeño (rendimiento) evolucionó de básico (regular) a alto (bueno). ¡Excelente trabajo! El esfuerzo y compromiso del estudiante, junto con el plan de estudio personalizado, han dado resultados positivos."
   - "Pasó de un nivel básico (regular) a un nivel alto (bueno). ¡Felicitaciones por este avance significativo! La dedicación del estudiante ha sido clave en este progreso."
   - "El progreso es evidente: de nivel básico (regular) a nivel alto (bueno). ¡Muy bien! El compromiso del estudiante con su proceso de aprendizaje ha sido fundamental para alcanzar estos resultados."
   - "El estudiante presenta una mejora sustancial en su nivel de preparación académica. Su desempeño (rendimiento) evolucionó de básico (regular) a alto (bueno). ¡Excelente trabajo! El esfuerzo y compromiso del estudiante, junto con el plan de estudio personalizado, han dado resultados positivos."
   - "Pasó de un nivel básico (regular) a un nivel alto (bueno). ¡Felicitaciones por este avance significativo! La dedicación del estudiante ha sido clave en este progreso."
   - "El progreso es evidente: de nivel básico (regular) a nivel alto (bueno). ¡Muy bien! El compromiso del estudiante con su proceso de aprendizaje ha sido fundamental para alcanzar estos resultados."
   
   Si presentó una mejora sustancial - VARIACIONES POSIBLES (elige diferentes formas para cada materia, ENFÓCATE EN FALTA DE DEDICACIÓN, NO en fallas del plan):
   - "Se mantiene en nivel básico (regular), lo que indica que requiere mayor dedicación al estudio para poder mejorar. El plan de estudio está disponible, pero necesita más tiempo y esfuerzo del estudiante."
   - "Su desempeño (rendimiento) permanece en nivel básico (regular), señalando que necesita incrementar su dedicación al estudio. Con mayor compromiso y práctica constante, podrá avanzar."
   - "Continúa en nivel básico (regular), evidenciando que requiere más dedicación al estudio. El estudiante debe aumentar su tiempo de práctica y esfuerzo para lograr mejoras."
   - "El nivel básico (regular) se mantiene, lo que sugiere que necesita mayor dedicación al estudio. Es fundamental que el estudiante incremente su compromiso con el proceso de aprendizaje."
   - "El estudiante presenta una mejora sustancial en su nivel de preparación académica. Su desempeño (rendimiento) evolucionó de básico (regular) a alto (bueno). ¡Excelente trabajo! El esfuerzo y compromiso del estudiante, junto con el plan de estudio personalizado, han dado resultados positivos."
   - "Pasó de un nivel básico (regular) a un nivel alto (bueno). ¡Felicitaciones por este avance significativo! La dedicación del estudiante ha sido clave en este progreso."
   - "El progreso es evidente: de nivel básico (regular) a nivel alto (bueno). ¡Muy bien! El compromiso del estudiante con su proceso de aprendizaje ha sido fundamental para alcanzar estos resultados."
   - "El estudiante presenta una mejora sustancial en su nivel de preparación académica. Su desempeño (rendimiento) evolucionó de básico (regular) a alto (bueno). ¡Excelente trabajo! El esfuerzo y compromiso del estudiante, junto con el plan de estudio personalizado, han dado resultados positivos."
   - "Pasó de un nivel básico (regular) a un nivel alto (bueno). ¡Felicitaciones por este avance significativo! La dedicación del estudiante ha sido clave en este progreso."
   - "El progreso es evidente: de nivel básico (regular) a nivel alto (bueno). ¡Muy bien! El compromiso del estudiante con su proceso de aprendizaje ha sido fundamental para alcanzar estos resultados."
   Si empeoró - VARIACIONES POSIBLES (elige diferentes formas para cada materia, ENFÓCATE EN FALTA DE DEDICACIÓN, NO en fallas del plan):
   - "Retrocedió de nivel básico a nivel bajo (necesita mejorar), lo que indica que requiere mayor dedicación al estudio. Es importante que el estudiante incremente su tiempo de práctica y esfuerzo."
   - "Su desempeño (rendimiento) descendió de básico a bajo (necesita mejorar), señalando la necesidad urgente de mayor dedicación al estudio. El estudiante debe comprometerse más con su proceso de aprendizaje."
   - "Pasó de nivel básico a nivel bajo (necesita mejorar), evidenciando que necesita incrementar significativamente su dedicación al estudio. Es fundamental un mayor compromiso y esfuerzo del estudiante."
   - "El estudiante presenta una mejora sustancial en su nivel de preparación académica. Su desempeño (rendimiento) evolucionó de básico (regular) a alto (bueno). ¡Excelente trabajo! El esfuerzo y compromiso del estudiante, junto con el plan de estudio personalizado, han dado resultados positivos."
   - "Pasó de un nivel básico (regular) a un nivel alto (bueno). ¡Felicitaciones por este avance significativo! La dedicación del estudiante ha sido clave en este progreso."
   - "El progreso es evidente: de nivel básico (regular) a nivel alto (bueno). ¡Muy bien! El compromiso del estudiante con su proceso de aprendizaje ha sido fundamental para alcanzar estos resultados."

3. TERCERA ORACIÓN EN ADELANTE: Detalles específicos
   ⚠️ VARIACIÓN OBLIGATORIA: Varía también la forma de expresar los detalles. Usa diferentes estructuras y vocabulario.
   - Menciona temas/competencias específicas que mejoraron, se mantuvieron o empeoraron
   - Si mejoró: Felicita al estudiante y menciona el impacto positivo del plan de estudio:
     * "¡Felicitaciones! Las estrategias de apoyo funcionaron bien en [tema]"
     * "¡Excelente! El plan de estudio mostró efectividad en [tema]"
     * "¡Muy bien! Las actividades personalizadas tuvieron impacto positivo en [tema]"
     * "El estudiante ha demostrado compromiso y ha mejorado en [tema]"
   - Si presentó una mejora sustancial o empeoró: Enfócate en la necesidad de mayor dedicación del estudiante, NO critiques el plan de estudio:
     * "Aún requiere más práctica y dedicación en [tema]"
     * "Persisten dificultades en [tema], lo que indica necesidad de mayor dedicación al estudio"
     * "Sigue presentando desafíos en [tema], requiriendo más tiempo de práctica y esfuerzo del estudiante"
     * "El estudiante necesita incrementar su dedicación y práctica en [tema]"
   - ⚠️ IMPORTANTE: Si presentó una mejora sustancial o empeoró, NO digas que el plan de estudio no funcionó. En su lugar, enfócate en que el estudiante necesita más dedicación, tiempo de práctica y esfuerzo.
   - Usa lenguaje técnico pero accesible, explicando términos cuando sea necesario

EJEMPLOS COMPLETOS CORRECTOS (varía la forma de expresar lo mismo):

SI TUVO UNA MEJORA SIGNIFICATIVA - Ejemplo 1 (Matemáticas):
"El estudiante tuvo una mejora significativa. En Fase I tenía un nivel básico (regular) y ahora tiene un nivel alto (bueno). ¡Felicitaciones por este progreso! Su dedicación al estudio y las estrategias de apoyo han sido efectivas. Específicamente, mejoró en álgebra y resolución de problemas, aunque aún requiere más práctica en geometría. ¡Excelente trabajo en su compromiso con el aprendizaje!"

SI EVIDENCIÓ UNA MEJORA SIGNIFICATIVA - Ejemplo 2 (Lenguaje - VARIACIÓN):
"El estudiante evidencia una mejora significativa. Su desempeño (rendimiento) evolucionó de básico (regular) a alto (bueno). ¡Excelente trabajo! El esfuerzo y compromiso del estudiante, junto con el plan de estudio personalizado, han dado resultados positivos. Los avances son notables en comprensión lectora y análisis textual, mientras que la producción escrita aún necesita refuerzo. ¡Felicitaciones por su dedicación!"

SI PRESENTÓ UNA MEJORA SUSTANCIAL - Ejemplo 1 (Matemáticas):
"se observa una evolución positiva del rendimiento. Se mantiene en nivel básico (regular), lo que indica que requiere mayor dedicación al estudio para poder mejorar. El plan de estudio está disponible, pero necesita más tiempo y esfuerzo del estudiante. Las dificultades en álgebra y geometría persisten, sugiriendo que el estudiante debe incrementar su tiempo de práctica y estudio para lograr avances."

SI PRESENTÓ UNA MEJORA SUSTANCIAL - Ejemplo 2 (Lenguaje - VARIACIÓN):
"El estudiante presenta una mejora sustancial en su nivel de preparación académica. Su desempeño (rendimiento) permanece en nivel básico (regular), señalando que necesita incrementar su dedicación al estudio. Con mayor compromiso y práctica constante, podrá avanzar. Las áreas de comprensión lectora y análisis textual continúan presentando desafíos, lo que requiere un compromiso más intenso del estudiante con su proceso de aprendizaje y más tiempo de práctica."

Mejora progresiva (aunque permanezca en el mismo nivel)

Muy importante para evitar desmotivación.

“Aunque el estudiante se mantiene en el mismo nivel general, se evidencia un progreso interno relevante respecto a la Fase I.”

“Los resultados indican una mejora progresiva del desempeño, acercándose al nivel esperado para su grado.”

“Se identifican avances parciales pero consistentes en el estado académico general del estudiante.”

“El desempeño global muestra una tendencia positiva de mejora, aun sin cambio de nivel.”

C. Mejora moderada / en proceso

Ideal cuando el avance es real pero aún insuficiente.

“El estudiante presenta una mejora moderada en su desempeño general, lo que indica un proceso de avance en curso.”

“Los resultados reflejan un progreso inicial, que requiere consolidación en fases posteriores.”

“Se evidencia una evolución favorable, aunque todavía se mantienen brechas frente al estándar esperado.”

“El desempeño general ha mejorado parcialmente, mostrando señales positivas de avance académico.”

D. Mejora desde una perspectiva formativa (lenguaje motivador)

Recomendado para informes dirigidos directamente al estudiante.

“En comparación con la Fase I, el estudiante ha fortalecido su estado académico general.”

“El proceso desarrollado ha permitido una mejora gradual del rendimiento, sentando bases para un progreso mayor.”

“Los resultados actuales muestran que el estudiante avanza en la dirección adecuada.”

“Se reconoce un proceso de mejora continua, coherente con el trabajo realizado.”
Formas profesionales de expresar “se mantuvo”

(clasificadas por enfoque pedagógico)

A. Estabilidad académica clara

Uso neutro y objetivo, ideal para informes institucionales.

“El estudiante mantiene su desempeño académico general en comparación con la Fase I.”

“Los resultados de la Fase II indican una estabilidad en el nivel general de preparación.”

“No se evidencian cambios significativos en el estado académico global del estudiante.”

“El desempeño general permanece consistente respecto al diagnóstico inicial.”

B. Estabilidad con enfoque formativo (lenguaje positivo)

Recomendado para informes dirigidos al estudiante.

“El estudiante ha sostenido su nivel académico general, consolidando el estado alcanzado en la Fase I.”

“Los resultados reflejan una continuidad en el desempeño, lo que indica estabilidad en el proceso de aprendizaje.”

“Se observa un mantenimiento del estado académico, sobre el cual es posible seguir construyendo mejoras.”

“El desempeño general se mantiene, sentando una base estable para avanzar en fases posteriores.”

C. Estabilidad con necesidad de ajuste

Cuando se requiere intervención, sin usar lenguaje negativo.

“El estudiante mantiene su nivel general, lo que sugiere la necesidad de ajustar la estrategia de estudio para promover avances.”

“La estabilidad observada indica que, aunque no hay retrocesos, se requiere reforzar el proceso de intervención.”

“El desempeño se mantiene frente a la Fase I, evidenciando un progreso aún no consolidado a nivel global.”

“El estado académico permanece estable, lo que señala oportunidades de optimización del plan de estudio.”


⚠️ RECUERDA: Aunque el mensaje sea el mismo (mejoró, se mantuvo, empeoró), DEBES variar la forma de expresarlo en cada materia usando diferentes estructuras, sinónimos y formas de redacción.

═══════════════════════════════════════════════════════════════

` : ''}
{
  "Matemáticas": "${phase === 'second' && previousPhaseMetrics && previousPhaseMetrics.metrics.materiasDebiles.includes('Matemáticas') ? '⚠️ REGLA DE ORO: La PRIMERA ORACIÓN DEBE ser EXACTAMENTE: "El estudiante MEJORÓ." O "El estudiante se MANTUVO." O "El estudiante EMPEORÓ." SIN EXCEPCIÓN. ⚠️ NO repitas el nombre de la materia (ya está en la clave del JSON). ⚠️ VARIACIÓN OBLIGATORIA: Varía la forma de expresar el mismo mensaje usando diferentes estructuras y sinónimos. ⚠️ IMPORTANTE: Si mejoró, INCLUYE FELICITACIONES (ej: "¡Felicitaciones!", "¡Excelente trabajo!"). Si se mantuvo o empeoró, ENFÓCATE en falta de dedicación del estudiante, NO critiques el plan de estudio. Luego explica el cambio en lenguaje sencillo, menciona temas específicos (ej: álgebra, geometría) y evalúa el impacto enfocándote en la dedicación del estudiante o felicitándolo según corresponda. ' : 'Análisis específico SOLO de Matemáticas. Describe el nivel de desempeño actual (Superior/excelente, Alto/bueno, Básico/regular, o Bajo/necesita mejorar), las competencias (habilidades) evaluadas, fortalezas y debilidades ESPECÍFICAS. '}Usa lenguaje técnico pero COMPRENSIBLE: puedes usar "competencias" o "desempeño" pero explícalos (ej: "demuestra competencias sólidas" significa "tiene habilidades bien desarrolladas", "presenta buen desempeño" significa "tiene buen rendimiento"). Menciona temas específicos cuando sea relevante. NO menciones otras materias. (70-100 palabras)",
  "Lenguaje": "${phase === 'second' && previousPhaseMetrics && previousPhaseMetrics.metrics.materiasDebiles.includes('Lenguaje') ? '⚠️ REGLA DE ORO: La PRIMERA ORACIÓN DEBE ser EXACTAMENTE: "El estudiante MEJORÓ." O "El estudiante se MANTUVO." O "El estudiante EMPEORÓ." SIN EXCEPCIÓN. ⚠️ NO repitas el nombre de la materia. ⚠️ VARIACIÓN OBLIGATORIA: Varía la forma de expresar el mismo mensaje. ⚠️ IMPORTANTE: Si mejoró, INCLUYE FELICITACIONES. Si se mantuvo o empeoró, ENFÓCATE en falta de dedicación del estudiante, NO critiques el plan de estudio. Luego explica el cambio en lenguaje sencillo y evalúa enfocándote en la dedicación del estudiante o felicitándolo según corresponda. ' : 'Análisis específico SOLO de Lenguaje. '}Describe el nivel de desempeño, competencias evaluadas, fortalezas y debilidades ESPECÍFICAS. Usa lenguaje técnico pero comprensible, explicando términos cuando sea necesario. Menciona temas específicos cuando sea relevante. NO menciones otras materias. (70-100 palabras)",
  "Ciencias Sociales": "${phase === 'second' && previousPhaseMetrics && previousPhaseMetrics.metrics.materiasDebiles.includes('Ciencias Sociales') ? '⚠️ REGLA DE ORO: La PRIMERA ORACIÓN DEBE ser EXACTAMENTE: "El estudiante MEJORÓ." O "El estudiante se MANTUVO." O "El estudiante EMPEORÓ." SIN EXCEPCIÓN. ⚠️ NO repitas el nombre de la materia. ⚠️ VARIACIÓN OBLIGATORIA: Varía la forma de expresar el mismo mensaje. ⚠️ IMPORTANTE: Si mejoró, INCLUYE FELICITACIONES. Si se mantuvo o empeoró, ENFÓCATE en falta de dedicación del estudiante, NO critiques el plan de estudio. Luego explica el cambio en lenguaje sencillo y evalúa enfocándote en la dedicación del estudiante o felicitándolo según corresponda. ' : 'Análisis específico SOLO de Ciencias Sociales. '}Describe el nivel de desempeño, competencias evaluadas, fortalezas y debilidades ESPECÍFICAS. Usa lenguaje técnico pero comprensible, explicando términos cuando sea necesario. Menciona temas específicos cuando sea relevante. NO menciones otras materias. (70-100 palabras)",
  "Biologia": "${phase === 'second' && previousPhaseMetrics && previousPhaseMetrics.metrics.materiasDebiles.includes('Biologia') ? '⚠️ REGLA DE ORO: La PRIMERA ORACIÓN DEBE ser EXACTAMENTE: "El estudiante MEJORÓ." O "El estudiante se MANTUVO." O "El estudiante EMPEORÓ." SIN EXCEPCIÓN. ⚠️ NO repitas el nombre de la materia. ⚠️ VARIACIÓN OBLIGATORIA: Varía la forma de expresar el mismo mensaje. ⚠️ IMPORTANTE: Si mejoró, INCLUYE FELICITACIONES. Si se mantuvo o empeoró, ENFÓCATE en falta de dedicación del estudiante, NO critiques el plan de estudio. Luego explica el cambio en lenguaje sencillo y evalúa enfocándote en la dedicación del estudiante o felicitándolo según corresponda. ' : 'Análisis específico SOLO de Biología. '}Describe el nivel de desempeño, competencias evaluadas, fortalezas y debilidades ESPECÍFICAS. Usa lenguaje técnico pero comprensible, explicando términos cuando sea necesario. Menciona temas específicos cuando sea relevante. NO menciones otras materias. (70-100 palabras)",
  "Quimica": "${phase === 'second' && previousPhaseMetrics && previousPhaseMetrics.metrics.materiasDebiles.includes('Quimica') ? '⚠️ REGLA DE ORO: La PRIMERA ORACIÓN DEBE ser EXACTAMENTE: "El estudiante MEJORÓ." O "El estudiante se MANTUVO." O "El estudiante EMPEORÓ." SIN EXCEPCIÓN. ⚠️ NO repitas el nombre de la materia. ⚠️ VARIACIÓN OBLIGATORIA: Varía la forma de expresar el mismo mensaje. ⚠️ IMPORTANTE: Si mejoró, INCLUYE FELICITACIONES. Si se mantuvo o empeoró, ENFÓCATE en falta de dedicación del estudiante, NO critiques el plan de estudio. Luego explica el cambio en lenguaje sencillo y evalúa enfocándote en la dedicación del estudiante o felicitándolo según corresponda. ' : 'Análisis específico SOLO de Química. '}Describe el nivel de desempeño, competencias evaluadas, fortalezas y debilidades ESPECÍFICAS. Usa lenguaje técnico pero comprensible, explicando términos cuando sea necesario. Menciona temas específicos cuando sea relevante. NO menciones otras materias. (70-100 palabras)",
  "Física": "${phase === 'second' && previousPhaseMetrics && previousPhaseMetrics.metrics.materiasDebiles.includes('Física') ? '⚠️ REGLA DE ORO: La PRIMERA ORACIÓN DEBE ser EXACTAMENTE: "El estudiante MEJORÓ." O "El estudiante se MANTUVO." O "El estudiante EMPEORÓ." SIN EXCEPCIÓN. ⚠️ NO repitas el nombre de la materia. ⚠️ VARIACIÓN OBLIGATORIA: Varía la forma de expresar el mismo mensaje. ⚠️ IMPORTANTE: Si mejoró, INCLUYE FELICITACIONES. Si se mantuvo o empeoró, ENFÓCATE en falta de dedicación del estudiante, NO critiques el plan de estudio. Luego explica el cambio en lenguaje sencillo y evalúa enfocándote en la dedicación del estudiante o felicitándolo según corresponda. ' : 'Análisis específico SOLO de Física. '}Describe el nivel de desempeño, competencias evaluadas, fortalezas y debilidades ESPECÍFICAS. Usa lenguaje técnico pero comprensible, explicando términos cuando sea necesario. Menciona temas específicos cuando sea relevante. NO menciones otras materias. (70-100 palabras)",
  "Inglés": "${phase === 'second' && previousPhaseMetrics && previousPhaseMetrics.metrics.materiasDebiles.includes('Inglés') ? '⚠️ REGLA DE ORO: La PRIMERA ORACIÓN DEBE ser EXACTAMENTE: "El estudiante MEJORÓ." O "El estudiante se MANTUVO." O "El estudiante EMPEORÓ." SIN EXCEPCIÓN. ⚠️ NO repitas el nombre de la materia. ⚠️ VARIACIÓN OBLIGATORIA: Varía la forma de expresar el mismo mensaje. ⚠️ IMPORTANTE: Si mejoró, INCLUYE FELICITACIONES. Si se mantuvo o empeoró, ENFÓCATE en falta de dedicación del estudiante, NO critiques el plan de estudio. Luego explica el cambio en lenguaje sencillo y evalúa enfocándote en la dedicación del estudiante o felicitándolo según corresponda. ' : 'Análisis específico SOLO de Inglés enfocado en el NIVEL ACADÉMICO según el Marco Común Europeo de Referencia (MCER). '}⚠️ CRÍTICO: Identifica el nivel MCER del estudiante (A1, A2, B1, B2, C1 o C2) basándote en su desempeño general y explícalo de forma sencilla (ej: "se encuentra en nivel B1, que significa que puede comunicarse en situaciones cotidianas", "presenta un nivel A2, indicando competencia básica en el idioma"). NO menciones "pruebas del 1 al 7", "prueba 1", "prueba 2", ni ninguna referencia numérica a pruebas. Describe fortalezas y debilidades en términos de competencias del idioma (comprensión, expresión, etc.) y nivel MCER. Usa lenguaje técnico pero comprensible, explicando términos cuando sea necesario. NO menciones otras materias. (70-100 palabras)"
}

⚠️ REGLAS CRÍTICAS PARA FASE II:
- ⚠️ OBLIGATORIO: Incluye TODAS las materias: ${materiasLista}
- ${phase === 'second' && previousPhaseMetrics ? `⚠️ REGLA DE ORO: Para materias débiles de Fase I (${previousPhaseMetrics.metrics.materiasDebiles.join(', ')}), PRIMERA ORACIÓN debe ser EXACTAMENTE: "El estudiante MEJORÓ." O "El estudiante se MANTUVO." O "El estudiante EMPEORÓ." SIN EXCEPCIÓN. ⚠️ NO repitas el nombre de la materia (ya está en la clave del JSON). ⚠️ IMPORTANTE: Si mejoró, INCLUYE FELICITACIONES al estudiante. Si se mantuvo o empeoró, ENFÓCATE en falta de dedicación del estudiante, NO critiques el plan de estudio.` : ''}
- ⚠️ VARIACIÓN OBLIGATORIA - CRÍTICO: Aunque el mensaje sea el mismo (mejoró, se mantuvo, empeoró), DEBES variar la forma de expresarlo en cada materia. 
  ✅ VARIACIONES PERMITIDAS:
  * Diferentes estructuras de oraciones (activa, pasiva, con gerundios, etc.)
  * Sinónimos variados: "evolucionó" vs "pasó de" vs "mejoró de", "permanece" vs "se mantiene" vs "continúa"
  * Diferentes conectores: "lo que muestra" vs "evidenciando" vs "demostrando" vs "confirmando"
  * Variar el orden de la información
  * Usar diferentes formas de expresar conceptos similares
  ❌ PROHIBIDO: Usar las mismas frases exactas en diferentes materias. Cada materia debe tener su propia forma única de expresar el mismo concepto.
- ⚠️ EVITA REDUNDANCIAS: NO repitas la misma información en diferentes secciones. Cada sección debe aportar información ÚNICA.
- Sé CONCISO: 70-100 palabras por materia, sin repetir conceptos ya mencionados.
- Usa lenguaje técnico pero explícalo: "competencias (habilidades)", "desempeño (rendimiento)"
- Menciona temas específicos cuando sea relevante
- ⚠️ INGLÉS: Enfócate en nivel MCER (A1-C2), NO menciones "pruebas del 1 al 7"`},
  
  "fortalezas_academicas": [
    "${isPhase3 ? `Competencia o área evaluada donde el estudiante evidencia desempeño favorable según estándares ICFES (redactada en términos técnico-institucionales)` : `Competencia o habilidad 1 donde el estudiante muestra desempeño favorable en ${phaseName} (redactada en términos competenciales)`}",
    "${isPhase3 ? `Competencia o área evaluada 2...` : `Competencia o habilidad 2...`}",
    "..."
  ],
  
  "aspectos_por_mejorar": [
    "${isPhase3 ? `Área o competencia que requiere fortalecimiento según estándares nacionales del ICFES, con lenguaje institucional constructivo` : `Área o competencia 1 que requiere fortalecimiento en ${phaseName} (lenguaje constructivo y orientado al aprendizaje)`}",
    "${isPhase3 ? `Área o competencia 2...` : `Área o competencia 2...`}",
    "..."
  ],
  
  "recomendaciones_enfoque_saber11": [
    "${isPhase3 ? `Recomendación institucional 1 basada en estándares ICFES y alineada con las políticas educativas nacionales, considerando el desempeño en ${phaseName}` : `Sugerencia pedagógica 1 alineada con desarrollo de competencias y práctica tipo Saber 11, considerando el desempeño en ${phaseName}`}",
    "${isPhase3 ? `Recomendación institucional 2...` : `Sugerencia pedagógica 2...`}",
    "..."
  ]${phase === 'first' ? `,
  
  "justificacion_pedagogica": {
    "contenidos_prioritarios": [
      {
        "materia": "Nombre de la materia",
        "tema": "Nombre del tema/competencia",
        "justificacion": "Explicación pedagógica clara de POR QUÉ se prioriza este contenido. Debe fundamentarse en: severidad de la debilidad (estructural vs leve), impacto en el aprendizaje futuro, relación con estándares del grado, y patrones de tiempo identificados. (40-60 palabras)",
        "tipo_actividad_recomendada": "Descripción específica del tipo de actividad más efectiva según el patrón identificado (impulsividad, dificultad cognitiva, debilidad estructural o leve). (20-30 palabras)"
      }
    ],
    "estrategias_por_patron": {
      ${globalMetrics.patronesGlobalesTiempo && globalMetrics.patronesGlobalesTiempo.porcentajeImpulsividad > 10 ? `"impulsividad": [
        "Estrategia 1 para trabajar la impulsividad (ej: actividades que promuevan reflexión y verificación)",
        "Estrategia 2..."
      ],` : ''}
      ${globalMetrics.patronesGlobalesTiempo && globalMetrics.patronesGlobalesTiempo.porcentajeDificultadCognitiva > 10 ? `"dificultad_cognitiva": [
        "Estrategia 1 para trabajar la dificultad cognitiva (ej: actividades con más apoyo y explicaciones paso a paso)",
        "Estrategia 2..."
      ],` : ''}
      ${globalMetrics.debilidadesEstructurales.length > 0 ? `"debilidades_estructurales": [
        "Estrategia 1 para debilidades estructurales (ej: actividades de nivelación y construcción de bases sólidas)",
        "Estrategia 2..."
      ],` : ''}
      ${globalMetrics.debilidadesLeves.length > 0 ? `"debilidades_leves": [
        "Estrategia 1 para debilidades leves (ej: actividades de refuerzo y práctica dirigida)",
        "Estrategia 2..."
      ]` : ''}
    }
  }` : ''}
}

═══════════════════════════════════════════════════════════════

Genera el JSON con tu análisis completo de ${phaseName} ahora:`;
  }

  /**
   * Verifica si el estudiante tiene las 7 evaluaciones completadas para una fase
   */
  async hasAllEvaluations(studentId: string, phase: 'first' | 'second' | 'third'): Promise<boolean> {
    try {
      const evaluations = await this.getStudentEvaluations(studentId, phase);
      const normalized = this.normalizeEvaluationResults(evaluations);
      
      // Verificar que tenga las 7 materias
      const materiasPresentes = new Set(normalized.map(r => r.materia));
      return ALL_SUBJECTS.every(subject => materiasPresentes.has(subject));
    } catch (error: any) {
      console.error('Error verificando evaluaciones:', error);
      return false;
    }
  }

  /**
   * Verifica si ya existe un resumen vigente para el estudiante en una fase
   */
  private async hasExistingSummary(studentId: string, phase: 'first' | 'second' | 'third'): Promise<boolean> {
    try {
      const studentDb = getStudentDatabase();
      const summaryRef = studentDb
        .collection('ResumenStudent')
        .doc(studentId)
        .collection(phase)
        .doc('resumenActual');
      
      const snapshot = await summaryRef.get();
      return snapshot.exists;
    } catch (error: any) {
      console.warn('Error verificando resumen existente:', error.message);
      return false;
    }
  }

  /**
   * Guarda el resumen en Firestore
   * Estructura: ResumenStudent/{studentId}/{phase}/resumenActual
   * Donde phase es: 'first', 'second', o 'third'
   */
  private async saveSummary(summary: PersistedSummary): Promise<void> {
    try {
      const studentDb = getStudentDatabase();
      
      // Limpiar resúmenes antiguos de la estructura anterior (si existen)
      // Estructura antigua: ResumenStudent/{studentId}/resumenActual/{docId}
      await this.cleanOldSummaryStructure(summary.studentId);
      
      // Guardar resumen por fase en la nueva estructura
      // Estructura nueva: ResumenStudent/{studentId}/{phase}/resumenActual
      const summaryRef = studentDb
        .collection('ResumenStudent')
        .doc(summary.studentId)
        .collection(summary.phase)
        .doc('resumenActual');
      
      await summaryRef.set({
        ...summary,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      
      console.log(`✅ Resumen guardado en: ResumenStudent/${summary.studentId}/${summary.phase}/resumenActual`);
    } catch (error: any) {
      console.error('Error guardando resumen:', error);
      throw error;
    }
  }

  /**
   * Limpia resúmenes de la estructura antigua
   * Estructura antigua: ResumenStudent/{studentId}/resumenActual/{docId}
   */
  private async cleanOldSummaryStructure(studentId: string): Promise<void> {
    try {
      const studentDb = getStudentDatabase();
      const oldRef = studentDb
        .collection('ResumenStudent')
        .doc(studentId)
        .collection('resumenActual');
      
      const oldSnap = await oldRef.get();
      if (!oldSnap.empty) {
        const batch = studentDb.batch();
        oldSnap.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`   🧹 Limpiados ${oldSnap.docs.length} resúmenes de la estructura antigua`);
      }
    } catch (error: any) {
      // No es crítico si falla la limpieza, solo loguear
      console.warn('⚠️ No se pudo limpiar estructura antigua (puede que no exista):', error.message);
    }
  }

  /**
   * Genera y guarda el resumen académico completo para una fase específica
   */
  async generateSummary(studentId: string, phase: 'first' | 'second' | 'third', force: boolean = false): Promise<SummaryGenerationResult> {
    const startTime = Date.now();
    
    try {
      console.log(`\n📊 Iniciando generación de resumen para estudiante: ${studentId}, fase: ${phase}`);
      
      // Verificar que existan las 7 evaluaciones para esta fase
      const hasAll = await this.hasAllEvaluations(studentId, phase);
      if (!hasAll) {
        return {
          success: false,
          error: `El estudiante no ha completado las 7 evaluaciones requeridas para ${phase === 'first' ? 'Fase I' : phase === 'second' ? 'Fase II' : 'Fase III'}`,
        };
      }
      
      // Verificar si ya existe un resumen (a menos que sea forzado)
      if (!force) {
        const hasExisting = await this.hasExistingSummary(studentId, phase);
        if (hasExisting) {
          return {
            success: false,
            error: `Ya existe un resumen vigente para esta fase. Usa force=true para regenerarlo.`,
          };
        }
      }
      
      // Obtener evaluaciones de la fase específica
      const evaluations = await this.getStudentEvaluations(studentId, phase);
      console.log(`   📝 Evaluaciones encontradas: ${evaluations.length}`);
      
      // FASE 1.1 - Normalizar resultados
      const normalizedResults = this.normalizeEvaluationResults(evaluations);
      console.log(`   ✅ Resultados normalizados: ${normalizedResults.length} materias`);
      
      // FASE 1.2 - Calcular métricas globales
      const globalMetrics = this.calculateGlobalMetrics(normalizedResults);
      console.log(`   ✅ Métricas globales calculadas`);
      
      // Obtener contexto académico
      const academicContext = await this.getAcademicContext(studentId);
      console.log(`   ✅ Contexto académico obtenido`);
      
      // Generar resumen con IA
      console.log(`   🤖 Generando resumen con IA para ${phase === 'first' ? 'Fase I' : phase === 'second' ? 'Fase II' : 'Fase III'}...`);
      console.log(`   📊 Datos de evaluación procesados: ${normalizedResults.length} materias de SOLO ${phase === 'first' ? 'Fase I' : phase === 'second' ? 'Fase II' : 'Fase III'}`);
      const academicSummary = await this.generateSummaryWithAI(
        normalizedResults,
        globalMetrics,
        academicContext,
        phase,
        studentId
      );
      console.log(`   ✅ Resumen generado con IA`);
      
      // Preparar resumen para guardar
      const persistedSummary: PersistedSummary = {
        studentId,
        phase,
        fecha: new Date().toISOString().split('T')[0],
        version: 'v1',
        fuente: 'IA',
        resumen: academicSummary,
        metadata: {
          materiasAnalizadas: normalizedResults.length,
          modeloIA: GEMINI_CONFIG.MODEL_NAME,
        },
        contextoAcademico: academicContext,
        metricasGlobales: globalMetrics,
      };
      
      // Guardar en Firestore
      await this.saveSummary(persistedSummary);
      console.log(`   ✅ Resumen guardado en Firestore`);
      
      const processingTime = Date.now() - startTime;
      
      return {
        success: true,
        summary: persistedSummary,
        processingTimeMs: processingTime,
      };
    } catch (error: any) {
      console.error('Error generando resumen:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido',
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Obtiene el resumen vigente de un estudiante para una fase específica
   */
  async getSummary(studentId: string, phase: 'first' | 'second' | 'third'): Promise<PersistedSummary | null> {
    try {
      const studentDb = getStudentDatabase();
      const summaryRef = studentDb
        .collection('ResumenStudent')
        .doc(studentId)
        .collection(phase)
        .doc('resumenActual');
      
      const snapshot = await summaryRef.get();
      
      if (!snapshot.exists) {
        return null;
      }
      
      return snapshot.data() as PersistedSummary;
    } catch (error: any) {
      console.error('Error obteniendo resumen:', error);
      return null;
    }
  }
}

// Exportar instancia singleton
export const studentSummaryService = new StudentSummaryService();

export default studentSummaryService;


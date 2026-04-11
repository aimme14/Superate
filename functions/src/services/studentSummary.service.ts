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

import { GEMINI_CONFIG } from '../config/gemini.config';
import * as admin from 'firebase-admin';
import { getStudentDatabase } from '../utils/firestoreHelpers';
import { geminiCentralizedService } from './geminiService';
import {
  buildPhase1Prompt,
  buildPhase2Prompt,
  buildPhase3Prompt,
  type MateriaPhase1Payload,
  type MateriaPhase23Payload,
  type PromptGlobalMetrics,
  type PreviousPhaseBundle,
} from './studentSummaryPromptBuilders';

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
              const context: AcademicContext = {};
              
              // Obtener nombre del grado desde la institución si solo tenemos gradeId
              let gradeName = userData?.gradeName;
              const gradeId = userData?.gradeId || userData?.grade;
              
              // Si no hay gradeName pero sí hay gradeId, intentar obtenerlo de la institución
              if (!gradeName && gradeId && institutionId) {
                try {
                  const institutionRef = studentDb
                    .collection('superate')
                    .doc('auth')
                    .collection('institutions')
                    .doc(institutionId);
                  const institutionSnap = await institutionRef.get();
                  
                  if (institutionSnap.exists) {
                    const institutionData = institutionSnap.data();
                    const campusId = userData?.campusId || userData?.campus;
                    
                    // Buscar el grado en los campus de la institución
                    if (institutionData?.campuses && Array.isArray(institutionData.campuses)) {
                      for (const campus of institutionData.campuses) {
                        // Si hay campusId, buscar solo en ese campus
                        if (campusId && campus.id !== campusId) {
                          continue;
                        }
                        
                        if (campus.grades && Array.isArray(campus.grades)) {
                          const grade = campus.grades.find((g: any) => g.id === gradeId);
                          if (grade && grade.name) {
                            gradeName = grade.name;
                            console.log(`✅ Nombre de grado obtenido desde institución: ${gradeName}`);
                            break;
                          }
                        }
                      }
                    }
                  }
                } catch (error: any) {
                  console.warn(`⚠️ Error obteniendo nombre de grado desde institución: ${error.message}`);
                }
              }
              
              // Usar gradeName si está disponible, sino usar grade (puede ser ID o nombre)
              if (gradeName) {
                context.grado = gradeName;
                context.nivel = gradeName;
              } else if (userData?.grade) {
                // Si grade parece ser un ID técnico (contiene guiones y números largos), no usarlo
                const gradeValue = userData.grade;
                const isTechnicalId = /^[a-zA-Z0-9]+-\d+-\d+$/.test(gradeValue);
                if (!isTechnicalId) {
                  context.grado = gradeValue;
                  context.nivel = gradeValue;
                }
              }
              
              if (institutionId) {
                context.institutionId = institutionId;
              }
              if (userData?.campusId || userData?.campus) {
                context.sedeId = userData?.campusId || userData?.campus;
              }
              if (gradeId) {
                context.gradeId = gradeId;
              }
              
              return context;
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
        const context: AcademicContext = {};
        
        // Obtener nombre del grado desde la institución si solo tenemos gradeId
        let gradeName = userData?.gradeName;
        const gradeId = userData?.gradeId || userData?.grade;
        const institutionId = userData?.inst || userData?.institutionId;
        
        // Si no hay gradeName pero sí hay gradeId, intentar obtenerlo de la institución
        if (!gradeName && gradeId && institutionId) {
          try {
            const institutionRef = studentDb
              .collection('superate')
              .doc('auth')
              .collection('institutions')
              .doc(institutionId);
            const institutionSnap = await institutionRef.get();
            
            if (institutionSnap.exists) {
              const institutionData = institutionSnap.data();
              const campusId = userData?.campusId || userData?.campus;
              
              // Buscar el grado en los campus de la institución
              if (institutionData?.campuses && Array.isArray(institutionData.campuses)) {
                for (const campus of institutionData.campuses) {
                  // Si hay campusId, buscar solo en ese campus
                  if (campusId && campus.id !== campusId) {
                    continue;
                  }
                  
                  if (campus.grades && Array.isArray(campus.grades)) {
                    const grade = campus.grades.find((g: any) => g.id === gradeId);
                    if (grade && grade.name) {
                      gradeName = grade.name;
                      console.log(`✅ Nombre de grado obtenido desde institución: ${gradeName}`);
                      break;
                    }
                  }
                }
              }
            }
          } catch (error: any) {
            console.warn(`⚠️ Error obteniendo nombre de grado desde institución: ${error.message}`);
          }
        }
        
        // Usar gradeName si está disponible, sino usar grade (puede ser ID o nombre)
        if (gradeName) {
          context.grado = gradeName;
          context.nivel = gradeName;
        } else if (userData?.grade) {
          // Si grade parece ser un ID técnico (contiene guiones y números largos), no usarlo
          const gradeValue = userData.grade;
          const isTechnicalId = /^[a-zA-Z0-9]+-\d+-\d+$/.test(gradeValue);
          if (!isTechnicalId) {
            context.grado = gradeValue;
            context.nivel = gradeValue;
          }
        }
        
        if (institutionId) {
          context.institutionId = institutionId;
        }
        if (userData?.campusId || userData?.campus) {
          context.sedeId = userData?.campusId || userData?.campus;
        }
        if (gradeId) {
          context.gradeId = gradeId;
        }
        
        return context;
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
      const result = await geminiCentralizedService.generateContent({
        userId: studentId,
        prompt,
        processName: 'student_summary',
        images: [],
        options: {
          timeout: GEMINI_CONFIG.GENERATION_SUMMARY_AND_PLAN_TIMEOUT_MS,
        },
      });
      
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

  /** Convierte métricas internas al tipo usado por los builders de prompt */
  private toPromptGlobalMetrics(gm: GlobalMetrics): PromptGlobalMetrics {
    return {
      nivelGeneralDesempeno: String(gm.nivelGeneralDesempeno),
      materiasFuertes: gm.materiasFuertes,
      materiasDebiles: gm.materiasDebiles,
      debilidadesLeves: gm.debilidadesLeves,
      debilidadesEstructurales: gm.debilidadesEstructurales,
      patronesGlobalesTiempo: gm.patronesGlobalesTiempo,
    };
  }

  /**
   * Solo materia + nivel cualitativo + competencias/temas con nivel cualitativo (Fase II/III al modelo).
   */
  private toMateriaPhase23Payload(r: NormalizedEvaluationResult): MateriaPhase23Payload {
    return {
      materia: r.materia,
      nivel: String(r.nivel),
      competencias: { ...r.competencias },
    };
  }

  /**
   * Bloques contextuales para Fase II (comparación con la fase anterior).
   */
  private buildPhase2ComparativeSections(
    previousPhaseMetrics: {
      phase: string;
      metrics: GlobalMetrics;
      fullSummary?: PersistedSummary;
    } | null,
    normalizedResults: NormalizedEvaluationResult[]
  ): { comparativeContextBlock: string; phase1AnalysisBlock: string } {
    if (!previousPhaseMetrics) {
      return { comparativeContextBlock: '', phase1AnalysisBlock: '' };
    }

    const phase2MateriaLevels: { [key: string]: string } = {};
    normalizedResults.forEach((r) => {
      phase2MateriaLevels[r.materia] = String(r.nivel);
    });

    const temasDebilesPorMateria: { [materia: string]: string[] } = {};
    (previousPhaseMetrics.metrics.temasDebiles ?? []).forEach(({ materia, tema }) => {
      if (!temasDebilesPorMateria[materia]) {
        temasDebilesPorMateria[materia] = [];
      }
      temasDebilesPorMateria[materia].push(tema);
    });

    let phase1AnalysisBlock = '';
    if (previousPhaseMetrics.fullSummary?.resumen) {
      const phase1Resumen = previousPhaseMetrics.fullSummary.resumen;
      let analisisCompetencialFase1 = '';
      if (typeof phase1Resumen.analisis_competencial === 'object' && phase1Resumen.analisis_competencial !== null) {
        analisisCompetencialFase1 = Object.entries(phase1Resumen.analisis_competencial)
          .map(([materia, analisis]) => `**${materia}**:\n${analisis}`)
          .join('\n\n');
      } else if (typeof phase1Resumen.analisis_competencial === 'string') {
        analisisCompetencialFase1 = phase1Resumen.analisis_competencial;
      }
      phase1AnalysisBlock = `
═══════════════════════════════════════════════════════════════
📋 ANÁLISIS COMPLETO DE ${previousPhaseMetrics.phase} (referencia IA)
═══════════════════════════════════════════════════════════════
**RESUMEN GENERAL — ${previousPhaseMetrics.phase}:**
${phase1Resumen.resumen_general || 'No disponible'}

**ANÁLISIS COMPETENCIAL — ${previousPhaseMetrics.phase}:**
${analisisCompetencialFase1 || 'No disponible'}

**FORTALEZAS — ${previousPhaseMetrics.phase}:**
${phase1Resumen.fortalezas_academicas?.length ? phase1Resumen.fortalezas_academicas.map((f) => `- ${f}`).join('\n') : 'Ninguna'}

**ASPECTOS POR MEJORAR — ${previousPhaseMetrics.phase}:**
${phase1Resumen.aspectos_por_mejorar?.length ? phase1Resumen.aspectos_por_mejorar.map((a) => `- ${a}`).join('\n') : 'Ninguno'}
${phase1Resumen.justificacion_pedagogica?.contenidos_prioritarios?.length ? `
**CONTENIDOS PRIORITARIOS — ${previousPhaseMetrics.phase}:**
${phase1Resumen.justificacion_pedagogica.contenidos_prioritarios
  .map((cp) => `- **${cp.materia} - ${cp.tema}**: ${cp.justificacion}`)
  .join('\n')}
` : ''}
`;
    }

    const materiasDebilesPrev = previousPhaseMetrics.metrics.materiasDebiles ?? [];
    const compDetail =
      materiasDebilesPrev.length > 0
        ? `\n📊 Comparación ${previousPhaseMetrics.phase} → Fase II (materias débiles en ${previousPhaseMetrics.phase}):\n\n${materiasDebilesPrev
            .map((materia) => {
              const nivelFase2 = phase2MateriaLevels[materia] || 'No evaluada';
              const temasDebiles = temasDebilesPorMateria[materia] || [];
              const temasTexto =
                temasDebiles.length > 0
                  ? `\n  • Temas débiles en ${previousPhaseMetrics.phase}: ${temasDebiles.join(', ')}`
                  : '';
              return `- **${materia}**: Nivel en Fase II: ${nivelFase2}${temasTexto}`;
            })
            .join('\n\n')}`
        : '\n- No hubo materias marcadas como débiles en la fase anterior.';

    const debEstruct =
      previousPhaseMetrics.metrics.debilidadesEstructurales?.length
        ? `\n⚠️ Debilidades estructurales en ${previousPhaseMetrics.phase}:\n${previousPhaseMetrics.metrics.debilidadesEstructurales.map((d) => `- ${d.materia} - ${d.tema}`).join('\n')}`
        : '';
    const debLeves =
      previousPhaseMetrics.metrics.debilidadesLeves?.length
        ? `\n📋 Debilidades leves en ${previousPhaseMetrics.phase}:\n${previousPhaseMetrics.metrics.debilidadesLeves.map((d) => `- ${d.materia} - ${d.tema}`).join('\n')}`
        : '';

    const comparativeContextBlock = `
═══════════════════════════════════════════════════════════════
CONTEXTO COMPARATIVO — ${previousPhaseMetrics.phase}
═══════════════════════════════════════════════════════════════
- Nivel general en ${previousPhaseMetrics.phase}: ${previousPhaseMetrics.metrics.nivelGeneralDesempeno}
- Materias favorables: ${(previousPhaseMetrics.metrics.materiasFuertes ?? []).join(', ') || 'Ninguna'}
- Materias a fortalecer: ${materiasDebilesPrev.join(', ') || 'Ninguna'}
${compDetail}
${debEstruct}
${debLeves}

⚠️ Usa este contexto solo como referencia; el análisis principal debe basarse en los resultados de Fase II mostrados abajo. Sin puntajes numéricos explícitos en la redacción final.
`;

    return { comparativeContextBlock, phase1AnalysisBlock };
  }

  /** Trayectoria Fase I → II → III para prompts de Fase III */
  private buildPhase3TrajectoryBlock(phase3PreviousPhases: {
    phase1: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
    phase2: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
  }): string {
    let phase1Section = '';
    if (phase3PreviousPhases.phase1?.fullSummary?.resumen) {
      const r = phase3PreviousPhases.phase1.fullSummary.resumen;
      phase1Section = `
📌 ${phase3PreviousPhases.phase1.phase}
Resumen: ${r.resumen_general || 'N/D'}
Métricas: nivel ${phase3PreviousPhases.phase1.metrics.nivelGeneralDesempeno}; fuertes: ${phase3PreviousPhases.phase1.metrics.materiasFuertes.join(', ') || '—'}; débiles: ${phase3PreviousPhases.phase1.metrics.materiasDebiles.join(', ') || '—'}
Fortalezas: ${r.fortalezas_academicas?.length ? r.fortalezas_academicas.map((x) => `- ${x}`).join('\n') : '—'}
A mejorar: ${r.aspectos_por_mejorar?.length ? r.aspectos_por_mejorar.map((x) => `- ${x}`).join('\n') : '—'}
`;
    }
    let phase2Section = '';
    if (phase3PreviousPhases.phase2?.fullSummary?.resumen) {
      const r = phase3PreviousPhases.phase2.fullSummary.resumen;
      phase2Section = `
📌 ${phase3PreviousPhases.phase2.phase}
Resumen: ${r.resumen_general || 'N/D'}
Métricas: nivel ${phase3PreviousPhases.phase2.metrics.nivelGeneralDesempeno}; fuertes: ${phase3PreviousPhases.phase2.metrics.materiasFuertes.join(', ') || '—'}; débiles: ${phase3PreviousPhases.phase2.metrics.materiasDebiles.join(', ') || '—'}
Fortalezas: ${r.fortalezas_academicas?.length ? r.fortalezas_academicas.map((x) => `- ${x}`).join('\n') : '—'}
A mejorar: ${r.aspectos_por_mejorar?.length ? r.aspectos_por_mejorar.map((x) => `- ${x}`).join('\n') : '—'}
`;
    }
    return `
═══════════════════════════════════════════════════════════════
TRAYECTORIA Fase I → Fase II → Fase III
═══════════════════════════════════════════════════════════════
${phase1Section}
${phase2Section}
Integra trayectoria y estado actual para Saber 11, sin citar puntajes numéricos explícitos.
`;
  }

  private toPreviousPhaseBundle(
    p: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null
  ): PreviousPhaseBundle {
    if (!p) {
      return {
        phase: 'Fase I',
        metrics: {
          nivelGeneralDesempeno: '',
          materiasFuertes: [],
          materiasDebiles: [],
          debilidadesLeves: [],
          debilidadesEstructurales: [],
        },
      };
    }
    return {
      phase: p.phase,
      metrics: this.toPromptGlobalMetrics(p.metrics),
      fullSummary: p.fullSummary ? { resumen: p.fullSummary.resumen } : undefined,
    };
  }

  /**
   * Construye el prompt para la IA (builders independientes por fase).
   */
  private async buildSummaryPrompt(
    normalizedResults: NormalizedEvaluationResult[],
    globalMetrics: GlobalMetrics,
    academicContext: AcademicContext,
    phase: 'first' | 'second' | 'third',
    studentId: string
  ): Promise<string> {
    const materiasLista = normalizedResults.map((r) => r.materia).join(', ');
    const gm = this.toPromptGlobalMetrics(globalMetrics);

    if (phase === 'first') {
      const materiasData: MateriaPhase1Payload[] = normalizedResults.map((r) => ({
        materia: r.materia,
        nivel: String(r.nivel),
        puntaje: r.puntaje,
        competencias: r.competencias,
        temasDetallados: r.temasDetallados.map((t) => ({
          tema: t.tema,
          puntaje: t.puntaje,
          nivel: String(t.nivel),
          totalPreguntas: t.totalPreguntas,
          correctas: t.correctas,
          tiempoPromedioSegundos: t.tiempoPromedioSegundos,
          patronTiempo: t.patronTiempo,
        })),
        tiempoPromedioPorPregunta: r.tiempoPromedioPorPregunta,
        patronesTiempo: r.patronesTiempo,
      }));
      return buildPhase1Prompt({
        materiasData,
        globalMetrics: gm,
        academicContext,
        materiasLista,
      });
    }

    if (phase === 'second') {
      const materiasData: MateriaPhase23Payload[] = normalizedResults.map((r) =>
        this.toMateriaPhase23Payload(r)
      );
      const previousPhaseMetrics = await this.getPreviousPhaseMetrics(studentId, phase);
      const { comparativeContextBlock, phase1AnalysisBlock } = this.buildPhase2ComparativeSections(
        previousPhaseMetrics,
        normalizedResults
      );
      const previousBundle = this.toPreviousPhaseBundle(previousPhaseMetrics);
      return buildPhase2Prompt({
        materiasData,
        globalMetrics: gm,
        academicContext,
        materiasLista,
        previousPhase: previousBundle,
        comparativeContextBlock,
        phase1AnalysisBlock,
      });
    }

    const materiasData: MateriaPhase23Payload[] = normalizedResults.map((r) =>
      this.toMateriaPhase23Payload(r)
    );
    const phase3PreviousPhases = await this.getAllPreviousPhasesForPhase3(studentId);
    const trajectoryBlock = this.buildPhase3TrajectoryBlock(phase3PreviousPhases);
    return buildPhase3Prompt({
      materiasData,
      globalMetrics: gm,
      academicContext,
      materiasLista,
      trajectoryBlock,
    });
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
  /**
   * Elimina propiedades undefined de un objeto recursivamente
   * Firestore no acepta valores undefined
   */
  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          if (value !== undefined) {
            cleaned[key] = this.removeUndefinedValues(value);
          }
        }
      }
      return cleaned;
    }
    
    return obj;
  }

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
      
      // Limpiar valores undefined antes de guardar (Firestore no los acepta)
      const cleanedSummary = this.removeUndefinedValues(summary);
      
      await summaryRef.set({
        ...cleanedSummary,
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


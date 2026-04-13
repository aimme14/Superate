/**
 * Servicio de Resumen Académico del Estudiante
 *
 * Genera resúmenes académicos estilo ICFES/Saber 11 con IA
 * basados en los resultados de las 7 evaluaciones del estudiante.
 *
 * CAMBIOS v2 (métricas y persistencia):
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. `calculateGlobalMetrics`: un solo origen para % impulsividad / dificultad cognitiva
 *    global — `NormalizedEvaluationResult.patronesTiempo` por evaluación. Se eliminó
 *    la doble suma que mezclaba `temasDetallados.patronTiempo` con heurística 30%.
 *
 * 2. `normalizeEvaluationResults`: contadores enteros para preguntas rápidas/lentas
 *    incorrectas; `patronesTiempo` por materia deriva de esos contadores / total.
 *
 * 3. `removeUndefinedValues`: además de quitar `undefined`, convierte `NaN` e
 *    `Infinity` en `null` (Firestore no los soporta bien en todos los contextos).
 *
 * 4. Documentos nuevos usan `version: 'v2'`. Parser IA: `sintesis_institucional` opcional.
 * ─────────────────────────────────────────────────────────────────────────────
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
  /** Puntaje por materia (0–100) para informes/PDF; añadido en v2 */
  resumenPorMateria?: { materia: string; puntaje: number; nivel: PerformanceLevel }[];
  // Métricas adicionales para diagnóstico pedagógico
  debilidadesLeves: { materia: string; tema: string; puntaje: number }[]; // 35-39% (cerca de Básico)
  debilidadesEstructurales: { materia: string; tema: string; puntaje: number }[]; // <35% (muy por debajo)
  patronesGlobalesTiempo?: {
    promedioGeneralSegundos: number;
    porcentajeImpulsividad: number;
    porcentajeDificultadCognitiva: number;
  };
  /** Todos los ejes/temas evaluados por materia (incluye 60–69%, antes omitidos en fuertes/débiles) */
  ejesEvaluados?: { materia: string; tema: string; puntaje: number }[];
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
  /** Nombre de sede / campus para informes (PDF) */
  sede?: string;
  /** Jornada escolar legible (Mañana, Tarde, Única, …) */
  jornada?: string;
}

function pickSedeNombreFromUserData(
  userData: admin.firestore.DocumentData | undefined
): string | undefined {
  if (!userData) return undefined;
  const keys = ['campusName', 'sedeNombre', 'sedeName', 'nombreSede'] as const;
  for (const k of keys) {
    const v = userData[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function resolveSedeNombreFromInstitution(
  institutionData: admin.firestore.DocumentData | undefined,
  campusId: string | undefined
): string | undefined {
  if (!campusId || !institutionData?.campuses || !Array.isArray(institutionData.campuses)) {
    return undefined;
  }
  const c = institutionData.campuses.find((campus: { id?: string }) => campus.id === campusId);
  return typeof c?.name === 'string' && c.name.trim() ? c.name.trim() : undefined;
}

function pickJornadaLabel(jornada: unknown): string | undefined {
  if (typeof jornada !== 'string') return undefined;
  const v = jornada.trim();
  if (!v) return undefined;
  const lower = v.toLowerCase();
  if (lower === 'mañana' || lower === 'manana') return 'Mañana';
  if (lower === 'tarde') return 'Tarde';
  if (lower === 'única' || lower === 'unica') return 'Única';
  return v.charAt(0).toUpperCase() + v.slice(1);
}

async function enrichContextWithSedeYJornada(
  studentDb: admin.firestore.Firestore,
  institutionId: string | undefined,
  userData: admin.firestore.DocumentData | undefined,
  context: AcademicContext
): Promise<void> {
  const campusId = (userData?.campusId || userData?.campus) as string | undefined;
  let sedeNombre = pickSedeNombreFromUserData(userData);
  if (!sedeNombre && campusId && institutionId) {
    try {
      const instSnap = await studentDb
        .collection('superate')
        .doc('auth')
        .collection('institutions')
        .doc(institutionId)
        .get();
      if (instSnap.exists) {
        sedeNombre = resolveSedeNombreFromInstitution(instSnap.data(), campusId);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`⚠️ Error resolviendo nombre de sede: ${msg}`);
    }
  }
  if (sedeNombre) context.sede = sedeNombre;
  const j = pickJornadaLabel(userData?.jornada);
  if (j) context.jornada = j;
}

/**
 * Resumen académico generado por IA
 */
interface AcademicSummary {
  resumen_general: string;
  analisis_competencial: string | { [materia: string]: string }; // Puede ser string (backward compatibility) o objeto por materias
  /** Fase III: texto continuo formal (v2 prompts); opcional por compatibilidad con resúmenes antiguos */
  sintesis_institucional?: string;
  fortalezas_academicas: string[];
  aspectos_por_mejorar: string[];
  recomendaciones_enfoque_saber11: string[];
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
        
        // Variables para análisis de tiempo (contadores — fuente única para patronesTiempo por materia)
        let tiempoTotalSegundos = 0;
        let preguntasConTiempo = 0;
        let preguntasRapidasIncorrectas = 0;
        let preguntasLentasIncorrectas = 0;
        
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
                preguntasRapidasIncorrectas++;
              }

              // Detectar patrones: lenta e incorrecta (dificultad cognitiva)
              if (!q.isCorrect && tiempoPregunta > tiempoLento) {
                topicStats[topic].lentasIncorrectas++;
                preguntasLentasIncorrectas++;
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
        
        const totalPreguntas = evalData.questionDetails?.length || 0;
        const patronesTiempo =
          totalPreguntas > 0
            ? {
                impulsividad: (preguntasRapidasIncorrectas / totalPreguntas) * 100,
                dificultadCognitiva: (preguntasLentasIncorrectas / totalPreguntas) * 100,
              }
            : undefined;

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
        resumenPorMateria: [],
        ejesEvaluados: [],
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

    normalizedResults.forEach((result) => {
      result.temasDetallados.forEach((temaDet) => {
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

        totalPreguntasGlobal += temaDet.totalPreguntas;
        if (temaDet.tiempoPromedioSegundos) {
          tiempoTotalGlobal += temaDet.tiempoPromedioSegundos * temaDet.totalPreguntas;
          preguntasConTiempoGlobal += temaDet.totalPreguntas;
        }
      });

      // Patrones globales: solo desde el agregado por evaluación (evita doble conteo con heurísticas por tema)
      if (result.patronesTiempo && result.temasDetallados.length > 0) {
        const totalPreguntasMateria = result.temasDetallados.reduce((sum, t) => sum + t.totalPreguntas, 0);
        preguntasRapidasIncorrectasGlobal += Math.round(
          (totalPreguntasMateria * result.patronesTiempo.impulsividad) / 100
        );
        preguntasLentasIncorrectasGlobal += Math.round(
          (totalPreguntasMateria * result.patronesTiempo.dificultadCognitiva) / 100
        );
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

    const resumenPorMateria = normalizedResults
      .map((r) => ({
        materia: r.materia,
        puntaje: Math.round(r.puntaje * 10) / 10,
        nivel: r.nivel,
      }))
      .sort((a, b) => b.puntaje - a.puntaje);

    const ejesEvaluados: { materia: string; tema: string; puntaje: number }[] = [];
    normalizedResults.forEach((result) => {
      result.temasDetallados.forEach((temaDet) => {
        ejesEvaluados.push({
          materia: result.materia,
          tema: typeof temaDet.tema === 'string' ? temaDet.tema.trim() : String(temaDet.tema),
          puntaje: Math.round(temaDet.puntaje * 10) / 10,
        });
      });
    });
    ejesEvaluados.sort((a, b) => {
      if (a.materia !== b.materia) return a.materia.localeCompare(b.materia, 'es');
      return a.tema.localeCompare(b.tema, 'es');
    });

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
      resumenPorMateria,
      ejesEvaluados,
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

              await enrichContextWithSedeYJornada(studentDb, institutionId, userData, context);

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

        await enrichContextWithSedeYJornada(studentDb, institutionId, userData, context);

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

      if (typeof parsed.sintesis_institucional === 'string' && parsed.sintesis_institucional.trim()) {
        summary.sintesis_institucional = parsed.sintesis_institucional.trim();
      }

      return summary;
    } catch (error: any) {
      console.error('Error generando resumen con IA:', error);
      throw new Error(`Error generando resumen con IA: ${error.message}`);
    }
  }

  /**
   * Fase anterior inmediata con métricas persistidas (p. ej. Fase I al generar Fase II).
   */
  private async getPreviousPhaseMetrics(
    studentId: string,
    currentPhase: 'first' | 'second' | 'third'
  ): Promise<{ phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null> {
    const prevPhaseMap: Partial<Record<'first' | 'second' | 'third', 'first' | 'second'>> = {
      second: 'first',
      third: 'second',
    };
    const prevPhase = prevPhaseMap[currentPhase];
    if (!prevPhase) return null;

    try {
      const snapshot = await getStudentDatabase()
        .collection('ResumenStudent')
        .doc(studentId)
        .collection(prevPhase)
        .doc('resumenActual')
        .get();

      if (!snapshot.exists) return null;
      const data = snapshot.data() as PersistedSummary;
      if (!data.metricasGlobales) return null;

      const phaseName = prevPhase === 'first' ? 'Fase I' : 'Fase II';
      return { phase: phaseName, metrics: data.metricasGlobales, fullSummary: data };
    } catch (error: any) {
      console.warn(`⚠️ Error obteniendo métricas de ${prevPhase}:`, error.message);
      return null;
    }
  }

  /** Resúmenes de Fase I y II para contexto de prompt Fase III */
  private async getAllPreviousPhasesForPhase3(
    studentId: string
  ): Promise<{
    phase1: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
    phase2: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
  }> {
    const db = getStudentDatabase();

    const fetchPhase = async (
      phaseKey: 'first' | 'second',
      phaseLabel: string
    ): Promise<{ phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null> => {
      try {
        const snap = await db
          .collection('ResumenStudent')
          .doc(studentId)
          .collection(phaseKey)
          .doc('resumenActual')
          .get();
        if (!snap.exists) return null;
        const data = snap.data() as PersistedSummary;
        if (!data.metricasGlobales) return null;
        return { phase: phaseLabel, metrics: data.metricasGlobales, fullSummary: data };
      } catch (e: any) {
        console.warn(`⚠️ Error obteniendo ${phaseLabel}:`, e.message);
        return null;
      }
    };

    try {
      const [phase1, phase2] = await Promise.all([
        fetchPhase('first', 'Fase I'),
        fetchPhase('second', 'Fase II'),
      ]);
      return { phase1, phase2 };
    } catch (e: any) {
      console.warn('⚠️ Error obteniendo fases anteriores para Fase III:', e.message);
      return { phase1: null, phase2: null };
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

  /** Trayectoria compacta Fase I → II para prompt Fase III (sin volcar análisis competencial completo) */
  private buildPhase3TrajectoryBlock(phase3PreviousPhases: {
    phase1: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
    phase2: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null;
  }): string {
    const section = (
      p: { phase: string; metrics: GlobalMetrics; fullSummary?: PersistedSummary } | null
    ): string => {
      if (!p?.fullSummary?.resumen) return '';
      const r = p.fullSummary.resumen;
      const m = p.metrics;
      return (
        `\n📌 ${p.phase}\n` +
        `Nivel: ${m.nivelGeneralDesempeno} | Fuertes: ${m.materiasFuertes.join(', ') || '—'} | Débiles: ${m.materiasDebiles.join(', ') || '—'}\n` +
        `Resumen: ${r.resumen_general || 'N/D'}\n` +
        `Fortalezas: ${r.fortalezas_academicas?.length ? r.fortalezas_academicas.map((x) => `- ${x}`).join('\n') : '—'}\n` +
        `A mejorar: ${r.aspectos_por_mejorar?.length ? r.aspectos_por_mejorar.map((x) => `- ${x}`).join('\n') : '—'}`
      );
    };

    return (
      `═══════════════════════════════════════════════════════════════\n` +
      `TRAYECTORIA Fase I → Fase II → Fase III\n` +
      `═══════════════════════════════════════════════════════════════` +
      section(phase3PreviousPhases.phase1) +
      section(phase3PreviousPhases.phase2) +
      `\n\nIntegra esta trayectoria en el análisis. Sin citar puntajes numéricos explícitos.`
    );
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
      const previousBundle = this.toPreviousPhaseBundle(previousPhaseMetrics);
      return buildPhase2Prompt({
        materiasData,
        globalMetrics: gm,
        academicContext,
        materiasLista,
        previousPhase: previousBundle,
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
   * Limpia el documento antes de `set` en Firestore: sin `undefined`, y sin NaN/Infinity
   * en números (orden: nullish → número → array → objeto).
   */
  private removeUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (typeof obj === 'number') {
      return Number.isFinite(obj) ? obj : null;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.removeUndefinedValues(item));
    }
    if (typeof obj === 'object') {
      const cleaned: Record<string, unknown> = {};
      for (const key of Object.keys(obj)) {
        const value = (obj as Record<string, unknown>)[key];
        if (value !== undefined) {
          cleaned[key] = this.removeUndefinedValues(value);
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
        version: 'v2',
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


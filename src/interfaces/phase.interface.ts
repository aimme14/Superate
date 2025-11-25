/**
 * Interfaces para el sistema de evaluación por fases estilo ICFES
 */

export type PhaseType = 'first' | 'second' | 'third';
export type PhaseStatus = 'locked' | 'available' | 'completed' | 'in_progress';

/**
 * Autorización de fase por grado
 */
export interface PhaseAuthorization {
  id: string;
  gradeId: string;
  gradeName: string;
  phase: PhaseType;
  authorized: boolean;
  authorizedBy: string; // UID del administrador
  authorizedAt: string; // ISO date string
  institutionId?: string;
  campusId?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Estado de progreso de un estudiante en una fase
 */
export interface StudentPhaseProgress {
  studentId: string;
  gradeId: string;
  phase: PhaseType;
  status: PhaseStatus;
  completedAt?: string; // ISO date string
  subjectsCompleted: string[]; // Materias completadas en esta fase
  subjectsInProgress: string[]; // Materias en progreso
  overallScore?: number; // Puntaje general de la fase (0-500 para fase 3)
  createdAt: string;
  updatedAt: string;
}

/**
 * Estado de completitud de una fase por grado
 */
export interface GradePhaseCompletion {
  gradeId: string;
  gradeName: string;
  phase: PhaseType;
  totalStudents: number;
  completedStudents: number;
  inProgressStudents: number;
  pendingStudents: number;
  completionPercentage: number;
  allCompleted: boolean; // true si todos los estudiantes completaron TODAS las materias
  lastUpdated: string;
  pendingStudentsDetails?: Array<{ studentId: string; pendingSubjects: string[] }>; // Detalles de estudiantes pendientes
}

/**
 * Análisis de resultados de Fase 1 para generar Fase 2
 */
export interface Phase1Analysis {
  studentId: string;
  subject: string;
  overallScore: number; // Porcentaje general
  topicPerformance: TopicPerformance[];
  strengths: string[]; // Temas fuertes
  weaknesses: string[]; // Temas débiles
  primaryWeakness: string; // Tema con más errores (para 50% de preguntas en Fase 2)
  improvementPlan?: ImprovementPlan; // Ruta de mejoramiento generada por IA
  analyzedAt: string;
}

/**
 * Rendimiento por tema
 */
export interface TopicPerformance {
  topic: string;
  topicCode: string;
  correct: number;
  incorrect: number;
  total: number;
  percentage: number;
  isWeakness: boolean; // true si es una debilidad
}

/**
 * Plan de mejoramiento generado por IA
 */
export interface ImprovementPlan {
  studentId: string;
  subject: string;
  primaryWeakness: string;
  resources: LearningResource[];
  studyPlan?: Array<{
    week: number;
    topics: string[];
    activities: string[];
    goals: string[];
  }>;
  estimatedTime: string; // Ej: "2 semanas"
  description: string;
  generatedAt: string;
}

/**
 * Recurso de aprendizaje
 */
export interface LearningResource {
  type: 'video' | 'quiz' | 'exercise' | 'material' | 'reading';
  title: string;
  description: string;
  url?: string;
  topic: string;
  priority: 'high' | 'medium' | 'low';
}

/**
 * Configuración de distribución de preguntas para Fase 2
 */
export interface Phase2QuestionDistribution {
  subject: string;
  primaryWeakness: string; // Tema principal (para compatibilidad)
  otherTopics: string[]; // Otros temas (para compatibilidad)
  totalQuestions: number;
  primaryWeaknessCount: number; // 50% del total (suma de todas las debilidades)
  otherTopicsCount: number; // 50% distribuido equitativamente (fortalezas)
  weaknessDistribution?: Array<{ topic: string; count: number }>; // Distribución proporcional de debilidades
  strengthDistribution?: Array<{ topic: string; count: number }>; // Distribución equitativa de fortalezas
}

/**
 * Análisis de avance entre Fase 1 y Fase 2
 */
export interface ProgressAnalysis {
  studentId: string;
  subject: string;
  phase1Score: number;
  phase2Score: number;
  improvement: number; // Diferencia porcentual
  hasImproved: boolean;
  weaknessImprovement: {
    topic: string;
    phase1Percentage: number;
    phase2Percentage: number;
    improvement: number;
  }[];
  insights: string[]; // Insights generados por IA
  analyzedAt: string;
}

/**
 * Resultado final de Fase 3 (ICFES)
 */
export interface Phase3ICFESResult {
  studentId: string;
  subject: string;
  icfesScore: number; // 0-500
  percentage: number; // 0-100
  topicScores: {
    topic: string;
    score: number; // 0-500
    percentage: number;
  }[];
  overallDiagnosis: string; // Diagnóstico final generado por IA
  recommendations: string[];
  completedAt: string;
}

/**
 * Comparativo entre las tres fases
 */
export interface PhaseComparison {
  studentId: string;
  subject: string;
  phase1: {
    score: number;
    percentage: number;
    completedAt: string;
  };
  phase2: {
    score: number;
    percentage: number;
    completedAt: string;
    improvement: number;
  };
  phase3: {
    icfesScore: number;
    percentage: number;
    completedAt: string;
  };
  overallProgress: {
    trend: 'improving' | 'stable' | 'declining';
    totalImprovement: number;
    finalDiagnosis: string;
  };
}


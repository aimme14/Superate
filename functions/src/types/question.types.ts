/**
 * Tipos e interfaces para el sistema de preguntas con IA
 * 
 * Este archivo define todas las estructuras de datos utilizadas en el sistema
 * de generación de justificaciones con Gemini AI
 */

// =============================
// TIPOS BASE DE PREGUNTA
// =============================

/**
 * Opción de una pregunta de opción múltiple
 */
export interface QuestionOption {
  id: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H';
  text: string | null;
  imageUrl: string | null;
  isCorrect: boolean;
}

/**
 * Niveles de dificultad
 */
export type DifficultyLevel = 'Fácil' | 'Medio' | 'Difícil';
export type DifficultyCode = 'F' | 'M' | 'D';

/**
 * Grados académicos
 */
export type Grade = '6' | '7' | '8' | '9' | '0' | '1'; // 6=sexto, 7=séptimo, 8=octavo, 9=noveno, 0=décimo, 1=undécimo

// =============================
// JUSTIFICACIÓN CON IA
// =============================

/**
 * Explicación de una opción incorrecta
 */
export interface IncorrectAnswerExplanation {
  optionId: string;
  explanation: string;
}

/**
 * Justificación generada por IA para una pregunta
 */
export interface AIJustification {
  // Explicación de la respuesta correcta
  correctAnswerExplanation: string;
  
  // Explicaciones de cada respuesta incorrecta
  incorrectAnswersExplanation: IncorrectAnswerExplanation[];
  
  // Conceptos clave que el estudiante debe dominar
  keyConcepts: string[];
  
  // Dificultad percibida por la IA
  perceivedDifficulty: DifficultyLevel;
  
  // Metadata de generación
  generatedAt: Date;
  generatedBy: string; // Nombre del modelo (ej: "gemini-1.5-flash")
  confidence: number; // 0.0 a 1.0
  promptVersion: string; // Versión del prompt utilizado
}

/**
 * Pregunta completa en Firestore
 */
export interface Question {
  // Identificadores
  id?: string;
  code: string; // Ej: MAAL1F001
  
  // Información académica
  subject: string; // Ej: "Matemáticas"
  subjectCode: string; // Ej: "MA"
  topic: string; // Ej: "Álgebra"
  topicCode: string; // Ej: "AL"
  grade: Grade;
  level: DifficultyLevel;
  levelCode: DifficultyCode;
  
  // Contexto
  informativeText?: string;
  informativeImages?: string[];
  
  // Pregunta
  questionText: string;
  questionImages?: string[];
  
  // Respuestas
  answerType: 'MCQ'; // Multiple Choice Question
  options: QuestionOption[];
  
  // Justificación con IA (campo que se agrega automáticamente)
  aiJustification?: AIJustification;
  
  // Metadata
  createdBy: string; // UID del usuario
  createdAt: Date;
  rand?: number; // Para muestreo aleatorio eficiente
}

// =============================
// DATOS PARA GENERACIÓN CON IA
// =============================

/**
 * Datos de entrada para generar una justificación con IA
 */
export interface QuestionGenerationData {
  questionId: string;
  questionCode: string;
  subject: string;
  topic: string;
  level: DifficultyLevel;
  questionText: string;
  informativeText?: string;
  informativeImages?: string[]; // URLs de imágenes informativas
  questionImages?: string[]; // URLs de imágenes en la pregunta
  options: QuestionOption[];
}

/**
 * Resultado de la generación de una justificación
 */
export interface JustificationGenerationResult {
  success: boolean;
  questionId: string;
  justification?: AIJustification;
  error?: string;
  processingTimeMs?: number;
}

// =============================
// PROCESAMIENTO BATCH
// =============================

/**
 * Configuración para procesamiento batch
 */
export interface BatchProcessingConfig {
  batchSize: number; // Cuántas preguntas procesar por lote
  delayBetweenBatches: number; // Milisegundos entre cada request
  maxRetries: number; // Número máximo de reintentos
  filters?: QuestionFilters; // Filtros opcionales
}

/**
 * Resultado del procesamiento batch
 */
export interface BatchProcessingResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  skipped: number;
  errors: Array<{
    questionId: string;
    questionCode: string;
    error: string;
  }>;
  startTime: Date;
  endTime: Date;
  durationMs: number;
}

// =============================
// FILTROS Y CONSULTAS
// =============================

/**
 * Filtros para consultas de preguntas
 */
export interface QuestionFilters {
  subject?: string;
  subjectCode?: string;
  topic?: string;
  topicCode?: string;
  grade?: string;
  level?: string;
  levelCode?: string;
  withJustification?: boolean;
  withoutJustification?: boolean;
  limit?: number;
}

/**
 * Estadísticas de justificaciones
 */
export interface JustificationStats {
  total: number;
  withJustification: number;
  withoutJustification: number;
  bySubject: Record<string, { total: number; withJustification: number }>;
  byLevel: Record<string, { total: number; withJustification: number }>;
  byGrade: Record<string, { total: number; withJustification: number }>;
  averageConfidence?: number;
}

// =============================
// VALIDACIÓN
// =============================

/**
 * Resultado de validación de una justificación
 */
export interface JustificationValidation {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
}

// =============================
// RESPUESTA DE API
// =============================

/**
 * Respuesta estándar de la API
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  metadata?: {
    processingTime?: number;
    timestamp?: Date;
    version?: string;
  };
}


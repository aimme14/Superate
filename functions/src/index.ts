/**
 * Cloud Functions para el sistema de justificaciones con IA
 * 
 * Este archivo define todos los endpoints HTTP y funciones programadas
 * para el sistema de generación automática de justificaciones
 */

import * as functions from 'firebase-functions';
import { justificationService } from './services/justification.service';
import { questionService } from './services/question.service';
import { geminiService } from './services/gemini.service';
import { studyPlanService, TopicWebSearchInfo } from './services/studyPlan.service';
import { studentSummaryService } from './services/studentSummary.service';
import { vocabularyService } from './services/vocabulary.service';
import { APIResponse } from './types/question.types';

// =============================
// CONFIGURACIÓN REGIONAL
// =============================

const REGION = 'us-central1'; // Cambia según tu región

// =============================
// ENDPOINTS DE JUSTIFICACIONES
// =============================

/**
 * Genera justificación para una pregunta específica
 * 
 * POST /generateJustification
 * Body: { questionId: string, force?: boolean }
 */
export const generateJustification = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { questionId, force = false } = req.body;
      
      if (!questionId) {
        const response: APIResponse = {
          success: false,
          error: { message: 'questionId es requerido' },
        };
        res.status(400).json(response);
        return;
      }
      
      const result = await justificationService.generateAndSaveJustification(
        questionId,
        force
      );
      
      const response: APIResponse = {
        success: result.success,
        data: result.justification,
        error: result.error ? { message: result.error } : undefined,
        metadata: {
          processingTime: result.processingTimeMs,
          timestamp: new Date(),
        },
      };
      
      res.status(result.success ? 200 : 500).json(response);
    } catch (error: any) {
      console.error('Error en generateJustification:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Procesa un lote de preguntas sin justificación
 * 
 * POST /processBatch
 * Body: { batchSize?: number, filters?: QuestionFilters }
 */
export const processBatch = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540, // 9 minutos (máximo para HTTP functions)
    memory: '1GB',
  })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const {
        batchSize = 10,
        delayBetweenBatches = 2000,
        maxRetries = 3,
        filters = {},
      } = req.body;
      
      const result = await justificationService.processBatch({
        batchSize,
        delayBetweenBatches,
        maxRetries,
        filters,
      });
      
      const response: APIResponse = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en processBatch:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Regenera justificación para una pregunta específica
 * 
 * POST /regenerateJustification
 * Body: { questionId: string }
 */
export const regenerateJustification = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { questionId } = req.body;
      
      if (!questionId) {
        const response: APIResponse = {
          success: false,
          error: { message: 'questionId es requerido' },
        };
        res.status(400).json(response);
        return;
      }
      
      const result = await justificationService.regenerateJustification(questionId);
      
      const response: APIResponse = {
        success: result.success,
        data: result.justification,
        error: result.error ? { message: result.error } : undefined,
        metadata: {
          processingTime: result.processingTimeMs,
          timestamp: new Date(),
        },
      };
      
      res.status(result.success ? 200 : 500).json(response);
    } catch (error: any) {
      console.error('Error en regenerateJustification:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Obtiene estadísticas de justificaciones
 * 
 * GET /justificationStats
 * Query params: subject?, level?, grade?
 */
export const justificationStats = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'GET') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa GET' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { subject, level, grade } = req.query;
      
      const filters = {
        subject: subject as string | undefined,
        level: level as string | undefined,
        grade: grade as string | undefined,
      };
      
      const stats = await justificationService.getStats(filters);
      
      const response: APIResponse = {
        success: true,
        data: stats,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en justificationStats:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Valida una justificación existente
 * 
 * POST /validateJustification
 * Body: { questionId: string }
 */
export const validateJustification = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { questionId } = req.body;
      
      if (!questionId) {
        const response: APIResponse = {
          success: false,
          error: { message: 'questionId es requerido' },
        };
        res.status(400).json(response);
        return;
      }
      
      const question = await questionService.getQuestionById(questionId);
      
      if (!question) {
        const response: APIResponse = {
          success: false,
          error: { message: 'Pregunta no encontrada' },
        };
        res.status(404).json(response);
        return;
      }
      
      if (!question.aiJustification) {
        const response: APIResponse = {
          success: false,
          error: { message: 'La pregunta no tiene justificación' },
        };
        res.status(404).json(response);
        return;
      }
      
      const validation = await geminiService.validateJustification(
        question,
        question.aiJustification
      );
      
      const response: APIResponse = {
        success: true,
        data: validation,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en validateJustification:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

// =============================
// FUNCIONES PROGRAMADAS
// =============================

/**
 * Función programada para procesar preguntas sin justificación
 * Se ejecuta diariamente a las 2:00 AM
 * 
 * Configurable desde Firebase Console
 */
export const scheduledJustificationGeneration = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .pubsub.schedule('0 2 * * *') // Cron: 2:00 AM todos los días
  .timeZone('America/Bogota') // Ajusta según tu zona horaria
  .onRun(async (_context) => {
    console.log('🕐 Ejecutando generación programada de justificaciones...');
    
    try {
      const result = await justificationService.processBatch({
        batchSize: 20, // Procesar 20 preguntas por día
        delayBetweenBatches: 3000,
        maxRetries: 3,
        filters: {
          withoutJustification: true,
        },
      });
      
      console.log('✅ Generación programada completada:', result);
      
      return {
        success: true,
        ...result,
      };
    } catch (error: any) {
      console.error('❌ Error en generación programada:', error);
      throw error;
    }
  });


/**
 * Función programada para generar vocabulario académico
 * Se ejecuta semanalmente los domingos a las 3:00 AM
 */
export const scheduledVocabularyGeneration = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .pubsub.schedule('0 3 * * 0')
  .timeZone('America/Bogota')
  .onRun(async (_context) => {
    console.log('📚 Ejecutando generación programada de vocabulario académico...');
    try {
      const materias = ['matematicas', 'lectura_critica', 'fisica', 'biologia', 'quimica', 'ingles', 'sociales_ciudadanas'];
      const MIN_WORDS_THRESHOLD = 100;
      const BATCH_SIZE = 20;
      let totalGenerated = 0;
      let totalSkipped = 0;
      const results: Array<{ materia: string; generated: number; skipped: number }> = [];
      for (const materia of materias) {
        try {
          const existingCount = await vocabularyService.countActiveWords(materia);
          if (existingCount >= MIN_WORDS_THRESHOLD) {
            totalSkipped += existingCount;
            results.push({ materia, generated: 0, skipped: existingCount });
            continue;
          }
          const wordsNeeded = MIN_WORDS_THRESHOLD - existingCount;
          const wordsToGenerate = Math.min(BATCH_SIZE, wordsNeeded);
          const commonWords: Record<string, string[]> = {
            matematicas: ['álgebra', 'ecuación', 'función', 'derivada', 'integral'],
            lectura_critica: ['inferencia', 'deducción', 'argumento', 'tesis', 'hipótesis'],
            fisica: ['fuerza', 'masa', 'aceleración', 'velocidad', 'movimiento'],
            biologia: ['célula', 'organelo', 'núcleo', 'mitocondria', 'ribosoma'],
            quimica: ['átomo', 'molécula', 'elemento', 'compuesto', 'sustancia'],
            ingles: ['vocabulary', 'grammar', 'syntax', 'semantics', 'pronunciation'],
            sociales_ciudadanas: ['democracia', 'ciudadanía', 'derechos', 'deberes', 'constitución']
          };
          const wordsForMateria = commonWords[materia] || [];
          const wordsToProcess = wordsForMateria.slice(0, wordsToGenerate);
          if (wordsToProcess.length > 0) {
            const batchResult = await vocabularyService.generateBatch(materia, wordsToProcess);
            totalGenerated += batchResult.success;
            results.push({ materia, generated: batchResult.success, skipped: existingCount });
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        } catch (error: any) {
          console.error(`Error procesando ${materia}:`, error.message);
          results.push({ materia, generated: 0, skipped: 0 });
        }
      }
      return { success: true, totalGenerated, totalSkipped, results, timestamp: new Date() };
    } catch (error: any) {
      console.error('Error en generación programada de vocabulario:', error);
      throw error;
    }
  });


// =============================
// FUNCIONES DE UTILIDAD
// =============================

/**
 * Obtiene información del sistema de IA
 * 
 * GET /aiInfo
 */
export const aiInfo = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    try {
      const info = geminiService.getInfo();
      
      const response: APIResponse = {
        success: true,
        data: info,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en aiInfo:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Genera un plan de estudio personalizado para un estudiante
 * 
 * POST /generateStudyPlan
 * Body: { studentId: string, phase: 'first' | 'second' | 'third', subject: string }
 */
export const generateStudyPlan = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540, // 9 minutos (máximo para HTTP functions)
    memory: '1GB',
    secrets: ['YOUTUBE_API_KEY', 'GOOGLE_CSE_API_KEY', 'GOOGLE_CSE_ID'], // Secrets para APIs externas
  })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { studentId, phase, subject } = req.body;
      
      if (!studentId || !phase || !subject) {
        const response: APIResponse = {
          success: false,
          error: { message: 'studentId, phase y subject son requeridos' },
        };
        res.status(400).json(response);
        return;
      }

      // Validar fase
      if (!['first', 'second', 'third'].includes(phase)) {
        const response: APIResponse = {
          success: false,
          error: { message: 'phase debe ser: first, second o third' },
        };
        res.status(400).json(response);
        return;
      }

      console.log(`📚 Generando plan de estudio para estudiante ${studentId}, fase ${phase}, materia ${subject}`);
      
      const result = await studyPlanService.generateStudyPlan({
        studentId,
        phase: phase as 'first' | 'second' | 'third',
        subject,
      });
      
      const response: APIResponse = {
        success: result.success,
        data: result.studyPlan,
        error: result.error ? { message: result.error } : undefined,
        metadata: {
          processingTime: result.processingTimeMs,
          timestamp: new Date(),
        },
      };
      
      res.status(result.success ? 200 : 500).json(response);
    } catch (error: any) {
      console.error('Error en generateStudyPlan:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Obtiene un plan de estudio existente
 * 
 * GET /getStudyPlan?studentId=...&phase=...&subject=...
 */
export const getStudyPlan = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'GET') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa GET' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { studentId, phase, subject } = req.query;
      
      if (!studentId || !phase || !subject) {
        const response: APIResponse = {
          success: false,
          error: { message: 'studentId, phase y subject son requeridos como query params' },
        };
        res.status(400).json(response);
        return;
      }

      // Validar fase
      if (!['first', 'second', 'third'].includes(phase as string)) {
        const response: APIResponse = {
          success: false,
          error: { message: 'phase debe ser: first, second o third' },
        };
        res.status(400).json(response);
        return;
      }

      const studyPlan = await studyPlanService.getStudyPlan(
        studentId as string,
        phase as 'first' | 'second' | 'third',
        subject as string
      );
      
      const response: APIResponse = {
        success: true,
        data: studyPlan,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en getStudyPlan:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Genera enlaces web educativos para un tema específico
 * Endpoint independiente para pruebas y generación selectiva
 * 
 * POST /generateWebLinks
 * Body: { phase: 'first'|'second'|'third', subject: string, topic: string, webSearchInfo: TopicWebSearchInfo }
 */
export const generateWebLinks = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { phase, subject, topic, webSearchInfo } = req.body;
      
      if (!phase || !subject || !topic || !webSearchInfo) {
        const response: APIResponse = {
          success: false,
          error: { message: 'phase, subject, topic y webSearchInfo son requeridos' },
        };
        res.status(400).json(response);
        return;
      }
      
      // Validar fase
      if (!['first', 'second', 'third'].includes(phase)) {
        const response: APIResponse = {
          success: false,
          error: { message: 'phase debe ser: first, second o third' },
        };
        res.status(400).json(response);
        return;
      }
      
      // Validar webSearchInfo
      if (!webSearchInfo.searchIntent || !webSearchInfo.searchKeywords || !Array.isArray(webSearchInfo.searchKeywords)) {
        const response: APIResponse = {
          success: false,
          error: { message: 'webSearchInfo debe tener searchIntent y searchKeywords (array)' },
        };
        res.status(400).json(response);
        return;
      }
      
      console.log(`🔗 Generando enlaces web para tema "${topic}", fase ${phase}, materia ${subject}`);
      
      const links = await studyPlanService.generateWebLinksForTopic(
        phase as 'first' | 'second' | 'third',
        subject,
        topic,
        webSearchInfo as TopicWebSearchInfo
      );
      
      const response: APIResponse = {
        success: true,
        data: {
          links,
          count: links.length,
          topic,
          subject,
          phase,
        },
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en generateWebLinks:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });


/**
 * Health check del sistema
 * 
 * GET /health
 */
export const health = functions
  .region(REGION)
  .https.onRequest(async (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    
    try {
      const geminiInfo = await geminiService.getInfo();
      const geminiAvailable = geminiInfo.available;
      
      const response: APIResponse = {
        success: true,
        data: {
          status: 'healthy',
          services: {
            gemini: geminiAvailable ? 'available' : 'unavailable',
            firestore: 'available',
          },
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

// =============================
// ENDPOINTS DE RESUMEN ACADÉMICO
// =============================

/**
 * Genera resumen académico para un estudiante en una fase específica
 * 
 * POST /generateStudentSummary
 * Body: { studentId: string, phase: 'first' | 'second' | 'third', force?: boolean }
 */
export const generateStudentSummary = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { studentId, phase, force = false } = req.body;
      
      if (!studentId) {
        const response: APIResponse = {
          success: false,
          error: { message: 'studentId es requerido' },
        };
        res.status(400).json(response);
        return;
      }

      if (!phase || !['first', 'second', 'third'].includes(phase)) {
        const response: APIResponse = {
          success: false,
          error: { message: 'phase es requerido y debe ser: first, second o third' },
        };
        res.status(400).json(response);
        return;
      }
      
      const phaseName = phase === 'first' ? 'Fase I' : phase === 'second' ? 'Fase II' : 'Fase III';
      console.log(`📊 Generando resumen académico para estudiante ${studentId}, ${phaseName}${force ? ' (forzado)' : ''}`);
      
      const result = await studentSummaryService.generateSummary(studentId, phase as 'first' | 'second' | 'third', force);
      
      const response: APIResponse = {
        success: result.success,
        data: result.summary,
        error: result.error ? { message: result.error } : undefined,
        metadata: {
          processingTime: result.processingTimeMs,
          timestamp: new Date(),
        },
      };
      
      res.status(result.success ? 200 : 500).json(response);
    } catch (error: any) {
      console.error('Error en generateStudentSummary:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Obtiene el resumen académico vigente de un estudiante para una fase específica
 * 
 * GET /getStudentSummary?studentId=...&phase=first|second|third
 */
export const getStudentSummary = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'GET') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa GET' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { studentId, phase } = req.query;
      
      if (!studentId) {
        const response: APIResponse = {
          success: false,
          error: { message: 'studentId es requerido como query param' },
        };
        res.status(400).json(response);
        return;
      }

      if (!phase || !['first', 'second', 'third'].includes(phase as string)) {
        const response: APIResponse = {
          success: false,
          error: { message: 'phase es requerido y debe ser: first, second o third' },
        };
        res.status(400).json(response);
        return;
      }
      
      const summary = await studentSummaryService.getSummary(
        studentId as string, 
        phase as 'first' | 'second' | 'third'
      );
      
      const response: APIResponse = {
        success: true,
        data: summary,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en getStudentSummary:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Endpoint HTTP para verificar y generar resumen automáticamente
 * Este endpoint puede ser llamado desde el frontend después de completar una evaluación
 * o desde un sistema externo
 * 
 * POST /checkAndGenerateSummary
 * Body: { studentId: string, phase: 'first' | 'second' | 'third' }
 */
export const checkAndGenerateSummary = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { studentId, phase } = req.body;
      
      if (!studentId) {
        const response: APIResponse = {
          success: false,
          error: { message: 'studentId es requerido' },
        };
        res.status(400).json(response);
        return;
      }

      if (!phase || !['first', 'second', 'third'].includes(phase)) {
        const response: APIResponse = {
          success: false,
          error: { message: 'phase es requerido y debe ser: first, second o third' },
        };
        res.status(400).json(response);
        return;
      }
      
      const phaseName = phase === 'first' ? 'Fase I' : phase === 'second' ? 'Fase II' : 'Fase III';
      console.log(`\n📝 Verificando evaluaciones completadas para estudiante: ${studentId}, ${phaseName}`);
      
      // Verificar si el estudiante tiene las 7 evaluaciones para esta fase
      const hasAll = await studentSummaryService.hasAllEvaluations(studentId, phase as 'first' | 'second' | 'third');
      
      if (!hasAll) {
        const response: APIResponse = {
          success: false,
          error: { message: `El estudiante aún no ha completado las 7 evaluaciones requeridas para ${phaseName}` },
          data: { hasAllEvaluations: false },
        };
        res.status(200).json(response);
        return;
      }
      
      // Verificar si ya existe un resumen
      const existingSummary = await studentSummaryService.getSummary(studentId, phase as 'first' | 'second' | 'third');
      if (existingSummary) {
        const response: APIResponse = {
          success: true,
          data: { 
            hasAllEvaluations: true,
            summaryExists: true,
            summary: existingSummary,
          },
        };
        res.status(200).json(response);
        return;
      }
      
      // Generar resumen automáticamente
      console.log(`   🚀 Generando resumen académico automáticamente para estudiante ${studentId}, ${phaseName}...`);
      const result = await studentSummaryService.generateSummary(studentId, phase as 'first' | 'second' | 'third', false);
      
      const response: APIResponse = {
        success: result.success,
        data: result.summary ? {
          hasAllEvaluations: true,
          summaryExists: false,
          summaryGenerated: true,
          summary: result.summary,
        } : undefined,
        error: result.error ? { message: result.error } : undefined,
        metadata: {
          processingTime: result.processingTimeMs,
          timestamp: new Date(),
        },
      };
      
      res.status(result.success ? 200 : 500).json(response);
    } catch (error: any) {
      console.error('Error en checkAndGenerateSummary:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

// =============================
// ENDPOINTS DE VOCABULARIO ACADÉMICO
// =============================

/**
 * Obtiene palabras aleatorias de una materia
 * 
 * GET /definitions/words?materia=...&limit=10&exclude=id1,id2,id3
 */
export const getVocabularyWords = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'GET') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa GET' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { materia, limit, exclude } = req.query;
      
      if (!materia) {
        const response: APIResponse = {
          success: false,
          error: { message: 'materia es requerido como query param' },
        };
        res.status(400).json(response);
        return;
      }

      const limitNum = limit ? parseInt(limit as string, 10) : 10;
      const excludeIds = exclude ? (exclude as string).split(',').filter(id => id.trim()) : [];

      const words = await vocabularyService.getWords(
        materia as string,
        limitNum,
        excludeIds
      );
      
      const response: APIResponse = {
        success: true,
        data: words,
        metadata: {
          
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en getVocabularyWords:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Obtiene la definición de una palabra específica
 * 
 * GET /definitions/word?materia=...&palabra=...
 */
export const getVocabularyWord = functions
  .region(REGION)
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'GET') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa GET' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { materia, palabra } = req.query;
      
      if (!materia) {
        const response: APIResponse = {
          success: false,
          error: { message: 'materia es requerido como query param' },
        };
        res.status(400).json(response);
        return;
      }

      if (!palabra) {
        const response: APIResponse = {
          success: false,
          error: { message: 'palabra es requerido como query param' },
        };
        res.status(400).json(response);
        return;
      }

      const definition = await vocabularyService.getWordDefinition(
        materia as string,
        palabra as string
      );
      
      if (!definition) {
        const response: APIResponse = {
          success: false,
          error: { message: 'No se pudo obtener o generar la definición' },
        };
        res.status(404).json(response);
        return;
      }
      
      const response: APIResponse = {
        success: true,
        data: definition,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en getVocabularyWord:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Genera un lote de definiciones (para job backend)
 * 
 * POST /definitions/generate-batch
 * Body: { materia: string, palabras: string[] }
 */
export const generateVocabularyBatch = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { materia, palabras } = req.body;
      
      if (!materia) {
        const response: APIResponse = {
          success: false,
          error: { message: 'materia es requerido' },
        };
        res.status(400).json(response);
        return;
      }

      if (!palabras || !Array.isArray(palabras) || palabras.length === 0) {
        const response: APIResponse = {
          success: false,
          error: { message: 'palabras debe ser un array no vacío' },
        };
        res.status(400).json(response);
        return;
      }

      const result = await vocabularyService.generateBatch(materia, palabras);
      
      const response: APIResponse = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en generateVocabularyBatch:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Genera ejemplos para palabras existentes que no tienen ejemplo
 * 
 * POST /definitions/generate-examples
 * Body: { materia: string, limit?: number, batchSize?: number, delayBetweenBatches?: number }
 */
export const generateVocabularyExamples = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
  })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { materia, limit, batchSize, delayBetweenBatches } = req.body;
      
      if (!materia) {
        const response: APIResponse = {
          success: false,
          error: { message: 'materia es requerido' },
        };
        res.status(400).json(response);
        return;
      }

      const result = await vocabularyService.generateExamplesForExistingWords(materia, {
        limit: limit || undefined,
        batchSize: batchSize || 10,
        delayBetweenBatches: delayBetweenBatches || 2000,
      });
      
      const response: APIResponse = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en generateVocabularyExamples:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });

/**
 * Elimina todos los ejemplos de palabras de una materia
 * 
 * POST /definitions/delete-examples
 * Body: { materia: string }
 */
export const deleteVocabularyExamples = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 300,
    memory: '512MB',
  })
  .https.onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    if (req.method !== 'POST') {
      const response: APIResponse = {
        success: false,
        error: { message: 'Método no permitido. Usa POST' },
      };
      res.status(405).json(response);
      return;
    }
    
    try {
      const { materia } = req.body;
      
      if (!materia) {
        const response: APIResponse = {
          success: false,
          error: { message: 'materia es requerido' },
        };
        res.status(400).json(response);
        return;
      }

      const result = await vocabularyService.deleteExamplesForMateria(materia);
      
      const response: APIResponse = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date(),
        },
      };
      
      res.status(200).json(response);
    } catch (error: any) {
      console.error('Error en deleteVocabularyExamples:', error);
      const response: APIResponse = {
        success: false,
        error: { message: error.message || 'Error interno del servidor' },
      };
      res.status(500).json(response);
    }
  });
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


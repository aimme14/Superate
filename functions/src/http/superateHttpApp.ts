/**
 * API HTTP unificada: un solo despliegue con rutas bajo /superateHttp/<ruta>
 * (p. ej. .../superateHttp/health).
 */
import express from 'express';
import { justificationService } from '../services/justification.service';
import { questionService } from '../services/question.service';
import { geminiService } from '../services/gemini.service';
import { studyPlanService } from '../services/studyPlan.service';
import { vocabularyService } from '../services/vocabulary.service';
import { getTipsFromConsolidado1 } from '../services/tipsICFES.service';
import { getRandomEjercicios } from '../services/ejerciciosIA.service';
import { APIResponse } from '../types/question.types';
import { rebuildSimulacrosConsolidated } from '../services/simulacrosConsolidated.service';
import {
  handleGetStudentSummary,
  handleStudentSummaryPost,
} from './studentSummaryUnified';
import { verifyBearerIdToken } from './studentSummaryAuth.middleware';

function cors(
  res: express.Response,
  methods: string,
  headers = 'Content-Type'
): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', methods);
  res.set('Access-Control-Allow-Headers', headers);
}

export function createSuperateHttpApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.set(
        'Access-Control-Allow-Headers',
        'Content-Type, X-Admin-Secret, Authorization'
      );
      res.status(204).send('');
      return;
    }
    next();
  });

  // --- Justificaciones ---
  app.post('/generateJustification', async (req, res) => {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { questionId, force = false } = req.body;
      if (!questionId) {
        res.status(400).json({
          success: false,
          error: { message: 'questionId es requerido' },
        } as APIResponse);
        return;
      }
      const result = await justificationService.generateAndSaveJustification(
        questionId,
        force
      );
      res.status(result.success ? 200 : 500).json({
        success: result.success,
        data: result.justification,
        error: result.error ? { message: result.error } : undefined,
        metadata: {
          processingTime: result.processingTimeMs,
          timestamp: new Date(),
        },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('generateJustification:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.post('/processBatch', async (req, res) => {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
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
      res.status(200).json({
        success: true,
        data: result,
        metadata: { timestamp: new Date() },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('processBatch:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.post('/regenerateJustification', async (req, res) => {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { questionId } = req.body;
      if (!questionId) {
        res.status(400).json({
          success: false,
          error: { message: 'questionId es requerido' },
        } as APIResponse);
        return;
      }
      const result = await justificationService.regenerateJustification(questionId);
      res.status(result.success ? 200 : 500).json({
        success: result.success,
        data: result.justification,
        error: result.error ? { message: result.error } : undefined,
        metadata: {
          processingTime: result.processingTimeMs,
          timestamp: new Date(),
        },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('regenerateJustification:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.get('/justificationStats', async (req, res) => {
    cors(res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
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
      res.status(200).json({
        success: true,
        data: stats,
        metadata: { timestamp: new Date() },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('justificationStats:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.post('/validateJustification', async (req, res) => {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { questionId } = req.body;
      if (!questionId) {
        res.status(400).json({
          success: false,
          error: { message: 'questionId es requerido' },
        } as APIResponse);
        return;
      }
      const question = await questionService.getQuestionById(questionId);
      if (!question) {
        res.status(404).json({
          success: false,
          error: { message: 'Pregunta no encontrada' },
        } as APIResponse);
        return;
      }
      if (!question.aiJustification) {
        res.status(404).json({
          success: false,
          error: { message: 'La pregunta no tiene justificación' },
        } as APIResponse);
        return;
      }
      const validation = await geminiService.validateJustification(
        question,
        question.aiJustification
      );
      res.status(200).json({
        success: true,
        data: validation,
        metadata: { timestamp: new Date() },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('validateJustification:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.get('/aiInfo', async (req, res) => {
    cors(res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const info = geminiService.getInfo();
      res.status(200).json({
        success: true,
        data: info,
        metadata: { timestamp: new Date() },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('aiInfo:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.post('/generateStudyPlan', async (req, res) => {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { studentId, phase, subject, grade } = req.body;
      if (!studentId || !phase || !subject) {
        res.status(400).json({
          success: false,
          error: { message: 'studentId, phase y subject son requeridos' },
        } as APIResponse);
        return;
      }
      if (!['first', 'second', 'third'].includes(phase)) {
        res.status(400).json({
          success: false,
          error: { message: 'phase debe ser: first, second o third' },
        } as APIResponse);
        return;
      }
      if (phase === 'second') {
        res.status(400).json({
          success: false,
          error: {
            message:
              'Los planes de estudio con IA solo están disponibles para Fase I (diagnóstico). Fase II no genera plan.',
          },
        } as APIResponse);
        return;
      }
      const result = await studyPlanService.generateStudyPlan({
        studentId,
        phase: phase as 'first' | 'second' | 'third',
        subject,
        grade: grade || undefined,
      });
      res.status(result.success ? 200 : 500).json({
        success: result.success,
        data: result.studyPlan,
        error: result.error ? { message: result.error } : undefined,
        metadata: {
          processingTime: result.processingTimeMs,
          timestamp: new Date(),
        },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('generateStudyPlan:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.get('/getStudyPlan', async (req, res) => {
    cors(res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { studentId, phase, subject } = req.query;
      if (!studentId || !phase || !subject) {
        res.status(400).json({
          success: false,
          error: {
            message: 'studentId, phase y subject son requeridos como query params',
          },
        } as APIResponse);
        return;
      }
      if (!['first', 'second', 'third'].includes(phase as string)) {
        res.status(400).json({
          success: false,
          error: { message: 'phase debe ser: first, second o third' },
        } as APIResponse);
        return;
      }
      if (phase === 'second') {
        res.status(200).json({
          success: true,
          data: null,
          metadata: {
            timestamp: new Date(),
            note: 'Plan Fase II deshabilitado; solo Fase I.',
          },
        } as APIResponse);
        return;
      }
      const studyPlan = await studyPlanService.getStudyPlan(
        studentId as string,
        phase as 'first' | 'second' | 'third',
        subject as string
      );
      res.status(200).json({
        success: true,
        data: studyPlan,
        metadata: { timestamp: new Date() },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('getStudyPlan:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.all('/getRandomEjerciciosIA', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    if (req.method !== 'GET' && req.method !== 'POST') {
      res.status(405).json({
        success: false,
        error: { message: 'Método no permitido. Usa GET o POST' },
      } as APIResponse);
      return;
    }
    try {
      const params = req.method === 'GET' ? req.query : req.body;
      const grade = (params.grade as string) || undefined;
      const subject = (params.subject as string) || undefined;
      const limit = 10;
      const { exercises, documentsRead } = await getRandomEjercicios(
        grade,
        subject,
        limit
      );
      res.status(200).json({
        success: true,
        data: exercises,
        metadata: {
          count: exercises.length,
          firestoreDocumentReads: documentsRead,
          timestamp: new Date(),
        },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('getRandomEjerciciosIA:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.get('/getTipsICFES', async (req, res) => {
    cors(res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const tips = await getTipsFromConsolidado1();
      res.status(200).json({
        success: true,
        data: tips,
        metadata: { timestamp: new Date() },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('getTipsICFES:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.post('/generateWebLinks', async (req, res) => {
    cors(res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { phase, subject, topic, grade } = req.body;
      if (!phase || !subject || !topic) {
        res.status(400).json({
          success: false,
          error: { message: 'phase, subject y topic son requeridos' },
        } as APIResponse);
        return;
      }
      if (!['first', 'second', 'third'].includes(phase)) {
        res.status(400).json({
          success: false,
          error: { message: 'phase debe ser: first, second o third' },
        } as APIResponse);
        return;
      }
      const links = await studyPlanService.generateWebLinksForTopic(
        phase as 'first' | 'second' | 'third',
        subject,
        topic,
        grade
      );
      res.status(200).json({
        success: true,
        data: {
          links,
          count: links.length,
          topic,
          subject,
          phase,
        },
        metadata: { timestamp: new Date() },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('generateWebLinks:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.get('/health', async (_req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    try {
      const geminiInfo = await geminiService.getInfo();
      const geminiAvailable = geminiInfo.available;
      res.status(200).json({
        success: true,
        data: {
          status: 'healthy',
          services: {
            gemini: geminiAvailable ? 'available' : 'unavailable',
            firestore: 'available',
          },
          timestamp: new Date(),
        },
      } as APIResponse);
    } catch (error: unknown) {
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  // Resumen académico unificado + aliases (Bearer ID token + docente activo + alcance)
  const studentSummaryAuth = [verifyBearerIdToken];
  app.post('/studentSummary', ...studentSummaryAuth, handleStudentSummaryPost);
  app.post('/checkAndGenerateSummary', ...studentSummaryAuth, (req, res) => {
    req.body = { ...req.body, mode: 'ensure' };
    void handleStudentSummaryPost(req, res);
  });
  app.post('/generateStudentSummary', ...studentSummaryAuth, (req, res) => {
    req.body = { ...req.body, mode: 'generate' };
    void handleStudentSummaryPost(req, res);
  });
  app.get('/getStudentSummary', ...studentSummaryAuth, handleGetStudentSummary);

  app.get('/getVocabularyWords', async (req, res) => {
    cors(res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    try {
      const { materia, limit, exclude, all } = req.query;
      if (!materia) {
        res.status(400).json({
          success: false,
          error: { message: 'materia es requerido como query param' },
        } as APIResponse);
        return;
      }
      const allRaw = all as string | string[] | undefined;
      const allValues = Array.isArray(allRaw)
        ? allRaw
        : allRaw !== undefined
          ? [allRaw]
          : [];
      const wantAll = allValues.some(
        (v) =>
          v === 'true' ||
          v === '1' ||
          (typeof v === 'string' && v.toLowerCase() === 'yes')
      );
      let words: Awaited<ReturnType<typeof vocabularyService.getWords>>;
      if (wantAll) {
        words = await vocabularyService.getAllWords(materia as string);
      } else {
        const limitNum = limit ? parseInt(limit as string, 10) : 10;
        const excludeIds = exclude
          ? (exclude as string).split(',').filter((id) => id.trim())
          : [];
        words = await vocabularyService.getWords(
          materia as string,
          limitNum,
          excludeIds
        );
      }
      res.status(200).json({
        success: true,
        data: words,
        metadata: { timestamp: new Date() },
      } as APIResponse);
    } catch (error: unknown) {
      console.error('getVocabularyWords:', error);
      res.status(500).json({
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Error interno',
        },
      } as APIResponse);
    }
  });

  app.post('/rebuildSimulacrosConsolidatedHttp', async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Secret');
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    const configuredSecret = process.env.CONSOLIDATE_SIMULACROS_SECRET;
    if (configuredSecret) {
      const hdr = req.headers['x-admin-secret'];
      const headerSecret = typeof hdr === 'string' ? hdr : Array.isArray(hdr) ? hdr[0] : '';
      const q = typeof req.query.secret === 'string' ? req.query.secret : '';
      const body =
        typeof req.body === 'object' && req.body !== null
          ? (req.body as { secret?: string })
          : {};
      const bodySecret = typeof body.secret === 'string' ? body.secret : '';
      if (
        headerSecret !== configuredSecret &&
        q !== configuredSecret &&
        bodySecret !== configuredSecret
      ) {
        res.status(403).json({
          success: false,
          error: { message: 'No autorizado' },
        } as APIResponse);
        return;
      }
    }
    try {
      const result = await rebuildSimulacrosConsolidated();
      res.status(200).json({
        success: result.success,
        data: result,
        metadata: { timestamp: new Date() },
      } as APIResponse);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error interno';
      console.error('rebuildSimulacrosConsolidatedHttp:', error);
      res.status(500).json({
        success: false,
        error: { message },
      } as APIResponse);
    }
  });

  return app;
}

/**
 * Lógica unificada para resumen académico (evita dos endpoints con IA duplicados).
 */
import type { Request, Response } from 'express';
import { studentSummaryService } from '../services/studentSummary.service';
import type { APIResponse } from '../types/question.types';

type Phase = 'first' | 'second' | 'third';

function cors(res: Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
}

/** POST: modo ensure (ex checkAndGenerate) o generate (ex generateStudentSummary con force). */
export async function handleStudentSummaryPost(req: Request, res: Response): Promise<void> {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: { message: 'Método no permitido. Usa POST' },
    } as APIResponse);
    return;
  }

  const body = req.body as {
    studentId?: string;
    phase?: string;
    /** ensure = solo si fase completa y sin resumen; generate = forzar IA */
    mode?: 'ensure' | 'generate';
    force?: boolean;
  };

  const mode: 'ensure' | 'generate' =
    body.mode === 'generate' || body.force === true ? 'generate' : 'ensure';

  const { studentId, phase } = body;

  if (!studentId) {
    res.status(400).json({
      success: false,
      error: { message: 'studentId es requerido' },
    } as APIResponse);
    return;
  }

  if (!phase || !['first', 'second', 'third'].includes(phase)) {
    res.status(400).json({
      success: false,
      error: { message: 'phase es requerido y debe ser: first, second o third' },
    } as APIResponse);
    return;
  }

  const ph = phase as Phase;

  try {
    if (mode === 'generate') {
      const phaseName =
        ph === 'first' ? 'Fase I' : ph === 'second' ? 'Fase II' : 'Fase III';
      console.log(
        `📊 [studentSummary unified] generate para ${studentId}, ${phaseName} (forzado)`
      );
      const result = await studentSummaryService.generateSummary(
        studentId,
        ph,
        true
      );
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
      return;
    }

    const phaseName =
      ph === 'first' ? 'Fase I' : ph === 'second' ? 'Fase II' : 'Fase III';
    console.log(
      `\n📝 [studentSummary unified] ensure para ${studentId}, ${phaseName}`
    );

    const hasAll = await studentSummaryService.hasAllEvaluations(studentId, ph);
    if (!hasAll) {
      res.status(200).json({
        success: false,
        error: {
          message: `El estudiante aún no ha completado las 7 evaluaciones requeridas para ${phaseName}`,
        },
        data: { hasAllEvaluations: false },
      } as APIResponse);
      return;
    }

    const existingSummary = await studentSummaryService.getSummary(studentId, ph);
    if (existingSummary) {
      res.status(200).json({
        success: true,
        data: {
          hasAllEvaluations: true,
          summaryExists: true,
          summary: existingSummary,
        },
      } as APIResponse);
      return;
    }

    console.log(
      `   🚀 Generando resumen automáticamente para ${studentId}, ${phaseName}...`
    );
    const result = await studentSummaryService.generateSummary(studentId, ph, false);
    const response: APIResponse = {
      success: result.success,
      data: result.summary
        ? {
            hasAllEvaluations: true,
            summaryExists: false,
            summaryGenerated: true,
            summary: result.summary,
          }
        : undefined,
      error: result.error ? { message: result.error } : undefined,
      metadata: {
        processingTime: result.processingTimeMs,
        timestamp: new Date(),
      },
    };
    res.status(result.success ? 200 : 500).json(response);
  } catch (error: unknown) {
    console.error('handleStudentSummaryPost:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Error interno del servidor',
      },
    } as APIResponse);
  }
}

export async function handleGetStudentSummary(req: Request, res: Response): Promise<void> {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).json({
      success: false,
      error: { message: 'Método no permitido. Usa GET' },
    } as APIResponse);
    return;
  }

  try {
    const { studentId, phase } = req.query;
    if (!studentId) {
      res.status(400).json({
        success: false,
        error: { message: 'studentId es requerido como query param' },
      } as APIResponse);
      return;
    }
    if (!phase || !['first', 'second', 'third'].includes(phase as string)) {
      res.status(400).json({
        success: false,
        error: { message: 'phase es requerido y debe ser: first, second o third' },
      } as APIResponse);
      return;
    }

    const summary = await studentSummaryService.getSummary(
      studentId as string,
      phase as Phase
    );
    res.status(200).json({
      success: true,
      data: summary,
      metadata: { timestamp: new Date() },
    } as APIResponse);
  } catch (error: unknown) {
    console.error('handleGetStudentSummary:', error);
    res.status(500).json({
      success: false,
      error: {
        message: error instanceof Error ? error.message : 'Error interno del servidor',
      },
    } as APIResponse);
  }
}

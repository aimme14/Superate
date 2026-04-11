/**
 * Lógica unificada para resumen académico (evita dos endpoints con IA duplicados).
 */
import type { Request, Response } from 'express';
import { HttpsError } from 'firebase-functions/v2/https';
import type { CallableRequest } from 'firebase-functions/v2/https';
import { studentSummaryService } from '../services/studentSummary.service';
import { assertTeacherCanAccessStudent } from '../services/teacherStudentAccess.service';
import type { APIResponse } from '../types/question.types';

type Phase = 'first' | 'second' | 'third';

export type StudentSummaryUnifiedInput = {
  studentId: string;
  phase: Phase;
  mode: 'ensure' | 'generate';
};

/**
 * Misma lógica que POST /studentSummary (ensure vs generate), sin Express.
 * Usada por el callable `generateStudentAcademicSummary`.
 */
export async function runStudentSummaryUnified(
  input: StudentSummaryUnifiedInput
): Promise<{ status: number; response: APIResponse }> {
  const { studentId, phase: ph, mode } = input;

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
      return { status: result.success ? 200 : 500, response };
    }

    const phaseName =
      ph === 'first' ? 'Fase I' : ph === 'second' ? 'Fase II' : 'Fase III';
    console.log(
      `\n📝 [studentSummary unified] ensure para ${studentId}, ${phaseName}`
    );

    const hasAll = await studentSummaryService.hasAllEvaluations(studentId, ph);
    if (!hasAll) {
      return {
        status: 200,
        response: {
          success: false,
          error: {
            message: `El estudiante aún no ha completado las 7 evaluaciones requeridas para ${phaseName}`,
          },
          data: { hasAllEvaluations: false },
        } as APIResponse,
      };
    }

    const existingSummary = await studentSummaryService.getSummary(studentId, ph);
    if (existingSummary) {
      return {
        status: 200,
        response: {
          success: true,
          data: {
            hasAllEvaluations: true,
            summaryExists: true,
            summary: existingSummary,
          },
        } as APIResponse,
      };
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
    return { status: result.success ? 200 : 500, response };
  } catch (error: unknown) {
    console.error('runStudentSummaryUnified:', error);
    return {
      status: 500,
      response: {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Error interno del servidor',
        },
      } as APIResponse,
    };
  }
}

function cors(res: Response): void {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Docente activo (claims) + mismo alcance que el callable (`studentSummaries`).
 * Debe ejecutarse tras `verifyBearerIdToken`.
 */
async function authorizeStudentSummaryHttp(
  req: Request,
  res: Response,
  studentId: string
): Promise<boolean> {
  const fa = req.firebaseAuth;
  if (!fa) {
    res.status(401).json({
      success: false,
      error: { message: 'No autenticado' },
    } as APIResponse);
    return false;
  }
  const claims = fa.decoded as Record<string, unknown>;
  const role = typeof claims.role === 'string' ? claims.role.trim() : '';
  const active = claims.active === true;
  if (role !== 'teacher' || !active) {
    res.status(403).json({
      success: false,
      error: {
        message: 'Solo docentes activos pueden acceder a esta ruta.',
      },
    } as APIResponse);
    return false;
  }
  const authPayload: CallableRequest['auth'] = {
    uid: fa.uid,
    token: fa.decoded,
    rawToken: fa.rawIdToken,
  };
  try {
    await assertTeacherCanAccessStudent(authPayload, studentId);
    return true;
  } catch (e: unknown) {
    if (e instanceof HttpsError) {
      const status =
        e.code === 'permission-denied'
          ? 403
          : e.code === 'unauthenticated'
            ? 401
            : 500;
      res.status(status).json({
        success: false,
        error: { message: e.message },
      } as APIResponse);
      return false;
    }
    throw e;
  }
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

  if (!(await authorizeStudentSummaryHttp(req, res, studentId))) {
    return;
  }

  const { status, response } = await runStudentSummaryUnified({
    studentId,
    phase: ph,
    mode,
  });
  res.status(status).json(response);
}

export async function handleGetStudentSummary(req: Request, res: Response): Promise<void> {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    if (!(await authorizeStudentSummaryHttp(req, res, studentId as string))) {
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

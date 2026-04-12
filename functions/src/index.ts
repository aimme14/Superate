/**
 * Cloud Functions para Supérate: API HTTP unificada (`superateHttp`) y triggers Firestore/Auth.
 */

import * as functions from 'firebase-functions/v1';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { beforeUserSignedIn } from 'firebase-functions/v2/identity';
import { db } from './config/firebase.config';
import { rebuildStudentProgressSummary } from './services/studentProgressSummary.service';
import { rebuildGradeSummary } from './services/gradeSummary.service';
import { rebuildInstitutionSummary } from './services/institutionSummary.service';
import {
  computeSuperateClaims,
  syncClaimsForUid,
  syncClaimsForInstitutionMembers,
} from './services/authClaims.service';
import { scheduleClaimsSync } from './services/authClaimsEnqueue.service';
import { createSuperateHttpApp } from './http/superateHttpApp';
import { runStudentSummaryUnified } from './http/studentSummaryUnified';
import { assertTeacherCanAccessStudent } from './services/teacherStudentAccess.service';
import { studentSummaryService } from './services/studentSummary.service';
import { pdfService } from './services/pdf.service';

// =============================
// CONFIGURACIÓN REGIONAL
// =============================

const REGION = 'us-central1';

async function displayNamesForAcademicPdf(
  studentId: string,
  institutionId: string
): Promise<{ studentName: string; institutionName?: string }> {
  let studentName = 'Estudiante';
  let institutionName: string | undefined;
  try {
    const est = await db
      .doc(`superate/auth/institutions/${institutionId}/estudiantes/${studentId}`)
      .get();
    if (est.exists) {
      const d = est.data();
      const n = d?.name ?? d?.displayName ?? d?.fullName ?? d?.nombre;
      if (typeof n === 'string' && n.trim()) {
        studentName = n.trim();
      }
    }
  } catch (e) {
    console.warn('[displayNamesForAcademicPdf] estudiantes', e);
  }
  try {
    const ins = await db.doc(`superate/auth/institutions/${institutionId}`).get();
    if (ins.exists) {
      const n = ins.data()?.name ?? ins.data()?.nombre;
      if (typeof n === 'string' && n.trim()) {
        institutionName = n.trim();
      }
    }
  } catch (e) {
    console.warn('[displayNamesForAcademicPdf] institution', e);
  }
  return { studentName, institutionName };
}

// =============================
// API HTTP UNIFICADA (Express)
// Rutas: https://<region>-<project>.cloudfunctions.net/superateHttp/<nombreRuta>
// Ej.: .../superateHttp/health, .../superateHttp/getStudyPlan
// =============================

/** HTTP unificada: incluye generación de plan de estudio (IA) y puede tardar varios minutos. */
const SUPERATE_HTTP_TIMEOUT_SECONDS = 540;
/** En Cloud Functions 1ª gen la CPU va ligada a la memoria; 256MB ≈ la mitad de 512MB. */
const SUPERATE_HTTP_MEMORY = '256MB' as const;

export const superateHttp = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: SUPERATE_HTTP_TIMEOUT_SECONDS,
    memory: SUPERATE_HTTP_MEMORY,
    secrets: ['YOUTUBE_API_KEY', 'GOOGLE_CSE_API_KEY', 'GOOGLE_CSE_ID'],
  })
  .https.onRequest(createSuperateHttpApp());

// =============================
// TRIGGER: resumen de progreso por estudiante (denormalizado bajo institución)
// =============================

/**
 * Al crear/actualizar/borrar un resultado en results/{uid}/{fase}/{examId},
 * recalcula superate/auth/institutions/{instId}/studentSummaries/{uid}
 */
export const onExamResultWriteStudentProgressSummary = onDocumentWritten(
  {
    document: 'results/{studentId}/{phaseName}/{examId}',
    region: REGION,
    /** Misma base que el cliente (Firestore default). Evita ambigüedad si se añade otra DB. */
    database: '(default)',
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (event) => {
    const studentId = event.params.studentId as string;
    const phaseName = event.params.phaseName as string;
    const examDocId = event.params.examId as string;
    try {
      const ok = await rebuildStudentProgressSummary(studentId);
      if (!ok) {
        console.warn(
          `[onExamResultWriteStudentProgressSummary] Sin contexto de institución para ${studentId}; studentSummaries no actualizado (revisar userLookup)`
        );
      } else {
        console.log(
          `[onExamResultWriteStudentProgressSummary] OK student=${studentId} phase=${phaseName} doc=${examDocId}`
        );
      }
    } catch (err) {
      console.error(
        `[onExamResultWriteStudentProgressSummary] student=${studentId} phase=${phaseName} doc=${examDocId}`,
        err
      );
      throw err;
    }
  }
);

/**
 * Recalcula gradeSummary para un grado/año (on-demand desde el dashboard del docente).
 */
/**
 * Resumen académico (ensure / generate) con autorización por custom claims:
 * docente activo y coincidencia institución/sede/grado/jornada vs studentSummaries.
 */
export const generateStudentAcademicSummary = onCall(
  {
    region: REGION,
    memory: '256MiB',
    timeoutSeconds: 30,
    /** Sin `secrets` aquí: evita solapamiento con vars del mismo nombre en `.env` (error Cloud Run 400). Gemini usa credenciales/Vertex por proyecto. */
  },
  async (request) => {
    const data = request.data as {
      studentId?: unknown;
      phase?: unknown;
      mode?: unknown;
      force?: unknown;
    };
    const studentId =
      typeof data.studentId === 'string' ? data.studentId.trim() : '';
    const phaseRaw =
      typeof data.phase === 'string' ? data.phase.trim() : '';
    const mode: 'ensure' | 'generate' =
      data.mode === 'generate' || data.force === true ? 'generate' : 'ensure';

    if (!studentId) {
      throw new HttpsError('invalid-argument', 'studentId es requerido');
    }
    if (!phaseRaw || !['first', 'second', 'third'].includes(phaseRaw)) {
      throw new HttpsError(
        'invalid-argument',
        'phase es requerido y debe ser: first, second o third'
      );
    }

    await assertTeacherCanAccessStudent(request.auth, studentId);

    const { response } = await runStudentSummaryUnified({
      studentId,
      phase: phaseRaw as 'first' | 'second' | 'third',
      mode,
    });
    if (
      mode === 'generate' &&
      response.success === true &&
      phaseRaw &&
      ['first', 'second', 'third'].includes(phaseRaw)
    ) {
      await pdfService
        .deleteCanonicalPdfIfExists(
          studentId,
          phaseRaw as 'first' | 'second' | 'third'
        )
        .catch(() => undefined);
    }
    return response;
  }
);

/**
 * URL pública del PDF del resumen (Storage). Reutiliza archivo canónico si existe;
 * si no, genera con PDFKit. Requiere que el resumen ya exista en Firestore.
 */
export const getStudentAcademicSummaryPDF = onCall(
  { region: REGION, memory: '256MiB', timeoutSeconds: 30 },
  async (request) => {
    const data = request.data as { studentId?: unknown; phase?: unknown };
    const studentId =
      typeof data.studentId === 'string' ? data.studentId.trim() : '';
    const phaseRaw =
      typeof data.phase === 'string' ? data.phase.trim() : '';
    if (!studentId) {
      throw new HttpsError('invalid-argument', 'studentId es requerido');
    }
    if (!phaseRaw || !['first', 'second', 'third'].includes(phaseRaw)) {
      throw new HttpsError(
        'invalid-argument',
        'phase es requerido y debe ser: first, second o third'
      );
    }
    const phase = phaseRaw as 'first' | 'second' | 'third';

    await assertTeacherCanAccessStudent(request.auth, studentId);

    const summary = await studentSummaryService.getSummary(studentId, phase);
    if (!summary) {
      throw new HttpsError('not-found', 'Genera el reporte primero');
    }

    const cachedUrl = await pdfService.getCanonicalPdfPublicUrlIfExists(
      studentId,
      phase
    );
    if (cachedUrl) {
      return { url: cachedUrl };
    }

    const token = request.auth?.token as Record<string, unknown>;
    const institutionId =
      typeof token.institutionId === 'string' ? token.institutionId.trim() : '';
    const { studentName, institutionName } = await displayNamesForAcademicPdf(
      studentId,
      institutionId
    );

    const gen = await pdfService.generateAndUploadPDF({
      studentName,
      studentId,
      institutionName,
      phase,
      summary,
    });
    if (!gen.success || !gen.downloadUrl) {
      throw new HttpsError(
        'internal',
        gen.error || 'No se pudo generar el PDF'
      );
    }
    return { url: gen.downloadUrl };
  }
);

export const rebuildGradeSummaryOnDemand = onCall(
  { region: REGION, memory: '256MiB', timeoutSeconds: 30 },
  async (request) => {
    const data = request.data as {
      institutionId?: unknown;
      gradeId?: unknown;
      academicYear?: unknown;
    };
    const institutionId =
      typeof data.institutionId === 'string' ? data.institutionId.trim() : '';
    const gradeId = typeof data.gradeId === 'string' ? data.gradeId.trim() : '';
    let academicYear: number | string | null = null;
    if (typeof data.academicYear === 'number' && Number.isFinite(data.academicYear)) {
      academicYear = data.academicYear;
    } else if (typeof data.academicYear === 'string' && data.academicYear.trim()) {
      academicYear = data.academicYear.trim();
    }

    if (!institutionId || !gradeId || academicYear === null) {
      throw new HttpsError(
        'invalid-argument',
        'institutionId, gradeId y academicYear son requeridos'
      );
    }

    try {
      await rebuildGradeSummary({ institutionId, gradeId, academicYear });
      return { ok: true as const };
    } catch (err) {
      console.error('[rebuildGradeSummaryOnDemand]', err);
      throw new HttpsError(
        'internal',
        err instanceof Error ? err.message : 'Error al recalcular gradeSummary'
      );
    }
  }
);

/**
 * Recalcula institutionSummary para institución/año (on-demand desde el dashboard del rector).
 */
export const rebuildInstitutionSummaryOnDemand = onCall(
  { region: REGION, memory: '256MiB', timeoutSeconds: 30 },
  async (request) => {
    const data = request.data as {
      institutionId?: unknown;
      academicYear?: unknown;
    };
    const institutionId =
      typeof data.institutionId === 'string' ? data.institutionId.trim() : '';
    let academicYear: number | string | null = null;
    if (typeof data.academicYear === 'number' && Number.isFinite(data.academicYear)) {
      academicYear = data.academicYear;
    } else if (typeof data.academicYear === 'string' && data.academicYear.trim()) {
      academicYear = data.academicYear.trim();
    }

    if (!institutionId || academicYear === null) {
      throw new HttpsError(
        'invalid-argument',
        'institutionId y academicYear son requeridos'
      );
    }

    try {
      await rebuildInstitutionSummary({ institutionId, academicYear });
      return { ok: true as const };
    } catch (err) {
      console.error('[rebuildInstitutionSummaryOnDemand]', err);
      throw new HttpsError(
        'internal',
        err instanceof Error ? err.message : 'Error al recalcular institutionSummary'
      );
    }
  }
);

// =============================
// Custom claims: cola + triggers consolidados
// =============================

const ROLE_SUBCOLLECTIONS = new Set([
  'rectores',
  'coordinadores',
  'profesores',
  'estudiantes',
]);

/**
 * users o userLookup: un solo trigger (antes eran dos funciones).
 */
export const onAuthUsersOrLookupWriteSyncClaims = onDocumentWritten(
  {
    document: 'superate/auth/{collectionId}/{uid}',
    region: REGION,
    memory: '256MiB',
    timeoutSeconds: 10,
  },
  async (event) => {
    const collectionId = event.params.collectionId as string;
    if (collectionId !== 'users' && collectionId !== 'userLookup') {
      return;
    }
    const uid = event.params.uid as string;
    try {
      await scheduleClaimsSync(uid);
    } catch (err) {
      console.error('[onAuthUsersOrLookupWriteSyncClaims]', err);
      throw err;
    }
  }
);

/**
 * Docs de rol bajo institución: un solo trigger (antes cuatro funciones).
 */
export const onInstitutionRoleWriteSyncClaims = onDocumentWritten(
  {
    document: 'superate/auth/institutions/{institutionId}/{roleSub}/{uid}',
    region: REGION,
    memory: '256MiB',
    timeoutSeconds: 10,
  },
  async (event) => {
    const roleSub = event.params.roleSub as string;
    if (!ROLE_SUBCOLLECTIONS.has(roleSub)) {
      return;
    }
    const uid = event.params.uid as string;
    try {
      await scheduleClaimsSync(uid);
    } catch (err) {
      console.error('[onInstitutionRoleWriteSyncClaims]', err);
      throw err;
    }
  }
);

/**
 * Procesa la cola: sincroniza claims y borra el doc para permitir nuevos encolados.
 */
export const onClaimsSyncQueueWrite = onDocumentWritten(
  {
    document: 'superate/auth/_syncClaimsQueue/{uid}',
    region: REGION,
    memory: '256MiB',
    timeoutSeconds: 10,
  },
  async (event) => {
    const uid = event.params.uid as string;
    const change = event.data;
    if (!change?.after.exists) {
      return;
    }
    try {
      await syncClaimsForUid(uid);
      await db.doc(`superate/auth/_syncClaimsQueue/${uid}`).delete();
    } catch (err) {
      console.error('[onClaimsSyncQueueWrite]', uid, err);
      throw err;
    }
  }
);

/** Institución activa/inactiva o borrada: refrescar claims de todos los miembros (lotes directos). */
export const onInstitutionWriteSyncClaims = onDocumentWritten(
  {
    document: 'superate/auth/institutions/{institutionId}',
    region: REGION,
    memory: '256MiB',
    timeoutSeconds: 10,
  },
  async (event) => {
    const institutionId = event.params.institutionId as string;
    try {
      const change = event.data;
      if (!change) return;
      if (!change.after.exists) {
        await syncClaimsForInstitutionMembers(institutionId);
        return;
      }
      const before = change.before.exists ? change.before.data() : null;
      const after = change.after.data();
      const beforeActive = before?.isActive === true;
      const afterActive = after?.isActive === true;
      if (change.before.exists && beforeActive === afterActive) {
        return;
      }
      await syncClaimsForInstitutionMembers(institutionId);
    } catch (err) {
      console.error('[onInstitutionWriteSyncClaims]', err);
      throw err;
    }
  }
);

// =============================
// AUTH BLOCKING: claims en el token al iniciar sesión (Identity Platform)
// =============================

export const setUserClaims = beforeUserSignedIn(
  { region: REGION, memory: '256MiB' },
  (async (user: any, _context: any) => {
    const uid = user?.uid;
    if (!uid) {
      return { customClaims: {} };
    }
    try {
      const claims = await computeSuperateClaims(uid);
      if (claims === null) {
        return { customClaims: {} };
      }
      return { customClaims: { ...claims } };
    } catch (err) {
      console.error('[setUserClaims]', uid, err);
      return { customClaims: {} };
    }
  }) as any
);

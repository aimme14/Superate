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

// =============================
// CONFIGURACIÓN REGIONAL
// =============================

const REGION = 'us-central1';

// =============================
// API HTTP UNIFICADA (Express)
// Rutas: https://<region>-<project>.cloudfunctions.net/superateHttp/<nombreRuta>
// Ej.: .../superateHttp/health, .../superateHttp/getStudyPlan
// =============================

export const superateHttp = functions
  .region(REGION)
  .runWith({
    timeoutSeconds: 540,
    memory: '1GB',
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
  },
  async (event) => {
    const studentId = event.params.studentId as string;
    try {
      const ok = await rebuildStudentProgressSummary(studentId);
      if (!ok) {
        console.warn(
          `[onExamResultWriteStudentProgressSummary] Sin contexto de institución para ${studentId}; studentSummaries no actualizado (revisar userLookup)`
        );
      }
    } catch (err) {
      console.error('[onExamResultWriteStudentProgressSummary]', err);
      throw err;
    }
  }
);

/**
 * Recalcula gradeSummary para un grado/año (on-demand desde el dashboard del docente).
 */
export const rebuildGradeSummaryOnDemand = onCall(
  { region: REGION },
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
  { region: REGION },
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
  { document: 'superate/auth/{collectionId}/{uid}', region: REGION },
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
  { document: 'superate/auth/_syncClaimsQueue/{uid}', region: REGION },
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
  { document: 'superate/auth/institutions/{institutionId}', region: REGION },
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
  { region: REGION },
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

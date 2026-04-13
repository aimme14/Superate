/**

 * Servicio de Resumen Académico del Estudiante (Frontend)

 *

 * Callables (`httpsCallable`) para generación/PDF y lectura directa a Firestore.

 * Las rutas HTTP legacy (`superateHttp`) pueden seguir usándose en otros flujos con Bearer.

 */



import { Result, success, failure } from '@/interfaces/db.interface';

import ErrorAPI from '@/errors';

import { normalizeError } from '@/errors/handler';

import { CLOUD_FUNCTIONS_HTTP_BASE } from '@/config/cloudFunctions';

import { authService } from '@/services/firebase/auth.service';

import { getFunctions, httpsCallable } from 'firebase/functions';

import { doc, onSnapshot } from 'firebase/firestore';

import { getFirestore } from 'firebase/firestore';

import { firebaseApp } from '@/services/db';



/** Misma región que `functions/src/index.ts` */

export const STUDENT_SUMMARY_FUNCTIONS_REGION = 'us-central1';



const fs = getFirestore(firebaseApp);



async function studentSummaryAuthHeaders(): Promise<HeadersInit> {

  const user = authService.auth.currentUser;

  if (!user) {

    throw new Error('Debes iniciar sesión para usar el resumen académico.');

  }

  const idToken = await user.getIdToken();

  return {

    'Content-Type': 'application/json',

    Authorization: `Bearer ${idToken}`,

  };

}



/** JWT con custom claims actualizados (p. ej. `role: teacher`) antes de callables. */

async function ensureCallableAuthToken(): Promise<void> {

  const user = authService.auth.currentUser;

  if (!user) {

    throw new Error('Debes iniciar sesión para usar el resumen académico.');

  }

  await user.getIdToken(true);

}



/**

 * Resumen académico generado por IA

 */

export interface AcademicSummary {

  resumen_general: string;

  analisis_competencial: string | Record<string, string>;

  /** Fase III (v2): texto continuo formal; opcional en documentos antiguos */
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

  contextoAcademico?: {

    grado?: string;

    nivel?: string;

    institutionId?: string;

    sedeId?: string;

    gradeId?: string;

    /** Nombre de sede / campus */

    sede?: string;

    /** Jornada (Mañana, Tarde, Única, …) */

    jornada?: string;

  };

  metricasGlobales?: {

    promedioGeneral: number;

    materiasFuertes: string[];

    materiasDebiles: string[];

    temasFuertes: { materia: string; tema: string; puntaje: number }[];

    temasDebiles: { materia: string; tema: string; puntaje: number }[];

    nivelGeneralDesempeno: string;

    /** Puntaje por materia (PDF / informes); opcional en documentos antiguos */
    resumenPorMateria?: { materia: string; puntaje: number; nivel: string }[];

    /** Todos los ejes evaluados por materia (PDF); opcional en documentos anteriores a este campo */
    ejesEvaluados?: { materia: string; tema: string; puntaje: number }[];

  };

}



interface APIResponse {

  success: boolean;

  data?: PersistedSummary | Record<string, unknown>;

  error?: { message: string };

  metadata?: {

    processingTime?: number;

    timestamp?: string;

  };

}



/** Respuesta típica de `generateStudentAcademicSummary` (callable). */

export function getCallableErrorMessage(res: unknown): string | null {

  if (!res || typeof res !== 'object') return null;

  const r = res as { success?: boolean; error?: { message?: string } };

  if (r.success === false && r.error?.message) {

    return r.error.message;

  }

  return null;

}



/**

 * Extrae `PersistedSummary` del payload del callable de generación.

 */

export function persistedSummaryFromCallableResult(res: unknown): PersistedSummary | null {

  if (!res || typeof res !== 'object') return null;

  const r = res as { success?: boolean; data?: unknown };

  if (r.success === false) return null;

  const data = r.data;

  if (!data || typeof data !== 'object') return null;

  const d = data as Record<string, unknown>;

  if ('resumen' in d && d.resumen && typeof d.resumen === 'object') {

    return data as PersistedSummary;

  }

  if ('summary' in d && d.summary && typeof d.summary === 'object') {

    const s = d.summary as PersistedSummary;

    if (s.resumen) return s;

  }

  return null;

}



/**

 * Escucha `ResumenStudent/{studentId}/{phase}/resumenActual` (misma ruta que en Cloud Functions).

 */

export function subscribeResumenActual(

  studentId: string,

  phase: 'first' | 'second' | 'third',

  onData: (data: PersistedSummary | null) => void

): () => void {

  const ref = doc(fs, 'ResumenStudent', studentId, phase, 'resumenActual');

  return onSnapshot(ref, (snap) => {

    onData(snap.exists() ? (snap.data() as PersistedSummary) : null);

  });

}



/**

 * Callable `generateStudentAcademicSummary` — solo `studentId`, `phase`, `mode`.

 */

export async function callGenerateStudentAcademicSummary(

  studentId: string,

  phase: 'first' | 'second' | 'third',

  mode: 'ensure' | 'generate'

): Promise<unknown> {

  await ensureCallableAuthToken();

  const f = getFunctions(firebaseApp, STUDENT_SUMMARY_FUNCTIONS_REGION);

  const fn = httpsCallable<

    { studentId: string; phase: string; mode: 'ensure' | 'generate' },

    APIResponse

  >(f, 'generateStudentAcademicSummary');

  const res = await fn({ studentId, phase, mode });

  return res.data;

}



/**

 * Callable `getStudentAcademicSummaryPDF` — devuelve URL pública en Storage.

 */

export async function callGetStudentAcademicSummaryPdfUrl(

  studentId: string,

  phase: 'first' | 'second' | 'third'

): Promise<string> {

  await ensureCallableAuthToken();

  const f = getFunctions(firebaseApp, STUDENT_SUMMARY_FUNCTIONS_REGION);

  const fn = httpsCallable<

    { studentId: string; phase: string },

    { url: string }

  >(f, 'getStudentAcademicSummaryPDF');

  const res = await fn({ studentId, phase });

  const url = res.data?.url;

  if (!url || typeof url !== 'string') {

    throw new Error('Respuesta sin URL de PDF');

  }

  return url;

}



/**

 * Servicio de Resumen Académico (HTTP legacy con Bearer)

 */

class StudentSummaryService {

  private static instance: StudentSummaryService;



  static getInstance(): StudentSummaryService {

    if (!StudentSummaryService.instance) {

      StudentSummaryService.instance = new StudentSummaryService();

    }

    return StudentSummaryService.instance;

  }



  async generateSummary(

    studentId: string,

    phase: 'first' | 'second' | 'third',

    force: boolean = false

  ): Promise<Result<PersistedSummary>> {

    try {

      const url = `${CLOUD_FUNCTIONS_HTTP_BASE}/studentSummary`;

      const body = force

        ? { studentId, phase, mode: 'generate' as const }

        : { studentId, phase, mode: 'ensure' as const };



      const response = await fetch(url, {

        method: 'POST',

        headers: await studentSummaryAuthHeaders(),

        body: JSON.stringify(body),

      });



      if (!response.ok) {

        const errorData = await response.json().catch(() => ({}));

        throw new Error(

          (errorData as { error?: { message?: string } }).error?.message ||

            `Error HTTP: ${response.status}`

        );

      }



      const data = (await response.json()) as APIResponse;



      if (!data.success) {

        throw new Error(data.error?.message || 'Error generando resumen');

      }



      const payload = data.data as PersistedSummary | { summary?: PersistedSummary } | undefined;

      if (payload && typeof payload === 'object' && 'resumen' in payload) {

        return success(payload as PersistedSummary);

      }

      const nested = payload as { summary?: PersistedSummary } | undefined;

      if (nested?.summary) {

        return success(nested.summary);

      }

      throw new Error(data.error?.message || 'Error generando resumen');

    } catch (e) {

      console.error('Error generando resumen académico:', e);

      return failure(new ErrorAPI(normalizeError(e, 'generar resumen académico')));

    }

  }



  async getSummary(

    studentId: string,

    phase: 'first' | 'second' | 'third'

  ): Promise<Result<PersistedSummary | null>> {

    try {

      const url = `${CLOUD_FUNCTIONS_HTTP_BASE}/getStudentSummary?studentId=${encodeURIComponent(studentId)}&phase=${phase}`;



      const response = await fetch(url, {

        method: 'GET',

        headers: await studentSummaryAuthHeaders(),

      });



      if (!response.ok) {

        const errorData = await response.json().catch(() => ({}));

        throw new Error(

          (errorData as { error?: { message?: string } }).error?.message ||

            `Error HTTP: ${response.status}`

        );

      }



      const data = (await response.json()) as APIResponse;



      if (!data.success) {

        throw new Error(data.error?.message || 'Error obteniendo resumen');

      }



      return success((data.data as PersistedSummary | null) || null);

    } catch (e) {

      console.error('Error obteniendo resumen académico:', e);

      return failure(new ErrorAPI(normalizeError(e, 'obtener resumen académico')));

    }

  }

}



export const studentSummaryService = StudentSummaryService.getInstance();



export default studentSummaryService;



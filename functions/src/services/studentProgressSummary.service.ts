/**
 * Reconstruye el documento denormalizado de progreso por fase/materia
 * a partir de results/{studentId}/{phaseFolder}/{examId}.
 *
 * Debe usar la misma instancia de Firestore que el trigger (db en firebase.config).
 */

import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { db } from '../config/firebase.config';
import {
  EXPECTED_SUBJECT_COUNT,
  subjectLabelToSlug,
  type SubjectSlug,
} from '../config/subjectSlugs';
import type {
  PhaseProgressBlock,
  ProgressPhaseKey,
  StudentProgressSummaryDoc,
  SubjectProgressCell,
  TrendLabel,
} from '../types/studentProgressSummary.types';

/** v3: metadatos de estudiante/jornada/grade/campus para lecturas summary-only */
const SCHEMA_VERSION = 3;
const TOTAL_POSSIBLE_SUBMISSIONS = EXPECTED_SUBJECT_COUNT * 3;

/**
 * Clona datos del examen para guardarlos en el resumen (preserva Timestamp anidados).
 */
function cloneDeepForFirestore(
  input: admin.firestore.DocumentData
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(input)) {
    const v = input[key];
    if (v === undefined) continue;
    out[key] = cloneValue(v);
  }
  return out;
}

function cloneValue(v: unknown): unknown {
  if (v === null) return null;
  if (v instanceof admin.firestore.Timestamp) return v;
  if (v instanceof admin.firestore.GeoPoint) return v;
  if (Array.isArray(v)) return v.map((item) => cloneValue(item));
  if (typeof v === 'object') {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (val === undefined) continue;
      o[k] = cloneValue(val);
    }
    return o;
  }
  return v;
}

/** Subcolecciones por fase (coherente con getPhaseName en el cliente) */
const PHASE_FOLDERS: Record<ProgressPhaseKey, string[]> = {
  first: ['fase I', 'Fase I', 'Fase 1', 'fase 1', 'first'],
  second: ['Fase II', 'fase II', 'Fase 2', 'fase 2', 'second'],
  third: ['fase III', 'Fase III', 'Fase 3', 'fase 3', 'third'],
};

function isCompletedExam(data: admin.firestore.DocumentData | undefined): boolean {
  if (!data) return false;
  if (data.completed === false || data.isCompleted === false) return false;
  return true;
}

function extractScore(data: admin.firestore.DocumentData): number {
  const s = data.score;
  if (s && typeof s === 'object' && typeof s.overallPercentage === 'number') {
    return Math.round(s.overallPercentage * 10) / 10;
  }
  if (typeof s === 'number' && !Number.isNaN(s)) return Math.round(s * 10) / 10;
  return 0;
}

function extractSubmittedAt(
  data: admin.firestore.DocumentData
): admin.firestore.Timestamp | null {
  const ts = data.timestamp;
  if (typeof ts === 'number' && !Number.isNaN(ts)) {
    return admin.firestore.Timestamp.fromMillis(ts);
  }
  if (ts instanceof admin.firestore.Timestamp) return ts;
  const end = data.endTime;
  if (typeof end === 'string' && end) {
    const ms = Date.parse(end);
    if (!Number.isNaN(ms)) return admin.firestore.Timestamp.fromMillis(ms);
  }
  return null;
}

type BestBySubject = Map<
  SubjectSlug,
  {
    score: number;
    submittedAt: admin.firestore.Timestamp | null;
    examId: string;
    rawData: admin.firestore.DocumentData;
  }
>;

/**
 * Recorre todas las variantes de nombre de subcolección y conserva por materia
 * el examen con mayor puntaje (empate: el más reciente por timestamp).
 */
async function collectBestPerSubjectForPhase(
  firestore: Firestore,
  studentId: string,
  phaseKey: ProgressPhaseKey
): Promise<BestBySubject> {
  const best: BestBySubject = new Map();
  const folders = PHASE_FOLDERS[phaseKey];
  const seenExamIds = new Set<string>();

  for (const folder of folders) {
    const snap = await firestore
      .collection('results')
      .doc(studentId)
      .collection(folder)
      .get();

    for (const doc of snap.docs) {
      if (seenExamIds.has(doc.id)) continue;
      const data = doc.data();
      if (!isCompletedExam(data)) continue;

      const slug = subjectLabelToSlug(
        (data.subject as string) || (data.examTitle as string) || ''
      );
      if (!slug) continue;

      const score = extractScore(data);
      const submittedAt = extractSubmittedAt(data);
      seenExamIds.add(doc.id);

      const rawData = data;
      const prev = best.get(slug);
      if (!prev) {
        best.set(slug, { score, submittedAt, examId: doc.id, rawData });
        continue;
      }
      if (score > prev.score) {
        best.set(slug, { score, submittedAt, examId: doc.id, rawData });
        continue;
      }
      if (score === prev.score) {
        const prevMs = prev.submittedAt?.toMillis() ?? 0;
        const curMs = submittedAt?.toMillis() ?? 0;
        if (curMs >= prevMs) {
          best.set(slug, { score, submittedAt, examId: doc.id, rawData });
        }
      }
    }
  }

  return best;
}

function buildSubjectsRecord(best: BestBySubject): Record<string, SubjectProgressCell> {
  const out: Record<string, SubjectProgressCell> = {};
  best.forEach((v, slug) => {
    out[slug] = {
      score: v.score,
      submittedAt: v.submittedAt,
      examId: v.examId,
      examSnapshot: cloneDeepForFirestore(v.rawData),
    };
  });
  return out;
}

function averageScores(subjects: Record<string, SubjectProgressCell>): number | null {
  const vals = Object.values(subjects).map((s) => s.score);
  if (vals.length === 0) return null;
  const sum = vals.reduce((a, b) => a + b, 0);
  return Math.round((sum / vals.length) * 10) / 10;
}

function maxTimestamp(
  subjects: Record<string, SubjectProgressCell>
): admin.firestore.Timestamp | null {
  let max: admin.firestore.Timestamp | null = null;
  for (const c of Object.values(subjects)) {
    if (!c.submittedAt) continue;
    if (!max || c.submittedAt.toMillis() > max.toMillis()) max = c.submittedAt;
  }
  return max;
}

function emptyPhaseBlock(): PhaseProgressBlock {
  return {
    submittedCount: 0,
    isComplete: false,
    phaseAvg: null,
    completedAt: null,
    subjects: {},
  };
}

function buildPhaseBlock(best: BestBySubject): PhaseProgressBlock {
  const subjects = buildSubjectsRecord(best);
  const submittedCount = Object.keys(subjects).length;
  const isComplete = submittedCount >= EXPECTED_SUBJECT_COUNT;
  const phaseAvg = averageScores(subjects);
  const completedAt = isComplete ? maxTimestamp(subjects) : null;

  return {
    submittedCount,
    isComplete,
    phaseAvg,
    completedAt,
    subjects,
  };
}

function trendFromAvgs(a: number | null, b: number | null): TrendLabel | null {
  if (a === null || b === null) return null;
  const diff = b - a;
  if (Math.abs(diff) < 0.5) return 'stable';
  return diff > 0 ? 'improving' : 'declining';
}

export interface StudentInstitutionContext {
  institutionId: string;
  studentName?: string;
  sedeId?: string;
  jornada?: 'mañana' | 'tarde';
  campusName?: string;
  gradeId?: string;
  gradeName?: string;
  academicYear?: number | string;
}

function pickStudentNameFromStudent(
  d: admin.firestore.DocumentData | undefined
): string | undefined {
  if (!d) return undefined;
  const ordered: unknown[] = [d.name, d.displayName, d.fullName, d.nombre];
  for (const v of ordered) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function normalizeJornada(value: unknown): 'mañana' | 'tarde' | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().toLowerCase();
  if (v === 'manana' || v === 'mañana') return 'mañana';
  if (v === 'tarde') return 'tarde';
  return undefined;
}

function pickGradeNameFromStudent(
  d: admin.firestore.DocumentData | undefined
): string | undefined {
  if (!d) return undefined;
  const ordered: unknown[] = [d.gradeName, d.grade];
  for (const v of ordered) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** ID de sede: campusId y sedeId primero; luego campus/sede si son string no vacíos */
function pickSedeIdFromStudent(
  d: admin.firestore.DocumentData | undefined
): string | undefined {
  if (!d) return undefined;
  const ordered: unknown[] = [d.campusId, d.sedeId, d.campus, d.sede];
  for (const v of ordered) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

/** Nombre de sede para mostrar */
function pickCampusNameFromStudent(
  d: admin.firestore.DocumentData | undefined
): string | undefined {
  if (!d) return undefined;
  const ordered: unknown[] = [
    d.campusName,
    d.sedeNombre,
    d.sedeName,
    d.nombreSede,
  ];
  for (const v of ordered) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return undefined;
}

function contextFromStudentDoc(
  institutionId: string,
  d: admin.firestore.DocumentData | undefined
): StudentInstitutionContext {
  return {
    institutionId,
    studentName: pickStudentNameFromStudent(d),
    sedeId: pickSedeIdFromStudent(d),
    jornada: normalizeJornada(d?.jornada),
    campusName: pickCampusNameFromStudent(d),
    gradeId: (d?.gradeId || d?.grade) as string | undefined,
    gradeName: pickGradeNameFromStudent(d),
    academicYear: d?.academicYear as number | string | undefined,
  };
}

/**
 * Resuelve institución: userLookup O(n) instituciones como respaldo.
 */
export async function resolveStudentInstitution(
  firestore: Firestore,
  studentId: string
): Promise<StudentInstitutionContext | null> {
  try {
    const lookupRef = firestore.doc(`superate/auth/userLookup/${studentId}`);
    const lookupSnap = await lookupRef.get();
    if (lookupSnap.exists) {
      const institutionId = lookupSnap.data()?.institutionId as string | undefined;
      if (institutionId) {
        const stRef = firestore.doc(
          `superate/auth/institutions/${institutionId}/estudiantes/${studentId}`
        );
        const stSnap = await stRef.get();
        if (stSnap.exists) {
          return contextFromStudentDoc(institutionId, stSnap.data());
        }
      }
    }
  } catch (e) {
    console.warn('[studentProgressSummary] userLookup falló:', e);
  }

  return null;
}

/**
 * Recalcula y escribe el resumen de progreso del estudiante.
 * @param firestore — por defecto `db` del proyecto que despliega las Functions
 * @returns false si no hay institución para el estudiante
 */
export async function rebuildStudentProgressSummary(
  studentId: string,
  firestore: Firestore = db
): Promise<boolean> {
  const ctx = await resolveStudentInstitution(firestore, studentId);
  if (!ctx) {
    console.warn(
      `[studentProgressSummary] Sin institución para ${studentId}; no se escribe resumen`
    );
    return false;
  }

  const phases: Record<ProgressPhaseKey, PhaseProgressBlock> = {
    first: emptyPhaseBlock(),
    second: emptyPhaseBlock(),
    third: emptyPhaseBlock(),
  };

  const keys: ProgressPhaseKey[] = ['first', 'second', 'third'];
  for (const k of keys) {
    const best = await collectBestPerSubjectForPhase(firestore, studentId, k);
    phases[k] = buildPhaseBlock(best);
  }

  let totalSubmitted = 0;
  let sumAll = 0;
  for (const k of keys) {
    for (const cell of Object.values(phases[k].subjects)) {
      totalSubmitted += 1;
      sumAll += cell.score;
    }
  }

  const overallAvg =
    totalSubmitted > 0 ? Math.round((sumAll / totalSubmitted) * 10) / 10 : null;
  const progressPct =
    Math.round((totalSubmitted / TOTAL_POSSIBLE_SUBMISSIONS) * 1000) / 10;

  const trend = {
    firstToSecond: trendFromAvgs(phases.first.phaseAvg, phases.second.phaseAvg),
    secondToThird: trendFromAvgs(phases.second.phaseAvg, phases.third.phaseAvg),
  };

  const dest = firestore.doc(
    `superate/auth/institutions/${ctx.institutionId}/studentSummaries/${studentId}`
  );

  const payload: Omit<StudentProgressSummaryDoc, 'lastUpdatedAt'> & {
    lastUpdatedAt: admin.firestore.FieldValue;
  } = {
    studentId,
    studentName: ctx.studentName,
    institutionId: ctx.institutionId,
    sedeId: ctx.sedeId,
    jornada: ctx.jornada,
    campusName: ctx.campusName,
    gradeId: ctx.gradeId,
    gradeName: ctx.gradeName,
    academicYear: ctx.academicYear,
    phases,
    totalSubmitted,
    overallAvg,
    progressPct,
    trend,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    schemaVersion: SCHEMA_VERSION,
  };

  await dest.set(payload, { merge: true });

  console.log(
    `[studentProgressSummary] OK student=${studentId} inst=${ctx.institutionId} total=${totalSubmitted}`
  );
  return true;
}

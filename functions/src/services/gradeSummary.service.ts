import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { db } from '../config/firebase.config';
import type {
  GradePhaseSummary,
  GradeSubjectSummary,
  GradeSummaryDoc,
  GradeTopicSummary,
  ProgressPhaseKey,
} from '../types/gradeSummary.types';

const SCHEMA_VERSION = 2;
const COMPUTED_FROM = 'studentSummaries:v3';
const PHASES: ProgressPhaseKey[] = ['first', 'second', 'third'];

interface GradeSummaryContext {
  institutionId: string;
  gradeId: string;
  academicYear: number | string;
}

function pickSedeId(data: admin.firestore.DocumentData | undefined): string | null {
  if (!data) return null;
  const candidates: unknown[] = [data.sedeId, data.campusId, data.sede, data.campus];
  for (const value of candidates) {
    if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  }
  return null;
}

function normalizeJornada(value: unknown): 'mañana' | 'tarde' | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'manana' || v === 'mañana') return 'mañana';
  if (v === 'tarde') return 'tarde';
  return null;
}

function pickNonEmptyString(
  data: admin.firestore.DocumentData | undefined,
  keys: string[]
): string | null {
  if (!data) return null;
  for (const k of keys) {
    const value = data[k];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

interface TopicAccumulator {
  totalCorrect: number;
  totalQuestions: number;
  students: Set<string>;
}

interface SubjectAccumulator {
  submitted: number;
  totalCorrect: number;
  totalQuestions: number;
  topics: Map<string, TopicAccumulator>;
}

interface PhaseAccumulator {
  studentsComplete: number;
  sumPhaseAvg: number;
  phaseAvgCount: number;
  subjects: Map<string, SubjectAccumulator>;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(correct: number, total: number): number | null {
  if (total <= 0) return null;
  return round1((correct / total) * 100);
}

function pickExtremaSubject(
  subjects: Record<string, GradeSubjectSummary>,
  mode: 'weakest' | 'strongest'
): string | null {
  let chosen: string | null = null;
  let best: number | null = null;
  for (const [subjectKey, subject] of Object.entries(subjects)) {
    if (subject.avgPct === null) continue;
    if (best === null) {
      best = subject.avgPct;
      chosen = subjectKey;
      continue;
    }
    if (mode === 'weakest' ? subject.avgPct < best : subject.avgPct > best) {
      best = subject.avgPct;
      chosen = subjectKey;
    }
  }
  return chosen;
}

function pickExtremaTopic(
  topics: Record<string, GradeTopicSummary>,
  mode: 'weakest' | 'strongest'
): string | null {
  let chosen: string | null = null;
  let best: number | null = null;
  for (const [topicName, topic] of Object.entries(topics)) {
    if (topic.pct === null) continue;
    if (best === null) {
      best = topic.pct;
      chosen = topicName;
      continue;
    }
    if (mode === 'weakest' ? topic.pct < best : topic.pct > best) {
      best = topic.pct;
      chosen = topicName;
    }
  }
  return chosen;
}

function getQuestionStats(examSnapshot: Record<string, unknown>): {
  totalQuestions: number;
  totalCorrect: number;
} {
  const score = examSnapshot.score as Record<string, unknown> | undefined;
  const correctFromScore = score?.correctAnswers;
  const totalFromScore = score?.totalQuestions;
  if (
    typeof correctFromScore === 'number' &&
    typeof totalFromScore === 'number' &&
    Number.isFinite(correctFromScore) &&
    Number.isFinite(totalFromScore)
  ) {
    return {
      totalCorrect: Math.max(0, correctFromScore),
      totalQuestions: Math.max(0, totalFromScore),
    };
  }

  const questionDetails = examSnapshot.questionDetails as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(questionDetails)) {
    return { totalCorrect: 0, totalQuestions: 0 };
  }
  let totalCorrect = 0;
  for (const q of questionDetails) {
    if (q?.isCorrect === true) totalCorrect += 1;
  }
  return {
    totalCorrect,
    totalQuestions: questionDetails.length,
  };
}

function getOrCreatePhaseAcc(acc: Map<ProgressPhaseKey, PhaseAccumulator>, phase: ProgressPhaseKey): PhaseAccumulator {
  const current = acc.get(phase);
  if (current) return current;
  const next: PhaseAccumulator = {
    studentsComplete: 0,
    sumPhaseAvg: 0,
    phaseAvgCount: 0,
    subjects: new Map(),
  };
  acc.set(phase, next);
  return next;
}

function getOrCreateSubjectAcc(phaseAcc: PhaseAccumulator, subjectKey: string): SubjectAccumulator {
  const current = phaseAcc.subjects.get(subjectKey);
  if (current) return current;
  const next: SubjectAccumulator = {
    submitted: 0,
    totalCorrect: 0,
    totalQuestions: 0,
    topics: new Map(),
  };
  phaseAcc.subjects.set(subjectKey, next);
  return next;
}

function getOrCreateTopicAcc(subjectAcc: SubjectAccumulator, topicName: string): TopicAccumulator {
  const current = subjectAcc.topics.get(topicName);
  if (current) return current;
  const next: TopicAccumulator = {
    totalCorrect: 0,
    totalQuestions: 0,
    students: new Set<string>(),
  };
  subjectAcc.topics.set(topicName, next);
  return next;
}

function toAcademicYearSuffix(year: number | string): string {
  return String(year).trim();
}

export function extractGradeSummaryContext(
  data: admin.firestore.DocumentData | undefined,
  institutionIdFromPath?: string
): GradeSummaryContext | null {
  if (!data) return null;
  const gradeId = typeof data.gradeId === 'string' ? data.gradeId.trim() : '';
  const institutionIdRaw =
    typeof data.institutionId === 'string' && data.institutionId.trim()
      ? data.institutionId.trim()
      : institutionIdFromPath?.trim() || '';
  const academicYear = data.academicYear as number | string | undefined;
  const hasAcademicYear =
    typeof academicYear === 'number' ||
    (typeof academicYear === 'string' && academicYear.trim().length > 0);

  if (!gradeId || !institutionIdRaw || !hasAcademicYear) return null;
  return {
    institutionId: institutionIdRaw,
    gradeId,
    academicYear: academicYear as number | string,
  };
}

export async function rebuildGradeSummary(
  context: GradeSummaryContext,
  firestore: Firestore = db
): Promise<boolean> {
  const { institutionId, gradeId, academicYear } = context;
  const gradeSummaryId = `${toAcademicYearSuffix(academicYear)}_${gradeId}`;

  const studentSummariesRef = firestore
    .collection('superate')
    .doc('auth')
    .collection('institutions')
    .doc(institutionId)
    .collection('studentSummaries');

  const snapshot = await studentSummariesRef
    .where('gradeId', '==', gradeId)
    .where('academicYear', '==', academicYear)
    .get();

  const totalStudents = snapshot.size;
  const sedeIds = new Set<string>();
  const campusNames = new Set<string>();
  const gradeNames = new Set<string>();
  const jornadas = { manana: 0, tarde: 0 };
  const jornadasSet = new Set<'mañana' | 'tarde'>();
  const studentNames = new Set<string>();
  const phaseAcc = new Map<ProgressPhaseKey, PhaseAccumulator>();
  for (const phase of PHASES) {
    getOrCreatePhaseAcc(phaseAcc, phase);
  }

  for (const studentDoc of snapshot.docs) {
    const studentId = studentDoc.id;
    const data = studentDoc.data();
    const sedeId = pickSedeId(data);
    if (sedeId) sedeIds.add(sedeId);
    const campusName = pickNonEmptyString(data, ['campusName']);
    if (campusName) campusNames.add(campusName);
    const gradeName = pickNonEmptyString(data, ['gradeName', 'grade']);
    if (gradeName) gradeNames.add(gradeName);
    const studentName = pickNonEmptyString(data, ['studentName', 'name', 'displayName']);
    if (studentName) studentNames.add(studentName);
    const jornada = normalizeJornada(data?.jornada);
    if (jornada === 'mañana') {
      jornadas.manana += 1;
      jornadasSet.add('mañana');
    }
    if (jornada === 'tarde') {
      jornadas.tarde += 1;
      jornadasSet.add('tarde');
    }
    const phases = data?.phases as Record<string, unknown> | undefined;
    if (!phases || typeof phases !== 'object') continue;

    for (const phase of PHASES) {
      const phaseData = phases[phase] as Record<string, unknown> | undefined;
      if (!phaseData || typeof phaseData !== 'object') continue;
      const pAcc = getOrCreatePhaseAcc(phaseAcc, phase);

      if (phaseData.isComplete === true) {
        pAcc.studentsComplete += 1;
      }
      if (typeof phaseData.phaseAvg === 'number' && Number.isFinite(phaseData.phaseAvg)) {
        pAcc.sumPhaseAvg += phaseData.phaseAvg;
        pAcc.phaseAvgCount += 1;
      }

      const subjects = phaseData.subjects as Record<string, unknown> | undefined;
      if (!subjects || typeof subjects !== 'object') continue;

      for (const [subjectKey, subjectUnknown] of Object.entries(subjects)) {
        const subject = subjectUnknown as Record<string, unknown>;
        const examSnapshot = subject?.examSnapshot as Record<string, unknown> | undefined;
        if (!examSnapshot || typeof examSnapshot !== 'object') continue;

        const sAcc = getOrCreateSubjectAcc(pAcc, subjectKey);
        sAcc.submitted += 1;

        const stats = getQuestionStats(examSnapshot);
        sAcc.totalCorrect += stats.totalCorrect;
        sAcc.totalQuestions += stats.totalQuestions;

        const questionDetails = examSnapshot.questionDetails as Array<Record<string, unknown>> | undefined;
        if (!Array.isArray(questionDetails)) continue;

        for (const q of questionDetails) {
          const topicNameRaw = typeof q?.topic === 'string' ? q.topic.trim() : '';
          const topicName = topicNameRaw || 'Sin tema';
          const tAcc = getOrCreateTopicAcc(sAcc, topicName);
          tAcc.totalQuestions += 1;
          if (q?.isCorrect === true) tAcc.totalCorrect += 1;
          tAcc.students.add(studentId);
        }
      }
    }
  }

  const phases: Record<ProgressPhaseKey, GradePhaseSummary> = {
    first: {
      studentsComplete: 0,
      completionRate: 0,
      avgScore: null,
      weakestSubject: null,
      strongestSubject: null,
      subjects: {},
    },
    second: {
      studentsComplete: 0,
      completionRate: 0,
      avgScore: null,
      weakestSubject: null,
      strongestSubject: null,
      subjects: {},
    },
    third: {
      studentsComplete: 0,
      completionRate: 0,
      avgScore: null,
      weakestSubject: null,
      strongestSubject: null,
      subjects: {},
    },
  };

  for (const phase of PHASES) {
    const pAcc = getOrCreatePhaseAcc(phaseAcc, phase);
    const subjects: Record<string, GradeSubjectSummary> = {};
    for (const [subjectKey, sAcc] of pAcc.subjects.entries()) {
      const topics: Record<string, GradeTopicSummary> = {};
      for (const [topicName, tAcc] of sAcc.topics.entries()) {
        topics[topicName] = {
          totalCorrect: tAcc.totalCorrect,
          totalQuestions: tAcc.totalQuestions,
          pct: pct(tAcc.totalCorrect, tAcc.totalQuestions),
          studentsCount: tAcc.students.size,
        };
      }
      subjects[subjectKey] = {
        avgPct: pct(sAcc.totalCorrect, sAcc.totalQuestions),
        submitted: sAcc.submitted,
        totalCorrect: sAcc.totalCorrect,
        totalQuestions: sAcc.totalQuestions,
        weakestTopic: pickExtremaTopic(topics, 'weakest'),
        strongestTopic: pickExtremaTopic(topics, 'strongest'),
        topics,
      };
    }

    phases[phase] = {
      studentsComplete: pAcc.studentsComplete,
      completionRate: totalStudents > 0 ? round1((pAcc.studentsComplete / totalStudents) * 100) : 0,
      avgScore: pAcc.phaseAvgCount > 0 ? round1(pAcc.sumPhaseAvg / pAcc.phaseAvgCount) : null,
      weakestSubject: pickExtremaSubject(subjects, 'weakest'),
      strongestSubject: pickExtremaSubject(subjects, 'strongest'),
      subjects,
    };
  }

  const ref = firestore.doc(
    `superate/auth/institutions/${institutionId}/gradeSummary/${gradeSummaryId}`
  );

  const payload: Omit<GradeSummaryDoc, 'lastUpdatedAt'> & {
    lastUpdatedAt: admin.firestore.FieldValue;
  } = {
    gradeId,
    gradeName: gradeNames.size === 1 ? Array.from(gradeNames)[0] : null,
    institutionId,
    sedeId: sedeIds.size === 1 ? Array.from(sedeIds)[0] : null,
    campusName: campusNames.size === 1 ? Array.from(campusNames)[0] : null,
    jornada: jornadasSet.size === 1 ? Array.from(jornadasSet)[0] : null,
    jornadas,
    studentNames: Array.from(studentNames).sort(),
    academicYear,
    totalStudents,
    phases,
    schemaVersion: SCHEMA_VERSION,
    computedFrom: COMPUTED_FROM,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await ref.set(payload, { merge: true });
  console.log(
    `[gradeSummary] OK institution=${institutionId} grade=${gradeId} year=${academicYear} students=${totalStudents}`
  );
  return true;
}

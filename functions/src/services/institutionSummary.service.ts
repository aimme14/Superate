import * as admin from 'firebase-admin';
import type { Firestore } from 'firebase-admin/firestore';
import { db } from '../config/firebase.config';
import type { GradeSummaryDoc, ProgressPhaseKey } from '../types/gradeSummary.types';
import type {
  InstitutionByGradeSummary,
  InstitutionBySedeSummary,
  InstitutionGradeRankingEntry,
  InstitutionPhaseSummary,
  InstitutionSubjectSummary,
  InstitutionSummaryDoc,
  InstitutionTopicSummary,
} from '../types/institutionSummary.types';

const SCHEMA_VERSION = 1;
const COMPUTED_FROM = 'gradeSummaries:v1';
const PHASES: ProgressPhaseKey[] = ['first', 'second', 'third'];

interface InstitutionSummaryContext {
  institutionId: string;
  academicYear: number | string;
}

interface TopicAcc {
  totalCorrect: number;
  totalQuestions: number;
  studentsCount: number;
}

interface SubjectAcc {
  totalCorrect: number;
  totalQuestions: number;
  submitted: number;
  byGrade: Map<string, { gradeName: string | null; totalCorrect: number; totalQuestions: number; submitted: number }>;
  topics: Map<string, TopicAcc>;
}

interface PhaseAcc {
  sumAvgScoreWeighted: number;
  totalStudentsWeighted: number;
  studentsComplete: number;
  byJornada: Map<'mañana' | 'tarde', { sumAvgScoreWeighted: number; totalStudentsWeighted: number; grades: Set<string> }>;
  bySede: Map<string, { campusName: string | null; sumAvgScoreWeighted: number; totalStudentsWeighted: number; grades: Set<string> }>;
  subjects: Map<string, SubjectAcc>;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function pct(correct: number, total: number): number | null {
  if (total <= 0) return null;
  return round1((correct / total) * 100);
}

function toAcademicYearSuffix(year: number | string): string {
  return String(year).trim();
}

function getOrCreatePhaseAcc(acc: Map<ProgressPhaseKey, PhaseAcc>, phase: ProgressPhaseKey): PhaseAcc {
  const current = acc.get(phase);
  if (current) return current;
  const next: PhaseAcc = {
    sumAvgScoreWeighted: 0,
    totalStudentsWeighted: 0,
    studentsComplete: 0,
    byJornada: new Map(),
    bySede: new Map(),
    subjects: new Map(),
  };
  acc.set(phase, next);
  return next;
}

function getOrCreateSubjectAcc(phaseAcc: PhaseAcc, subjectKey: string): SubjectAcc {
  const current = phaseAcc.subjects.get(subjectKey);
  if (current) return current;
  const next: SubjectAcc = {
    totalCorrect: 0,
    totalQuestions: 0,
    submitted: 0,
    byGrade: new Map(),
    topics: new Map(),
  };
  phaseAcc.subjects.set(subjectKey, next);
  return next;
}

function pickExtremaSubject(
  subjects: Record<string, InstitutionSubjectSummary>,
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
  topics: Record<string, InstitutionTopicSummary>,
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

function normalizeJornada(value: unknown): 'mañana' | 'tarde' | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  if (v === 'manana' || v === 'mañana') return 'mañana';
  if (v === 'tarde') return 'tarde';
  return null;
}

export async function rebuildInstitutionSummary(
  context: InstitutionSummaryContext,
  firestore: Firestore = db
): Promise<boolean> {
  const { institutionId, academicYear } = context;
  const summaryId = `${toAcademicYearSuffix(academicYear)}_${institutionId}`;

  const gradeSummaryRef = firestore
    .collection('superate')
    .doc('auth')
    .collection('institutions')
    .doc(institutionId)
    .collection('gradeSummary');

  const snapshot = await gradeSummaryRef.where('academicYear', '==', academicYear).get();
  const gradeDocs = snapshot.docs.map((d) => ({ id: d.id, data: d.data() as GradeSummaryDoc }));

  const totalGrades = gradeDocs.length;
  const totalStudents = gradeDocs.reduce((sum, item) => sum + (item.data.totalStudents || 0), 0);
  const byJornada: Partial<Record<'mañana' | 'tarde', number>> = {};
  const bySedeAcc = new Map<string, { campusName: string | null; totalStudents: number; grades: Set<string> }>();
  const byGrade: Record<string, InstitutionByGradeSummary> = {};
  const phaseAcc = new Map<ProgressPhaseKey, PhaseAcc>();
  for (const phase of PHASES) getOrCreatePhaseAcc(phaseAcc, phase);

  for (const { data } of gradeDocs) {
    const gradeId = data.gradeId;
    const gradeName = data.gradeName || null;
    const gradeStudents = data.totalStudents || 0;
    const sedeId = typeof data.sedeId === 'string' && data.sedeId.trim() ? data.sedeId.trim() : null;
    const campusName = data.campusName || null;
    const jornada = normalizeJornada(data.jornada);

    const jornadas = data.jornadas || { manana: 0, tarde: 0 };
    if (jornadas.manana > 0) byJornada['mañana'] = (byJornada['mañana'] || 0) + jornadas.manana;
    if (jornadas.tarde > 0) byJornada['tarde'] = (byJornada['tarde'] || 0) + jornadas.tarde;

    if (sedeId) {
      const current = bySedeAcc.get(sedeId) || { campusName, totalStudents: 0, grades: new Set<string>() };
      current.totalStudents += gradeStudents;
      current.grades.add(gradeId);
      if (!current.campusName && campusName) current.campusName = campusName;
      bySedeAcc.set(sedeId, current);
    }

    const gradePhaseSummary: InstitutionByGradeSummary['phases'] = {
      first: { avgScore: null, completionRate: 0, weakestSubject: null },
      second: { avgScore: null, completionRate: 0, weakestSubject: null },
      third: { avgScore: null, completionRate: 0, weakestSubject: null },
    };

    for (const phase of PHASES) {
      const phaseData = data.phases?.[phase];
      if (!phaseData) continue;

      gradePhaseSummary[phase] = {
        avgScore: phaseData.avgScore ?? null,
        completionRate: phaseData.completionRate ?? 0,
        weakestSubject: phaseData.weakestSubject ?? null,
      };

      const pAcc = getOrCreatePhaseAcc(phaseAcc, phase);
      if (typeof phaseData.avgScore === 'number' && Number.isFinite(phaseData.avgScore)) {
        pAcc.sumAvgScoreWeighted += phaseData.avgScore * gradeStudents;
        pAcc.totalStudentsWeighted += gradeStudents;
      }
      pAcc.studentsComplete += phaseData.studentsComplete || 0;

      const jornadaStudents: Record<'mañana' | 'tarde', number> = {
        'mañana': jornadas.manana || (jornada === 'mañana' ? gradeStudents : 0),
        'tarde': jornadas.tarde || (jornada === 'tarde' ? gradeStudents : 0),
      };

      for (const j of ['mañana', 'tarde'] as const) {
        const jStudents = jornadaStudents[j];
        if (jStudents <= 0) continue;
        const current = pAcc.byJornada.get(j) || {
          sumAvgScoreWeighted: 0,
          totalStudentsWeighted: 0,
          grades: new Set<string>(),
        };
        if (typeof phaseData.avgScore === 'number' && Number.isFinite(phaseData.avgScore)) {
          current.sumAvgScoreWeighted += phaseData.avgScore * jStudents;
          current.totalStudentsWeighted += jStudents;
        }
        current.grades.add(gradeId);
        pAcc.byJornada.set(j, current);
      }

      if (sedeId) {
        const sedeCurrent = pAcc.bySede.get(sedeId) || {
          campusName,
          sumAvgScoreWeighted: 0,
          totalStudentsWeighted: 0,
          grades: new Set<string>(),
        };
        if (typeof phaseData.avgScore === 'number' && Number.isFinite(phaseData.avgScore)) {
          sedeCurrent.sumAvgScoreWeighted += phaseData.avgScore * gradeStudents;
          sedeCurrent.totalStudentsWeighted += gradeStudents;
        }
        sedeCurrent.grades.add(gradeId);
        if (!sedeCurrent.campusName && campusName) sedeCurrent.campusName = campusName;
        pAcc.bySede.set(sedeId, sedeCurrent);
      }

      const subjects = phaseData.subjects || {};
      for (const [subjectKey, subject] of Object.entries(subjects)) {
        const sAcc = getOrCreateSubjectAcc(pAcc, subjectKey);
        sAcc.totalCorrect += subject.totalCorrect || 0;
        sAcc.totalQuestions += subject.totalQuestions || 0;
        sAcc.submitted += subject.submitted || 0;

        const gradeSubject = sAcc.byGrade.get(gradeId) || {
          gradeName,
          totalCorrect: 0,
          totalQuestions: 0,
          submitted: 0,
        };
        gradeSubject.totalCorrect += subject.totalCorrect || 0;
        gradeSubject.totalQuestions += subject.totalQuestions || 0;
        gradeSubject.submitted += subject.submitted || 0;
        if (!gradeSubject.gradeName && gradeName) gradeSubject.gradeName = gradeName;
        sAcc.byGrade.set(gradeId, gradeSubject);

        const topics = subject.topics || {};
        for (const [topicName, topic] of Object.entries(topics)) {
          const tAcc = sAcc.topics.get(topicName) || { totalCorrect: 0, totalQuestions: 0, studentsCount: 0 };
          tAcc.totalCorrect += topic.totalCorrect || 0;
          tAcc.totalQuestions += topic.totalQuestions || 0;
          tAcc.studentsCount += topic.studentsCount || 0;
          sAcc.topics.set(topicName, tAcc);
        }
      }
    }

    byGrade[gradeId] = {
      gradeId,
      gradeName,
      sedeId,
      campusName,
      jornada,
      totalStudents: gradeStudents,
      phases: gradePhaseSummary,
    };
  }

  const bySede: Record<string, InstitutionBySedeSummary> = {};
  for (const [sedeId, value] of bySedeAcc.entries()) {
    bySede[sedeId] = {
      sedeId,
      campusName: value.campusName,
      totalStudents: value.totalStudents,
      grades: value.grades.size,
    };
  }

  const phases: Record<ProgressPhaseKey, InstitutionPhaseSummary> = {
    first: {
      avgScore: null,
      studentsComplete: 0,
      completionRate: 0,
      weakestSubject: null,
      strongestSubject: null,
      byJornada: {},
      bySede: {},
      subjects: {},
    },
    second: {
      avgScore: null,
      studentsComplete: 0,
      completionRate: 0,
      weakestSubject: null,
      strongestSubject: null,
      byJornada: {},
      bySede: {},
      subjects: {},
    },
    third: {
      avgScore: null,
      studentsComplete: 0,
      completionRate: 0,
      weakestSubject: null,
      strongestSubject: null,
      byJornada: {},
      bySede: {},
      subjects: {},
    },
  };

  const gradeRanking: Record<ProgressPhaseKey, InstitutionGradeRankingEntry[]> = {
    first: [],
    second: [],
    third: [],
  };

  for (const phase of PHASES) {
    const pAcc = getOrCreatePhaseAcc(phaseAcc, phase);
    const subjects: Record<string, InstitutionSubjectSummary> = {};
    for (const [subjectKey, sAcc] of pAcc.subjects.entries()) {
      const topics: InstitutionSubjectSummary['topics'] = {};
      for (const [topicName, tAcc] of sAcc.topics.entries()) {
        topics[topicName] = {
          pct: pct(tAcc.totalCorrect, tAcc.totalQuestions),
          totalCorrect: tAcc.totalCorrect,
          totalQuestions: tAcc.totalQuestions,
          studentsCount: tAcc.studentsCount,
        };
      }

      const byGradeSubject: InstitutionSubjectSummary['byGrade'] = {};
      for (const [gradeId, gradeAcc] of sAcc.byGrade.entries()) {
        byGradeSubject[gradeId] = {
          gradeName: gradeAcc.gradeName,
          avgPct: pct(gradeAcc.totalCorrect, gradeAcc.totalQuestions),
          submitted: gradeAcc.submitted,
        };
      }

      subjects[subjectKey] = {
        avgPct: pct(sAcc.totalCorrect, sAcc.totalQuestions),
        totalStudents: sAcc.submitted,
        totalCorrect: sAcc.totalCorrect,
        totalQuestions: sAcc.totalQuestions,
        weakestTopic: pickExtremaTopic(topics, 'weakest'),
        strongestTopic: pickExtremaTopic(topics, 'strongest'),
        byGrade: byGradeSubject,
        topics,
      };
    }

    const byJornadaPhase: InstitutionPhaseSummary['byJornada'] = {};
    for (const [jornada, jAcc] of pAcc.byJornada.entries()) {
      byJornadaPhase[jornada] = {
        avgScore: jAcc.totalStudentsWeighted > 0 ? round1(jAcc.sumAvgScoreWeighted / jAcc.totalStudentsWeighted) : null,
        gradesCount: jAcc.grades.size,
      };
    }

    const bySedePhase: InstitutionPhaseSummary['bySede'] = {};
    for (const [sedeId, sAcc] of pAcc.bySede.entries()) {
      bySedePhase[sedeId] = {
        campusName: sAcc.campusName,
        avgScore: sAcc.totalStudentsWeighted > 0 ? round1(sAcc.sumAvgScoreWeighted / sAcc.totalStudentsWeighted) : null,
        gradesCount: sAcc.grades.size,
      };
    }

    phases[phase] = {
      avgScore: pAcc.totalStudentsWeighted > 0 ? round1(pAcc.sumAvgScoreWeighted / pAcc.totalStudentsWeighted) : null,
      studentsComplete: pAcc.studentsComplete,
      completionRate: totalStudents > 0 ? round1((pAcc.studentsComplete / totalStudents) * 100) : 0,
      weakestSubject: pickExtremaSubject(subjects, 'weakest'),
      strongestSubject: pickExtremaSubject(subjects, 'strongest'),
      byJornada: byJornadaPhase,
      bySede: bySedePhase,
      subjects,
    };

    const ranking = Object.values(byGrade)
      .map((grade) => ({
        gradeId: grade.gradeId,
        gradeName: grade.gradeName,
        avgScore: grade.phases[phase].avgScore,
      }))
      .filter((r) => typeof r.avgScore === 'number')
      .sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0))
      .map((entry, index) => ({
        position: index + 1,
        gradeId: entry.gradeId,
        gradeName: entry.gradeName,
        avgScore: entry.avgScore,
      }));
    gradeRanking[phase] = ranking;
  }

  let globalWeakestSubject: string | null = null;
  let globalStrongestSubject: string | null = null;
  let globalWeakestTopic: string | null = null;
  for (const phase of ['third', 'second', 'first'] as ProgressPhaseKey[]) {
    if (Object.keys(phases[phase].subjects).length === 0) continue;
    globalWeakestSubject = phases[phase].weakestSubject;
    globalStrongestSubject = phases[phase].strongestSubject;
    if (globalWeakestSubject) {
      const subject = phases[phase].subjects[globalWeakestSubject];
      globalWeakestTopic = subject?.weakestTopic || null;
    }
    break;
  }

  const payload: Omit<InstitutionSummaryDoc, 'lastUpdatedAt'> & {
    lastUpdatedAt: admin.firestore.FieldValue;
  } = {
    institutionId,
    academicYear,
    totalStudents,
    totalGrades,
    byJornada,
    bySede,
    globalWeakestSubject,
    globalWeakestTopic,
    globalStrongestSubject,
    byGrade,
    gradeRanking,
    phases,
    computedFrom: COMPUTED_FROM,
    schemaVersion: SCHEMA_VERSION,
    lastUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  const ref = firestore.doc(`superate/auth/institutions/${institutionId}/institutionSummary/${summaryId}`);
  await ref.set(payload, { merge: true });
  console.log(
    `[institutionSummary] OK institution=${institutionId} year=${academicYear} grades=${totalGrades} students=${totalStudents}`
  );
  return true;
}

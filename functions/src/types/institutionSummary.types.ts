import type { Timestamp } from 'firebase-admin/firestore';
import type { ProgressPhaseKey } from './gradeSummary.types';

export interface InstitutionTopicSummary {
  pct: number | null;
  totalCorrect: number;
  totalQuestions: number;
  studentsCount: number;
}

export interface InstitutionSubjectByGradeSummary {
  gradeName: string | null;
  avgPct: number | null;
  submitted: number;
}

export interface InstitutionSubjectSummary {
  avgPct: number | null;
  totalStudents: number;
  totalCorrect: number;
  totalQuestions: number;
  weakestTopic: string | null;
  strongestTopic: string | null;
  byGrade: Record<string, InstitutionSubjectByGradeSummary>;
  topics: Record<string, InstitutionTopicSummary>;
}

export interface InstitutionPhaseByJornadaSummary {
  avgScore: number | null;
  gradesCount: number;
}

export interface InstitutionPhaseBySedeSummary {
  campusName: string | null;
  avgScore: number | null;
  gradesCount: number;
}

export interface InstitutionPhaseSummary {
  avgScore: number | null;
  studentsComplete: number;
  completionRate: number;
  weakestSubject: string | null;
  strongestSubject: string | null;
  byJornada: Partial<Record<'mañana' | 'tarde', InstitutionPhaseByJornadaSummary>>;
  bySede: Record<string, InstitutionPhaseBySedeSummary>;
  subjects: Record<string, InstitutionSubjectSummary>;
}

export interface InstitutionBySedeSummary {
  sedeId: string;
  campusName: string | null;
  totalStudents: number;
  grades: number;
}

export interface InstitutionByGradePhaseSummary {
  avgScore: number | null;
  completionRate: number;
  weakestSubject: string | null;
}

export interface InstitutionByGradeSummary {
  gradeId: string;
  gradeName: string | null;
  sedeId: string | null;
  campusName: string | null;
  jornada: 'mañana' | 'tarde' | null;
  totalStudents: number;
  phases: Record<ProgressPhaseKey, InstitutionByGradePhaseSummary>;
}

export interface InstitutionGradeRankingEntry {
  position: number;
  gradeId: string;
  gradeName: string | null;
  avgScore: number | null;
}

export interface InstitutionSummaryDoc {
  institutionId: string;
  academicYear: number | string;
  totalStudents: number;
  totalGrades: number;
  byJornada: Partial<Record<'mañana' | 'tarde', number>>;
  bySede: Record<string, InstitutionBySedeSummary>;
  globalWeakestSubject: string | null;
  globalWeakestTopic: string | null;
  globalStrongestSubject: string | null;
  byGrade: Record<string, InstitutionByGradeSummary>;
  gradeRanking: Record<ProgressPhaseKey, InstitutionGradeRankingEntry[]>;
  phases: Record<ProgressPhaseKey, InstitutionPhaseSummary>;
  computedFrom: string;
  schemaVersion: number;
  lastUpdatedAt: Timestamp;
}

import type { Timestamp } from 'firebase-admin/firestore';

export type ProgressPhaseKey = 'first' | 'second' | 'third';

export interface GradeTopicSummary {
  totalCorrect: number;
  totalQuestions: number;
  pct: number | null;
  studentsCount: number;
}

export interface GradeSubjectSummary {
  avgPct: number | null;
  submitted: number;
  totalCorrect: number;
  totalQuestions: number;
  weakestTopic: string | null;
  strongestTopic: string | null;
  topics: Record<string, GradeTopicSummary>;
}

export interface GradePhaseSummary {
  studentsComplete: number;
  completionRate: number;
  avgScore: number | null;
  weakestSubject: string | null;
  strongestSubject: string | null;
  subjects: Record<string, GradeSubjectSummary>;
}

export interface GradeSummaryDoc {
  gradeId: string;
  gradeName?: string | null;
  institutionId: string;
  sedeId?: string | null;
  campusName?: string | null;
  jornada?: 'mañana' | 'tarde' | null;
  jornadas?: {
    manana: number;
    tarde: number;
  };
  studentNames?: string[];
  academicYear: number | string;
  totalStudents: number;
  phases: Record<ProgressPhaseKey, GradePhaseSummary>;
  lastUpdatedAt: Timestamp;
  schemaVersion: number;
  computedFrom: string;
}

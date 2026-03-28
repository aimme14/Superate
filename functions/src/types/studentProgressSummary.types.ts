/**
 * Documento denormalizado: progreso y promedios por fase/materia
 * Ruta: superate/auth/institutions/{institutionId}/studentSummaries/{studentId}
 */

import type { Timestamp } from 'firebase-admin/firestore';

export type ProgressPhaseKey = 'first' | 'second' | 'third';

export type TrendLabel = 'improving' | 'declining' | 'stable';

/**
 * Una celda por materia dentro de una fase.
 * `examSnapshot` es una copia del documento completo en `results/.../{examId}`
 * (mejor puntaje por materia en esa fase), para tener todo en un solo doc.
 */
export interface SubjectProgressCell {
  score: number;
  submittedAt: Timestamp | null;
  examId: string;
  /** Copia serializable del documento de resultados (answers, score, questionDetails, etc.) */
  examSnapshot?: Record<string, unknown>;
}

export interface PhaseProgressBlock {
  submittedCount: number;
  isComplete: boolean;
  phaseAvg: number | null;
  completedAt: Timestamp | null;
  subjects: Record<string, SubjectProgressCell>;
}

export interface StudentProgressSummaryDoc {
  studentId: string;
  institutionId: string;
  /** ID de la sede (campusId / sedeId / campus / sede en el doc del estudiante) */
  sedeId?: string;
  /** Nombre legible de la sede (campusName, sedeNombre, etc.) */
  campusName?: string;
  gradeId?: string;
  academicYear?: number | string;
  phases: Record<ProgressPhaseKey, PhaseProgressBlock>;
  totalSubmitted: number;
  overallAvg: number | null;
  progressPct: number;
  trend: {
    firstToSecond: TrendLabel | null;
    secondToThird: TrendLabel | null;
  };
  lastUpdatedAt: Timestamp;
  /** Versión del esquema para migraciones futuras */
  schemaVersion: number;
}

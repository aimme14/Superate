/**
 * Reconstruye ExamResult[] únicamente desde userLookup + studentSummaries.
 * El resumen se actualiza en backend al presentar cada examen.
 */

import { doc, getDoc, getFirestore, Timestamp } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'
import type { ExamResult } from '@/hooks/query/studentEvaluations.types'

const db = getFirestore(firebaseApp)

export type ProgressPhaseKey = 'first' | 'second' | 'third'

export interface SubjectProgressCell {
  score: number
  submittedAt: Timestamp | { seconds: number; nanoseconds?: number } | null
  examId: string
  examSnapshot?: Record<string, unknown>
}

export interface PhaseProgressBlock {
  submittedCount: number
  isComplete: boolean
  phaseAvg: number | null
  completedAt: Timestamp | null
  subjects: Record<string, SubjectProgressCell>
}

export interface StudentProgressSummaryDoc {
  studentId: string
  institutionId: string
  phases: Record<ProgressPhaseKey, PhaseProgressBlock>
  totalSubmitted: number
  overallAvg: number | null
  progressPct: number
  schemaVersion?: number
}

function toMillis(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v
  if (v instanceof Timestamp) return v.toMillis()
  if (v && typeof v === 'object' && 'toMillis' in v && typeof (v as Timestamp).toMillis === 'function') {
    return (v as Timestamp).toMillis()
  }
  if (v && typeof v === 'object' && 'seconds' in v) {
    const s = (v as { seconds: number }).seconds
    return typeof s === 'number' ? s * 1000 : Date.now()
  }
  return Date.now()
}

/** Resuelve institución desde userLookup (1 lectura). */
export async function getInstitutionIdFromUserLookup(userId: string): Promise<string | null> {
  const ref = doc(db, 'superate', 'auth', 'userLookup', userId)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const id = snap.data()?.institutionId
  return typeof id === 'string' && id.trim() ? id.trim() : null
}

/**
 * userLookup + studentSummaries en una sola pasada (2 lecturas).
 * Fuente única para acceso a fase y listado de evaluaciones sin leer results/.
 */
export async function fetchStudentProgressSummaryByUserId(
  userId: string
): Promise<{ institutionId: string; summary: StudentProgressSummaryDoc | null } | null> {
  try {
    const institutionId = await getInstitutionIdFromUserLookup(userId)
    if (!institutionId) return null

    const summaryRef = doc(
      db,
      'superate',
      'auth',
      'institutions',
      institutionId,
      'studentSummaries',
      userId
    )
    const summarySnap = await getDoc(summaryRef)
    if (!summarySnap.exists()) {
      return { institutionId, summary: null }
    }
    return {
      institutionId,
      summary: summarySnap.data() as StudentProgressSummaryDoc,
    }
  } catch {
    return null
  }
}

/**
 * Construye ExamResult[] desde el documento ya cargado (sin lecturas extra).
 */
export function examResultsFromSummaryData(
  data: Partial<StudentProgressSummaryDoc>,
  userId: string
): ExamResult[] {
  const phases = data.phases
  if (!phases || typeof phases !== 'object') return []

  const out: ExamResult[] = []
  const phaseKeys: ProgressPhaseKey[] = ['first', 'second', 'third']

  for (const phaseKey of phaseKeys) {
    const block = phases[phaseKey]
    const subjects = block?.subjects
    if (!subjects || typeof subjects !== 'object') continue

    for (const [slug, cellUnknown] of Object.entries(subjects)) {
      const cell = cellUnknown as SubjectProgressCell
      const snap = cell?.examSnapshot
      if (snap && typeof snap === 'object') {
        out.push(
          mapSnapshotToExamResult(
            snap as Record<string, unknown>,
            phaseKey,
            slug,
            cell.examId,
            userId
          )
        )
      }
    }
  }

  return out
}

function mapSnapshotToExamResult(
  raw: Record<string, unknown>,
  phaseKey: ProgressPhaseKey,
  storageSlug: string,
  cellExamId: string,
  userId: string
): ExamResult {
  const examId = (typeof raw.examId === 'string' && raw.examId) ? raw.examId : cellExamId || storageSlug

  return {
    ...raw,
    userId: (typeof raw.userId === 'string' && raw.userId) ? raw.userId : userId,
    examId,
    examTitle: (typeof raw.examTitle === 'string' && raw.examTitle) ? raw.examTitle : '',
    phase: phaseKey,
    timestamp: toMillis(raw.timestamp),
    tabChangeCount: typeof raw.tabChangeCount === 'number' ? raw.tabChangeCount : 0,
    lockedByTabChange: raw.lockedByTabChange === true,
    completed: raw.completed !== false,
    answers: (raw.answers as ExamResult['answers']) || {},
    score: raw.score as ExamResult['score'],
    topic: typeof raw.topic === 'string' ? raw.topic : '',
    timeExpired: raw.timeExpired === true,
    startTime: typeof raw.startTime === 'string' ? raw.startTime : '',
    endTime: typeof raw.endTime === 'string' ? raw.endTime : '',
    timeSpent: typeof raw.timeSpent === 'number' ? raw.timeSpent : 0,
    questionDetails: Array.isArray(raw.questionDetails) ? (raw.questionDetails as ExamResult['questionDetails']) : [],
  } as ExamResult
}

/**
 * Única fuente de datos para evaluaciones en cliente: userLookup + studentSummaries.
 * Si falta institución, documento o hay error, devuelve [].
 */
export async function fetchEvaluationsFromStudentSummary(userId: string): Promise<ExamResult[]> {
  try {
    const pack = await fetchStudentProgressSummaryByUserId(userId)
    if (!pack?.summary) return []
    return examResultsFromSummaryData(pack.summary, userId)
  } catch {
    return []
  }
}

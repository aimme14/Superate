import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'

const db = getFirestore(firebaseApp)

export type RectorPhaseKey = 'first' | 'second' | 'third'

export interface InstitutionTopicSummary {
  pct: number | null
  totalCorrect: number
  totalQuestions: number
  studentsCount: number
}

export interface InstitutionSubjectSummary {
  avgPct: number | null
  totalStudents: number
  totalCorrect: number
  totalQuestions: number
  weakestTopic: string | null
  strongestTopic: string | null
  byGrade: Record<string, { gradeName: string | null; avgPct: number | null; submitted: number }>
  topics: Record<string, InstitutionTopicSummary>
}

export interface InstitutionPhaseSummary {
  avgScore: number | null
  studentsComplete: number
  completionRate: number
  weakestSubject: string | null
  strongestSubject: string | null
  byJornada: Partial<Record<'mañana' | 'tarde', { avgScore: number | null; gradesCount: number }>>
  bySede: Record<string, { campusName: string | null; avgScore: number | null; gradesCount: number }>
  subjects: Record<string, InstitutionSubjectSummary>
}

export interface InstitutionSummaryDoc {
  institutionId: string
  academicYear: number | string
  totalStudents: number
  totalGrades: number
  byJornada: Partial<Record<'mañana' | 'tarde', number>>
  bySede: Record<string, { sedeId: string; campusName: string | null; totalStudents: number; grades: number }>
  globalWeakestSubject: string | null
  globalWeakestTopic: string | null
  globalStrongestSubject: string | null
  byGrade: Record<
    string,
    {
      gradeId: string
      gradeName: string | null
      sedeId: string | null
      campusName: string | null
      jornada: 'mañana' | 'tarde' | null
      totalStudents: number
      phases: Record<RectorPhaseKey, { avgScore: number | null; completionRate: number; weakestSubject: string | null }>
    }
  >
  gradeRanking: Record<RectorPhaseKey, Array<{ position: number; gradeId: string; gradeName: string | null; avgScore: number | null }>>
  phases: Record<RectorPhaseKey, InstitutionPhaseSummary>
  schemaVersion?: number
  computedFrom?: string
}

export async function fetchInstitutionSummaryByContext(context: {
  institutionId?: string | null
  academicYear?: number | string
}): Promise<InstitutionSummaryDoc | null> {
  const institutionId = context.institutionId?.trim()
  const year = context.academicYear ?? new Date().getFullYear()
  const hasYear = typeof year === 'number' || (typeof year === 'string' && year.trim().length > 0)
  if (!institutionId || !hasYear) return null

  const summaryId = `${String(year)}_${institutionId}`
  const ref = doc(
    db,
    'superate',
    'auth',
    'institutions',
    institutionId,
    'institutionSummary',
    summaryId
  )
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as InstitutionSummaryDoc
}

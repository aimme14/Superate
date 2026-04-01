import { doc, getDoc, getFirestore } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'

const db = getFirestore(firebaseApp)

export type TeacherPhaseKey = 'first' | 'second' | 'third'

export interface GradeTopicSummary {
  totalCorrect: number
  totalQuestions: number
  pct: number | null
  studentsCount: number
}

export interface GradeSubjectSummary {
  avgPct: number | null
  submitted: number
  totalCorrect: number
  totalQuestions: number
  weakestTopic: string | null
  strongestTopic: string | null
  topics: Record<string, GradeTopicSummary>
}

export interface GradePhaseSummary {
  studentsComplete: number
  completionRate: number
  avgScore: number | null
  weakestSubject: string | null
  strongestSubject: string | null
  subjects: Record<string, GradeSubjectSummary>
}

export interface GradeSummaryDoc {
  gradeId: string
  gradeName?: string | null
  institutionId: string
  sedeId?: string | null
  campusName?: string | null
  jornada?: 'mañana' | 'tarde' | null
  jornadas?: {
    manana: number
    tarde: number
  }
  studentNames?: string[]
  academicYear: number | string
  totalStudents: number
  phases: Record<TeacherPhaseKey, GradePhaseSummary>
  schemaVersion?: number
  computedFrom?: string
}

export interface GradeSummaryContext {
  institutionId: string
  gradeId: string
  academicYear: number | string
}

export const SUBJECT_SLUG_TO_DISPLAY: Record<string, string> = {
  matematicas: 'Matemáticas',
  lenguaje: 'Lenguaje',
  ciencias_sociales: 'Ciencias Sociales',
  biologia: 'Biologia',
  quimica: 'Quimica',
  fisica: 'Física',
  ingles: 'Inglés',
}

export function displayNameFromSubjectSlug(slug: string): string {
  const key = slug.trim().toLowerCase()
  return SUBJECT_SLUG_TO_DISPLAY[key] || slug
}

function inferInstitutionId(students: any[]): string | null {
  for (const s of students) {
    const val = s?.institutionId || s?.inst
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return null
}

function inferGradeId(students: any[]): string | null {
  for (const s of students) {
    const val = s?.gradeId || s?.grade
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return null
}

function inferAcademicYear(students: any[], explicitYear?: number): number | string | null {
  if (typeof explicitYear === 'number' && Number.isFinite(explicitYear)) return explicitYear
  for (const s of students) {
    const val = s?.academicYear || s?.year
    if (typeof val === 'number' && Number.isFinite(val)) return val
    if (typeof val === 'string' && val.trim()) return val.trim()
  }
  return null
}

export async function fetchGradeSummaryForTeacher(
  students: any[],
  explicitYear?: number
): Promise<GradeSummaryDoc | null> {
  if (!students?.length) return null
  const institutionId = inferInstitutionId(students)
  const gradeId = inferGradeId(students)
  const academicYear = inferAcademicYear(students, explicitYear)
  if (!institutionId || !gradeId || academicYear === null) return null

  const summaryId = `${String(academicYear)}_${gradeId}`
  const ref = doc(
    db,
    'superate',
    'auth',
    'institutions',
    institutionId,
    'gradeSummary',
    summaryId
  )
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as GradeSummaryDoc
}

export async function fetchGradeSummaryByContext(
  context: Partial<GradeSummaryContext>
): Promise<GradeSummaryDoc | null> {
  const institutionId = context.institutionId?.trim()
  const gradeId = context.gradeId?.trim()
  const academicYear = context.academicYear

  const hasAcademicYear =
    typeof academicYear === 'number' ||
    (typeof academicYear === 'string' && academicYear.trim().length > 0)

  if (!institutionId || !gradeId || !hasAcademicYear) return null

  const summaryId = `${String(academicYear)}_${gradeId}`
  const ref = doc(
    db,
    'superate',
    'auth',
    'institutions',
    institutionId,
    'gradeSummary',
    summaryId
  )
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  return snap.data() as GradeSummaryDoc
}

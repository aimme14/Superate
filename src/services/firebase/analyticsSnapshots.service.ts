import { doc, getDoc, getDocs, collection, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore'
import { firebaseApp } from '@/services/firebase/db.service'

const db = getFirestore(firebaseApp)

type Phase = 'first' | 'second' | 'third'
type Jornada = 'mañana' | 'tarde' | 'única' | 'todas'

interface SnapshotStudent {
  id?: string
  uid?: string
  grade?: string
  gradeId?: string
  jornada?: string
  academicYear?: number
  createdAt?: unknown
}

interface EvolutionFilters {
  year: number
  jornada: Jornada | string
  gradeId: string
  studentId: string
}

interface EvolutionSnapshotData {
  chartData: Array<Record<string, unknown>>
  subjects: string[]
}

const REQUIRED_SUBJECTS = ['Matemáticas', 'Lenguaje', 'Ciencias Sociales', 'Biologia', 'Quimica', 'Física', 'Inglés']
const NATURALES_SUBJECTS = ['Biologia', 'Quimica', 'Física']
const POINTS_PER_NATURALES_SUBJECT = 100 / 3
const POINTS_PER_REGULAR_SUBJECT = 100

function phaseToCollectionName(phase: Phase): string {
  if (phase === 'first') return 'fase I'
  if (phase === 'second') return 'Fase II'
  return 'fase III'
}

function normalizeSubjectName(subject: string): string {
  const normalized = subject.trim().toLowerCase()
  const subjectMap: Record<string, string> = {
    'biologia': 'Biologia', 'biología': 'Biologia',
    'quimica': 'Quimica', 'química': 'Quimica',
    'fisica': 'Física', 'física': 'Física',
    'matematicas': 'Matemáticas', 'matemáticas': 'Matemáticas',
    'lenguaje': 'Lenguaje',
    'ciencias sociales': 'Ciencias Sociales', 'sociales': 'Ciencias Sociales',
    'ingles': 'Inglés', 'inglés': 'Inglés',
  }
  return subjectMap[normalized] || subject
}

function getStudentId(student: SnapshotStudent): string | null {
  return (student.id || student.uid || null) as string | null
}

function getStudentYear(student: SnapshotStudent): number | null {
  if (typeof student.academicYear === 'number') return student.academicYear
  const createdAt = student.createdAt as any
  if (!createdAt) return null
  let date: Date
  if (typeof createdAt === 'string') {
    date = new Date(createdAt)
  } else if (createdAt?.toDate) {
    date = createdAt.toDate()
  } else if (createdAt?.seconds) {
    date = new Date(createdAt.seconds * 1000)
  } else {
    return null
  }
  return date.getFullYear()
}

function buildSnapshotId(parts: Record<string, string | number>): string {
  return Object.entries(parts)
    .map(([k, v]) => `${k}-${String(v).replace(/[^a-zA-Z0-9_-]/g, '_')}`)
    .join('__')
}

async function readSnapshot<T>(institutionId: string, snapshotId: string): Promise<T | null> {
  try {
    const ref = doc(db, 'superate', 'auth', 'institutions', institutionId, 'analyticsSnapshots', snapshotId)
    const snap = await getDoc(ref)
    if (!snap.exists()) return null
    const data = snap.data()
    return (data?.payload as T) ?? null
  } catch {
    return null
  }
}

async function writeSnapshot(institutionId: string, snapshotId: string, payload: unknown): Promise<void> {
  try {
    const ref = doc(db, 'superate', 'auth', 'institutions', institutionId, 'analyticsSnapshots', snapshotId)
    await setDoc(
      ref,
      {
        payload,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    )
  } catch {
    // Si falla escritura por reglas/permisos, devolvemos payload calculado sin romper UX.
  }
}

async function computeInstitutionAverage(phase: Phase, students: SnapshotStudent[]): Promise<number> {
  const studentIds = students.map(getStudentId).filter(Boolean) as string[]
  if (studentIds.length === 0) return 0

  const phaseName = phaseToCollectionName(phase)
  const studentGlobalScores: number[] = []

  for (const studentId of studentIds) {
    try {
      const phaseRef = collection(db, 'results', studentId, phaseName)
      const phaseSnap = await getDocs(phaseRef)
      const studentResults: Array<{ subject: string; percentage: number }> = []

      phaseSnap.docs.forEach((d) => {
        const examData = d.data() as any
        if (examData.completed && examData.score && examData.subject) {
          studentResults.push({
            subject: examData.subject.trim(),
            percentage: examData.score.overallPercentage || 0,
          })
        }
      })

      if (studentResults.length === 0) continue

      const subjectScores: Record<string, number> = {}
      studentResults.forEach((result) => {
        const subject = normalizeSubjectName(result.subject || '')
        if (!subjectScores[subject] || result.percentage > subjectScores[subject]) {
          subjectScores[subject] = result.percentage
        }
      })

      const hasAllSubjects = REQUIRED_SUBJECTS.every((s) => Object.prototype.hasOwnProperty.call(subjectScores, s))
      if (!hasAllSubjects) continue

      let globalScore = 0
      Object.entries(subjectScores).forEach(([subject, percentage]) => {
        const pointsForSubject = NATURALES_SUBJECTS.includes(subject)
          ? (percentage / 100) * POINTS_PER_NATURALES_SUBJECT
          : (percentage / 100) * POINTS_PER_REGULAR_SUBJECT
        globalScore += pointsForSubject
      })
      studentGlobalScores.push(Math.round(globalScore * 100) / 100)
    } catch {
      // Ignorar errores por estudiante para no tumbar todo el cálculo.
    }
  }

  if (studentGlobalScores.length === 0) return 0
  const average = studentGlobalScores.reduce((sum, score) => sum + score, 0) / studentGlobalScores.length
  return Math.round(average * 100) / 100
}

export async function getOrBuildRectorInstitutionAverageSnapshot(params: {
  institutionId: string
  phase: Phase
  gradeId: string
  jornada: Jornada
  students: SnapshotStudent[]
}): Promise<number> {
  const { institutionId, phase, gradeId, jornada, students } = params
  const snapshotId = buildSnapshotId({
    v: 'rector-average-v1',
    phase,
    gradeId: gradeId || 'todos',
    jornada: jornada || 'todas',
    scope: 'institution',
    studentCount: students.length,
  })

  const cached = await readSnapshot<number>(institutionId, snapshotId)
  if (typeof cached === 'number') return cached

  const computed = await computeInstitutionAverage(phase, students)
  await writeSnapshot(institutionId, snapshotId, computed)
  return computed
}

async function computeEvolution(filters: EvolutionFilters, studentsInput: SnapshotStudent[]): Promise<EvolutionSnapshotData> {
  let filteredStudents = studentsInput

  if (filters.year) {
    filteredStudents = filteredStudents.filter((student) => {
      const year = getStudentYear(student)
      if (year === null) return true
      return year === filters.year
    })
  }
  if (filters.jornada && filters.jornada !== 'todas') {
    filteredStudents = filteredStudents.filter((student) => student.jornada === filters.jornada)
  }
  if (filters.gradeId && filters.gradeId !== 'todos') {
    filteredStudents = filteredStudents.filter((student) => (student.grade || student.gradeId) === filters.gradeId)
  }
  if (filters.studentId && filters.studentId !== 'todos') {
    filteredStudents = filteredStudents.filter((student) => getStudentId(student) === filters.studentId)
  }

  const studentIds = filteredStudents.map(getStudentId).filter(Boolean) as string[]
  if (studentIds.length === 0) return { chartData: [], subjects: [] }

  const allPossibleSubjects = [...REQUIRED_SUBJECTS]
  const phases: Array<{ key: Phase; name: string }> = [
    { key: 'first', name: 'fase I' },
    { key: 'second', name: 'Fase II' },
    { key: 'third', name: 'fase III' },
  ]
  const resultsByPhaseAndSubject = new Map<string, Map<string, number[]>>()

  for (const studentId of studentIds) {
    for (const phase of phases) {
      try {
        const phaseRef = collection(db, 'results', studentId, phase.name)
        const phaseSnap = await getDocs(phaseRef)
        phaseSnap.docs.forEach((d) => {
          const examData = d.data() as any
          if (examData.completed && examData.score && examData.subject) {
            const subject = normalizeSubjectName(examData.subject)
            if (!allPossibleSubjects.includes(subject)) return
            const score = examData.score.overallPercentage || 0
            if (!resultsByPhaseAndSubject.has(phase.key)) {
              resultsByPhaseAndSubject.set(phase.key, new Map())
            }
            const phaseMap = resultsByPhaseAndSubject.get(phase.key)!
            if (!phaseMap.has(subject)) phaseMap.set(subject, [])
            phaseMap.get(subject)!.push(score)
          }
        })
      } catch {
        // Ignorar error por estudiante/fase individual.
      }
    }
  }

  const allSubjectsSet = new Set<string>()
  resultsByPhaseAndSubject.forEach((phaseMap) => {
    phaseMap.forEach((_, subject) => allSubjectsSet.add(subject))
  })
  const allSubjects = Array.from(allSubjectsSet).sort()

  const chartData = phases.map((phase) => {
    const dataPoint: Record<string, unknown> = {
      fase: phase.key === 'first' ? 'Fase I' : phase.key === 'second' ? 'Fase II' : 'Fase III',
    }
    allSubjects.forEach((subject) => {
      const phaseMap = resultsByPhaseAndSubject.get(phase.key)
      const scores = phaseMap?.get(subject) || []
      dataPoint[subject] = scores.length > 0
        ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100) / 100
        : null
    })
    return dataPoint
  })

  return { chartData, subjects: allSubjects }
}

export async function getOrBuildRectorEvolutionSnapshot(params: {
  institutionId: string
  filters: EvolutionFilters
  students: SnapshotStudent[]
}): Promise<EvolutionSnapshotData> {
  const { institutionId, filters, students } = params
  const snapshotId = buildSnapshotId({
    v: 'rector-evolution-v1',
    year: filters.year || 'all',
    jornada: filters.jornada || 'todas',
    gradeId: filters.gradeId || 'todos',
    studentId: filters.studentId || 'todos',
    scope: 'institution',
    studentCount: students.length,
  })

  const cached = await readSnapshot<EvolutionSnapshotData>(institutionId, snapshotId)
  if (cached && Array.isArray(cached.chartData) && Array.isArray(cached.subjects)) {
    return cached
  }

  const computed = await computeEvolution(filters, students)
  await writeSnapshot(institutionId, snapshotId, computed)
  return computed
}

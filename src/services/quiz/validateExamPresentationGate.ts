/**
 * Validación previa a presentar un examen: solo desde studentSummaries (fetchEvaluationsFromStudentSummary).
 * Sin lecturas a la colección results/ en el cliente.
 */

import { fetchEvaluationsFromStudentSummary } from '@/services/studentProgressSummary/fetchEvaluationsFromSummary'

export type ExamGateOutcome =
  | { type: 'blocked' }
  | { type: 'already_taken'; examSnapshot: Record<string, unknown> }
  | { type: 'welcome' }

export async function validateExamPresentationGate(params: {
  userId: string
  gradeId: string
  phase: 'first' | 'second' | 'third'
  subjectLabel: string
  quizId: string
}): Promise<ExamGateOutcome> {
  const { userId, gradeId, phase, subjectLabel, quizId } = params
  const { phaseAuthorizationService } = await import('@/services/phase/phaseAuthorization.service')

  // Bloquear el acceso a la fase si está deshabilitada globalmente o si el estudiante
  // aún no cumplió la fase anterior.
  const currentPhaseAccess = await phaseAuthorizationService.canStudentAccessPhase(userId, gradeId, phase)
  if (!currentPhaseAccess.success || !currentPhaseAccess.data?.canAccess) {
    return { type: 'blocked' }
  }

  const evaluations = await fetchEvaluationsFromStudentSummary(userId)
  const inPhase = evaluations.filter((e) => e.phase === phase && e.completed !== false)
  const normalizedSubject = subjectLabel.trim().toLowerCase()
  const subjectMatches = (examSubject: string | undefined) =>
    (examSubject || '').trim().toLowerCase() === normalizedSubject

  let isSubjectCompleted = inPhase.some((e) => subjectMatches(e.subject))

  const progressResult = await phaseAuthorizationService.getStudentPhaseProgress(userId, phase)
  let allSubjectsCompleted = false
  if (progressResult.success && progressResult.data) {
    const completedSubjects = (progressResult.data.subjectsCompleted || []).map((s: string) => s.trim())
    allSubjectsCompleted = completedSubjects.length >= 7
    const fromProgress = completedSubjects.some((s) => s.toLowerCase() === normalizedSubject)
    isSubjectCompleted = isSubjectCompleted || fromProgress
  }

  const nextPhase: 'first' | 'second' | 'third' | null =
    phase === 'first' ? 'second' : phase === 'second' ? 'third' : null
  let nextPhaseAuthorized = false
  if (nextPhase) {
    const nextPhaseAccess = await phaseAuthorizationService.canStudentAccessPhase(userId, gradeId, nextPhase)
    nextPhaseAuthorized = nextPhaseAccess.success && nextPhaseAccess.data.canAccess
  }

  if (isSubjectCompleted && !allSubjectsCompleted && !nextPhaseAuthorized) {
    return { type: 'blocked' }
  }

  const alreadyDone = evaluations.some(
    (e) => e.phase === phase && e.examId === quizId && e.completed !== false
  )
  if (alreadyDone) {
    const ev = evaluations.find((e) => e.examId === quizId && e.phase === phase)
    if (!ev) return { type: 'welcome' }
    const ts = typeof ev.timestamp === 'number' ? ev.timestamp : Date.now()
    return {
      type: 'already_taken',
      examSnapshot: {
        ...ev,
        endTime: ev.endTime || new Date(ts).toISOString(),
      } as Record<string, unknown>,
    }
  }

  return { type: 'welcome' }
}

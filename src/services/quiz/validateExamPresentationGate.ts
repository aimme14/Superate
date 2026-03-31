/**
 * Validación previa a presentar un examen: una sola carga de studentSummaries
 * (userLookup + resumen = 2 lecturas), sin leer results/ en el cliente.
 */

import {
  examResultsFromSummaryData,
  fetchStudentProgressSummaryByUserId,
} from '@/services/studentProgressSummary/fetchEvaluationsFromSummary'
import { subjectLabelToSlug } from '@/utils/subjectResultDocId'

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

  const pack = await fetchStudentProgressSummaryByUserId(userId)
  const summary = pack?.summary ?? null

  const currentPhaseAccess = await phaseAuthorizationService.canStudentAccessPhase(userId, gradeId, phase, {
    summary,
  })
  if (!currentPhaseAccess.success || !currentPhaseAccess.data?.canAccess) {
    return { type: 'blocked' }
  }

  const evaluations = summary ? examResultsFromSummaryData(summary, userId) : []
  const inPhase = evaluations.filter((e) => e.phase === phase && e.completed !== false)
  const normalizedSubject = subjectLabel.trim().toLowerCase()
  const subjectMatches = (examSubject: string | undefined) =>
    (examSubject || '').trim().toLowerCase() === normalizedSubject

  let isSubjectCompleted = inPhase.some((e) => subjectMatches(e.subject))

  const blockCurrent = summary?.phases?.[phase]
  const slug = subjectLabelToSlug(subjectLabel)
  if (slug && blockCurrent?.subjects?.[slug] != null) {
    isSubjectCompleted = true
  }

  const allSubjectsCompleted = blockCurrent?.isComplete === true

  const nextPhase: 'first' | 'second' | 'third' | null =
    phase === 'first' ? 'second' : phase === 'second' ? 'third' : null
  let nextPhaseAuthorized = false
  if (nextPhase) {
    const nextPhaseAccess = await phaseAuthorizationService.canStudentAccessPhase(userId, gradeId, nextPhase, {
      summary,
    })
    nextPhaseAuthorized = nextPhaseAccess.success && nextPhaseAccess.data?.canAccess === true
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

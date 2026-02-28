import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { studyPlanAuthorizationService } from '@/services/studyPlan/studyPlanAuthorization.service'
import { dbService } from '@/services/firebase/db.service'
import type { StudyPlanAuthorization, SubjectName, StudyPlanPhase } from '@/interfaces/studyPlan.interface'

export interface GradeOption {
  value: string
  label: string
  institutionId?: string
  institutionName?: string
  campusId?: string
  campusName?: string
}

export interface GradeSubjectStatus {
  gradeId: string
  gradeName: string
  institutionId: string
  institutionName: string
  campusId: string
  campusName: string
  totalStudents: number
  subjects: {
    [key in SubjectName]: {
      first: { authorized: boolean }
      second: { authorized: boolean }
    }
  }
}

const STUDY_PLAN_AUTH_KEYS = {
  all: ['studyPlanAuthorizations'] as const,
  list: (gradeIds: string[]) => [...STUDY_PLAN_AUTH_KEYS.all, 'list', { gradeIds: [...gradeIds].sort() }] as const,
}

const DEFAULT_SUBJECTS: GradeSubjectStatus['subjects'] = {
  Matemáticas: { first: { authorized: false }, second: { authorized: false } },
  Lenguaje: { first: { authorized: false }, second: { authorized: false } },
  'Ciencias Sociales': { first: { authorized: false }, second: { authorized: false } },
  Biologia: { first: { authorized: false }, second: { authorized: false } },
  Quimica: { first: { authorized: false }, second: { authorized: false } },
  Física: { first: { authorized: false }, second: { authorized: false } },
  Inglés: { first: { authorized: false }, second: { authorized: false } },
}

async function fetchGradeStatus(grade: GradeOption): Promise<GradeSubjectStatus> {
  const authResult = await studyPlanAuthorizationService.getGradeAuthorizations(grade.value)
  const authorizations: StudyPlanAuthorization[] = authResult.success ? authResult.data : []

  const studentsResult = await dbService.getFilteredStudents({
    gradeId: grade.value,
    isActive: true,
  })
  const totalStudents = studentsResult.success ? studentsResult.data.length : 0

  const subjectsStatus = JSON.parse(JSON.stringify(DEFAULT_SUBJECTS)) as GradeSubjectStatus['subjects']

  authorizations.forEach((auth) => {
    if (
      auth.authorized &&
      auth.subject in subjectsStatus &&
      (auth.phase === 'first' || auth.phase === 'second')
    ) {
      subjectsStatus[auth.subject as SubjectName][auth.phase].authorized = true
    }
  })

  return {
    gradeId: grade.value,
    gradeName: grade.label,
    institutionId: grade.institutionId ?? '',
    institutionName: grade.institutionName ?? '',
    campusId: grade.campusId ?? '',
    campusName: grade.campusName ?? '',
    totalStudents,
    subjects: subjectsStatus,
  }
}

/**
 * Hook para cargar estados de autorización de planes de estudio por grado.
 * Usa React Query con caché de 2 minutos.
 */
export function useStudyPlanAuthorizations(grades: GradeOption[]) {
  const gradeIds = grades.map((g) => g.value)
  const enabled = gradeIds.length > 0

  return useQuery({
    queryKey: STUDY_PLAN_AUTH_KEYS.list(gradeIds),
    queryFn: async (): Promise<GradeSubjectStatus[]> => {
      const statuses = await Promise.all(grades.map(fetchGradeStatus))
      return statuses
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export interface AuthorizeStudyPlanParams {
  gradeId: string
  gradeName: string
  phase: StudyPlanPhase
  subject: SubjectName
  institutionId?: string
  campusId?: string
}

export interface RevokeStudyPlanParams {
  gradeId: string
  phase: StudyPlanPhase
  subject: SubjectName
}

/**
 * Mutaciones para autorizar/revocar planes de estudio. Invalidan la caché automáticamente.
 */
export function useStudyPlanAuthorizationMutations() {
  const queryClient = useQueryClient()

  const authorize = useMutation({
    mutationFn: async (params: AuthorizeStudyPlanParams & { userId: string }) => {
      const result = await studyPlanAuthorizationService.authorizeStudyPlan(
        params.gradeId,
        params.gradeName,
        params.phase,
        params.subject,
        params.userId,
        params.institutionId,
        params.campusId
      )
      if (!result.success) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDY_PLAN_AUTH_KEYS.all })
    },
  })

  const revoke = useMutation({
    mutationFn: async (params: RevokeStudyPlanParams) => {
      const result = await studyPlanAuthorizationService.revokeStudyPlanAuthorization(
        params.gradeId,
        params.phase,
        params.subject
      )
      if (!result.success) throw result.error
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: STUDY_PLAN_AUTH_KEYS.all })
    },
  })

  return { authorize, revoke }
}

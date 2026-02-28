import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { phaseAuthorizationService } from '@/services/phase/phaseAuthorization.service';
import { dbService } from '@/services/firebase/db.service';
import type { GradePhaseCompletion, PhaseType } from '@/interfaces/phase.interface';
import type { GradeOption } from '@/hooks/query/useStudyPlanAuthorizations';

export interface GradePhaseStatus {
  gradeId: string;
  gradeName: string;
  institutionId: string;
  institutionName: string;
  campusId: string;
  campusName: string;
  totalStudents: number;
  phases: {
    first: { authorized: boolean; completion?: GradePhaseCompletion };
    second: { authorized: boolean; completion?: GradePhaseCompletion };
    third: { authorized: boolean; completion?: GradePhaseCompletion };
  };
}

const PHASE_AUTH_KEYS = {
  all: ['phaseAuthorizations'] as const,
  list: (gradeIds: string[]) => [...PHASE_AUTH_KEYS.all, 'list', { gradeIds: gradeIds.sort() }] as const,
};

const PHASES: PhaseType[] = ['first', 'second', 'third'];

async function fetchGradePhaseStatus(grade: GradeOption): Promise<GradePhaseStatus> {
  const authResult = await phaseAuthorizationService.getGradeAuthorizations(grade.value);
  const authorizations = authResult.success ? authResult.data : [];

  const studentsResult = await dbService.getFilteredStudents({
    gradeId: grade.value,
    isActive: true,
  });
  const totalStudents = studentsResult.success ? studentsResult.data.length : 0;

  const phaseStatus: GradePhaseStatus['phases'] = {
    first: { authorized: false },
    second: { authorized: false },
    third: { authorized: false },
  };

  for (const phase of PHASES) {
    const auth = authorizations.find((a) => a.phase === phase && a.authorized);
    phaseStatus[phase].authorized = !!auth;

    if (totalStudents > 0) {
      const completionResult = await phaseAuthorizationService.checkGradePhaseCompletion(
        grade.value,
        phase,
        totalStudents
      );
      if (completionResult.success) {
        phaseStatus[phase].completion = completionResult.data;
      }
    }
  }

  return {
    gradeId: grade.value,
    gradeName: grade.label,
    institutionId: grade.institutionId ?? '',
    institutionName: grade.institutionName ?? '',
    campusId: grade.campusId ?? '',
    campusName: grade.campusName ?? '',
    totalStudents,
    phases: phaseStatus,
  };
}

/**
 * Hook para cargar estados de autorización de fases por grado.
 * Usa React Query con caché de 2 minutos.
 */
export function usePhaseAuthorizations(grades: GradeOption[]) {
  const gradeIds = grades.map((g) => g.value);
  const enabled = gradeIds.length > 0;

  return useQuery({
    queryKey: PHASE_AUTH_KEYS.list(gradeIds),
    queryFn: async (): Promise<GradePhaseStatus[]> => {
      const statuses = await Promise.all(grades.map(fetchGradePhaseStatus));
      return statuses;
    },
    enabled,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  });
}

export interface AuthorizePhaseParams {
  gradeId: string;
  gradeName: string;
  phase: PhaseType;
  institutionId?: string;
  campusId?: string;
}

export interface RevokePhaseParams {
  gradeId: string;
  phase: PhaseType;
}

/**
 * Mutaciones para autorizar/revocar fases. Invalidan la caché automáticamente.
 */
export function usePhaseAuthorizationMutations() {
  const queryClient = useQueryClient();

  const authorize = useMutation({
    mutationFn: async (params: AuthorizePhaseParams & { userId: string }) => {
      const result = await phaseAuthorizationService.authorizePhase(
        params.gradeId,
        params.gradeName,
        params.phase,
        params.userId,
        params.institutionId,
        params.campusId
      );
      if (!result.success) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHASE_AUTH_KEYS.all });
    },
  });

  const revoke = useMutation({
    mutationFn: async (params: RevokePhaseParams) => {
      const result = await phaseAuthorizationService.revokePhaseAuthorization(params.gradeId, params.phase);
      if (!result.success) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PHASE_AUTH_KEYS.all });
    },
  });

  return { authorize, revoke };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthContext } from '@/context/AuthContext';
import { phaseAuthorizationService } from '@/services/phase/phaseAuthorization.service';
import { phaseAnalysisService } from '@/services/phase/phaseAnalysis.service';
import { PhaseType } from '@/interfaces/phase.interface';

/**
 * Hook para obtener el progreso de fases de un estudiante
 */
export function useStudentPhaseProgress(phase: PhaseType) {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['studentPhaseProgress', user?.uid, phase],
    queryFn: async () => {
      if (!user?.uid) return null;
      const result = await phaseAuthorizationService.getStudentPhaseProgress(user.uid, phase);
      return result.success ? result.data : null;
    },
    enabled: !!user?.uid,
  });
}

/**
 * Hook para verificar si un estudiante puede acceder a una fase
 */
export function usePhaseAccess(gradeId: string, phase: PhaseType) {
  const { user } = useAuthContext();

  return useQuery({
    queryKey: ['phaseAccess', user?.uid, gradeId, phase],
    queryFn: async () => {
      if (!user?.uid) return { canAccess: false };
      const result = await phaseAuthorizationService.canStudentAccessPhase(user.uid, gradeId, phase);
      return result.success ? result.data : { canAccess: false };
    },
    enabled: !!user?.uid && !!gradeId,
  });
}

/**
 * Hook para obtener autorizaciones de un grado
 */
export function useGradeAuthorizations(gradeId: string) {
  return useQuery({
    queryKey: ['gradeAuthorizations', gradeId],
    queryFn: async () => {
      const result = await phaseAuthorizationService.getGradeAuthorizations(gradeId);
      return result.success ? result.data : [];
    },
    enabled: !!gradeId,
  });
}

/**
 * Hook para obtener completitud de fase por grado
 */
export function useGradePhaseCompletion(gradeId: string, phase: PhaseType, totalStudents: number) {
  return useQuery({
    queryKey: ['gradePhaseCompletion', gradeId, phase, totalStudents],
    queryFn: async () => {
      const result = await phaseAuthorizationService.checkGradePhaseCompletion(gradeId, phase, totalStudents);
      return result.success ? result.data : null;
    },
    enabled: !!gradeId && totalStudents > 0,
  });
}

/**
 * Hook para mutaciones de autorización de fases
 */
export function usePhaseAuthorizationMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const authorizePhase = useMutation({
    mutationFn: async ({
      gradeId,
      gradeName,
      phase,
      institutionId,
      campusId,
    }: {
      gradeId: string;
      gradeName: string;
      phase: PhaseType;
      institutionId?: string;
      campusId?: string;
    }) => {
      if (!user?.uid) throw new Error('Usuario no autenticado');
      const result = await phaseAuthorizationService.authorizePhase(
        gradeId,
        gradeName,
        phase,
        user.uid,
        institutionId,
        campusId
      );
      if (!result.success) throw result.error;
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gradeAuthorizations', variables.gradeId] });
      queryClient.invalidateQueries({ queryKey: ['phaseAccess'] });
    },
  });

  const revokePhase = useMutation({
    mutationFn: async ({ gradeId, phase }: { gradeId: string; phase: PhaseType }) => {
      const result = await phaseAuthorizationService.revokePhaseAuthorization(gradeId, phase);
      if (!result.success) throw result.error;
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['gradeAuthorizations', variables.gradeId] });
      queryClient.invalidateQueries({ queryKey: ['phaseAccess'] });
    },
  });

  return {
    authorizePhase,
    revokePhase,
  };
}

/**
 * Hook para actualizar progreso de estudiante
 */
export function useStudentProgressMutations() {
  const queryClient = useQueryClient();
  const { user } = useAuthContext();

  const updateProgress = useMutation({
    mutationFn: async ({
      gradeId,
      phase,
      subject,
      completed,
    }: {
      gradeId: string;
      phase: PhaseType;
      subject: string;
      completed: boolean;
    }) => {
      if (!user?.uid) throw new Error('Usuario no autenticado');
      const result = await phaseAuthorizationService.updateStudentPhaseProgress(
        user.uid,
        gradeId,
        phase,
        subject,
        completed
      );
      if (!result.success) throw result.error;
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ 
        queryKey: ['studentPhaseProgress', user?.uid, variables.phase] 
      });
    },
  });

  return {
    updateProgress,
  };
}

/**
 * Hook para análisis de resultados
 */
export function usePhaseAnalysisMutations() {
  const queryClient = useQueryClient();

  const analyzePhase1 = useMutation({
    mutationFn: async ({
      studentId,
      subject,
      examResult,
    }: {
      studentId: string;
      subject: string;
      examResult: any;
    }) => {
      const result = await phaseAnalysisService.analyzePhase1Results(studentId, subject, examResult);
      if (!result.success) throw result.error;
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['phase1Analyses'] });
    },
  });

  const generatePhase2Distribution = useMutation({
    mutationFn: async ({
      studentId,
      subject,
      totalQuestions,
    }: {
      studentId: string;
      subject: string;
      totalQuestions: number;
    }) => {
      const result = await phaseAnalysisService.generatePhase2Distribution(
        studentId,
        subject,
        totalQuestions
      );
      if (!result.success) throw result.error;
      return result.data;
    },
  });

  const analyzeProgress = useMutation({
    mutationFn: async ({
      studentId,
      subject,
      phase1Result,
      phase2Result,
    }: {
      studentId: string;
      subject: string;
      phase1Result: any;
      phase2Result: any;
    }) => {
      const result = await phaseAnalysisService.analyzeProgress(
        studentId,
        subject,
        phase1Result,
        phase2Result
      );
      if (!result.success) throw result.error;
      return result.data;
    },
  });

  const generatePhase3Result = useMutation({
    mutationFn: async ({
      studentId,
      subject,
      examResult,
    }: {
      studentId: string;
      subject: string;
      examResult: any;
    }) => {
      const result = await phaseAnalysisService.generatePhase3Result(studentId, subject, examResult);
      if (!result.success) throw result.error;
      return result.data;
    },
  });

  return {
    analyzePhase1,
    generatePhase2Distribution,
    analyzeProgress,
    generatePhase3Result,
  };
}



import { useQuery } from "@tanstack/react-query";
import {
  fetchPhaseStatusForStudent,
  type PhaseState,
  ALL_SUBJECTS,
} from "@/services/phase/phaseStatusData.service";
import type { PhaseType } from "@/interfaces/phase.interface";

export const phaseStatusKeys = {
  all: ["phase-status"] as const,
  student: (userId: string) => [...phaseStatusKeys.all, userId] as const,
};

/**
 * Hook centralizado para el estado de fases por materia del estudiante.
 * Una sola carga con caché React Query; SubjectPhaseStatus, Intento y PhaseDashboard lo reutilizan.
 */
export function usePhaseStatusForSubjects(userId: string | undefined) {
  const query = useQuery({
    queryKey: phaseStatusKeys.student(userId ?? ""),
    queryFn: () => fetchPhaseStatusForStudent(userId!),
    enabled: !!userId,
    staleTime: 2 * 60 * 1000,
    gcTime: 8 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const data = query.data;

  return {
    phaseStatesBySubject: data?.phaseStatesBySubject ?? {},
    isPhase3Complete: data?.isPhase3Complete ?? false,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

/** Obtiene el estado de fases para una materia */
export function getPhaseStatesForSubject(
  phaseStatesBySubject: Record<string, Record<PhaseType, PhaseState>>,
  subject: string
): Record<PhaseType, PhaseState> {
  const found = phaseStatesBySubject[subject];
  if (found) return found;

  return {
    first: {
      phase: "first",
      canAccess: false,
      isCompleted: false,
      isInProgress: false,
      isExamCompleted: false,
      allSubjectsCompleted: false,
    },
    second: {
      phase: "second",
      canAccess: false,
      isCompleted: false,
      isInProgress: false,
      isExamCompleted: false,
      allSubjectsCompleted: false,
    },
    third: {
      phase: "third",
      canAccess: false,
      isCompleted: false,
      isInProgress: false,
      isExamCompleted: false,
      allSubjectsCompleted: false,
    },
  };
}

export { ALL_SUBJECTS, type PhaseState };

/** Calcula qué fase mostrar según el estado (disponible, bloqueada, etc.) */
export function computeAvailablePhase(
  phaseStates: Record<PhaseType, PhaseState>
): PhaseType {
  for (const phase of ["first", "second", "third"] as PhaseType[]) {
    const state = phaseStates[phase];
    const nextPhase: PhaseType | null =
      phase === "first" ? "second" : phase === "second" ? "third" : null;
    const nextPhaseAuthorized = nextPhase
      ? phaseStates[nextPhase].canAccess
      : false;
    const isBlocked =
      state.isExamCompleted &&
      !state.allSubjectsCompleted &&
      !nextPhaseAuthorized;

    if (state.canAccess && !isBlocked && !state.isExamCompleted && !state.isCompleted) {
      return phase;
    }
  }

  for (const phase of ["first", "second", "third"] as PhaseType[]) {
    const state = phaseStates[phase];
    const nextPhase: PhaseType | null =
      phase === "first" ? "second" : phase === "second" ? "third" : null;
    const nextPhaseAuthorized = nextPhase
      ? phaseStates[nextPhase].canAccess
      : false;
    const isBlocked =
      state.isExamCompleted &&
      !state.allSubjectsCompleted &&
      !nextPhaseAuthorized;

    if (isBlocked && state.canAccess) return phase;
  }

  for (const phase of ["first", "second", "third"] as PhaseType[]) {
    const state = phaseStates[phase];
    if (state.canAccess && !state.isExamCompleted) return phase;
  }

  return "first";
}

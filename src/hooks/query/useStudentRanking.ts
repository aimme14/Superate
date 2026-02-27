import { useQuery } from "@tanstack/react-query";
import {
  fetchStudentRanking,
  type StudentRankingResult,
} from "@/services/ranking/studentRanking.service";
import type { PhaseType } from "@/utils/firestoreHelpers";

export type RankingPhase = "phase1" | "phase2" | "phase3";

const PHASE_TO_SERVICE: Record<RankingPhase, PhaseType> = {
  phase1: "first",
  phase2: "second",
  phase3: "third",
};

export const studentRankingKeys = {
  all: ["student-ranking"] as const,
  detail: (userId: string, phase: RankingPhase) =>
    [...studentRankingKeys.all, userId, phase] as const,
};

interface UseStudentRankingParams {
  userId: string | undefined;
  phase: RankingPhase | "all";
  /** Puntaje precalculado del estudiante actual (evita fetch duplicado) */
  currentStudentScore?: number;
  /** Habilitar query; ej. false cuando tab ≠ overview/diagnosis para lazy load */
  enabled?: boolean;
}

/**
 * Hook para obtener el puesto/ranking del estudiante en su grado.
 * Usa React Query para caché y paraleliza lecturas de Firestore.
 */
export function useStudentRanking({
  userId,
  phase,
  currentStudentScore,
  enabled = true,
}: UseStudentRankingParams) {
  const phaseForQuery = phase === "all" ? "phase1" : phase;
  const servicePhase = PHASE_TO_SERVICE[phaseForQuery];

  const query = useQuery({
    queryKey: studentRankingKeys.detail(userId ?? "", phaseForQuery),
    queryFn: () =>
      fetchStudentRanking({
        userId: userId!,
        phase: servicePhase,
        currentStudentScore,
      }),
    enabled: !!enabled && !!userId && phase !== "all",
    staleTime: 3 * 60 * 1000, // 3 min - ranking cambia al presentar exámenes
    gcTime: 8 * 60 * 1000, // 8 min
  });

  const data = query.data as StudentRankingResult | undefined;

  return {
    rank: data?.rank ?? null,
    totalInPhase: data?.totalInPhase ?? null,
    totalInGrade: data?.totalInGrade ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError,
    refetch: query.refetch,
  };
}

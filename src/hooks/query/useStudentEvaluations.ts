import { useQuery } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { useAuthContext } from "@/context/AuthContext";
import { ESTUDIANTE_SESSION_CACHE } from "@/config/rutaPreparacionCache";
import { fetchEvaluationsFromStudentSummary } from "@/services/studentProgressSummary/fetchEvaluationsFromSummary";
import type { ExamResult, ExamScore } from "@/hooks/query/studentEvaluations.types";
import { phaseStatusKeys } from "@/hooks/query/usePhaseStatusForSubjects";

export type { ExamResult, ExamScore };

/**
 * Evaluaciones del estudiante solo desde `userLookup` + `studentSummaries`
 * (actualizado en backend al presentar cada examen).
 */
export async function fetchEvaluations(userId: string): Promise<ExamResult[]> {
  const list = await fetchEvaluationsFromStudentSummary(userId);
  return [...list].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
}

const EVALUATIONS_QUERY_KEY = ["student-evaluations"] as const;

/**
 * Hook para obtener las evaluaciones del estudiante autenticado.
 * Usa React Query para caché: al navegar entre secciones, los datos se sirven desde caché.
 */
export function useStudentEvaluations() {
  const { user } = useAuthContext();
  const userId = user?.uid ?? "";

  return useQuery({
    queryKey: [...EVALUATIONS_QUERY_KEY, userId],
    queryFn: () => fetchEvaluations(userId),
    enabled: !!userId,
    ...ESTUDIANTE_SESSION_CACHE,
  });
}

/** Clave de query para invalidar evaluaciones (ej. tras enviar un examen). */
export { EVALUATIONS_QUERY_KEY };

/**
 * Tras escribir en `results/`, React Query debe olvidar la caché que lee `studentSummaries`.
 * Hay dos matices:
 * - La invalidación por prefijo `["student-evaluations"]` cubre `["student-evaluations", uid]`.
 * - El resumen denormalizado se escribe en Cloud Function (asíncrono): el primer refetch puede
 *   llegar antes de que exista el doc actualizado; por eso se programa un segundo invalidate.
 */
export function invalidateStudentEvaluationsAfterExamSave(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: [...EVALUATIONS_QUERY_KEY] });
  void queryClient.invalidateQueries({ queryKey: [...phaseStatusKeys.all] });
  setTimeout(() => {
    void queryClient.invalidateQueries({ queryKey: [...EVALUATIONS_QUERY_KEY] });
  }, 2500);
}

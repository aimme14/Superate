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
 * Tras escribir en `results/`, sincroniza la caché que lee `studentSummaries` vía userLookup.
 * - Invalidación por prefijo cubre todas las queries `student-evaluations`.
 * - Con `userId`, fuerza refetch activo de ese estudiante (mejor que solo marcar stale con staleTime ∞).
 * - La Cloud Function escribe el resumen de forma asíncrona: refuerzos a 2,5s y 5s.
 */
function refreshStudentEvaluationsQueries(
  queryClient: QueryClient,
  userId: string | undefined
): void {
  void queryClient.invalidateQueries({ queryKey: [...EVALUATIONS_QUERY_KEY] });
  if (userId) {
    void queryClient.invalidateQueries({
      queryKey: [...EVALUATIONS_QUERY_KEY, userId],
    });
    void queryClient.refetchQueries({
      queryKey: [...EVALUATIONS_QUERY_KEY, userId],
      type: 'active',
    });
  }
}

export function invalidateStudentEvaluationsAfterExamSave(
  queryClient: QueryClient,
  userId?: string
): void {
  refreshStudentEvaluationsQueries(queryClient, userId);
  void queryClient.invalidateQueries({ queryKey: [...phaseStatusKeys.all] });
  setTimeout(() => refreshStudentEvaluationsQueries(queryClient, userId), 2500);
  setTimeout(() => refreshStudentEvaluationsQueries(queryClient, userId), 5000);
}

import { useQuery } from "@tanstack/react-query";
import { useAuthContext } from "@/context/AuthContext";
import { ESTUDIANTE_SESSION_CACHE } from "@/config/rutaPreparacionCache";
import { fetchEvaluationsFromStudentSummary } from "@/services/studentProgressSummary/fetchEvaluationsFromSummary";
import type { ExamResult, ExamScore } from "@/hooks/query/studentEvaluations.types";

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

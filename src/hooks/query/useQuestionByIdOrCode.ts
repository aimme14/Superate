import { useQuery } from "@tanstack/react-query";
import {
  questionService,
  type Question,
} from "@/services/firebase/question.service";
import { QUESTION_BANK_SESSION_CACHE } from "@/config/rutaPreparacionCache";

const QUESTION_QUERY_KEY = ["question-bank"] as const;

/**
 * Obtiene una pregunta del banco por id de documento o por código.
 * Lanza si no existe o falla la red (para que React Query marque error).
 */
export async function fetchQuestionByIdOrCode(
  identifier: string
): Promise<Question> {
  const result = await questionService.getQuestionByIdOrCode(identifier);
  if (!result.success) {
    throw new Error(
      result.error?.message ?? "No se pudo cargar la pregunta completa"
    );
  }
  return result.data;
}

/**
 * Pregunta del banco: caché en memoria + persistida en `localStorage` (mismo mecanismo que evaluaciones).
 * Repetir el mismo id no refetch; sobrevive al cerrar el navegador; se borra al cerrar sesión (`clearPersistedCache`).
 */
export function useQuestionByIdOrCode(
  identifier: string | null,
  enabled: boolean
) {
  return useQuery({
    queryKey: [...QUESTION_QUERY_KEY, identifier],
    queryFn: () => fetchQuestionByIdOrCode(identifier!),
    enabled: Boolean(identifier) && enabled,
    ...QUESTION_BANK_SESSION_CACHE,
  });
}

export { QUESTION_QUERY_KEY };

import { useMemo } from 'react'
import type { Question } from '@/services/firebase/question.service'
import { getCombinedItems } from '@/components/admin/questionBank/questionBankUtils'

/**
 * Hook que memoiza la lógica de agrupación de preguntas (Cloze, Comprensión de Lectura, Matching).
 * Retorna combinedItems ordenados por fecha (más reciente primero).
 */
export function useQuestionGrouping(
  filteredQuestions: Question[],
  allQuestions: Question[]
) {
  return useMemo(
    () => getCombinedItems(filteredQuestions, allQuestions),
    [filteredQuestions, allQuestions]
  )
}

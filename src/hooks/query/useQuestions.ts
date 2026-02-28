import { useQuery, useQueryClient } from '@tanstack/react-query'
import { questionService } from '@/services/firebase/question.service'
import type { Question, QuestionFilters } from '@/services/firebase/question.service'

export const QUESTIONS_KEYS = {
  all: ['questions'] as const,
  list: (filters: QuestionFilters) => [...QUESTIONS_KEYS.all, 'list', filters] as const,
  stats: () => [...QUESTIONS_KEYS.all, 'stats'] as const,
}

/**
 * Hook para cargar preguntas con filtros de servidor (subjectCode, topicCode, grade, levelCode).
 * Filtros adicionales (searchTerm, filterAIInconsistency) se aplican en cliente.
 */
export function useQuestions(filters: QuestionFilters = {}) {
  const serverFilters = {
    ...(filters.subjectCode && { subjectCode: filters.subjectCode }),
    ...(filters.topicCode && { topicCode: filters.topicCode }),
    ...(filters.grade && { grade: filters.grade }),
    ...(filters.levelCode && { levelCode: filters.levelCode }),
  }

  return useQuery({
    queryKey: QUESTIONS_KEYS.list(serverFilters),
    queryFn: async (): Promise<Question[]> => {
      const result = await questionService.getFilteredQuestions(serverFilters)
      if (!result.success) throw result.error
      return result.data
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

/**
 * Hook para estadísticas del banco (optimizado con getCountFromServer).
 */
export function useQuestionStats() {
  return useQuery({
    queryKey: QUESTIONS_KEYS.stats(),
    queryFn: async () => {
      const result = await questionService.getQuestionStatsOptimized()
      if (!result.success) throw result.error
      return result.data
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

/**
 * Invalidar caché de preguntas y stats (para usar tras mutaciones).
 */
export function useInvalidateQuestions() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: QUESTIONS_KEYS.all })
  }
}

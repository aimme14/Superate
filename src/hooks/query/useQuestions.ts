import { InfiniteData, useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import { ADMIN_LIST_CACHE } from '@/config/adminQueryCache'
import { questionService } from '@/services/firebase/question.service'
import type {
  Question,
  QuestionFilters,
  PaginatedQuestions,
  QuestionCursor,
} from '@/services/firebase/question.service'

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
    ...ADMIN_LIST_CACHE,
  })
}

/**
 * Hook paginado para el banco de preguntas (cursor pagination).
 * Reduce lecturas porque no descarga todo el banco de una vez.
 */
export function useQuestionsInfinite(
  filters: QuestionFilters = {},
  pageSize: number = 10,
  enabled: boolean = true
) {
  const serverFilters = {
    ...(filters.subjectCode && { subjectCode: filters.subjectCode }),
    ...(filters.topicCode && { topicCode: filters.topicCode }),
    ...(filters.grade && { grade: filters.grade }),
    ...(filters.levelCode && { levelCode: filters.levelCode }),
  }

  return useInfiniteQuery({
    queryKey: [...QUESTIONS_KEYS.list(serverFilters), 'infinite', pageSize],
    queryFn: async ({ pageParam }): Promise<PaginatedQuestions> => {
      const cursor = pageParam as QuestionCursor | undefined
      const result = await questionService.getFilteredQuestionsPaginated(serverFilters, pageSize, cursor)
      if (!result.success) throw result.error
      return result.data
    },
    enabled,
    initialPageParam: undefined as QuestionCursor | undefined,
    getNextPageParam: (lastPage) => {
      if (!lastPage.hasMore) return undefined
      return lastPage.nextCursor
    },
    ...ADMIN_LIST_CACHE,
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
    ...ADMIN_LIST_CACHE,
  })
}

/**
 * Invalidar caché de preguntas y stats (para usar tras mutaciones).
 */
export function useInvalidateQuestions() {
  const queryClient = useQueryClient()
  return () => {
    // Invalida solo listados/paginado, no stats (para reducir lecturas).
    queryClient.invalidateQueries({
      queryKey: [...QUESTIONS_KEYS.all, 'list'],
      exact: false,
    })
  }
}

/**
 * Acciones de caché para mutaciones sin recargar todas las páginas.
 */
export function useQuestionCacheActions() {
  const queryClient = useQueryClient()

  const updateInfiniteQuestions = (
    mapper: (items: Question[]) => Question[]
  ) => {
    queryClient.setQueriesData(
      {
        predicate: (query) => {
          const key = query.queryKey
          return (
            Array.isArray(key) &&
            key[0] === QUESTIONS_KEYS.all[0] &&
            key[1] === 'list' &&
            key.includes('infinite')
          )
        },
      },
      (oldData: InfiniteData<PaginatedQuestions, QuestionCursor | undefined> | undefined) => {
        if (!oldData || !oldData.pages?.length) return oldData

        return {
          ...oldData,
          pages: oldData.pages.map((page) => ({
            ...page,
            items: mapper(page.items),
          })),
        }
      }
    )
  }

  const prependCreatedQuestions = (createdQuestions: Question[]) => {
    if (!createdQuestions.length) return

    queryClient.setQueriesData(
      {
        predicate: (query) => {
          const key = query.queryKey
          return (
            Array.isArray(key) &&
            key[0] === QUESTIONS_KEYS.all[0] &&
            key[1] === 'list' &&
            key.includes('infinite')
          )
        },
      },
      (oldData: InfiniteData<PaginatedQuestions, QuestionCursor | undefined> | undefined) => {
        if (!oldData || !oldData.pages?.length) return oldData

        const firstPage = oldData.pages[0]
        const existingIds = new Set(firstPage.items.map((q) => q.id))
        const uniqueNew = createdQuestions.filter((q) => q.id && !existingIds.has(q.id))
        if (!uniqueNew.length) return oldData

        const updatedFirstPage: PaginatedQuestions = {
          ...firstPage,
          items: [...uniqueNew, ...firstPage.items],
        }

        return {
          ...oldData,
          pages: [updatedFirstPage, ...oldData.pages.slice(1)],
        }
      }
    )
  }

  const invalidateQuestionStats = () => {
    queryClient.invalidateQueries({ queryKey: QUESTIONS_KEYS.stats() })
  }

  const upsertQuestions = (questionsToUpsert: Question[]) => {
    const validQuestions = questionsToUpsert.filter((q) => !!q.id)
    if (!validQuestions.length) return

    const byId = new Map(validQuestions.map((q) => [q.id as string, q]))
    updateInfiniteQuestions((items) => items.map((item) => byId.get(item.id || '') ?? item))
  }

  const removeQuestionsByIds = (questionIds: string[]) => {
    if (!questionIds.length) return
    const ids = new Set(questionIds.filter(Boolean))
    if (!ids.size) return

    updateInfiniteQuestions((items) => items.filter((item) => !item.id || !ids.has(item.id)))
  }

  return {
    prependCreatedQuestions,
    invalidateQuestionStats,
    upsertQuestions,
    removeQuestionsByIds,
  }
}

/**
 * Busca una pregunta exacta por su código.
 * Se usa cuando el usuario escribe un `code` completo en el campo de búsqueda.
 */
export function useQuestionByCode(code: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...QUESTIONS_KEYS.all, 'by-code', code],
    queryFn: async (): Promise<Question | null> => {
      if (!code) return null
      const result = await questionService.getQuestionByCode(code)
      if (!result.success) {
        // Si no existe, devolvemos null (no disparamos error en UI).
        if ((result.error as any)?.statusCode === 404) return null
        throw result.error
      }
      return result.data
    },
    enabled: enabled && !!code,
    staleTime: 24 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

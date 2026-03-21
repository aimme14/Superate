import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  aiToolsService,
  type AIToolData,
  type AIToolCursor,
  type PaginatedAITools,
} from '@/services/firebase/aiTools.service'

export const AI_TOOLS_KEYS = {
  all: ['aiTools'] as const,
  list: () => [...AI_TOOLS_KEYS.all, 'list'] as const,
}

/**
 * Hook para cargar herramientas IA. Carga automáticamente al montar.
 */
export function useAITools() {
  return useQuery({
    queryKey: AI_TOOLS_KEYS.list(),
    queryFn: async (): Promise<AIToolData[]> => {
      const res = await aiToolsService.getAll()
      if (!res.success) throw res.error
      return res.data
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
  })
}

export function useAIToolsInfinite(pageSize: number = 10) {
  return useInfiniteQuery({
    queryKey: [...AI_TOOLS_KEYS.list(), 'infinite', pageSize],
    queryFn: async ({ pageParam }): Promise<PaginatedAITools> => {
      const cursor = pageParam as AIToolCursor | undefined
      const res = await aiToolsService.getAllPaginated(pageSize, cursor)
      if (!res.success) throw res.error
      return res.data
    },
    initialPageParam: undefined as AIToolCursor | undefined,
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.nextCursor : undefined),
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
}

/**
 * Invalidar caché de herramientas IA (para usar tras mutaciones).
 */
export function useInvalidateAITools() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: AI_TOOLS_KEYS.all })
  }
}

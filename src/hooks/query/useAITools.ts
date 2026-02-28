import { useQuery, useQueryClient } from '@tanstack/react-query'
import { aiToolsService, type AIToolData } from '@/services/firebase/aiTools.service'

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

/**
 * Invalidar caché de herramientas IA (para usar tras mutaciones).
 */
export function useInvalidateAITools() {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: AI_TOOLS_KEYS.all })
  }
}

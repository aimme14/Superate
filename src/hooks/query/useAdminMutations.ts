import { useMutation, useQueryClient } from '@tanstack/react-query'
import { recalculateStudentCounts } from '@/controllers/admin.controller'
import { useNotification } from '@/hooks/ui/useNotification'

/**
 * Hook para mutaciones administrativas
 */
export const useAdminMutations = () => {
  const queryClient = useQueryClient()
  const { notifySuccess, notifyError } = useNotification()

  // Mutación para recalcular contadores de estudiantes
  const recalculateCounts = useMutation({
    mutationFn: recalculateStudentCounts,
    onSuccess: () => {
      // Invalidar todas las consultas relacionadas con estadísticas
      queryClient.invalidateQueries({ queryKey: ['institution-stats'] })
      queryClient.invalidateQueries({ queryKey: ['teachers'] })
      queryClient.invalidateQueries({ queryKey: ['principals'] })
      queryClient.invalidateQueries({ queryKey: ['rectors'] })
      queryClient.invalidateQueries({ queryKey: ['students'] })
      queryClient.invalidateQueries({ queryKey: ['institutions'] })
      
      notifySuccess('Contadores de estudiantes recalculados exitosamente')
    },
    onError: (error: any) => {
      console.error('Error al recalcular contadores:', error)
      notifyError('Error al recalcular contadores de estudiantes')
    }
  })

  return {
    recalculateCounts: recalculateCounts.mutate,
    isRecalculating: recalculateCounts.isPending
  }
}

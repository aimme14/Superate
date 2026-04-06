import { useEffect } from 'react'
import type { Question } from '@/services/firebase/question.service'
import {
  collectImageUrlsFromQuestion,
  collectImageUrlsFromQuestions,
  prefetchImageUrls,
  scheduleIdlePrefetch,
} from '@/utils/quiz/prefetchQuestionImages'

/**
 * Precarga imágenes de las siguientes preguntas mientras el estudiante está en la actual.
 */
export function usePrefetchAdjacentQuizImagesLinear(
  enabled: boolean,
  questions: Question[] | null | undefined,
  currentIndex: number
): void {
  useEffect(() => {
    if (!enabled || !questions?.length) return

    const next = questions[currentIndex + 1]
    if (next) {
      prefetchImageUrls(collectImageUrlsFromQuestion(next))
    }

    const next2 = questions[currentIndex + 2]
    if (next2) {
      scheduleIdlePrefetch(() => {
        prefetchImageUrls(collectImageUrlsFromQuestion(next2))
      })
    }
  }, [enabled, questions, currentIndex])
}

/**
 * Igual que linear pero por grupos (examen de inglés: siguiente bloque de preguntas).
 */
export function usePrefetchAdjacentQuizImagesGroups(
  enabled: boolean,
  groups: Question[][] | null | undefined,
  currentGroupIndex: number
): void {
  useEffect(() => {
    if (!enabled || !groups?.length) return

    const nextGroup = groups[currentGroupIndex + 1]
    if (nextGroup?.length) {
      prefetchImageUrls(collectImageUrlsFromQuestions(nextGroup))
    }

    const nextGroup2 = groups[currentGroupIndex + 2]
    if (nextGroup2?.length) {
      scheduleIdlePrefetch(() => {
        prefetchImageUrls(collectImageUrlsFromQuestions(nextGroup2))
      })
    }
  }, [enabled, groups, currentGroupIndex])
}
